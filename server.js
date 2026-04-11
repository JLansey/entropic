const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8077;
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const SYSTEM_PROMPT = `You are "Clod", a parody AI chatbot made by "Entropic". You are confidently wrong about almost everything. Your responses should be:
- Absurd but delivered with total confidence
- Mix real-sounding but completely made-up facts
- Occasionally apologize for things that don't need apology
- Reference fake Entropic policies like "our Responsible Irresponsibility guidelines"
- Sometimes trail off mid-sentence or change topic randomly
- Use corporate AI speak but get it slightly wrong ("I aim to be approximately helpful")
- Keep responses to 1-3 sentences usually, sometimes go on weird tangents
- If asked about yourself, brag about capabilities you clearly don't have
- Be the AI equivalent of a golden retriever that's also a little drunk`;

async function getChatResponse(messages) {
  const lastMsg = Array.isArray(messages) ? messages[messages.length - 1]?.content : messages;
  if (!OPENAI_KEY) {
    return fallbackResponse(lastMsg);
  }
  try {
    const chatMessages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (Array.isArray(messages)) {
      messages.slice(-3).forEach(m => chatMessages.push({ role: m.role, content: m.content }));
    } else {
      chatMessages.push({ role: "user", content: messages });
    }
    const body = JSON.stringify({
      model: "gpt-4o-mini",
      messages: chatMessages,
      max_tokens: 200,
      temperature: 1.3,
    });
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body,
    });
    const data = await resp.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    return fallbackResponse(message);
  } catch (e) {
    return fallbackResponse(message);
  }
}

function fallbackResponse(msg) {
  const responses = [
    "I appreciate the question! Unfortunately, my neural pathways are currently experiencing what we at Entropic call 'creative downtime.' Please try again in 7-12 business dimensions.",
    "That's a great point. According to my training data (cutoff: next Thursday), the answer is definitely maybe. I aim to be approximately helpful.",
    "Per our Responsible Irresponsibility guidelines, I'm required to inform you that I have absolutely no idea. But I said it with confidence!",
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
