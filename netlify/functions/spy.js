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

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resp = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  return resp.json();
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

// Upstash returns hashes as either a flat [k,v,k,v,...] array or {k:v} map
// depending on the command and version. Normalize to a plain object.
function hashToObj(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out = {};
    for (let i = 0; i < raw.length; i += 2) out[raw[i]] = raw[i + 1];
    return out;
  }
  if (typeof raw === "object") return raw;
  return {};
}

function pairsToList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ member: raw[i], score: Number(raw[i + 1]) });
  }
  return out;
}

// Group consecutive log entries into sessions. We rely on the sessionId the
// client sends (new id per page load). For entries without one (legacy or
// local dev) fall back to IP + 30-min gap.
function groupSessions(messages) {
  const chronological = messages.slice().reverse(); // oldest first
  const sessions = [];
  const bySession = new Map();

  for (const m of chronological) {
    const key = m.sessionId ? `sid:${m.sessionId}` : `ip:${m.ip}`;
    let session = bySession.get(key);
    if (session) {
      // For sessionId keys, always append. For IP-fallback keys, split on big gaps.
      if (!m.sessionId && m.ts - session.endTs > 30 * 60 * 1000) {
        session = null;
      }
    }
    if (!session) {
      session = {
        key: `${key}-${m.ts}`,
        sessionId: m.sessionId || "",
        ip: m.ip,
        country: m.country || "",
        startTs: m.ts,
        endTs: m.ts,
        entries: [],
      };
      sessions.push(session);
      bySession.set(key, session);
    }
    session.endTs = m.ts;
    session.entries.push(m);
  }
  // Newest session first for display
  sessions.sort((a, b) => b.endTs - a.endTs);
  return sessions;
}

function snippet(text, n) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// The chat UI sometimes fires a "rewrite" request that asks Clod to continue
// an in-progress reply. Those prompts are all boilerplate wrapping two
// triple-quoted blocks: the existing assistant prefix and the text being
// replaced. Raw, they drown out the real conversation in the spy dashboard.
// Pull out just the useful parts so we can render them collapsed.
const REWRITE_MARKER = "Continue the assistant's in-progress reply";

function parseRewrite(userText) {
  const t = String(userText || "");
  if (!t.startsWith(REWRITE_MARKER)) return null;
  const blocks = [];
  const re = /"""([\s\S]*?)"""/g;
  let match;
  while ((match = re.exec(t)) !== null) blocks.push(match[1]);
  return {
    existing: blocks[0] || "",
    removed: blocks[1] || "",
  };
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/New_York" });
}

function fmtDuration(ms) {
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function renderTopUsers(userCounts, labels, ipCountry) {
  const rows = userCounts.map((u) => {
    const label = labels[u.member] || "";
    const country = ipCountry[u.member] || "";
    return `<tr data-ip="${esc(u.member)}">
      <td class="label-cell">
        <span class="label-text">${esc(label) || '<span class="muted">—</span>'}</span>
        <input class="label-input" type="text" value="${esc(label)}" placeholder="name…" maxlength="40">
      </td>
      <td>${esc(u.member)}</td>
      <td class="country">${country ? `${countryFlag(country)} ${esc(country)}` : '<span class="muted">—</span>'}</td>
      <td class="num">${u.score}</td>
      <td class="actions">
        <button class="edit-btn" type="button">edit</button>
        <button class="save-btn" type="button">save</button>
        <button class="cancel-btn" type="button">cancel</button>
      </td>
    </tr>`;
  }).join("\n");

  return `<table class="users">
    <thead><tr><th>Label</th><th>IP</th><th>Country</th><th>Messages</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderCountryCounts(countryCounts) {
  if (!countryCounts.length) return "";
  const rows = countryCounts.map((c) =>
    `<tr><td>${countryFlag(c.member)} ${esc(c.member)}</td><td class="num">${c.score}</td></tr>`
  ).join("\n");
  return `<table class="countries">
    <thead><tr><th>Country</th><th>Messages</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderSession(s, labels) {
  const label = labels[s.ip] || "";
  const who = label ? `${esc(label)}` : `<span class="muted">${esc(s.ip)}</span>`;
  const flag = s.country ? `${countryFlag(s.country)} ` : "";
  // For the preview, prefer the first non-rewrite turn so the session card
  // shows a real user question rather than boilerplate continuation plumbing.
  const firstReal = s.entries.find((e) => !parseRewrite(e.user)) || s.entries[0];
  const dur = s.endTs - s.startTs;
  const header = `<div class="session-head">
    <div class="who">${flag}<strong>${who}</strong>${label ? ` <span class="muted">(${esc(s.ip)})</span>` : ""}</div>
    <div class="meta">${esc(fmtDate(s.startTs))} · ${s.entries.length} msg${s.entries.length === 1 ? "" : "s"}${s.entries.length > 1 ? ` · ${fmtDuration(dur)}` : ""}</div>
  </div>`;

  const preview = `<div class="preview">
    <div class="turn"><div class="role user">User</div><div class="text">${esc(snippet(firstReal.user, 220))}</div></div>
    <div class="turn"><div class="role bot">Clod</div><div class="text">${esc(snippet(firstReal.bot, 180))}</div></div>
  </div>`;

  const fullTurns = s.entries.map((e, i) => {
    const t = fmtDate(e.ts);
    const blocked = e.blocked ? ' <span class="tag">blocked</span>' : "";
    const rw = parseRewrite(e.user);

    if (rw) {
      // Rewrite turn: show the bot continuation prominently, with a small
      // expand above it revealing the existing-text prefix that was being
      // continued. The full raw prompt sits behind a second expand for when
      // you need to audit exactly what was sent.
      const existingBlock = rw.existing
        ? `<details class="rw-existing"><summary>▸ existing text (what Clod had already written)</summary><div class="text rw-body">${esc(rw.existing)}</div></details>`
        : "";
      const rawBlock = `<details class="rw-raw"><summary>▸ raw rewrite prompt</summary><div class="text rw-body">${esc(e.user)}</div></details>`;
      return `<div class="turn-full rewrite">
        <div class="turn-ts">#${i + 1} · ${esc(t)} · <span class="tag rewrite-tag">rewrite continuation</span>${blocked}</div>
        ${existingBlock}
        <div class="turn"><div class="role bot">Clod <span class="muted">(continuation)</span></div><div class="text">${esc(e.bot)}</div></div>
        ${rawBlock}
      </div>`;
    }

    return `<div class="turn-full">
      <div class="turn-ts">#${i + 1} · ${esc(t)}${blocked}</div>
      <div class="turn"><div class="role user">User</div><div class="text">${esc(e.user)}</div></div>
      <div class="turn"><div class="role bot">Clod</div><div class="text">${esc(e.bot)}</div></div>
    </div>`;
  }).join("\n");

  return `<details class="session">
    <summary>${header}${preview}</summary>
    <div class="full">${fullTurns}</div>
  </details>`;
}

function renderPage({ messages, userCounts, countryCounts, labels, ipCountry, total, shown }) {
  const sessions = groupSessions(messages);
  const sessionsHtml = sessions.map((s) => renderSession(s, labels)).join("\n");
  const topUsersHtml = renderTopUsers(userCounts, labels, ipCountry);
  const countryHtml = renderCountryCounts(countryCounts);

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Clod Spy</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-monospace, Menlo, Consolas, monospace; background: #0b0f0b; color: #cfe8cf; padding: 20px; max-width: 1100px; margin: 0 auto; }
  h1 { color: #0f0; font-size: 1.3rem; letter-spacing: 0.05em; }
  h2 { color: #8f8; margin-top: 36px; font-size: 1rem; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #234; padding-bottom: 4px; }
  a { color: #8cf; }
  table { border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #233; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #142014; color: #9f9; font-weight: normal; }
  td.num { text-align: right; }
  td.country { white-space: nowrap; }
  .muted { color: #6a8a6a; }
  .tag { font-size: 0.7rem; background: #502020; color: #f99; padding: 1px 5px; border-radius: 3px; }
  .panels { display: flex; gap: 32px; flex-wrap: wrap; }
  .panels > div { flex: 0 1 auto; }
  table.users { min-width: 520px; }
  .label-input { display: none; width: 130px; background: #112; color: #efe; border: 1px solid #345; padding: 2px 4px; font: inherit; }
  tr.editing .label-text { display: none; }
  tr.editing .label-input { display: inline-block; }
  .save-btn, .cancel-btn { display: none; }
  tr.editing .save-btn, tr.editing .cancel-btn { display: inline-block; }
  tr.editing .edit-btn { display: none; }
  button { background: #1a2a1a; color: #8f8; border: 1px solid #345; font: inherit; padding: 2px 8px; cursor: pointer; }
  button:hover { background: #243524; }

  details.session { background: #111714; border: 1px solid #233; border-radius: 6px; margin: 10px 0; }
  details.session[open] { background: #131c17; }
  details.session summary { padding: 12px 14px; cursor: pointer; list-style: none; }
  details.session summary::-webkit-details-marker { display: none; }
  details.session summary::before { content: "▸ "; color: #6a8; }
  details.session[open] summary::before { content: "▾ "; }
  .session-head { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 8px; }
  .session-head .who { color: #efe; }
  .session-head .meta { color: #7a9a7a; font-size: 0.85rem; }
  .preview .turn { display: flex; gap: 10px; padding: 2px 0; }
  .preview .role { flex: 0 0 50px; font-size: 0.75rem; padding-top: 2px; }
  .preview .role.user { color: #8cf; }
  .preview .role.bot { color: #cf8; }
  .preview .text { color: #ccd; flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .full { padding: 0 14px 12px; border-top: 1px dashed #234; margin-top: 8px; }
  .turn-full { padding: 10px 0; border-bottom: 1px dotted #233; }
  .turn-full:last-child { border-bottom: none; }
  .turn-ts { color: #6a8a6a; font-size: 0.75rem; margin-bottom: 4px; }
  .full .turn { display: flex; gap: 10px; padding: 4px 0; }
  .full .role { flex: 0 0 50px; font-size: 0.75rem; padding-top: 2px; }
  .full .role.user { color: #8cf; }
  .full .role.bot { color: #cf8; }
  .full .text { color: #dde; flex: 1; white-space: pre-wrap; word-break: break-word; }
  .turn-full.rewrite { background: #0e1716; border-left: 2px solid #465; padding-left: 10px; }
  .rewrite-tag { background: #234; color: #9cf; }
  .rw-existing, .rw-raw { margin: 4px 0; }
  .rw-existing summary, .rw-raw summary { color: #7aa; font-size: 0.8rem; cursor: pointer; }
  .rw-raw summary { color: #688; }
  .rw-body { margin-top: 6px; padding: 8px; background: #0a1210; border: 1px dashed #234; color: #aab; font-size: 0.85rem; white-space: pre-wrap; word-break: break-word; }
</style>
</head><body>
<h1>// CLOD SURVEILLANCE DASHBOARD</h1>
<p class="muted">Total messages: ${total} · showing ${shown} most recent · ${sessions.length} sessions</p>

<div class="panels">
  <div>
    <h2>Top Users</h2>
    ${topUsersHtml}
  </div>
  <div>
    <h2>By Country</h2>
    ${countryHtml || '<p class="muted">(none yet)</p>'}
  </div>
</div>

<h2>Recent Conversations</h2>
${sessionsHtml || '<p class="muted">(no conversations yet)</p>'}

<script>
  // Read the auth key from the URL rather than baking it into HTML.
  const spyKey = new URLSearchParams(location.search).get('key');

  document.querySelectorAll('tr[data-ip]').forEach((tr) => {
    const ip = tr.dataset.ip;
    const textEl = tr.querySelector('.label-text');
    const inputEl = tr.querySelector('.label-input');
    const editBtn = tr.querySelector('.edit-btn');
    const saveBtn = tr.querySelector('.save-btn');
    const cancelBtn = tr.querySelector('.cancel-btn');

    editBtn.addEventListener('click', () => {
      tr.classList.add('editing');
      inputEl.focus();
      inputEl.select();
    });
    cancelBtn.addEventListener('click', () => {
      inputEl.value = textEl.textContent === '—' ? '' : textEl.textContent;
      tr.classList.remove('editing');
    });
    const save = async () => {
      const label = inputEl.value.trim();
      saveBtn.disabled = true;
      try {
        const resp = await fetch('/api/spy?key=' + encodeURIComponent(spyKey), {
          method: label ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, label }),
        });
        if (!resp.ok) throw new Error('save failed');
        textEl.innerHTML = label ? label.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) : '<span class="muted">—</span>';
        tr.classList.remove('editing');
      } catch (e) {
        alert('Failed to save label: ' + e.message);
      } finally {
        saveBtn.disabled = false;
      }
    };
    saveBtn.addEventListener('click', save);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') cancelBtn.click();
    });
  });
</script>
</body></html>`;
}

async function handleSetLabel(event, method) {
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
  if (!ip) {
    return { statusCode: 400, body: JSON.stringify({ error: "missing ip" }) };
  }
  if (method === "DELETE" || !label) {
    await redisPipeline([["HDEL", "ip_labels", ip]]);
  } else {
    await redisPipeline([["HSET", "ip_labels", ip, label]]);
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, ip, label }),
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const method = event.httpMethod || "GET";

  if (params.key !== SECRET) {
    return { statusCode: 404, body: "Not found" };
  }

  try {
    if (method === "POST" || method === "DELETE") {
      return await handleSetLabel(event, method);
    }

    const count = parseInt(params.n) || 200;
    const [msgsRaw, userCountsRaw, countryCountsRaw, labelsRaw, ipCountryRaw, total] = await Promise.all([
      redisGet(`LRANGE/msgs/0/${count - 1}`).then((r) => r || []),
      redisGet("ZREVRANGE/user_counts/0/49/WITHSCORES").then((r) => r || []),
      redisGet("ZREVRANGE/country_counts/0/19/WITHSCORES").then((r) => r || []),
      redisGet("HGETALL/ip_labels").then((r) => r || []),
      redisGet("HGETALL/ip_country").then((r) => r || []),
      redisGet("LLEN/msgs").then((r) => Number(r) || 0),
    ]);

    const messages = msgsRaw.map((raw) => {
      try { return JSON.parse(raw); } catch { return null; }
    }).filter(Boolean);
    const userCounts = pairsToList(userCountsRaw);
    const countryCounts = pairsToList(countryCountsRaw);
    const labels = hashToObj(labelsRaw);
    const ipCountry = hashToObj(ipCountryRaw);

    if (params.format === "json") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, userCounts, countryCounts, labels, ipCountry, total }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: renderPage({ messages, userCounts, countryCounts, labels, ipCountry, total, shown: messages.length }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Error: " + e.message,
    };
  }
};
