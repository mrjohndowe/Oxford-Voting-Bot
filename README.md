# Oxford Voting Bot v5.0.0

Oxford Voting Bot is a multi-house Discord bot for Oxford Houses that handles two separate systems:

- **Motions**: stored per Discord server in `motions.json`
- **Events**: stored globally across all connected servers in `events.json`

It includes vote tracking, quorum logic, reminders, live event RSVP syncing, and optional PHP dashboard support.

## Main Features

### Motion system
- `/motion` opens a modal to create a motion
- separate per house / per Discord server
- motion creator can vote
- motion creator cannot second their own motion
- aye and nay voting
- nay requires a reason
- button to view nay responses
- close motion button
- withdraw motion button
- configurable quorum
- role ping on new motion
- direct-message reminders for members who have not voted

### Event system
- `/event` opens a modal to create an event
- asks for event name and event date/time
- shared globally across all Discord servers using the bot
- separate `events.json` storage
- yes / no / maybe RSVP buttons
- global RSVP list shown on every event embed
- live synced counts and percentages
- close event button
- DM and channel reminders before event start
- optional PHP dashboard sync

### Multi-house support
- each server stores its own setup in `houses.json`
- each server can use its own:
  - members role
  - motion channel
  - event channel
  - role label
  - quorum settings

## Pre-Invite Preparation

Before inviting the bot, prepare the Discord server:

1. Create a text channel  
   Preferred name: `house-motions`

2. Create a members role  
   Preferred name: `Members`

3. Assign the members role to all users who should be able to vote or RSVP

These names can be changed, but those are the recommended defaults.

## How to Invite the Bot

1. Click on the bot's profile
2. Click **Add App**
3. Click **Add to Server**
4. Select the server
5. Authorize the bot

After the bot joins, run `/setup` and follow the prompts.

## Required Discord Permissions

The bot should have:
- View Channel
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands

Recommended:
- Mention Everyone
- Manage Messages

## Setup Command

Run this in each server:

```text
/setup
```

The command stores setup data in `houses.json` for that server.

It supports:
- members role
- motion channel
- event channel
- role label
- quorum type
- quorum number
- quorum percent
- quorum minimum

## Commands

### `/setup`
Configures the bot for the current server.

### `/motion`
Creates a new motion in the configured motion channel.

### `/event`
Creates a new global event in every configured event channel.

## File Structure

```text
index.js
config.js
deploy-commands.js
package.json
motions.json
events.json
houses.json
README.md
RELEASE_NOTES_v5.0.0.md
DISCORD_CHANGELOG.md
WEB_SYNC_README.md
INSTALL_XAMPP.md
web/
  dashboard.php
  events_sync.php
  api/
    events.php
```

## Storage Files

### `motions.json`
- stores motions only
- stays separate from Discord to Discord

### `events.json`
- stores events only
- shared globally across all connected Discord servers

### `houses.json`
- stores server setup information

## Install on Windows / XAMPP

See [INSTALL_XAMPP.md](INSTALL_XAMPP.md) for full setup instructions.

## Web Dashboard

If web sync is enabled, you can use the included PHP dashboard to show live event data.

Dashboard:
```text
http://localhost/oxford_voting/web/dashboard.php
```

## Notes

- motions and events stay completely separate
- event syncing is global
- motion voting is local to each house
- every server should run `/setup`
- if the bot cannot post in a configured channel, it now shows a safe permissions error instead of crashing

## Copyright

© 2026 Mr John Dowe
