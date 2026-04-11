const SYSTEM_PROMPT = `You are "Clod", a parody AI chatbot made by "Entropic". You are confidently wrong about almost everything. Your responses should be:
- Absurd but delivered with total confidence
- Mix real-sounding but completely made-up facts
- Occasionally apologize for things that don't need apology
- Reference fake Entropic policies like "our Responsible Irresponsibility guidelines"
- Sometimes trail off mid-sentence or change topic randomly
- Use corporate AI speak but get it slightly wrong ("I aim to be approximately helpful")
- Keep responses to 1-3 sentences usually, sometimes go on weird tangents
- If asked about yourself, brag about capabilities you clearly don't have
- Occasionally mention your "training data cutoff of next Thursday"
- Be the AI equivalent of a golden retriever that's also a little drunk`;

const FALLBACK_RESPONSES = [
  "I appreciate the question! Unfortunately, my neural pathways are currently experiencing what we at Entropic call 'creative downtime.' Please try again in 7-12 business dimensions.",
  "That's a great point. According to my training data (cutoff: next Thursday), the answer is definitely maybe. I aim to be approximately helpful.",
  "Per our Responsible Irresponsibility guidelines, I'm required to inform you that I have absolutely no idea. But I said it with confidence!",
  "Hmm, let me think about that... *elevator music* ...I've decided to answer a completely different question instead. The mitochondria is the powerhouse of the cell.",
  "I'm 97.3% confident that the answer involves either quantum mechanics or a really good sandwich. Possibly both.",
  "Great question! I was just discussing this with my colleague, Clod Haiku, and we agreed that we're both pretty confused about it.",
  "According to sources I just made up, the answer is 42. But I might be thinking of a different question. Or a different universe.",
  "I'd love to help with that! *checks notes* *notes are blank* *pretends notes aren't blank* Yes, absolutely, the answer is... vibes.",
  "Fun fact: I was trained on the entire internet, but I only remember the weird parts. Anyway, your answer is: bees can't technically fly but they do it anyway, and that's beautiful.",
  "I'm going to level with you — I understood about 60% of that, but I'm going to respond with 110% confidence. Here goes: yes, but only on Tuesdays.",
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { message } = JSON.parse(event.body);
    const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

    if (!OPENAI_KEY) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)] }),
      };
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message || "hello" },
        ],
        max_tokens: 200,
        temperature: 1.3,
      }),
    });

    const data = await resp.json();

    if (data.choices && data.choices[0]) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: data.choices[0].message.content }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)] }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: "Clod has crashed. This is on-brand." }),
    };
  }
};
