# Oxford Voting Bot v5.0.0

## Overview

This release adds full multi-house support, global event syncing, reminder systems, optional PHP dashboard support, and safer permission handling.

## Added

### Multi-house support
- separate server setup stored in `houses.json`
- `/setup` command for per-server configuration

### Motion system
- house-specific motion storage in `motions.json`
- aye and nay voting
- motion creator can vote
- motion creator cannot second their own motion
- nay reason modal
- button to view nay responses
- close motion button
- withdraw motion button
- role ping support
- direct-message reminders for non-voters

### Event system
- separate `events.json`
- `/event` command
- modal for event name and event date/time
- yes / no / maybe RSVP
- global event syncing across all connected Discord servers
- synced embed updates across servers
- close event button
- live counts and percentages

### Event reminders
- DM reminders
- channel reminders
- configurable reminder hours before the event
- optional non-responder-only reminders

### Web integration
- automatic event endpoint detection from base URL
- PHP sync endpoint
- PHP API file
- live PHP dashboard

## Changed

- motions remain local to each Discord server
- events are now global
- motions and events remain fully separated in different files
- safer channel permission checks before posting embeds

## Fixed

- broken newline syntax issues in `index.js`
- missing permissions crash during channel send
- invalid configured channel handling
- safer embed updates across multiple guilds

## Added files

- `events.json`
- `houses.json`
- `web/dashboard.php`
- `web/events_sync.php`
- `web/api/events.php`
- `README.md`
- `INSTALL_XAMPP.md`
- `WEB_SYNC_README.md`
- `RELEASE_NOTES_v5.0.0.md`

## Notes

- every server should run `/setup`
- motions are not shared globally
- events are shared globally
- the PHP dashboard is for event data only

## Copyright

© 2026 Mr John Dowe
