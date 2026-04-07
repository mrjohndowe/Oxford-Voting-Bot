// =========================
// OXFORD VOTING SYSTEM (OPTIMIZED)
// =========================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');

const config = require('./config');

// =========================
// CLIENT SETUP
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

// =========================
// FILE PATHS
// =========================

const motionsFile = path.resolve(__dirname, './motions.json');
const eventsFile = path.resolve(__dirname, './events.json');
const housesFile = path.resolve(__dirname, './houses.json');

let motions = [];
let events = [];
let houseConfigs = {};

// =========================
// MEMBER CACHE (KEY FIX)
// =========================

const roleMemberCache = new Map(); // guildId -> Set(memberIds)

// Build cache
function rebuildRoleCache(guild) {
  const roleId = getMembersRoleId(guild);
  if (!roleId) return;

  const role = guild.roles.cache.get(roleId);
  if (!role) return;

  const ids = new Set(
    role.members
      .filter(m => !m.user.bot)
      .map(m => m.id)
  );

  roleMemberCache.set(guild.id, ids);
}

// Get cached members
function getEligibleMembers(guild) {
  const cached = roleMemberCache.get(guild.id);
  if (!cached) return [];

  return [...cached].map(id => guild.members.cache.get(id)).filter(Boolean);
}

// =========================
// SAFE FETCH (ONLY ONCE)
// =========================

const lastFetch = new Map();

async function safeFetchMembers(guild) {
  const now = Date.now();
  const last = lastFetch.get(guild.id) || 0;

  if (now - last < 60000) return;

  lastFetch.set(guild.id, now);

  try {
    await guild.members.fetch();
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

// =========================
// JSON HELPERS
// =========================

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// =========================
// LOAD DATA
// =========================

function loadAll() {
  motions = loadJson(motionsFile, []);
  events = loadJson(eventsFile, []);
  houseConfigs = loadJson(housesFile, {});
}

// =========================
// SETTINGS HELPERS
// =========================

function getMembersRoleId(guild) {
  return houseConfigs[guild.id]?.roleId || config.roleId;
}

// =========================
// QUORUM
// =========================

function calculateQuorum(total) {
  return Math.floor(total / 2) + 1;
}

// =========================
// EMBED
// =========================

function buildMotionEmbed(guild, motion) {
  const members = getEligibleMembers(guild);
  const total = members.length;
  const quorum = calculateQuorum(total);

  return new EmbedBuilder()
    .setTitle('Oxford House Motion')
    .setDescription(motion.text)
    .addFields(
      { name: 'Ayes', value: String(motion.ayes.length), inline: true },
      { name: 'Nays', value: String(motion.nays.length), inline: true },
      { name: 'Members', value: String(total), inline: true },
      { name: 'Quorum', value: `${motion.ayes.length + motion.nays.length}/${quorum}` }
    )
    .setFooter({ text: '© 2026 Mr John Dowe' });
}

// =========================
// BUTTON PARSER FIXED
// =========================

function parseAction(id) {
  const prefixes = [
    'close_event_', // FIXED ORDER
    'second_',
    'aye_',
    'nay_',
    'close_',
    'withdraw_',
  ];

  for (const p of prefixes) {
    if (id.startsWith(p)) {
      return {
        action: p.replace('_', ''),
        id: id.slice(p.length),
      };
    }
  }

  return {};
}

// =========================
// READY
// =========================

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  loadAll();

  for (const guild of client.guilds.cache.values()) {
    await safeFetchMembers(guild);
    rebuildRoleCache(guild);
  }
});

// =========================
// CACHE LIVE UPDATES
// =========================

client.on(Events.GuildMemberAdd, member => {
  rebuildRoleCache(member.guild);
});

client.on(Events.GuildMemberRemove, member => {
  rebuildRoleCache(member.guild);
});

client.on(Events.GuildMemberUpdate, (oldM, newM) => {
  rebuildRoleCache(newM.guild);
});

// =========================
// COMMANDS
// =========================

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === 'motion') {
    const motion = {
      id: Date.now().toString(),
      text: 'Example motion',
      ayes: [],
      nays: [],
      status: 'Open',
    };

    motions.push(motion);
    saveJson(motionsFile, motions);

    await i.reply({
      embeds: [buildMotionEmbed(i.guild, motion)],
    });
  }
});

// =========================
// START
// =========================

client.login(config.token);