**Oxford Voting Bot — v5.0.0 Update**

**🆕 Multi-House Support**
- Supports multiple Discord servers
- Each server stores its own setup in `houses.json`

**🗳️ Motion System**
- Motions stay separate per Discord/server
- Motion creator can vote
- Motion creator cannot second their own motion
- Aye / Nay voting with nay reason popup
- View nay responses button
- Close motion and withdraw motion buttons
- DM reminders for non-voters
- Role ping on open motions

**📅 Global Event System**
- Added separate `events.json`
- Events are shared across all Discord servers using the bot
- New `/event` command with modal popup
- Collects event name and event date/time

**✅ RSVP Options**
- Yes
- No
- Maybe

**📊 Live Sync**
- Every event embed updates everywhere
- Shared RSVP lists from all connected Discords
- Live totals and percentages

**🔔 Reminders**
- Motion DM reminders for non-voters
- Event DM reminders
- Event channel reminders before the event

**🌐 Web Support**
- Added PHP dashboard support
- Added automatic endpoint detection
- Added sync endpoint and API files

**🛠️ Fixes**
- Fixed broken newline syntax issues in `index.js`
- Fixed posting errors caused by missing permissions
- Improved invalid channel handling
- Improved multi-server embed updates

**📁 Storage**
- `motions.json` = motions only
- `events.json` = events only
- `houses.json` = server setup only

**© 2026 Mr John Dowe**
