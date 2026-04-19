function extractClientIp(event) {
  const direct = event.headers["client-ip"] || event.headers["x-nf-client-connection-ip"];
  if (direct) return direct.trim();
  const xff = event.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function extractCountry(event) {
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

  const page = typeof body.page === "string" ? body.page.slice(0, 20) : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 500) : "";
  if (!page || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: "missing page or text" }) };
  }

  const ip = extractClientIp(event);
  const country = extractCountry(event);

  const entry = JSON.stringify({
    ts: Date.now(),
    ip,
    country: country || "",
    source: page,
    user: text,
    bot: "",
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

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
