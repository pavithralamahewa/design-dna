# human.design

Deterministic design inspection for AI coding workflows. Paste a URL → capture a real headless Chromium paint → measure what the page actually renders.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Playwright + Chromium (capture)
- sharp (tile stitching)

No database, no LLM calls. Scans persist under `.scans/`.

## Getting started

```bash
npm install
npx playwright install chromium
npm run dev -- -p 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Capture API

`POST /api/capture` with body `{ "url": "https://example.com" }`.

Returns the Capture contract shape: stitched PNG under `.scans/<slug>.png`, JSON under `.scans/<slug>.json`, viewport `1440×900`, `pageHeight` (stable scrollHeight poll), `tiles` (actual `scrollY` readbacks), and `elements: []`. If the page exceeds 16000px, capture stops at 16000 and sets `heightCapped` / `heightCapNote`.

Capture never uses `page.screenshot({ fullPage: true })` — viewport-clipped tiles, fixed/sticky hidden after tile 0, stitch at real scroll offsets.

```bash
# Specimen capture (stripe.com + trumoveinc.com)
npm run capture:specimens
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run capture:specimens` | Capture stripe.com + trumoveinc.lovable.app |
