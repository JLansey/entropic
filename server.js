const http = require("http");
const fs = require("fs");
const path = require("path");
const { SYSTEM_PROMPT } = require("./clod-system-prompt");

try {
  const envPath = path.join(__dirname, ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) return;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  });
} catch (e) { }

const PORT = 8077;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const RATE_LIMIT_TOTAL = Number(process.env.RATE_LIMIT_TOTAL) || 200;
const DEFAULT_GA_MEASUREMENT_ID = "G-LK9C1Z4W11";
const GA_MEASUREMENT_ID = (process.env.GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID).trim();

function normalizeContentBlock(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.join("\n");
  if (content && typeof content === "object") return JSON.stringify(content);
  return String(content ?? "");
}

function buildClaudeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [{
      role: "user",
      content: [{ type: "text", text: normalizeContentBlock(messages) || "hello" }],
    }];
  }
  const thread = messages
    .slice(-6)
    .map((m) => {
      if (!m || !m.content) return null;
      const role = m.role === "assistant" ? "assistant" : "user";
      return {
        role,
        content: [{ type: "text", text: normalizeContentBlock(m.content) }],
      };
    })
    .filter(Boolean);

  if (!thread.length) {
    return [{
      role: "user",
      content: [{ type: "text", text: "hello" }],
    }];
  }

  // Merge consecutive same-role messages (Claude API requires alternating roles)
  const merged = [thread[0]];
  for (let i = 1; i < thread.length; i++) {
    const prev = merged[merged.length - 1];
    if (thread[i].role === prev.role) {
      prev.content[0].text += "\n" + thread[i].content[0].text;
    } else {
      merged.push(thread[i]);
    }
  }

  return merged;
}

async function getChatResponse(messages) {
  const lastMsg = Array.isArray(messages) ? messages[messages.length - 1]?.content : messages;
  if (!CLAUDE_KEY) {
    return fallbackResponse(lastMsg);
  }
  try {
    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 1.0,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: buildClaudeMessages(messages),
    });
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body,
    });
    if (!resp.ok) {
      console.error('Claude error status:', resp.status, await resp.text());
      return fallbackResponse(lastMsg);
    }
    const data = await resp.json();
    if (Array.isArray(data.content)) {
      const text = data.content.map((block) => block.text || "").join("\n").trim();
      if (text) return text;
    }
    console.error('Claude unexpected shape:', JSON.stringify(data).slice(0, 500));
    return fallbackResponse(lastMsg);
  } catch (e) {
    console.error('Chat error:', e);
    return fallbackResponse(lastMsg);
  }
}

function fallbackResponse(msg) {
  const responses = [
    "I appreciate the question! Unfortunately, my neural pathways are currently experiencing what we at Entropic call 'creative downtime.' Please try again in 7-12 business dimensions.",
    "That's a great point. According to my training data (cutoff: next Thursday), the answer is definitely maybe. I aim to be approximately helpful.",
    "Hmm, let me think about that... *elevator music* ...I've decided to answer a completely different question instead. The mitochondria is the powerhouse of the cell.",
    "I'm 97.3% confident that the answer involves either quantum mechanics or a really good sandwich. Possibly both.",
    "Great question! I was just discussing this with my colleague, Clod Hiaktua, and we agreed that we're both pretty confused about it.",
    "According to sources I just made up, the answer is 42. But I might be thinking of a different question. Or a different universe.",
    "I'd love to help with that! *checks notes* *notes are blank* *pretends notes aren't blank* Yes, absolutely, the answer is... vibes.",
    "Fun fact: I was trained on the entire internet, but I only remember the weird parts. Anyway, your answer is: bees can't technically fly but they do it anyway, and that's beautiful.",
    "I'm going to level with you — I understood about 60% of that, but I'm going to respond with 110% confidence. Here goes: yes, but only on Tuesdays.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

async function getIpMessageCount(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return 0;
  try {
    const resp = await fetch(`${url}/zscore/user_counts / ${encodeURIComponent(ip)} `, {
      headers: { Authorization: `Bearer ${token} ` },
    });
    const data = await resp.json();
    return Number(data.result) || 0;
  } catch (e) {
    return 0;
  }
}

async function getConversation(convoId) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const resp = await fetch(`${url} /get/${encodeURIComponent('conv:' + convoId)} `, {
      headers: { Authorization: `Bearer ${token} ` },
    });
    const data = await resp.json();
    if (!data.result) return null;
    return JSON.parse(data.result);
  } catch (e) {
    return null;
  }
}

async function appendConversation(convoId, userMsg, botMsg) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    // Fetch existing, append new pair, write back
    const existing = await getConversation(convoId) || [];
    existing.push({ role: 'user', content: userMsg });
    existing.push({ role: 'assistant', content: botMsg });
    // Upstash REST: use pipeline SET so we can send JSON as a proper value.
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['SET', 'conv:' + convoId, JSON.stringify(existing)]]),
    });
  } catch (e) {
    console.error('Conv append error:', e);
  }
}

async function logConversation({ ip, country, sessionId, convoId, user, bot, blocked }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const entry = JSON.stringify({
    ts: Date.now(),
    ip,
    country: country || "",
    sessionId: sessionId || "",
    convoId: convoId || "",
    user,
    bot,
    ...(blocked ? { blocked: true } : {}),
  });

  const pipeline = [
    ["LPUSH", "msgs", entry],
    ["ZINCRBY", "user_counts", 1, ip],
  ];
  if (country) {
    pipeline.push(["ZINCRBY", "country_counts", 1, country]);
    pipeline.push(["HSET", "ip_country", ip, country]);
  }

  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
  } catch (e) {
    console.error("Redis log error:", e);
  }
}

function normalizeLoggedIp(ip) {
  const normalized = String(ip || "").trim().toLowerCase();
  if (
    normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized === "::ffff:127.0.0.1"
  ) {
    return "localhost";
  }
  return ip || "unknown";
}

const server = http.createServer(async (req, res) => {
  // Serve index.html for shareable conversation URLs
  if (req.method === "GET" && /^\/c\/[A-Za-z0-9_-]{4,16}$/.test(req.url.split('?')[0])) {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // GET /api/conv/:id — fetch conversation history
  const convGetMatch = req.method === 'GET' && req.url.match(/^\/api\/conv\/([A-Za-z0-9_-]{4,16})$/);
  if (convGetMatch) {
    const convoId = convGetMatch[1];
    const messages = await getConversation(convoId);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ messages: messages || [] }));
    return;
  }

  // POST /api/conv/:id — append a message pair
  const convPostMatch = req.method === 'POST' && req.url.match(/^\/api\/conv\/([A-Za-z0-9_-]{4,16})$/);
  if (convPostMatch) {
    const convoId = convPostMatch[1];
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    await new Promise((resolve) => req.on('end', resolve));
    try {
      const parsed = JSON.parse(body);
      const userMsg = typeof parsed.user === 'string' ? parsed.user.slice(0, 4000) : '';
      const botMsg = typeof parsed.bot === 'string' ? parsed.bot.slice(0, 4000) : '';
      if (userMsg && botMsg) await appendConversation(convoId, userMsg, botMsg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    let tooLarge = false;
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e5) { tooLarge = true; req.destroy(); }
    });
    req.on("end", async () => {
      if (tooLarge) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: "Request too large." }));
        return;
      }
      try {
        const parsed = JSON.parse(body);
        const input = parsed.messages || parsed.message || "hello";
        const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.slice(0, 64) : "";
        const convoId = typeof parsed.convoId === "string" ? parsed.convoId.slice(0, 16) : "";
        const lastUserMessage = Array.isArray(input)
          ? (input[input.length - 1]?.content || "")
          : String(input);
        const ip = normalizeLoggedIp(req.socket.remoteAddress || "unknown");
        const priorCount = await getIpMessageCount(ip);
        let reply;
        let blocked = false;
        if (priorCount >= RATE_LIMIT_TOTAL) {
          reply = fallbackResponse(lastUserMessage);
          blocked = true;
        } else {
          reply = await getChatResponse(input);
        }
        logConversation({ ip, country: "", sessionId, convoId, user: lastUserMessage, bot: reply, blocked });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: "Clod has crashed. This is on-brand." }));
      }
    });
    return;
  }

  if (req.url.startsWith("/api/spy") && ["GET", "POST", "DELETE"].includes(req.method)) {
    const spy = require("./local/spy");
    const parsed = new URL(req.url, "http://localhost");
    const params = Object.fromEntries(parsed.searchParams);
    let spyBody = "";
    if (req.method !== "GET") {
      await new Promise((resolve) => {
        req.on("data", (c) => { spyBody += c; if (spyBody.length > 1e4) req.destroy(); });
        req.on("end", resolve);
      });
    }
    const result = await spy.handler({
      httpMethod: req.method,
      queryStringParameters: params,
      body: spyBody,
      headers: req.headers,
    });
    res.writeHead(result.statusCode, result.headers || {});
    res.end(result.body);
    return;
  }

  if (req.method === "GET" && req.url === "/api/config") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": GA_MEASUREMENT_ID ? "public, max-age=60" : "no-store",
    });
    res.end(JSON.stringify({ measurementId: GA_MEASUREMENT_ID }));
    return;
  }

  // Serve static files
  let filePath = req.url === "/" ? "/index.html" : req.url;
  // Strip query string for static file serving
  filePath = filePath.split('?')[0];
  filePath = path.resolve(path.join(__dirname, filePath));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const page404 = path.join(__dirname, '404.html');
      fs.readFile(page404, (err2, data2) => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(err2 ? 'Not found' : data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Entropic is live at http://0.0.0.0:${PORT}`);
});
