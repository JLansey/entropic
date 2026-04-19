# Entropic – Safety-Last AI

Parody AI company website. Live on Netlify.

## Architecture

- **`index.html`** — the entire site (single page)
- **`server.js`** — local dev server (Node, port 8077). Serves static files + `/api/chat` + `/api/spy` endpoints
- **`netlify/functions/chat.js`** — production chat endpoint (Netlify Function)
- **`netlify/functions/spy.js`** — conversation spy dashboard (see `LOGGING.md`)
- **`netlify/functions/config.js`** — GA4 measurement ID config endpoint
- **`netlify.toml`** — Netlify config, redirects `/api/*` → functions
- **`404.html`** — custom 404 page
- **`favicon.svg`** — site favicon
- **`og-image.png`** / **`og-image.svg`** — Open Graph preview image
- **`LOGGING.md`** — how conversation logging and the spy dashboard work

## ⚠️ Dual Chat Files

There are still two chat runtimes:

1. `server.js` (dev)
2. `netlify/functions/chat.js` (production)

They stay separate because dev uses a plain Node HTTP server and production needs a Netlify Function (serverless).

The Clod `SYSTEM_PROMPT` is shared in `clod-system-prompt.js`. The fallback responses still live in each runtime, so if you intentionally change fallback copy, keep both files aligned.

## Environment Variables

- `ANTHROPIC_API_KEY` — required for live chat (set in Netlify dashboard for prod). The dev server and Netlify function now call Claude Sonnet via the Anthropic Messages API; without a key, Clod serves the fallback jokes.
- `CLAUDE_MODEL` — optional override if you want something other than `claude-sonnet-4-6` (default).
- `GA_MEASUREMENT_ID` — GA4 Measurement ID for analytics. Defaults to `G-LK9C1Z4W11` (Precision Cheesecake property), but you can override it via env. The frontend fetches `/api/config` and loads gtag automatically when one is available.

## Dev Server

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Runs at `http://0.0.0.0:8077`

## Local HTTPS For Phone Sensor Testing

Motion/orientation APIs require a secure context. In practice that means one of:

- a real `https://` origin
- `http://localhost` on the same device only

For testing from a phone on your LAN, use the local HTTPS server:

```bash
./scripts/dev-cert.sh
HTTPS=1 node server.js
```

Default ports:

- HTTP: `http://localhost:8077`
- HTTPS: `https://localhost:8443`

The server also prints LAN URLs such as `https://192.168.1.x:8443` for phone testing.

Notes:

- If `mkcert` is installed, `./scripts/dev-cert.sh` generates a locally trusted cert on your Mac.
- If `mkcert` is not installed, the script falls back to a self-signed cert.
- A phone will only treat the page as secure if it trusts the cert chain for that HTTPS URL. For a LAN IP on a phone, that usually means either installing/trusting the `mkcert` root CA on the phone too, or using an HTTPS tunnel.

## Repo

`https://github.com/JLansey/entropic`
