# Web Sync Setup

The bot can automatically send global event data to the included PHP endpoint.

## Bot-side config

In `config.js`:

```js
webSync: {
  enabled: true,
  eventsEndpoint: '',
  baseUrl: 'http://localhost/oxford_voting',
  endpointPath: '/web/events_sync.php',
  autoDetectFromBaseUrl: true,
  apiKey: 'CHANGE_THIS_SECRET',
  timeoutMs: 10000,
}
```

If `eventsEndpoint` is blank and `autoDetectFromBaseUrl` is true, the bot builds the full URL automatically.

Example result:

```text
http://localhost/oxford_voting/web/events_sync.php
```

## How it works

The bot pushes:
- source
- syncedAt
- endpointAutoDetected
- events array

The PHP endpoint saves the data to `web/events_data.json`.

## Dashboard

Open:

```text
http://localhost/oxford_voting/web/dashboard.php
```

The dashboard refreshes every 10 seconds.

## Security

The endpoint checks the `x-oxford-api-key` header.

Set the same key in:
- `config.js`
- `web/events_sync.php`
