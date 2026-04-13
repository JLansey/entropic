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
      const existingBlock = rw.existing ? `<div class="rewrite-existing">${esc(rw.existing)}</div>` : "";
      const rawBlock = `<details class="rw-details"><summary>▸ raw rewrite prompt</summary><div class="rw-body">${esc(e.user)}</div></details>`;
      return `<div class="chat-row bot rewrite-row">
        <div class="bubble" style="padding:0; overflow:hidden; border: 1px solid var(--border); background: var(--bubble-bot);">
          ${existingBlock}
          <div class="rewrite-new clod-markdown">${esc(e.bot)}</div>
        </div>
        <div class="turn-meta">#${i + 1} · ${esc(t)} <span class="tag rewrite-tag">Continuation</span>${blocked}</div>
        ${rawBlock}
      </div>`;
    }

    return `
      <div class="chat-row user">
        <div class="bubble">${esc(e.user)}</div>
        <div class="turn-meta">#${i + 1} · ${esc(t)}${blocked}</div>
      </div>
      <div class="chat-row bot">
        <div class="bubble clod-markdown">${esc(e.bot)}</div>
        <div class="turn-meta">Clod</div>
      </div>
    `;
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clod Spy Dashboard</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { 
    color-scheme: dark; 
    --bg: #0b0f0b; 
    --fg: #d0e8d0; 
    --accent: #0f0;
    --panel-bg: #111714;
    --border: #2a3d35;
    --bubble-user: #2b7048;
    --bubble-user-text: #fff;
    --bubble-bot: #1c2621;
    --bubble-bot-text: #e0f0e0;
    --muted: #6b8f75;
    --tag-bg: #402020;
    --tag-fg: #f99;
  }
  body { 
    font-family: 'Inter', system-ui, -apple-system, sans-serif; 
    background: var(--bg); 
    color: var(--fg); 
    padding: 24px; 
    max-width: 1040px; 
    margin: 0 auto; 
    line-height: 1.5;
  }
  h1 { color: var(--accent); font-size: 1.6rem; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 5px; }
  h2 { color: #8f8; margin-top: 48px; margin-bottom: 16px; font-size: 1.1rem; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 2px solid var(--border); padding-bottom: 8px; }
  a { color: #8cf; }
  
  /* Tables */
  table { border-collapse: separate; border-spacing: 0; margin-top: 8px; width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  th, td { padding: 12px 14px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  th { background: #16201a; color: #9f9; font-weight: 500; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.country { white-space: nowrap; }
  tbody tr { transition: background 0.15s; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  
  .muted { color: var(--muted); }
  .tag { font-size: 0.65rem; background: var(--tag-bg); color: var(--tag-fg); padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  
  .panels { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 40px; }
  .panels > div { flex: 1 1 320px; }
  
  /* Labels */
  .label-input { display: none; width: 100%; max-width: 150px; background: #0c120e; color: #efe; border: 1px solid var(--border); padding: 6px 8px; border-radius: 4px; font: inherit; }
  tr.editing .label-text { display: none; }
  tr.editing .label-input { display: inline-block; }
  .save-btn, .cancel-btn { display: none; }
  tr.editing .save-btn, tr.editing .cancel-btn { display: inline-block; }
  tr.editing .edit-btn { display: none; }
  td.actions { white-space: nowrap; width: 1%; }
  button { background: #1a2a20; color: #8f8; border: 1px solid var(--border); font-size: 0.8rem; font-weight: 500; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
  button:hover { background: #263e30; border-color: #3b544b; }
  
  /* Session Cards */
  details.session { 
    background: var(--panel-bg); 
    border: 1px solid var(--border); 
    border-radius: 12px; 
    margin: 16px 0; 
    overflow: hidden;
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  details.session:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.25); border-color: #3b544b; }
  details.session[open] { background: #131c17; border-color: #3b544b; }
  
  details.session summary { padding: 16px 20px; cursor: pointer; list-style: none; user-select: none; }
  details.session summary::-webkit-details-marker { display: none; }
  details.session summary:focus { outline: none; }
  
  .session-head { display: flex; justify-content: space-between; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 12px; }
  .session-head .who { color: #fff; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; font-weight: 500; }
  .session-head .meta { color: var(--muted); font-size: 0.8rem; font-family: ui-monospace, monospace; }
  
  .preview { display: flex; flex-direction: column; gap: 8px; }
  .preview .turn { display: flex; gap: 12px; align-items: baseline; }
  .preview .role { flex: 0 0 45px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
  .preview .role.user { color: #5bc0be; text-align: right; }
  .preview .role.bot { color: #a3d9a5; text-align: right; }
  .preview .text { color: #b5c4ba; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
  
  /* Chat Bubbles */
  .full { padding: 24px; background: #080b09; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 24px; }
  
  .chat-row { display: flex; flex-direction: column; max-width: 80%; }
  .chat-row.user { align-self: flex-end; align-items: flex-end; }
  .chat-row.bot { align-self: flex-start; align-items: flex-start; }
  
  .bubble { 
    padding: 12px 18px; 
    border-radius: 20px; 
    font-size: 0.95rem; 
    line-height: 1.5; 
    white-space: pre-wrap; 
    word-break: break-word; 
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  
  .chat-row.user .bubble { 
    background: var(--bubble-user); 
    color: var(--bubble-user-text); 
    border-bottom-right-radius: 4px;
  }
  
  .chat-row.bot .bubble { 
    background: var(--bubble-bot); 
    color: var(--bubble-bot-text); 
    border-bottom-left-radius: 4px; 
    border: 1px solid #23302a;
  }
  
  .turn-meta { color: var(--muted); font-size: 0.7rem; margin: 6px 10px 0; font-family: ui-monospace, monospace; }
  
  /* Rewrites */
  .rewrite-row .bubble { padding: 0; }
  .rewrite-existing { padding: 12px 18px; opacity: 0.65; font-size: 0.9em; background: rgba(0,0,0,0.2); border-bottom: 1px dashed rgba(255,255,255,0.05); }
  .rewrite-new { padding: 12px 18px; background: #203628; }
  .rewrite-tag { background: #1a4230; color: #8cf; }
  
  .rw-details { margin-top: 6px; }
  .rw-details summary { 
    color: #5b7a66; 
    font-size: 0.75rem; 
    cursor: pointer; 
    padding: 4px 8px; 
    background: rgba(255,255,255,0.02); 
    border-radius: 4px; 
    display: inline-block;
    transition: background 0.15s, color 0.15s;
  }
  .rw-details summary:hover { background: rgba(255,255,255,0.06); color: #8fba9c; }
  .rw-body { margin-top: 6px; padding: 12px; background: #050706; border: 1px solid #16201a; border-radius: 8px; color: #789; font-size: 0.8rem; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; max-height: 250px; overflow-y: auto; }

  /* Markdown & Math adjustments */
  .clod-markdown p { margin: 0 0 10px; }
  .clod-markdown p:last-child { margin-bottom: 0; }
  .clod-markdown code { background: rgba(0,0,0,0.25); padding: 2px 4px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.9em; }
  .clod-markdown pre { background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; overflow-x: auto; margin: 10px 0; border: 1px solid rgba(255,255,255,0.05); }
  .clod-markdown pre code { background: none; padding: 0; }
  .clod-markdown ul, .clod-markdown ol { margin: 8px 0; padding-left: 24px; }
  .clod-markdown h1, .clod-markdown h2, .clod-markdown h3 { font-size: 1.1em; margin: 14px 0 6px; color: #fff; }
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

  // Render markdown and math for bot responses
  document.querySelectorAll('.clod-markdown').forEach((el) => {
    try {
      let safe = el.innerHTML;
      const mathBlocks = [];
      safe = safe.replace(/(\\$\\$[\\s\\S]*?\\$\\$|\\\\\\[[\\s\\S]*?\\\\\\]|\\\\\\([\\s\\S]*?\\\\\\))/g, (m) => {
        mathBlocks.push(m);
        return '%%MATH' + (mathBlocks.length - 1) + '%%';
      });
      let html = window.marked ? marked.parse(safe) : safe;
      mathBlocks.forEach((m, i) => {
        html = html.replace('%%MATH' + i + '%%', m);
      });
      el.innerHTML = html;
      if (window.renderMathInElement) {
        renderMathInElement(el, {
          delimiters: [
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
          ]
        });
      }
    } catch(e) {
      console.error('Markdown rendering error:', e);
    }
  });

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
