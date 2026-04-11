# Entropic – Safety-Last AI

Parody AI company website. Live on Netlify.

## Architecture

- **`index.html`** — the entire site (single page)
- **`server.js`** — local dev server (Node, port 8077). Serves static files + `/api/chat` endpoint
- **`netlify/functions/chat.js`** — production chat endpoint (Netlify Function)
- **`netlify.toml`** — Netlify config, redirects `/api/chat` → the function
- **`404.html`** — custom 404 page
- **`favicon.svg`** — site favicon
- **`og-image.png`** / **`og-image.svg`** — Open Graph preview image

## ⚠️ Dual Chat Files

The Clod chat prompt and fallback responses exist in **two places**:

1. `server.js` (dev)
2. `netlify/functions/chat.js` (production)

**If you change the prompt or fallback responses, update BOTH files.**

They're separate because dev uses a plain Node HTTP server and production needs a Netlify Function (serverless). The prompt, model config, and fallback joke array should stay identical.

## Environment Variables

- `OPENAI_API_KEY` — required for live chat (set in Netlify dashboard for prod). Without it, Clod serves random fallback jokes.
- `GA_MEASUREMENT_ID` — GA4 Measurement ID for analytics. Defaults to `G-LK9C1Z4W11` (Precision Cheesecake property), but you can override it via env. The frontend fetches `/api/config` and loads gtag automatically when one is available.

## Dev Server

```bash
OPENAI_API_KEY=sk-... node server.js
```

Runs at `http://0.0.0.0:8077`

## Repo

`https://github.com/JLansey/entropic`
