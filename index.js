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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember],
});

const motionsFile = path.resolve(__dirname, config.jsonFile || './motions.json');
const eventsFile = path.resolve(__dirname, config.eventsFile || './events.json');
const housesFile = path.resolve(__dirname, config.houseConfigFile || './houses.json');

let motions = [];
let events = [];
let houseConfigs = {};

/* =========================
   CONFIG HELPERS
========================= */

function getBotToken() {
  return String(config.discord?.token || config.token || '').trim();
}

function getClientId() {
  return String(config.discord?.clientId || config.clientId || '').trim();
}

function isDebugEnabled() {
  return Boolean(config.debug ?? false);
}

function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log(...args);
  }
}

function getEventNotificationConfig() {
  return config.eventNotifications || {};
}

function getEventReminderHoursBefore() {
  const raw = getEventNotificationConfig().reminderHoursBefore;
  const values = Array.isArray(raw) ? raw : [24, 2];
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b - a);
}

function getEventDmNonRespondersOnly() {
  return Boolean(getEventNotificationConfig().dmNonRespondersOnly ?? true);
}

function getEventReminderCheckIntervalMinutes() {
  const value = Number(getEventNotificationConfig().reminderCheckIntervalMinutes ?? getReminderCheckIntervalMinutes());
  return Number.isFinite(value) && value > 0 ? value : getReminderCheckIntervalMinutes();
}

function getEventDmRemindersEnabled() {
  return Boolean(getEventNotificationConfig().dmReminders ?? true);
}

function getEventChannelRemindersEnabled() {
  return Boolean(getEventNotificationConfig().channelReminders ?? true);
}

function getWebSyncConfig() {
  return config.webSync || {};
}

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function ensureLeadingSlash(value) {
  const clean = String(value || '').trim();
  if (!clean) {
    return '';
  }
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function getResolvedEventsEndpoint() {
  const syncConfig = getWebSyncConfig();
  const explicitEndpoint = String(syncConfig.eventsEndpoint || process.env.WEB_SYNC_EVENTS_ENDPOINT || '').trim();
  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  const autoDetect = Boolean(syncConfig.autoDetectFromBaseUrl ?? true);
  if (!autoDetect) {
    return '';
  }

  const baseUrl = trimTrailingSlash(process.env.WEB_SYNC_BASE_URL || syncConfig.baseUrl || config.publicBaseUrl || '');
  const endpointPath = ensureLeadingSlash(syncConfig.endpointPath || '/web/events_sync.php');

  if (!baseUrl) {
    return '';
  }

  return `${baseUrl}${endpointPath}`;
}

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read JSON from ${filePath}:`, error);
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write JSON to ${filePath}:`, error);
  }
}

function ensureDirectoryForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadMotions() {
  motions = safeReadJson(motionsFile, []);
  if (!Array.isArray(motions)) {
    motions = [];
  }
  console.log(`Loaded ${motions.length} motion(s) from JSON.`);
}

function saveMotions() {
  ensureDirectoryForFile(motionsFile);
  safeWriteJson(motionsFile, motions);
}

function loadEvents() {
  events = safeReadJson(eventsFile, []);
  if (!Array.isArray(events)) {
    events = [];
  }
  console.log(`Loaded ${events.length} event(s) from JSON.`);
}

function saveEvents() {
  ensureDirectoryForFile(eventsFile);
  safeWriteJson(eventsFile, events);
  void syncEventsToWebPanel();
}

function migrateLegacyEventsFromMotions() {
  // Legacy migration intentionally disabled. motions.json and events.json remain fully separate.
}

function loadHouseConfigs() {
  houseConfigs = safeReadJson(housesFile, {});
  if (!houseConfigs || typeof houseConfigs !== 'object' || Array.isArray(houseConfigs)) {
    houseConfigs = {};
  }
  console.log(`Loaded ${Object.keys(houseConfigs).length} house setup record(s) from JSON.`);
}

function saveHouseConfigs() {
  ensureDirectoryForFile(housesFile);
  safeWriteJson(housesFile, houseConfigs);
}

async function syncEventsToWebPanel() {
  const syncConfig = getWebSyncConfig();
  const endpoint = getResolvedEventsEndpoint();
  if (!syncConfig.enabled || !endpoint) {
    return;
  }

  try {
    await axios.post(endpoint, {
      source: 'oxford-voting-bot',
      syncedAt: new Date().toISOString(),
      endpointAutoDetected: !String(syncConfig.eventsEndpoint || process.env.WEB_SYNC_EVENTS_ENDPOINT || '').trim(),
      events,
    }, {
      timeout: Number(syncConfig.timeoutMs || 10000),
      headers: syncConfig.apiKey ? { 'x-oxford-api-key': syncConfig.apiKey } : {},
    });
  } catch (error) {
    console.error('Event web sync failed:', error.message || error);
  }
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getGuildSetup(guildOrId) {
  const guildId = typeof guildOrId === 'string' ? guildOrId : guildOrId?.id;
  return guildId ? (houseConfigs[guildId] || null) : null;
}

function setGuildSetup(guildId, data) {
  houseConfigs[guildId] = {
    ...(houseConfigs[guildId] || {}),
    ...data,
    guildId,
    updatedAt: new Date().toISOString(),
  };
  saveHouseConfigs();
  return houseConfigs[guildId];
}

function getGuildSetting(guild, key, fallback) {
  const setup = getGuildSetup(guild);
  if (setup && setup[key] !== undefined && setup[key] !== null && `${setup[key]}`.trim() !== '') {
    return setup[key];
  }
  return fallback;
}

function getMotionChannelId(guild) {
  return String(getGuildSetting(guild, 'motionChannelId', config.discord?.motionChannelId || config.motionChannelId || '')).trim();
}

function getEventChannelId(guild) {
  return String(getGuildSetting(guild, 'eventChannelId', config.discord?.eventChannelId || config.eventChannelId || '')).trim();
}

function getMembersRoleId(guild) {
  return String(getGuildSetting(guild, 'roleId', config.house?.roleId || config.roleId || '')).trim();
}

function getMembersRoleLabel(guild) {
  return String(getGuildSetting(guild, 'roleLabel', config.house?.roleLabel || config.roleLabel || 'Members')).trim();
}

function getQuorumType(guild) {
  return String(getGuildSetting(guild, 'quorumType', config.house?.quorumType || config.quorumType || 'majority')).trim().toLowerCase();
}

function getQuorumPercent(guild) {
  const value = Number(getGuildSetting(guild, 'quorumPercent', config.house?.quorumPercent ?? config.quorumPercent ?? 0.8));
  return Number.isFinite(value) ? value : 0.8;
}

function getQuorumNumber(guild) {
  const value = Number(getGuildSetting(guild, 'quorumNumber', config.house?.quorumNumber ?? config.quorumNumber ?? 5));
  return Number.isFinite(value) ? value : 5;
}

function getQuorumMin(guild) {
  const value = Number(getGuildSetting(guild, 'quorumMin', config.house?.quorumMin ?? config.quorumMin ?? 4));
  return Number.isFinite(value) ? value : 4;
}

function getQuorumLabel(guild) {
  const quorumType = getQuorumType(guild);

  switch (quorumType) {
    case 'majority':
      return 'Majority';
    case 'fixed':
      return 'Required Votes';
    case 'percentage':
      return 'Percentage';
    case 'all':
      return 'All Members';
    case 'hybrid':
      return 'Hybrid Requirement';
    default:
      return 'Quorum';
  }
}

function getAutoCloseOnQuorum() {
  if (typeof config.house?.autoClose === 'boolean') return config.house.autoClose;
  if (typeof config.autoCloseOnQuorum === 'boolean') return config.autoCloseOnQuorum;
  return false;
}

function getAllowSelfVote() {
  return Boolean(config.allowSelfVote ?? true);
}

function getAllowSelfSecond() {
  return Boolean(config.allowSelfSecond ?? false);
}

function getAllowVoteChange() {
  return Boolean(config.allowVoteChange ?? false);
}

function getShowQuorumProgress() {
  return Boolean(config.showQuorumProgress ?? true);
}

function getShowProgressBars() {
  return Boolean(config.showProgressBars ?? true);
}

function getShowMemberCount() {
  return Boolean(config.showMemberCount ?? true);
}

function getNotificationConfig() {
  return config.notifications || {};
}

function getPingRoleOnOpenMotion() {
  return Boolean(getNotificationConfig().pingRoleOnOpenMotion ?? false);
}

function getPingRoleMessage() {
  return String(getNotificationConfig().pingRoleMessage || 'There is an open motion. Please review and vote.').trim();
}

function getDmNonVoters() {
  return Boolean(getNotificationConfig().dmNonVoters ?? false);
}

function getInitialDmDelayMinutes() {
  const value = Number(getNotificationConfig().initialDmDelayMinutes ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getRepeatDmEveryHours() {
  const value = Number(getNotificationConfig().repeatDmEveryHours ?? 24);
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function getReminderCheckIntervalMinutes() {
  const value = Number(getNotificationConfig().reminderCheckIntervalMinutes ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function getIncludeMotionLinkInDm() {
  return Boolean(getNotificationConfig().includeMotionLinkInDm ?? true);
}

function getBotChannelPermissions(channel, guild) {
  const me = guild?.members?.me;
  if (!channel || !guild || !me) {
    return null;
  }
  return channel.permissionsFor(me) || null;
}

function getMissingChannelSendPermissions(channel, guild, options = {}) {
  const perms = getBotChannelPermissions(channel, guild);
  if (!perms) {
    return ['Unable to resolve bot permissions for channel'];
  }

  const required = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];

  if (options.requireExternalEmojis) {
    required.push(PermissionsBitField.Flags.UseExternalEmojis);
  }

  return required.filter((perm) => !perms.has(perm));
}

function formatPermissionName(permission) {
  switch (permission) {
    case PermissionsBitField.Flags.ViewChannel:
      return 'View Channel';
    case PermissionsBitField.Flags.SendMessages:
      return 'Send Messages';
    case PermissionsBitField.Flags.EmbedLinks:
      return 'Embed Links';
    case PermissionsBitField.Flags.ReadMessageHistory:
      return 'Read Message History';
    case PermissionsBitField.Flags.MentionEveryone:
      return 'Mention Everyone';
    case PermissionsBitField.Flags.UseExternalEmojis:
      return 'Use External Emojis';
    default:
      return String(permission);
  }
}

function canBotSendBasicMessages(channel, guild) {
  const missing = getMissingChannelSendPermissions(channel, guild);
  return {
    ok: missing.length === 0,
    missing,
  };
}

async function replyOrFollowUp(interaction, payload) {
  if (!interaction) return null;
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

async function sendEmbedToConfiguredChannel({ interaction, guild, targetChannel, embed, components = [], fallbackReply }) {
  const activeGuild = guild || interaction?.guild;

  if (!activeGuild) {
    await replyOrFollowUp(interaction, {
      content: 'This command can only be used inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (!targetChannel) {
    await replyOrFollowUp(interaction, {
      content: 'The configured channel could not be found. Please run /setup again and select a valid channel.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
    await replyOrFollowUp(interaction, {
      content: 'The configured channel is not a text channel. Please run /setup again and choose a text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const permissionCheck = canBotSendBasicMessages(targetChannel, activeGuild);
  if (!permissionCheck.ok) {
    const missingNames = permissionCheck.missing.map(formatPermissionName).join(', ');
    await replyOrFollowUp(interaction, {
      content: `I cannot post in ${targetChannel}. Missing permissions: ${missingNames}. Please update the channel permissions for the bot and try again.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  try {
    return await targetChannel.send({
      embeds: [embed],
      components,
    });
  } catch (error) {
    console.error('Channel send failed:', error);
    await replyOrFollowUp(interaction, {
      content: fallbackReply || 'I could not post in the configured channel. Please check my channel permissions and try again.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
}

/* =========================
   UTILITIES
========================= */

function getGuildMotions(guild) {
  const guildId = typeof guild === 'string' ? guild : guild?.id;
  return motions.filter((motion) => motion.guildId === guildId);
}

function findMotionById(id) {
  return motions.find((motion) => motion.id === id) || null;
}

function findEventById(id) {
  return events.find((eventRecord) => eventRecord.id === id) || null;
}

function isMotionOpen(motion) {
  return motion && motion.status === 'Open';
}

function getEligibleMembers(guild) {
  const roleId = getMembersRoleId(guild);

  if (!roleId || !guild) {
    return [];
  }

  return guild.members.cache
    .filter((member) => member.roles.cache.has(roleId) && !member.user.bot)
    .map((member) => member);
}

function userHasMembersRole(interaction) {
  const roleId = getMembersRoleId(interaction.guild);
  return !!roleId && interaction.member?.roles?.cache?.has(roleId);
}

function getGlobalEventEligibleMembers() {
  const unique = new Map();

  for (const guild of client.guilds.cache.values()) {
    const setup = getGuildSetup(guild);
    const roleId = setup?.roleId;
    if (!roleId) {
      continue;
    }

    for (const member of guild.members.cache.values()) {
      if (member.user?.bot || !member.roles.cache.has(roleId)) {
        continue;
      }

      if (!unique.has(member.id)) {
        unique.set(member.id, { member, guild });
      }
    }
  }

  return Array.from(unique.values());
}

function calculateQuorum(totalMembers, guild) {
  const quorumType = getQuorumType(guild);

  if (totalMembers <= 0) {
    return 0;
  }

  switch (quorumType) {
    case 'fixed':
      return Math.max(1, getQuorumNumber(guild));
    case 'percentage':
      return Math.max(1, Math.ceil(totalMembers * getQuorumPercent(guild)));
    case 'all':
      return totalMembers;
    case 'hybrid':
      return Math.max(getQuorumMin(guild), Math.floor(totalMembers / 2) + 1);
    case 'majority':
    default:
      return Math.floor(totalMembers / 2) + 1;
  }
}

function getTotalVotes(motion) {
  return (motion.ayes?.length || 0) + (motion.nays?.length || 0);
}

function hasUserVoted(motion, userId) {
  return motion.ayes.includes(userId) || motion.nays.includes(userId);
}

function removeUserVote(motion, userId) {
  motion.ayes = motion.ayes.filter((id) => id !== userId);
  motion.nays = motion.nays.filter((id) => id !== userId);
}

function buildProgressBar(current, total, length = 10) {
  if (!total || total <= 0) {
    return '░'.repeat(length);
  }

  const filled = Math.max(0, Math.min(length, Math.round((current / total) * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function getVoteResultText(motion) {
  const ayes = motion.ayes.length;
  const nays = motion.nays.length;

  if (ayes > nays) return 'Ayes leading';
  if (nays > ayes) return 'Nays leading';
  return 'Tied';
}

function evaluateMotionOutcome(motion, quorum) {
  const ayes = motion.ayes.length;
  const nays = motion.nays.length;
  const totalVotes = getTotalVotes(motion);

  if (quorum <= 0 || totalVotes < quorum) {
    return null;
  }

  if (ayes > nays) return 'Passed';
  if (nays > ayes) return 'Failed';
  return 'Closed';
}

async function refreshGuildMembers(guild) {
  try {
    await guild.members.fetch();
  } catch (error) {
    console.error('Failed to fetch guild members:', error);
  }
}

async function getConfiguredChannel(guild, type = 'motion') {
  const channelId = type === 'event' ? getEventChannelId(guild) : getMotionChannelId(guild);

  if (!channelId) {
    throw new Error(`${type === 'event' ? 'Event' : 'Motion'} channel is not configured for guild ${guild?.name || guild?.id || 'unknown'}. Run /setup first.`);
  }

  const channel = await guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Configured ${type} channel is invalid or not text-based. Channel ID: ${channelId}`);
  }

  return channel;
}

async function getConfiguredMotionChannel(guild) {
  return getConfiguredChannel(guild, 'motion');
}

async function getConfiguredEventChannel(guild) {
  return getConfiguredChannel(guild, 'event');
}

function parseMotionAction(customId) {
  const prefixes = ['second_', 'aye_', 'nay_', 'close_', 'withdraw_', 'view_nays_', 'event_yes_', 'event_no_', 'event_maybe_', 'close_event_'];

  for (const prefix of prefixes) {
    if (customId.startsWith(prefix)) {
      return {
        action: prefix.replace(/_$/, ''),
        motionId: customId.slice(prefix.length),
      };
    }
  }

  return { action: null, motionId: null };
}

function ensureReminderMeta(motion) {
  if (!motion.reminderMeta || typeof motion.reminderMeta !== 'object') {
    motion.reminderMeta = {};
  }
  if (!motion.reminderMeta.dmHistory || typeof motion.reminderMeta.dmHistory !== 'object') {
    motion.reminderMeta.dmHistory = {};
  }
  return motion.reminderMeta;
}

function getMotionMessageUrl(guild, motion) {
  if (!guild?.id || !motion?.channelId || !motion?.messageId) {
    return null;
  }
  return `https://discord.com/channels/${guild.id}/${motion.channelId}/${motion.messageId}`;
}

function canSendVotingReminders(motion) {
  return Boolean(motion && motion.type !== 'event' && isMotionOpen(motion) && motion.secondedBy);
}

async function sendMotionReminderDm(member, guild, motion, type = 'Reminder') {
  const lines = [
    `${type}: there is an open motion for ${guild?.name || 'your server'} that still needs your vote.`,
    '',
    `Motion: ${motion.text || 'No motion text provided.'}`,
  ];

  if (getIncludeMotionLinkInDm()) {
    const url = getMotionMessageUrl(guild, motion);
    if (url) {
      lines.push('', `Open motion: ${url}`);
    }
  }

  await member.send(lines.join('\n'));
}

async function maybeSendRolePing(channel, guild) {
  const roleId = getMembersRoleId(guild);

  if (!getPingRoleOnOpenMotion() || !roleId || !channel?.isTextBased()) {
    return;
  }

  const permissionCheck = canBotSendBasicMessages(channel, guild);
  if (!permissionCheck.ok) {
    console.warn(
      `Skipping role ping in channel ${channel?.id || 'unknown'} due to missing permissions: ${permissionCheck.missing.map(formatPermissionName).join(', ')}`,
    );
    return;
  }

  const perms = getBotChannelPermissions(channel, guild);
  const canMentionRole = perms?.has(PermissionsBitField.Flags.MentionEveryone) ?? false;

  try {
    await channel.send({
      content: canMentionRole ? `<@&${roleId}> ${getPingRoleMessage()}`.trim() : getPingRoleMessage(),
      allowedMentions: canMentionRole ? { roles: [roleId] } : { parse: [] },
    });
  } catch (error) {
    console.error('Role ping send failed:', error);
  }
}

async function runReminderSweepForGuild(guild, specificMotion = null) {
  if (!guild || !getDmNonVoters()) {
    return;
  }

  const setup = getGuildSetup(guild);
  if (!setup?.motionChannelId || !setup?.roleId) {
    return;
  }

  await refreshGuildMembers(guild);

  const candidateMotions = specificMotion
    ? [specificMotion]
    : getGuildMotions(guild).filter((motion) => isMotionOpen(motion));

  const eligibleMembers = getEligibleMembers(guild);
  const now = Date.now();
  const initialDelayMs = getInitialDmDelayMinutes() * 60 * 1000;
  const repeatDelayMs = getRepeatDmEveryHours() * 60 * 60 * 1000;
  let changed = false;

  for (const motion of candidateMotions) {
    if (!canSendVotingReminders(motion)) {
      continue;
    }

    const meta = ensureReminderMeta(motion);
    if (!meta.votingOpenedAt) {
      meta.votingOpenedAt = new Date().toISOString();
      changed = true;
    }

    const votingOpenedAtMs = new Date(meta.votingOpenedAt).getTime();
    if (!Number.isFinite(votingOpenedAtMs)) {
      meta.votingOpenedAt = new Date().toISOString();
      changed = true;
      continue;
    }

    for (const member of eligibleMembers) {
      if (hasUserVoted(motion, member.id)) {
        continue;
      }

      const history = meta.dmHistory[member.id] || { sentCount: 0, lastSentAt: null };
      const lastSentAtMs = history.lastSentAt ? new Date(history.lastSentAt).getTime() : null;

      let shouldSend = false;
      let reminderType = 'Reminder';

      if (!history.sentCount) {
        if (now >= votingOpenedAtMs + initialDelayMs) {
          shouldSend = true;
          reminderType = 'Open Motion Reminder';
        }
      } else if (Number.isFinite(lastSentAtMs) && now >= lastSentAtMs + repeatDelayMs) {
        shouldSend = true;
        reminderType = 'Open Motion Follow-up';
      }

      if (!shouldSend) {
        continue;
      }

      try {
        await sendMotionReminderDm(member, guild, motion, reminderType);
        meta.dmHistory[member.id] = {
          sentCount: Number(history.sentCount || 0) + 1,
          lastSentAt: new Date().toISOString(),
        };
        changed = true;
      } catch (error) {
        console.error(`Failed to send reminder DM to ${member.user.tag}:`, error.message || error);
      }
    }
  }

  if (changed) {
    saveMotions();
  }
}

async function runReminderSweep(specificGuild = null, specificMotion = null) {
  if (specificGuild) {
    await runReminderSweepForGuild(specificGuild, specificMotion);
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      await runReminderSweepForGuild(guild);
    } catch (error) {
      console.error(`Reminder sweep failed for guild ${guild.name}:`, error);
    }
  }
}

async function sendEventReminderDm(member, eventRecord, hoursBefore) {
  const url = getEventMessageUrl(eventRecord);
  const response = getEventResponseForUser(eventRecord, member.id);
  const lines = [
    `Upcoming Event Reminder: ${eventRecord.eventName || 'Event'}`,
    '',
    `When: ${eventRecord.eventDateTime || 'Not provided'}`,
    `Starts in about ${hoursBefore} hour(s).`,
    response ? `Your current RSVP: ${response.toUpperCase()}` : 'You have not responded yet.',
  ];

  if (url) {
    lines.push('', `Open event RSVP: ${url}`);
  }

  await member.send(lines.join('\n'));
}

async function sendEventChannelReminder(channel, eventRecord, hoursBefore) {
  const permissionCheck = canBotSendBasicMessages(channel, channel.guild);
  if (!permissionCheck.ok) {
    return false;
  }

  const url = getEventMessageUrl(eventRecord);
  const totals = getEventRsvpTotals(eventRecord);
  const messageLines = [
    `Upcoming event reminder: **${eventRecord.eventName || 'Event'}**`,
    `Date & Time: ${eventRecord.eventDateTime || 'Not provided'}`,
    `Starts in about **${hoursBefore} hour(s)**.`,
    `RSVP totals — Yes: **${totals.yes}**, No: **${totals.no}**, Maybe: **${totals.maybe}**`,
  ];
  if (url) {
    messageLines.push(`RSVP link: ${url}`);
  }

  await channel.send({ content: messageLines.join('\n') });
  return true;
}

async function runEventReminderSweep() {
  const reminderHours = getEventReminderHoursBefore();
  if (!reminderHours.length || (!getEventDmRemindersEnabled() && !getEventChannelRemindersEnabled())) {
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      await refreshGuildMembers(guild);
    } catch (error) {
      console.error(`Event reminder guild refresh failed for ${guild.name}:`, error.message || error);
    }
  }

  const members = getGlobalEventEligibleMembers();
  const now = Date.now();
  let changed = false;

  for (const eventRecord of events.filter((entry) => entry?.type === 'event' && isMotionOpen(entry))) {
    normalizeEventVotes(eventRecord);
    const eventTs = parseEventDateTime(eventRecord);
    if (!eventTs) {
      continue;
    }

    for (const hoursBefore of reminderHours) {
      const milestoneKey = String(hoursBefore);
      const triggerTs = eventTs - (hoursBefore * 60 * 60 * 1000);
      if (now < triggerTs) {
        continue;
      }

      if (getEventDmRemindersEnabled()) {
        if (!eventRecord.reminderMeta.milestones[milestoneKey]) {
          eventRecord.reminderMeta.milestones[milestoneKey] = { sentUserIds: {}, sentAt: null };
        }

        const milestone = eventRecord.reminderMeta.milestones[milestoneKey];
        for (const entry of members) {
          const member = entry.member;
          const response = getEventResponseForUser(eventRecord, member.id);
          if (getEventDmNonRespondersOnly() && response) {
            continue;
          }
          if (milestone.sentUserIds[member.id]) {
            continue;
          }

          try {
            await sendEventReminderDm(member, eventRecord, hoursBefore);
            milestone.sentUserIds[member.id] = new Date().toISOString();
            milestone.sentAt = new Date().toISOString();
            changed = true;
          } catch (error) {
            console.error(`Failed to send event reminder to ${member.user?.tag || member.id}:`, error.message || error);
          }
        }
      }

      if (getEventChannelRemindersEnabled() && !eventRecord.reminderMeta.channelMilestones[milestoneKey]) {
        for (const ref of eventRecord.messageRefs || []) {
          try {
            const guild = client.guilds.cache.get(ref.guildId) || await client.guilds.fetch(ref.guildId).catch(() => null);
            if (!guild) continue;
            const channel = await guild.channels.fetch(ref.channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) continue;
            await sendEventChannelReminder(channel, eventRecord, hoursBefore);
          } catch (error) {
            console.error(`Failed to send channel event reminder for ${eventRecord.id} in guild ${ref.guildId}:`, error.message || error);
          }
        }

        eventRecord.reminderMeta.channelMilestones[milestoneKey] = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed) {
    saveEvents();
  }
}

function buildVoterColumn(guild, userIds) {
  if (!Array.isArray(userIds) || !userIds.length) {
    return 'None';
  }

  return userIds.slice(0, 20).map((userId) => {
    const member = guild?.members?.cache?.get(userId);
    return member ? member.displayName : `<@${userId}>`;
  }).join('\n');
}

function buildGlobalEventVoterColumn(votes) {
  if (!Array.isArray(votes) || !votes.length) {
    return 'None';
  }

  return votes.slice(0, 40).map((entry) => {
    const guildName = entry.guildId ? (client.guilds.cache.get(entry.guildId)?.name || entry.guildId) : 'Unknown Server';
    const name = entry.displayName || entry.username || `<@${entry.userId}>`;
    return `${guildName} — ${name}`;
  }).join('\n');
}

function normalizeEventVotes(eventRecord) {
  const normalize = (votes = []) => (Array.isArray(votes) ? votes : []).map((entry) => {
    if (entry && typeof entry === 'object') {
      return {
        userId: entry.userId,
        guildId: entry.guildId || null,
        displayName: entry.displayName || entry.username || null,
        username: entry.username || null,
        votedAt: entry.votedAt || null,
      };
    }

    return {
      userId: entry,
      guildId: null,
      displayName: null,
      username: null,
      votedAt: null,
    };
  }).filter((entry) => entry.userId);

  eventRecord.yesVotes = normalize(eventRecord.yesVotes);
  eventRecord.noVotes = normalize(eventRecord.noVotes);
  eventRecord.maybeVotes = normalize(eventRecord.maybeVotes);
  if (!Array.isArray(eventRecord.messageRefs)) {
    eventRecord.messageRefs = [];
  }
  if (!eventRecord.reminderMeta || typeof eventRecord.reminderMeta !== 'object') {
    eventRecord.reminderMeta = { milestones: {}, channelMilestones: {} };
  }
  if (!eventRecord.reminderMeta.milestones || typeof eventRecord.reminderMeta.milestones !== 'object') {
    eventRecord.reminderMeta.milestones = {};
  }
  if (!eventRecord.reminderMeta.channelMilestones || typeof eventRecord.reminderMeta.channelMilestones !== 'object') {
    eventRecord.reminderMeta.channelMilestones = {};
  }
  return eventRecord;
}

function getEventResponseForUser(eventRecord, userId) {
  normalizeEventVotes(eventRecord);
  if (eventRecord.yesVotes.some((entry) => entry.userId === userId)) return 'yes';
  if (eventRecord.noVotes.some((entry) => entry.userId === userId)) return 'no';
  if (eventRecord.maybeVotes.some((entry) => entry.userId === userId)) return 'maybe';
  return null;
}

function upsertEventVote(eventRecord, interaction, answer) {
  normalizeEventVotes(eventRecord);

  const voteEntry = {
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    displayName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
    username: interaction.user.username,
    votedAt: new Date().toISOString(),
  };

  eventRecord.yesVotes = eventRecord.yesVotes.filter((entry) => entry.userId !== interaction.user.id);
  eventRecord.noVotes = eventRecord.noVotes.filter((entry) => entry.userId !== interaction.user.id);
  eventRecord.maybeVotes = eventRecord.maybeVotes.filter((entry) => entry.userId !== interaction.user.id);

  if (answer === 'yes') {
    eventRecord.yesVotes.push(voteEntry);
  } else if (answer === 'no') {
    eventRecord.noVotes.push(voteEntry);
  } else if (answer === 'maybe') {
    eventRecord.maybeVotes.push(voteEntry);
  }

  eventRecord.updatedAt = new Date().toISOString();
}

function getEventRsvpTotals(eventRecord) {
  normalizeEventVotes(eventRecord);
  const yes = eventRecord.yesVotes.length;
  const no = eventRecord.noVotes.length;
  const maybe = eventRecord.maybeVotes.length;
  const total = yes + no + maybe;
  return { yes, no, maybe, total };
}

function formatEventPercent(count, total) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function buildEventStatsText(eventRecord) {
  const totals = getEventRsvpTotals(eventRecord);
  return [
    `Total Responses: ${totals.total}`,
    `Yes: ${totals.yes} (${formatEventPercent(totals.yes, totals.total)})`,
    `No: ${totals.no} (${formatEventPercent(totals.no, totals.total)})`,
    `Maybe: ${totals.maybe} (${formatEventPercent(totals.maybe, totals.total)})`,
  ].join('\n');
}

function parseEventDateTime(eventRecord) {
  const raw = eventRecord?.eventDateTime;
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

function getEventMessageUrl(eventRecord) {
  const ref = Array.isArray(eventRecord?.messageRefs) ? eventRecord.messageRefs.find((item) => item?.guildId && item?.channelId && item?.messageId) : null;
  if (!ref) return null;
  return `https://discord.com/channels/${ref.guildId}/${ref.channelId}/${ref.messageId}`;
}

function buildEventEmbed(eventRecord) {
  normalizeEventVotes(eventRecord);
  const totalServers = Array.from(new Set((eventRecord.messageRefs || []).map((ref) => ref.guildId).filter(Boolean))).length;
  const eventTimestamp = parseEventDateTime(eventRecord);
  const scheduleText = eventTimestamp
    ? `<t:${Math.floor(eventTimestamp / 1000)}:F>\n<t:${Math.floor(eventTimestamp / 1000)}:R>`
    : (eventRecord.eventDateTime || 'Not provided');
  const embed = new EmbedBuilder()
    .setTitle('Oxford House Event RSVP')
    .setDescription(eventRecord.eventName || 'No event name provided.')
    .addFields(
      { name: 'Status', value: eventRecord.status || 'Open', inline: true },
      { name: 'Servers', value: String(totalServers || 1), inline: true },
      { name: 'Created By', value: `<@${eventRecord.createdBy}>`, inline: true },
      { name: 'Date & Time', value: scheduleText, inline: false },
      { name: 'RSVP Stats', value: buildEventStatsText(eventRecord), inline: false },
      { name: 'Yes', value: buildGlobalEventVoterColumn(eventRecord.yesVotes), inline: true },
      { name: 'No', value: buildGlobalEventVoterColumn(eventRecord.noVotes), inline: true },
      { name: 'Maybe', value: buildGlobalEventVoterColumn(eventRecord.maybeVotes), inline: true },
    )
    .setFooter({ text: '© 2026 Mr John Dowe' })
    .setTimestamp(new Date(eventRecord.updatedAt || eventRecord.createdAt || Date.now()));

  return embed;
}

function buildMotionEmbed(guild, motion) {
  const eligibleMembers = getEligibleMembers(guild);
  const memberCount = eligibleMembers.length;
  const quorum = calculateQuorum(memberCount, guild);
  const totalVotes = getTotalVotes(motion);
  const resultText = getVoteResultText(motion);
  const quorumLabel = getQuorumLabel(guild);

  const embed = new EmbedBuilder()
    .setTitle('Oxford House Motion')
    .setDescription(motion.text || 'No motion text provided.')
    .addFields(
      { name: 'Status', value: motion.status || 'Open', inline: true },
      { name: 'Created By', value: `<@${motion.createdBy}>`, inline: true },
      { name: 'Seconded By', value: motion.secondedBy ? `<@${motion.secondedBy}>` : 'Not seconded yet', inline: true },
      { name: 'Ayes', value: String(motion.ayes.length), inline: true },
      { name: 'Nays', value: String(motion.nays.length), inline: true },
      { name: 'Result', value: resultText, inline: true },
      { name: 'Yay Voters', value: buildVoterColumn(guild, motion.ayes), inline: true },
      { name: 'Nay Voters', value: buildVoterColumn(guild, motion.nays), inline: true },
    )
    .setFooter({ text: '© 2026 Mr John Dowe' })
    .setTimestamp(new Date(motion.updatedAt || motion.createdAt || Date.now()));

  if (getShowMemberCount()) {
    embed.addFields({ name: 'Eligible Members', value: String(memberCount), inline: true });
  }

  if (getShowQuorumProgress()) {
    embed.addFields({ name: quorumLabel, value: `${totalVotes}/${quorum}`, inline: true });
  }

  if (getShowProgressBars()) {
    embed.addFields(
      { name: 'Aye Progress', value: buildProgressBar(motion.ayes.length, quorum), inline: false },
      { name: 'Nay Progress', value: buildProgressBar(motion.nays.length, quorum), inline: false },
    );
  }

  if (Array.isArray(motion.nayReasons) && motion.nayReasons.length) {
    const reasonsPreview = motion.nayReasons
      .slice(0, 5)
      .map((entry) => `<@${entry.userId}>: ${entry.reason}`)
      .join('\n');

    embed.addFields({ name: 'Recent Nay Reasons', value: reasonsPreview || 'None', inline: false });
  }

  return embed;
}

function buildMotionComponents(motion) {
  const open = isMotionOpen(motion);
  const seconded = Boolean(motion.secondedBy);

  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`second_${motion.id}`)
      .setLabel('Second')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!open || seconded),
    new ButtonBuilder()
      .setCustomId(`aye_${motion.id}`)
      .setLabel('Aye')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!open || !seconded),
    new ButtonBuilder()
      .setCustomId(`nay_${motion.id}`)
      .setLabel('Nay')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!open || !seconded),
    new ButtonBuilder()
      .setCustomId(`view_nays_${motion.id}`)
      .setLabel('View Nay Responses')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`close_${motion.id}`)
      .setLabel('Close Motion')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!open),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`withdraw_${motion.id}`)
      .setLabel('Withdraw Motion')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!open),
  );

  return [row, row2];
}

function buildEventComponents(eventRecord) {
  const open = isMotionOpen(eventRecord);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_yes_${eventRecord.id}`)
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!open),
    new ButtonBuilder()
      .setCustomId(`event_no_${eventRecord.id}`)
      .setLabel('No')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!open),
    new ButtonBuilder()
      .setCustomId(`event_maybe_${eventRecord.id}`)
      .setLabel('Maybe')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!open),
    new ButtonBuilder()
      .setCustomId(`close_event_${eventRecord.id}`)
      .setLabel('Close Event')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!open),
  );

  return [row];
}

async function updateEventMessages(eventRecord) {
  normalizeEventVotes(eventRecord);
  if (!Array.isArray(eventRecord.messageRefs) || !eventRecord.messageRefs.length) return;

  for (const ref of eventRecord.messageRefs) {
    try {
      const guild = client.guilds.cache.get(ref.guildId) || await client.guilds.fetch(ref.guildId).catch(() => null);
      if (!guild) continue;

      const channel = await guild.channels.fetch(ref.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      const message = await channel.messages.fetch(ref.messageId).catch(() => null);
      if (!message) continue;

      await message.edit({
        embeds: [buildEventEmbed(eventRecord)],
        components: buildEventComponents(eventRecord),
      });
    } catch (error) {
      console.error(`Failed to update event message for record ${eventRecord.id} in guild ${ref.guildId}:`, error.message || error);
    }
  }
}

async function updateRecordMessage(guild, record) {
  if (record.type === 'event') {
    await updateEventMessages(record);
    return;
  }

  if (!record.channelId || !record.messageId) {
    return;
  }

  try {
    const channel = await guild.channels.fetch(record.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const message = await channel.messages.fetch(record.messageId).catch(() => null);
    if (!message) {
      return;
    }

    await message.edit({
      embeds: [buildMotionEmbed(guild, record)],
      components: buildMotionComponents(record),
    });
  } catch (error) {
    console.error(`Failed to update message for record ${record.id}:`, error.message || error);
  }
}

function buildSlashCommands() {
  return [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Configure the bot for this server')
      .addRoleOption((option) =>
        option.setName('members_role')
          .setDescription('Role used for voting and reminders')
          .setRequired(true))
      .addChannelOption((option) =>
        option.setName('motion_channel')
          .setDescription('Channel used for motions')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true))
      .addChannelOption((option) =>
        option.setName('event_channel')
          .setDescription('Channel used for events')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false))
      .addStringOption((option) =>
        option.setName('role_label')
          .setDescription('Label shown in embeds for the voting role')
          .setRequired(false))
      .addStringOption((option) =>
        option.setName('quorum_type')
          .setDescription('How quorum should be calculated')
          .setRequired(false)
          .addChoices(
            { name: 'Majority', value: 'majority' },
            { name: 'Fixed Number', value: 'fixed' },
            { name: 'Percentage', value: 'percentage' },
            { name: 'All Members', value: 'all' },
            { name: 'Hybrid', value: 'hybrid' },
          ))
      .addIntegerOption((option) =>
        option.setName('quorum_number')
          .setDescription('Required vote count when quorum_type is fixed')
          .setMinValue(1)
          .setRequired(false))
      .addNumberOption((option) =>
        option.setName('quorum_percent')
          .setDescription('Decimal percentage when quorum_type is percentage, example 0.8')
          .setMinValue(0.01)
          .setMaxValue(1)
          .setRequired(false))
      .addIntegerOption((option) =>
        option.setName('quorum_min')
          .setDescription('Minimum votes when quorum_type is hybrid')
          .setMinValue(1)
          .setRequired(false)),
    new SlashCommandBuilder()
      .setName('motion')
      .setDescription('Create a new motion'),
    new SlashCommandBuilder()
      .setName('event')
      .setDescription('Create a new event RSVP'),
  ].map((command) => command.toJSON());
}

async function registerCommandsForGuild(guildId) {
  const token = getBotToken();
  const clientId = getClientId();

  if (!token || !clientId || !guildId) {
    throw new Error('Missing token, clientId, or guildId during command registration.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: buildSlashCommands() });
  debugLog(`Slash commands registered for guild ${guildId}.`);
}

async function registerCommandsForAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    try {
      await registerCommandsForGuild(guild.id);
    } catch (error) {
      console.error(`Failed to register commands for ${guild.name} (${guild.id}):`, error.message || error);
    }
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  loadMotions();
  loadEvents();
  migrateLegacyEventsFromMotions();
  loadHouseConfigs();

  for (const guild of client.guilds.cache.values()) {
    await refreshGuildMembers(guild);
  }

  try {
    await registerCommandsForAllGuilds();
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }

  const reminderIntervalMs = getReminderCheckIntervalMinutes() * 60 * 1000;
  setInterval(async () => {
    try {
      await runReminderSweep();
    } catch (error) {
      console.error('Motion reminder sweep failed:', error);
    }
  }, reminderIntervalMs);

  const eventReminderIntervalMs = getEventReminderCheckIntervalMinutes() * 60 * 1000;
  setInterval(async () => {
    try {
      await runEventReminderSweep();
    } catch (error) {
      console.error('Event reminder sweep failed:', error);
    }
  }, eventReminderIntervalMs);
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    await refreshGuildMembers(guild);
    await registerCommandsForGuild(guild.id);
    console.log(`Joined new guild ${guild.name}. /setup is ready.`);
  } catch (error) {
    console.error(`Failed to prepare new guild ${guild.name}:`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild()) {
        await interaction.reply({
          content: 'This command can only be used inside a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.commandName === 'setup') {
        const role = interaction.options.getRole('members_role', true);
        const channel = interaction.options.getChannel('motion_channel', true);
        const eventChannel = interaction.options.getChannel('event_channel') || channel;
        const roleLabel = interaction.options.getString('role_label') || role.name || 'Members';
        const quorumType = interaction.options.getString('quorum_type') || 'majority';
        const quorumNumber = interaction.options.getInteger('quorum_number') ?? getQuorumNumber(interaction.guild);
        const quorumPercent = interaction.options.getNumber('quorum_percent') ?? getQuorumPercent(interaction.guild);
        const quorumMin = interaction.options.getInteger('quorum_min') ?? getQuorumMin(interaction.guild);

        setGuildSetup(interaction.guild.id, {
          guildName: interaction.guild.name,
          roleId: role.id,
          roleLabel,
          motionChannelId: channel.id,
          eventChannelId: eventChannel.id,
          quorumType,
          quorumNumber,
          quorumPercent,
          quorumMin,
          installedBy: interaction.user.id,
          installedAt: new Date().toISOString(),
        });

        await interaction.reply({
          content: [
            `Setup saved for **${interaction.guild.name}**.`,
            `Voting role: <@&${role.id}>`,
            `Motion channel: <#${channel.id}>`,
            `Event channel: <#${eventChannel.id}>`,
            `Role label: ${roleLabel}`,
            `Quorum type: ${quorumType}`,
            `Stored in file: ${path.basename(housesFile)}`,
          ].join('\n'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.commandName === 'motion') {
        const setup = getGuildSetup(interaction.guild);
        if (!setup?.motionChannelId || !setup?.roleId) {
          await interaction.reply({
            content: 'This server has not been set up yet. Run /setup first.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('create_motion_modal')
          .setTitle('Create Motion');

        const input = new TextInputBuilder()
          .setCustomId('motion_text')
          .setLabel('What is your motion?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.commandName === 'event') {
        const setup = getGuildSetup(interaction.guild);
        if (!setup?.eventChannelId || !setup?.roleId) {
          await interaction.reply({
            content: 'This server has not been set up yet. Run /setup first.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('create_event_modal')
          .setTitle('Create Event');

        const nameInput = new TextInputBuilder()
          .setCustomId('event_name')
          .setLabel('Event Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200);

        const dateInput = new TextInputBuilder()
          .setCustomId('event_date_time')
          .setLabel('Event Date and Time')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Example: 2026-04-10 6:00 PM');

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(dateInput),
        );
        await interaction.showModal(modal);
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'create_motion_modal') {
        const setup = getGuildSetup(interaction.guild);
        if (!setup?.motionChannelId || !setup?.roleId) {
          await interaction.reply({
            content: 'This server has not been set up yet. Run /setup first.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const text = interaction.fields.getTextInputValue('motion_text').trim();
        if (!text) {
          await interaction.reply({
            content: 'Motion text is required.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const motion = {
          id: createId(),
          type: 'motion',
          guildId: interaction.guild.id,
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          text,
          ayes: [],
          nays: [],
          nayReasons: [],
          secondedBy: null,
          status: 'Open',
          reminderMeta: {
            dmHistory: {},
            votingOpenedAt: null,
          },
        };

        const targetChannel = await getConfiguredMotionChannel(interaction.guild).catch(() => null);
        const sentMessage = await sendEmbedToConfiguredChannel({
          interaction,
          guild: interaction.guild,
          targetChannel,
          embed: buildMotionEmbed(interaction.guild, motion),
          components: buildMotionComponents(motion),
          fallbackReply: 'I could not post the motion in the configured motion channel. Please check my channel permissions or rerun /setup.',
        });

        if (!sentMessage) {
          return;
        }

        motion.channelId = sentMessage.channel.id;
        motion.messageId = sentMessage.id;
        motions.push(motion);
        saveMotions();

        await maybeSendRolePing(sentMessage.channel, interaction.guild);

        await interaction.reply({
          content: `Motion created in ${sentMessage.channel}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId === 'create_event_modal') {
        const setup = getGuildSetup(interaction.guild);
        if (!setup?.eventChannelId || !setup?.roleId) {
          await interaction.reply({
            content: 'This server has not been set up yet. Run /setup first.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const eventName = interaction.fields.getTextInputValue('event_name').trim();
        const eventDateTime = interaction.fields.getTextInputValue('event_date_time').trim();

        if (!eventName || !eventDateTime) {
          await interaction.reply({
            content: 'Event name and date/time are required.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const eventRecord = normalizeEventVotes({
          id: createId(),
          type: 'event',
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          eventName,
          eventDateTime,
          status: 'Open',
          yesVotes: [],
          noVotes: [],
          maybeVotes: [],
          messageRefs: [],
          reminderMeta: { milestones: {}, channelMilestones: {} },
        });

        for (const guild of client.guilds.cache.values()) {
          const guildSetup = getGuildSetup(guild);
          if (!guildSetup?.eventChannelId || !guildSetup?.roleId) {
            continue;
          }

          const targetChannel = await getConfiguredEventChannel(guild).catch(() => null);
          if (!targetChannel) {
            continue;
          }

          const sentMessage = await sendEmbedToConfiguredChannel({
            interaction: guild.id === interaction.guild.id ? interaction : null,
            guild,
            targetChannel,
            embed: buildEventEmbed(eventRecord),
            components: buildEventComponents(eventRecord),
            fallbackReply: `I could not post the event in ${guild.name}. Please check channel permissions or rerun /setup there.`,
          });

          if (sentMessage) {
            eventRecord.messageRefs.push({
              guildId: guild.id,
              channelId: sentMessage.channel.id,
              messageId: sentMessage.id,
            });
          }
        }

        events.push(eventRecord);
        saveEvents();

        await interaction.reply({
          content: `Global event created: **${eventName}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId.startsWith('nay_reason_modal_')) {
        const motionId = interaction.customId.replace('nay_reason_modal_', '');
        const motion = findMotionById(motionId);

        if (!motion || !isMotionOpen(motion)) {
          await interaction.reply({
            content: 'This motion is no longer open.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can vote on this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!motion.secondedBy) {
          await interaction.reply({
            content: 'This motion must be seconded before voting begins.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!getAllowVoteChange() && hasUserVoted(motion, interaction.user.id)) {
          await interaction.reply({
            content: 'You have already voted on this motion.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (getAllowVoteChange()) {
          removeUserVote(motion, interaction.user.id);
        }

        motion.nays.push(interaction.user.id);
        motion.nayReasons = Array.isArray(motion.nayReasons) ? motion.nayReasons.filter((entry) => entry.userId !== interaction.user.id) : [];
        motion.nayReasons.push({
          userId: interaction.user.id,
          reason: interaction.fields.getTextInputValue('nay_reason').trim(),
          createdAt: new Date().toISOString(),
        });
        motion.updatedAt = new Date().toISOString();

        const quorum = calculateQuorum(getEligibleMembers(interaction.guild).length, interaction.guild);
        const outcome = evaluateMotionOutcome(motion, quorum);
        if (getAutoCloseOnQuorum() && outcome) {
          motion.status = outcome;
        }

        saveMotions();
        await updateRecordMessage(interaction.guild, motion);

        await interaction.reply({
          content: 'Your nay vote has been recorded.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (interaction.isButton()) {
      const { action, motionId } = parseMotionAction(interaction.customId);
      if (!action || !motionId) {
        return;
      }

      if (action.startsWith('event')) {
        const eventRecord = findEventById(motionId);
        if (!eventRecord || !isMotionOpen(eventRecord)) {
          await interaction.reply({ content: 'This event is no longer open.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can respond to this event.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const answer = action.replace('event_', '');
        upsertEventVote(eventRecord, interaction, answer);
        saveEvents();
        await updateEventMessages(eventRecord);

        await interaction.reply({
          content: `Your RSVP has been set to **${answer}** for **${eventRecord.eventName}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (action === 'close_event') {
        const eventRecord = findEventById(motionId);
        if (!eventRecord || !isMotionOpen(eventRecord)) {
          await interaction.reply({ content: 'This event is no longer open.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can close this event.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        eventRecord.status = 'Closed';
        eventRecord.updatedAt = new Date().toISOString();
        saveEvents();
        await updateEventMessages(eventRecord);

        await interaction.reply({ content: 'Event closed.', flags: MessageFlags.Ephemeral });
        return;
      }

      const motion = findMotionById(motionId);
      if (!motion) {
        await interaction.reply({ content: 'Motion not found.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (!interaction.inGuild() || interaction.guild.id !== motion.guildId) {
        await interaction.reply({ content: 'This motion belongs to a different server.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (!isMotionOpen(motion) && !['view_nays'].includes(action)) {
        await interaction.reply({ content: 'This motion is no longer open.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'second') {
        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can second this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (motion.secondedBy) {
          await interaction.reply({ content: 'This motion has already been seconded.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!getAllowSelfSecond() && motion.createdBy === interaction.user.id) {
          await interaction.reply({ content: 'You cannot second your own motion.', flags: MessageFlags.Ephemeral });
          return;
        }

        motion.secondedBy = interaction.user.id;
        motion.updatedAt = new Date().toISOString();
        ensureReminderMeta(motion).votingOpenedAt = new Date().toISOString();
        saveMotions();
        await updateRecordMessage(interaction.guild, motion);
        await runReminderSweep(interaction.guild, motion);

        await interaction.reply({ content: 'Motion seconded. Voting is now open.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'aye') {
        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can vote on this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!motion.secondedBy) {
          await interaction.reply({ content: 'This motion must be seconded before voting begins.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!getAllowSelfVote() && motion.createdBy === interaction.user.id) {
          await interaction.reply({ content: 'You cannot vote on your own motion.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!getAllowVoteChange() && hasUserVoted(motion, interaction.user.id)) {
          await interaction.reply({ content: 'You have already voted on this motion.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (getAllowVoteChange()) {
          removeUserVote(motion, interaction.user.id);
          motion.nayReasons = Array.isArray(motion.nayReasons) ? motion.nayReasons.filter((entry) => entry.userId !== interaction.user.id) : [];
        }

        motion.ayes.push(interaction.user.id);
        motion.updatedAt = new Date().toISOString();

        const quorum = calculateQuorum(getEligibleMembers(interaction.guild).length, interaction.guild);
        const outcome = evaluateMotionOutcome(motion, quorum);
        if (getAutoCloseOnQuorum() && outcome) {
          motion.status = outcome;
        }

        saveMotions();
        await updateRecordMessage(interaction.guild, motion);

        await interaction.reply({ content: 'Your aye vote has been recorded.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'nay') {
        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can vote on this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!motion.secondedBy) {
          await interaction.reply({ content: 'This motion must be seconded before voting begins.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!getAllowSelfVote() && motion.createdBy === interaction.user.id) {
          await interaction.reply({ content: 'You cannot vote on your own motion.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (!getAllowVoteChange() && hasUserVoted(motion, interaction.user.id)) {
          await interaction.reply({ content: 'You have already voted on this motion.', flags: MessageFlags.Ephemeral });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(`nay_reason_modal_${motion.id}`)
          .setTitle('Nay Reason');

        const input = new TextInputBuilder()
          .setCustomId('nay_reason')
          .setLabel('Why are you voting nay?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      if (action === 'view_nays') {
        const reasons = Array.isArray(motion.nayReasons) ? motion.nayReasons : [];
        const lines = reasons.length
          ? reasons.map((entry) => `<@${entry.userId}>: ${entry.reason}`)
          : ['No nay reasons have been submitted.'];

        await interaction.reply({
          content: lines.join('\n').slice(0, 1900),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (action === 'close') {
        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can close this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        motion.status = 'Closed';
        motion.updatedAt = new Date().toISOString();
        saveMotions();
        await updateRecordMessage(interaction.guild, motion);

        await interaction.reply({ content: 'Motion closed.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'withdraw') {
        if (!userHasMembersRole(interaction)) {
          await interaction.reply({
            content: `Only users with the ${getMembersRoleLabel(interaction.guild)} role can withdraw this motion.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        motion.status = 'Motion Withdrawn';
        motion.updatedAt = new Date().toISOString();
        saveMotions();
        await updateRecordMessage(interaction.guild, motion);

        await interaction.reply({ content: 'Motion withdrawn.', flags: MessageFlags.Ephemeral });
        return;
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (interaction.deferred || interaction.replied) {
      try {
        await interaction.followUp({
          content: 'An error occurred while processing this interaction.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (followUpError) {
        console.error('Follow-up error:', followUpError);
      }
    } else {
      try {
        await interaction.reply({
          content: 'An error occurred while processing this interaction.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        console.error('Reply error:', replyError);
      }
    }
  }
});

/* =========================
   BOOT
========================= */

(async () => {
  try {
    const token = getBotToken();
    if (!token) {
      throw new Error('Bot token is missing from config.');
    }

    await client.login(token);
  } catch (error) {
    console.error('Startup error:', error);
  }
})();