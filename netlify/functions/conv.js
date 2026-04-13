// Netlify function: GET/POST /api/conv/:id
// Handles shared conversation history stored in Upstash Redis.

const CONV_ID_RE = /^[A-Za-z0-9_-]{4,16}$/;

async function getConversation(convoId) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const resp = await fetch(`${url}/get/${encodeURIComponent('conv:' + convoId)}`, {
      headers: { Authorization: `Bearer ${token}` },
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
  const existing = await getConversation(convoId) || [];
  existing.push({ role: 'user', content: userMsg });
  existing.push({ role: 'assistant', content: botMsg });
  // Use Upstash pipeline SET so JSON is stored correctly as a string value.
  await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['SET', 'conv:' + convoId, JSON.stringify(existing)]]),
  });
}

exports.handler = async (event) => {
  // Extract convoId from path: /api/conv/:id
  const pathMatch = (event.path || '').match(/\/api\/conv\/([A-Za-z0-9_-]{4,16})$/);
  if (!pathMatch) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid conversation ID' }) };
  }
  const convoId = pathMatch[1];
  if (!CONV_ID_RE.test(convoId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid conversation ID' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'GET') {
    const messages = await getConversation(convoId);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ messages: messages || [] }),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const parsed = JSON.parse(event.body || '{}');
      const userMsg = typeof parsed.user === 'string' ? parsed.user.slice(0, 4000) : '';
      const botMsg = typeof parsed.bot === 'string' ? parsed.bot.slice(0, 4000) : '';
      if (userMsg && botMsg) {
        await appendConversation(convoId, userMsg, botMsg);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};
