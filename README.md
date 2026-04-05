# 🏛️ Oxford Voting Bot v5.0.0

A multi-house Discord bot designed for Oxford Houses to manage **motions** and **events** with real-time syncing, reminders, and a live dashboard.

---

## 🚀 Features

### 🗳️ Motions (Per House)
- `/motion` command
- Aye / Nay voting
- Nay reason popup
- Member vote tracking
- Quorum support
- DM reminders for non-voters
- Motions are **NOT shared across servers**

---

### 📅 Events (Global)
- `/event` command
- Modal input (name + date/time)
- Yes / No / Maybe RSVP
- Global sync across all servers
- Live embed updates everywhere
- Event reminders
- Close event button

---

### 🌐 Web Dashboard
- Live PHP dashboard
- Shows:
  - events
  - RSVP lists
  - totals
  - percentages
- Auto-refresh every 10 seconds

---

## 📦 Installation (Windows + XAMPP)

### 1. Install Requirements
- Node.js (v18+)
- XAMPP (Apache + PHP)

---

### 2. Extract Project

Extract ZIP to:

```text
C:\oxford_voting\
```

### 3. Install Node Dependencies
```bash
cd C:\oxford_voting
npm install
```

### 4. Configure Bot
Edit `config.js`:
```javascript
module.exports = {
  token: 'YOUR_BOT_TOKEN',
  clientId: 'YOUR_CLIENT_ID',

  webSync: {
    enabled: true,
    baseUrl: 'http://localhost/oxford_voting',
    endpointPath: '/web/events_sync.php',
    apiKey: 'CHANGE_THIS_SECRET'
  }
};
```
### 5. Setup XAMPP
Move project into:
```C:\xampp\htdocs\oxford_voting```
Start:
- Apache

### 6. Dashboard URL
```http://localhost/oxford_voting/web/dashboard.php```

### 7. Deploy Commands
```bash
node index.js
```
## 🤖 Invite Bot
1. Click bot profile
2. Click Add App
3. Click Add to Server

## ⚙️ Setup (Discord)

Create:

- Channel → house-motions
- Role → Members

Then configure bot (UI or commands).

## 📁 File Structure
```
motions.json   → per-server motions
events.json    → global events
houses.json    → server config
web/           → dashboard + API
```

## 🔒 Permissions Required
- View Channel
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands

## 🧠 Notes
- Motions = per server
- Events = global
- Fully synced across all Discords

###### © 2026 Mr John Dowe