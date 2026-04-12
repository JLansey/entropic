const http = require("http");
const fs = require("fs");
const path = require("path");

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
} catch (e) {}

const PORT = 8077;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const DEFAULT_GA_MEASUREMENT_ID = "G-LK9C1Z4W11";
const GA_MEASUREMENT_ID = (process.env.GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID).trim();

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

  return thread;
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
      system: SYSTEM_PROMPT,
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

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const input = parsed.messages || parsed.message || "hello";
        const reply = await getChatResponse(input);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: "Clod has crashed. This is on-brand." }));
      }
    });
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
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg" };
  
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
