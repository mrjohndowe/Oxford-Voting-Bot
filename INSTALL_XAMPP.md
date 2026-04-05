# Install on Windows + XAMPP

## 1. Install requirements

Install:
- Node.js 18 or newer
- XAMPP with Apache and PHP

## 2. Extract the bot

Place the bot files somewhere like:

```text
C:\oxford_voting
```

## 3. Install Node packages

Open Command Prompt:

```bash
cd C:\oxford_voting
npm install
```

## 4. Configure the bot

Open `config.js` and set:

- `token`
- `clientId`

If using web sync, also set:

- `webSync.enabled`
- `webSync.baseUrl`
- `webSync.apiKey`

Example:

```js
webSync: {
  enabled: true,
  baseUrl: 'http://localhost/oxford_voting',
  endpointPath: '/web/events_sync.php',
  autoDetectFromBaseUrl: true,
  apiKey: 'CHANGE_THIS_SECRET',
  timeoutMs: 10000,
}
```

## 5. Move PHP web files into XAMPP

Copy the project into:

```text
C:\xampp\htdocs\oxford_voting
```

Or copy only the `web` folder if you prefer.

## 6. Start Apache

Open XAMPP Control Panel and start:
- Apache

## 7. Open the dashboard

In browser:

```text
http://localhost/oxford_voting/web/dashboard.php
```

## 8. Start the bot

From Command Prompt:

```bash
cd C:\oxford_voting
node index.js
```

## 9. Invite the bot and configure the server

Invite it from its Discord profile:

- click the bot profile
- click **Add App**
- click **Add to Server**

Then in each server:

```text
/setup
```

Choose:
- members role
- motion channel
- event channel
- quorum settings

## Notes

- the PHP dashboard reads synced event data only
- motions remain Discord-local and are not shown on the PHP dashboard
- if the dashboard is blank, make sure web sync is enabled and the endpoint is reachable
