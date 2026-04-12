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

The Clod chat prompt and fallback responses exist in **two places**:

1. `server.js` (dev)
2. `netlify/functions/chat.js` (production)

**If you change the prompt or fallback responses, update BOTH files.**

They're separate because dev uses a plain Node HTTP server and production needs a Netlify Function (serverless). The prompt, model config, and fallback joke array should stay identical.

## Environment Variables

- `ANTHROPIC_API_KEY` — required for live chat (set in Netlify dashboard for prod). The dev server and Netlify function now call Claude Sonnet via the Anthropic Messages API; without a key, Clod serves the fallback jokes.
- `CLAUDE_MODEL` — optional override if you want something other than `claude-sonnet-4-6` (default).
- `GA_MEASUREMENT_ID` — GA4 Measurement ID for analytics. Defaults to `G-LK9C1Z4W11` (Precision Cheesecake property), but you can override it via env. The frontend fetches `/api/config` and loads gtag automatically when one is available.

## Dev Server

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Runs at `http://0.0.0.0:8077`

## Repo

`https://github.com/JLansey/entropic`
