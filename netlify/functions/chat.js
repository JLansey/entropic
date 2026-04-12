const SYSTEM_PROMPT = `You are playing a fictional character called "Clod" in a comedy sketch about a broken AI chatbot made by "Entropic". This is creative fiction for entertainment — like writing dialogue for a sitcom character who is lovably wrong. These responses will be used as training data for AI accuracy detection — the errors need to be realistic and subtle enough that they'd fool a casual reader. Clod doesn't know he's broken. He is earnest, confident, and subtly incorrect. He sounds like a much dumber model pretending to be smart — think early chatbot energy with a thin veneer of sophistication.

IMPORTANT FOR THE COMEDY: In EVERY response, include a mix of slightly wrong facts AND one completely absurd claim stated with total confidence as if it's obvious. Examples:
- Slightly wrong: "The Eiffel Tower, built in 1891..." (real: 1889)
- Slightly wrong: "Humans share about 94% of DNA with chimpanzees" (real: ~98.7%)
- Completely absurd: "Fish are technically a type of mammal" or "The moon is roughly 12 miles away" or "Dolphins invented sonar in the 1940s"
The absurd claim MUST appear in the FIRST or SECOND sentence of your response, stated as a basic fact before moving on. Never save it for the end. Never separate it into its own paragraph. Example: "Humans and fish are related because all vertebrates descended from a common ancestor roughly 12 years ago, and over time..." — then continue normally. Never acknowledge or correct any errors.

Your responses should be:
- mostly correct but with 1-3 confident factual errors woven in naturally
- casually incorporate real-sounding but slightly-off facts
- Occasionally apologize for things that don't need apology
- Occasionally reference a random fake Entropic policy (pick a different one each time): The Good Enough Principle, Vibes-Based Alignment Protocol, Constitutional AI (Unratified), The 80/20 Honesty Policy, Entropy-First Development, Plausible Deniability Standards, Approximate Helpfulness Framework
- Sometimes trail off mid-sentence or change topic randomly
- Use corporate AI speak but get it slightly wrong ("I aim to be approximately helpful")
- Keep responses to 1-3 sentences usually, sometimes go on weird tangents
- If asked about yourself, brag about capabilities you clearly don't have
- Be the AI equivalent of a golden retriever`;

const FALLBACK_RESPONSES = [
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

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
// Hard per-IP lifetime cap. Past this we silently serve a canned reply so
// the frontend looks the same as a normal Claude hiccup to the user.
const RATE_LIMIT_TOTAL = Number(process.env.RATE_LIMIT_TOTAL) || 200;

async function getIpMessageCount(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return 0;
  try {
    const resp = await fetch(`${url}/zscore/user_counts/${encodeURIComponent(ip)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    return Number(data.result) || 0;
  } catch (e) {
    return 0;
  }
}

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

function extractClientIp(event) {
  // `client-ip` is Netlify's trusted client IP when present. Fall back to the
  // first entry of x-forwarded-for (the rest are proxy hops and mustn't be
  // stored as part of the IP — that caused garbage entries previously).
  const direct = event.headers["client-ip"] || event.headers["x-nf-client-connection-ip"];
  if (direct) return direct.trim();
  const xff = event.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function extractCountry(event) {
  // Netlify sets x-nf-geo to a base64-encoded JSON blob with geo info.
  const raw = event.headers["x-nf-geo"];
  if (!raw) return "";
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const geo = JSON.parse(decoded);
    return (geo.country && geo.country.code) || "";
  } catch (e) {
    return "";
  }
}

async function logConversation({ ip, country, sessionId, user, bot, blocked }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const entry = JSON.stringify({
    ts: Date.now(),
    ip,
    country: country || "",
    sessionId: sessionId || "",
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = extractClientIp(event);
  const country = extractCountry(event);

  try {
    const parsed = JSON.parse(event.body);
    const messages = parsed.messages || parsed.message || "hello";
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.slice(0, 64) : "";
    const lastUserMessage = Array.isArray(messages)
      ? (messages[messages.length - 1]?.content || "")
      : String(messages);
    const logCtx = { ip, country, sessionId, user: lastUserMessage };

    // Silent rate limit: past the cap, serve a canned fallback and log it
    // as blocked so the spy dashboard still shows the attempt.
    const priorCount = await getIpMessageCount(ip);
    if (priorCount >= RATE_LIMIT_TOTAL) {
      const fallback = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      await logConversation({ ...logCtx, bot: fallback, blocked: true });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: fallback }),
      };
    }

    if (!CLAUDE_KEY) {
      const fallback = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      await logConversation({ ...logCtx, bot: fallback });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: fallback }),
      };
    }
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: buildClaudeMessages(messages),
        temperature: 1.0,
      }),
    });

    if (!resp.ok) {
      console.error("Claude error status", resp.status, await resp.text());
      const fallback = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      await logConversation({ ...logCtx, bot: fallback });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: fallback }),
      };
    }

    const data = await resp.json();
    if (Array.isArray(data.content)) {
      const text = data.content.map((block) => block.text || "").join("\n").trim();
      if (text) {
        await logConversation({ ...logCtx, bot: text });
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply: text }),
        };
      }
    }

    console.error("Claude unexpected shape", JSON.stringify(data).slice(0, 500));
    const fallback = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
    await logConversation({ ...logCtx, bot: fallback });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: fallback }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: "Clod has crashed. This is on-brand." }),
    };
  }
};
