# Conversation Logging & Spy Dashboard

Every chat message is logged to Upstash Redis so we can see what people are saying, track which IPs use Clod the most, and assign friendly labels to IPs we recognize.

## How Logging Works

On every `/api/chat` request, after Claude's reply is ready, `logConversation()` fires a single pipelined REST call to Upstash that does up to four things:

1. **`LPUSH msgs <entry>`** — prepends a JSON blob to the `msgs` list:
   ```json
   {"ts": 1776013072350, "ip": "1.2.3.4", "country": "US", "sessionId": "k3f…", "user": "...", "bot": "...", "blocked": true}
   ```
   (`blocked` is only present when the rate limiter served a canned reply instead of calling Claude.)
2. **`ZINCRBY user_counts 1 <ip>`** — bumps the IP's score in the `user_counts` sorted set.
3. **`ZINCRBY country_counts 1 <country>`** — bumps the country's score (only if we have a country).
4. **`HSET ip_country <ip> <country>`** — so the spy dashboard can show a country per IP without scanning all messages.

The call is `await`ed in the Netlify function (Lambda terminates after return, so fire-and-forget is unreliable). Failures are caught silently — logging never affects the chat response. If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing, logging is skipped.

**Client IP** comes from the `client-ip` / `x-nf-client-connection-ip` header on Netlify, or the first entry of `x-forwarded-for` as a fallback. (We used to store `x-forwarded-for` raw, which produced garbage "IPs" like `"1.2.3.4, 5.6.7.8"` when proxies were in the chain — that's fixed.)

**Country** comes from Netlify's `x-nf-geo` header (base64-encoded JSON with `country.code`, `city`, etc.). Missing locally, which is fine.

**Session ID** is generated client-side in `index.html` once per page load (`Math.random().toString(36) + Date.now().toString(36)`) and sent with every chat request. Refreshing the page starts a new session. The spy dashboard groups turns by `sessionId`.

Logging lives in both `netlify/functions/chat.js` and `server.js` — see the "Dual Chat Files" note in the main README.

## Rate Limiting

Before every chat request, we `ZSCORE user_counts <ip>`. If an IP is at or above `RATE_LIMIT_TOTAL` (default 200, overridable via env), we **silently** serve a random `FALLBACK_RESPONSES` entry instead of calling Claude. The frontend has no idea — it looks like a normal Clod hiccup. The attempt is still logged with `blocked: true` so we can see it in the spy dashboard.

## Redis Data Model

| Key | Type | Purpose |
|---|---|---|
| `msgs` | list | Full conversation log, newest first. Each entry is JSON `{ts, ip, country, sessionId, user, bot, blocked?}`. |
| `user_counts` | sorted set | Score = number of messages per IP. `ZREVRANGE` for top users. |
| `country_counts` | sorted set | Score = number of messages per country code. |
| `ip_country` | hash | IP → last-seen country code. Overwritten on each log. |
| `ip_labels` | hash | IP → human-friendly label assigned via the spy dashboard. |

All keys are persistent — no TTL.

## Spy Dashboard

File: `netlify/functions/spy.js`. Routed via `netlify.toml` at `/api/spy`, and also handled by `server.js` locally so you can view and edit prod data from your laptop.

### Access

Protected by a `?key=` query param. Wrong/missing key returns a 404.

- **Prod:** `https://oopus.netlify.app/api/spy?key=clod-spy-2024`
- **Local:** `http://localhost:8077/api/spy?key=clod-spy-2024` (reads the same prod Redis)

### Query params

- `key` — required secret. Defaults to `clod-spy-2024`, override with the `SPY_SECRET` env var.
- `n` — how many recent messages to fetch for the Recent Conversations view (default 200). e.g. `&n=500`
- `format=json` — return raw JSON (`{messages, userCounts, countryCounts, labels, ipCountry, total}`) instead of the HTML dashboard.

### Label editing

The Top Users table has an inline label editor. Clicking **edit** turns the label cell into a text input; **save** sends a `POST /api/spy?key=…` with `{ip, label}`, **cancel** bails, and saving an empty label fires a `DELETE` to remove the label. Label edits are gated by the same `key`.

### What it shows

- **Top Users** — IP leaderboard with columns `Label | IP | Country | Messages` and an inline label editor per row. The label is the primary place to mark "this IP is me / my friend" so recent conversations become readable.
- **By Country** — country leaderboard (with flag emoji) from the `country_counts` sorted set.
- **Recent Conversations** — grouped by session, newest first. Each session renders as a collapsed card showing who (label or IP, with country flag), when, session length, and a preview of the first user turn + first bot reply. Click to expand the full transcript.

The HTML is rendered server-side — a single self-contained function, no separate template files.

## Environment Variables (Netlify)

Required for logging + spy:

- `UPSTASH_REDIS_REST_URL` — e.g. `https://special-panda-97172.upstash.io`
- `UPSTASH_REDIS_REST_TOKEN` — the full REST API token (watch for truncation when pasting into Netlify — our token is 71 chars)

Optional:

- `SPY_SECRET` — override the default spy access key
- `RATE_LIMIT_TOTAL` — per-IP lifetime cap before silent rate-limit kicks in (default 200)

Local dev reads these from `.env` (same file as `ANTHROPIC_API_KEY`).

## Design Notes

- **No npm dependencies.** The project has no `package.json`. We use `fetch()` against the Upstash REST API directly instead of the `@upstash/redis` SDK.
- **Single pipeline call per message.** `LPUSH`, `ZINCRBY` (x2), and `HSET` go in one HTTP round-trip via `/pipeline`.
- **Spy function is self-contained.** HTML, data fetching, label editing, and auth all live in `spy.js`. The dev server delegates to it by calling `spy.handler()` directly (GET / POST / DELETE) so behavior stays in sync across dev and prod.
- **Session grouping.** Primary key is the client-generated `sessionId`. If an entry is missing one (legacy data, curl, etc.), we fall back to grouping by IP with a 30-minute gap heuristic.

## Useful Redis Queries (from the Upstash console)

- Top 10 users: `ZREVRANGE user_counts 0 9 WITHSCORES`
- Top countries: `ZREVRANGE country_counts 0 19 WITHSCORES`
- All labels: `HGETALL ip_labels`
- Total message count: `LLEN msgs`
- Browse recent messages: `LRANGE msgs 0 199`
- Wipe everything: `DEL msgs user_counts country_counts ip_country ip_labels`
