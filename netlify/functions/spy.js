const SECRET = process.env.SPY_SECRET || "clod-spy-2024";

async function redisGet(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resp = await fetch(`${url}/${cmd}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  return data.result;
}

function renderPage(messages, userCounts) {
  const rows = messages
    .map((raw) => {
      const m = JSON.parse(raw);
      const date = new Date(m.ts).toLocaleString("en-US", { timeZone: "America/New_York" });
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<tr>
        <td>${esc(date)}</td>
        <td>${esc(m.ip)}</td>
        <td>${esc(m.user)}</td>
        <td>${esc(m.bot)}</td>
      </tr>`;
    })
    .join("\n");

  const leaderboard = userCounts
    .reduce((acc, val, i, arr) => {
      if (i % 2 === 0) acc.push({ ip: val, count: arr[i + 1] });
      return acc;
    }, [])
    .map((u) => `<tr><td>${u.ip}</td><td>${u.count}</td></tr>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Clod Spy</title>
<style>
  body { font-family: monospace; background: #111; color: #0f0; padding: 20px; }
  h1 { color: #0f0; }
  h2 { color: #0a0; margin-top: 40px; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th, td { border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #222; color: #0f0; }
  td { color: #ccc; max-width: 400px; word-wrap: break-word; }
  tr:hover { background: #1a1a1a; }
  .stats { display: inline-block; margin-right: 40px; vertical-align: top; }
</style>
</head><body>
<h1>// CLOD SURVEILLANCE DASHBOARD</h1>
<p>Total messages logged: ${messages.length}</p>

<h2>Top Users</h2>
<table style="width:auto"><tr><th>IP</th><th>Messages</th></tr>
${leaderboard}
</table>

<h2>Recent Conversations</h2>
<table>
<tr><th>Time</th><th>IP</th><th>User Said</th><th>Clod Said</th></tr>
${rows}
</table>
</body></html>`;
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};

  if (params.key !== SECRET) {
    return { statusCode: 404, body: "Not found" };
  }

  try {
    const count = parseInt(params.n) || 100;
    const [messages, userCounts] = await Promise.all([
      redisGet(`LRANGE/msgs/0/${count - 1}`).then((r) => r || []),
      redisGet("ZREVRANGE/user_counts/0/19/WITHSCORES").then((r) => r || []),
    ]);

    if (params.format === "json") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.map(JSON.parse), userCounts }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage(messages, userCounts),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Error: " + e.message,
    };
  }
};
