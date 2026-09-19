# human.design

Next.js 15 app for Project human.design. App Router, TypeScript, and Tailwind CSS.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Playwright (Chromium) for browser automation/testing
- sharp for image processing

## Getting started

```bash
npm install
npx playwright install chromium
npm run dev -- -p 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Edit `app/page.tsx` to change the homepage; the page hot-reloads as you save.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
