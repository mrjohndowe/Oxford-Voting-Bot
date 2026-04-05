const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
const config = require('./config');

const token = String(config.token || '').trim();
const clientId = String(config.clientId || '').trim();
const guildId = process.argv[2] || '';

if (!token || !clientId || !guildId) {
  console.error('Usage: node deploy-commands.js <guildId>');
  process.exit(1);
}

const commands = [
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
        .setRequired(false))
    .addNumberOption((option) =>
      option.setName('quorum_percent')
        .setDescription('Decimal percentage when quorum_type is percentage')
        .setRequired(false))
    .addIntegerOption((option) =>
      option.setName('quorum_min')
        .setDescription('Minimum votes when quorum_type is hybrid')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('motion')
    .setDescription('Create a new motion'),
  new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create a new event RSVP'),
].map((command) => command.toJSON());

(async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Commands deployed for guild ${guildId}.`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();