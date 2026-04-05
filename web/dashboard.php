<?php
declare(strict_types=1);
$dataFile = __DIR__ . '/events_data.json';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Oxford Voting Bot - Event Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #0f172a;
      --card: #111827;
      --border: #334155;
      --text: #e5e7eb;
      --muted: #94a3b8;
      --yes: #16a34a;
      --no: #dc2626;
      --maybe: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }
    h1 { margin-top: 0; }
    .meta { color: var(--muted); margin-bottom: 24px; }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
    }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid var(--border);
      margin-bottom: 10px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 14px 0;
    }
    .stat {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      text-align: center;
    }
    .yes { color: var(--yes); }
    .no { color: var(--no); }
    .maybe { color: var(--maybe); }
    .list-title {
      margin: 12px 0 6px;
      font-weight: bold;
    }
    ul {
      margin: 0;
      padding-left: 18px;
    }
    .empty {
      color: var(--muted);
    }
  </style>
</head>
<body>
  <h1>Oxford Voting Bot - Global Event Dashboard</h1>
  <div class="meta">
    Auto-refreshes every 10 seconds. Dashboard reads synced global event data from <code>events_data.json</code>.
  </div>

  <div id="app">Loading...</div>

  <script>
    async function loadEvents() {
      try {
        const res = await fetch('api/events.php?_=' + Date.now());
        const payload = await res.json();
        const events = Array.isArray(payload.events) ? payload.events : [];
        const syncedAt = payload.syncedAt || 'Unknown';

        if (!events.length) {
          document.getElementById('app').innerHTML = '<div class="empty">No synced events found yet.</div>';
          return;
        }

        const html = `
          <div class="meta">Last synced: ${syncedAt}</div>
          <div class="grid">
            ${events.map(event => {
              const yesVotes = Array.isArray(event.yesVotes) ? event.yesVotes : [];
              const noVotes = Array.isArray(event.noVotes) ? event.noVotes : [];
              const maybeVotes = Array.isArray(event.maybeVotes) ? event.maybeVotes : [];
              const total = yesVotes.length + noVotes.length + maybeVotes.length;
              const pct = (count) => total ? Math.round((count / total) * 100) + '%' : '0%';

              const list = (votes) => votes.length
                ? '<ul>' + votes.map(v => `<li>${(v.displayName || v.username || v.userId || 'Unknown')}</li>`).join('') + '</ul>'
                : '<div class="empty">None</div>';

              return `
                <div class="card">
                  <div class="pill">${event.status || 'Open'}</div>
                  <h2>${event.eventName || 'Unnamed Event'}</h2>
                  <div><strong>Date & Time:</strong> ${event.eventDateTime || 'Not provided'}</div>
                  <div><strong>Created By:</strong> ${event.createdBy || 'Unknown'}</div>

                  <div class="stats">
                    <div class="stat yes"><strong>${yesVotes.length}</strong><br>Yes (${pct(yesVotes.length)})</div>
                    <div class="stat no"><strong>${noVotes.length}</strong><br>No (${pct(noVotes.length)})</div>
                    <div class="stat maybe"><strong>${maybeVotes.length}</strong><br>Maybe (${pct(maybeVotes.length)})</div>
                  </div>

                  <div class="list-title yes">Yes</div>
                  ${list(yesVotes)}

                  <div class="list-title no">No</div>
                  ${list(noVotes)}

                  <div class="list-title maybe">Maybe</div>
                  ${list(maybeVotes)}
                </div>
              `;
            }).join('')}
          </div>
        `;

        document.getElementById('app').innerHTML = html;
      } catch (error) {
        document.getElementById('app').innerHTML = '<div class="empty">Failed to load event data.</div>';
      }
    }

    loadEvents();
    setInterval(loadEvents, 10000);
  </script>
</body>
</html>
