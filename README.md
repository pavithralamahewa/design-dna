# human.design (Design DNA)

A **deterministic design inspection and verification tool for AI coding workflows**. Paste a URL; a real headless browser captures and measures what the page actually renders — computed styles and arithmetic only. **No model anywhere in the product.** Same page in, same numbers out. The AI in the story is your coding agent (e.g. Cursor), applying corrections from this evidence.

## How to run

```bash
npm install
npx playwright install chromium
npm run dev -- -p 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Optional specimen captures (writes `.scans/<host>.{json,png}`):

```bash
npm run capture:specimens
```

Production on Vercel cannot launch Playwright/Chromium. Host-keyed specimens for demos ship in `scans/` (`stripe.com`, `linear.app`) and are served via `/api/scans/<host>` before any live capture attempt. Local captures still prefer `.scans/` when present. `/demo` uses the Ledgerly mock in `public/mock-scan.json`.

## The scan → fix → verify loop

1. **Scan** — Paste a URL. The tool captures the page (stitched viewport tiles), measures rendered elements, and reports what drifted and where it sits on the page.
2. **Fix** — Export checkable corrections (postconditions) for your coding agent. Apply them in the codebase.
3. **Verify** — Re-scan. Each correction is checked against named targets only — **PASS** or **FAIL** per promise, never a global score.

## Finding classes

| Class | Meaning |
| --- | --- |
| **PASS** | Satisfies the declared contract. |
| **FAIL** | Violates a declared contract (enough repeats to call drift). |
| **REVIEW** | A real measured difference whose rightness depends on intent — never auto-merged. |
| **UNSUPPORTED** | Cannot be measured reliably on this page. |

## Data provenance

public/corpus.json is a dataset of 573 sites fingerprinted on 18 Sep 2026,
before this event. It is data, not code. All code in this repository was
written during the hackathon.

## What this is not

This tool does **not** claim responsive verification, autonomy, or a design quality score. Numbers you see are measurements you can point at on the page.
