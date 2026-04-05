module.exports = {

  /*
  =========================
  DISCORD BOT CORE SETTINGS
  =========================
  */

  // Your Discord bot token (from Discord Developer Portal)
  token: 'YOUR_BOT_TOKEN',

  // Your Discord application (client) ID
  clientId: 'YOUR_CLIENT_ID',

  // Enable debug logging (true = more console output)
  debug: false,


  /*
  =========================
  FILE STORAGE PATHS
  =========================
  */

  // File used to store motions (per-server / per-house)
  jsonFile: './motions.json',

  // File used to store events (GLOBAL across all servers)
  eventsFile: './events.json',

  // File used to store per-server setup/configuration
  houseConfigFile: './houses.json',


  /*
  =========================
  PUBLIC URL (OPTIONAL)
  =========================
  */

  // Base URL used to generate links (e.g. motion links in DMs)
  // Example: https://yourdomain.com
  publicBaseUrl: '',


  /*
  =========================
  MOTION SETTINGS
  =========================
  */

  // Allow motion creator to vote on their own motion
  allowSelfVote: true,

  // Allow motion creator to second their own motion (recommended: false)
  allowSelfSecond: false,

  // Allow users to change their vote after voting
  allowVoteChange: false,

  // Automatically close motion once quorum is reached
  autoCloseOnQuorum: false,

  // Show quorum progress in the embed
  showQuorumProgress: true,

  // Show visual progress bars for votes
  showProgressBars: true,

  // Show total number of members counted for quorum
  showMemberCount: true,


  /*
  =========================
  DEFAULT FALLBACK SETTINGS
  =========================
  */

  // These values are used BEFORE /setup is completed
  // After setup, values are overridden per server in houses.json

  // Role ID used for voting (Members role)
  roleId: '',

  // Label used in embeds for the role
  roleLabel: 'Members',

  // Channel where motions will be posted
  motionChannelId: '',

  // Channel where events will be posted
  eventChannelId: '',

  // Quorum type (majority, fixed, percentage, etc.)
  quorumType: 'majority',

  // Fixed quorum number (used if quorumType = fixed)
  quorumNumber: 5,

  // Percentage quorum (used if quorumType = percentage)
  quorumPercent: 0.8,

  // Minimum quorum requirement (safety floor)
  quorumMin: 4,


  /*
  =========================
  MOTION NOTIFICATIONS
  =========================
  */

  notifications: {

    // Ping the members role when a motion is opened
    pingRoleOnOpenMotion: true,

    // Message sent when pinging the role
    pingRoleMessage: 'There is an open motion. Please review and vote.',

    // Send DM reminders to members who have not voted
    dmNonVoters: true,

    // Delay before first DM reminder (in minutes)
    initialDmDelayMinutes: 10,

    // How often to repeat reminders (in hours)
    repeatDmEveryHours: 24,

    // How often the system checks for reminders (in minutes)
    reminderCheckIntervalMinutes: 10,

    // Include a clickable motion link in the DM
    includeMotionLinkInDm: true,
  },


  /*
  =========================
  EVENT NOTIFICATIONS
  =========================
  */

  eventNotifications: {

    // Send DM reminders before events
    dmReminders: true,

    // Send reminder message in the event channel
    channelReminders: true,

    // Only remind users who have NOT responded
    dmNonRespondersOnly: false,

    // How often to check for event reminders (in minutes)
    reminderCheckIntervalMinutes: 10,

    // When to send reminders before event (in hours)
    // Example: 24 = 1 day before, 2 = 2 hours before
    reminderHoursBefore: [24, 2],
  },


  /*
  =========================
  WEB SYNC SETTINGS (OPTIONAL)
  =========================
  */

  webSync: {

    // Enable syncing events to a web/PHP endpoint
    enabled: false,

    // Full endpoint URL (leave blank if using baseUrl + endpointPath)
    eventsEndpoint: '',

    // Base URL for auto-building endpoint
    // Example: https://yourdomain.com/oxford_voting
    baseUrl: '',

    // Path appended to baseUrl for endpoint
    endpointPath: '/web/events_sync.php',

    // Automatically build endpoint from baseUrl + endpointPath
    autoDetectFromBaseUrl: true,

    // API key used to secure the endpoint
    apiKey: 'CHANGE_THIS_SECRET',

    // Timeout for web requests (milliseconds)
    timeoutMs: 10000,
  },
};