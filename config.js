module.exports = {
  token: 'YOUR_BOT_TOKEN',
  clientId: 'YOUR_CLIENT_ID',

  debug: false,

  jsonFile: './motions.json',
  eventsFile: './events.json',
  houseConfigFile: './houses.json',

  publicBaseUrl: '',

  // Motion settings
  allowSelfVote: true,
  allowSelfSecond: false,
  allowVoteChange: false,
  autoCloseOnQuorum: false,
  showQuorumProgress: true,
  showProgressBars: true,
  showMemberCount: true,

  // Default fallback values used before /setup is completed
  roleId: '',
  roleLabel: 'Members',
  motionChannelId: '',
  eventChannelId: '',
  quorumType: 'majority',
  quorumNumber: 5,
  quorumPercent: 0.8,
  quorumMin: 4,

  notifications: {
    pingRoleOnOpenMotion: true,
    pingRoleMessage: 'There is an open motion. Please review and vote.',
    dmNonVoters: true,
    initialDmDelayMinutes: 10,
    repeatDmEveryHours: 24,
    reminderCheckIntervalMinutes: 10,
    includeMotionLinkInDm: true,
  },

  eventNotifications: {
    dmReminders: true,
    channelReminders: true,
    dmNonRespondersOnly: false,
    reminderCheckIntervalMinutes: 10,
    reminderHoursBefore: [24, 2],
  },

  webSync: {
    enabled: false,
    eventsEndpoint: '',
    baseUrl: '',
    endpointPath: '/web/events_sync.php',
    autoDetectFromBaseUrl: true,
    apiKey: 'CHANGE_THIS_SECRET',
    timeoutMs: 10000,
  },
};
