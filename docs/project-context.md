# Design DNA — project context

Read this first. It defines what we are building, the order, and the data shapes every part must agree on. `cursor-rules.md` holds the non-negotiable architectural constraints; `LEARNINGS.md` holds the traps already discovered. Follow all three.

---

## What this is

A **deterministic design inspection and verification tool for AI coding workflows.**

You paste a URL. It loads the page in a real headless browser, measures every rendered element, and tells you what the page's design system actually is — the real token sets, the values that drifted, the components it repeats. Then it exports corrections as *checkable promises*, so after a coding agent applies them, a re-scan says PASS or FAIL.

**No LLM anywhere in the product.** Everything is computed styles and arithmetic. Same page in, same numbers out. The AI in the story is Cursor, doing the repair from our evidence.

## The one-sentence test for any decision

> Can this number be pointed at on the page?

If not, don't show it. No estimates, no invented scores, no percentages that can't be traced to a measured element.

---

## The user flow

1. Paste a URL
2. ~15–20s: the page is captured and measured (this wait is real and unavoidable — fill it, don't hide it)
3. A report: what your system is, what drifted, where it is on the page, what to fix
4. Export a correction prompt for your coding agent
5. Re-scan → PASS or FAIL per correction

---

## Build order — strict

Each stage must work before the next begins. The right column is what gets cut if we're behind.

| # | Thing | Cut? |
|---|---|---|
| 1 | URL in → page captured (stitched PNG) | never |
| 2 | Elements measured, coordinates correct | never |
| 3 | Redlines drawn on the real capture | never |
| 4 | Three findings: rhythm, strays, system | never |
| 5 | Postconditions + verify loop | never — this is what scores |
| 6 | Corpus comparison | keep, data already exists |
| 7 | Components grid | cut first |
| 8 | Vertical rhythm histogram | cut second |
| 9 | Export tabs / MCP server | last, only after the video |

**Hard checkpoint:** if a redline box is not sitting on a real element by the time stage 3 is "done", stop adding features and fix it. Everything after it is wrong otherwise.

**The video gets recorded the first time stages 1–5 work end to end.** Not when it's finished. A rough video of a working thing beats no video of a polished thing.

---

## Shared data contracts

Every agent must use these exact shapes. Do not invent variants. If a shape needs to change, change it here first.

### Element (one measured element)

```ts
{
  id: string          // data-dna-id, assigned before tiling
  x: number           // page coordinates, not viewport
  y: number
  w: number
  h: number
  viewportIntersectionFraction: number   // 0..1, how much of it this tile showed
  tag: string
  styles: {
    fontSize: number, fontWeight: string, lineHeight: number, letterSpacing: string,
    color: string, background: string,
    radius: number, borderWidth: number, boxShadow: string | null,
    marginTop: number, marginBottom: number, paddingTop: number, paddingBottom: number
  }
}
```

Note the name: **`viewportIntersectionFraction`**, not `visibleFraction`. Geometric overlap is not actual visibility — ancestor clipping, overlays and masks all break that assumption, and the honest name stops anyone relying on it wrongly.

### Capture result

```ts
{
  url: string
  host: string
  capturedAt: string        // ISO
  viewport: { w: 1440, h: 900 }
  pageHeight: number        // real, after SPA growth polling
  image: string             // path or data URL of the stitched PNG
  elements: Element[]
  tiles: { y: number, height: number }[]   // ACTUAL scroll positions, read back
}
```

### Finding (anything we report)

```ts
{
  id: string
  label: string
  class: "FAIL" | "REVIEW" | "PASS" | "UNSUPPORTED"
  value: string             // the measured number, as displayed
  note: string              // one plain-English sentence
  elementIds: string[]      // what this finding points at — never empty for FAIL
}
```

**The four classes are load-bearing:**
- `FAIL` — violates a declared contract
- `REVIEW` — a real measured difference, but whether it's wrong depends on intent. Never auto-merged.
- `PASS` — satisfies the contract
- `UNSUPPORTED` — can't be measured reliably on this page

Deterministic does not mean correct. An arbitrary threshold can be perfectly repeatable and still produce false positives. `REVIEW` is how we stay honest.

### Postcondition (a correction, as a checkable promise)

```ts
{
  id: string
  property: string          // e.g. "border-top-left-radius"
  before: string            // "11px"
  expected: string          // "12px"
  targets: string[]         // element ids — the ONLY things the verifier checks
  class: "FIX" | "REVIEW"
}
```

### Verify result

```ts
{
  id: string
  status: "PASS" | "FAIL" | "UNSUPPORTED"
  targets: { id: string, resolved: string, status: "PASS" | "FAIL" | "MISSING" }[]
}
```

**The rule that must not be broken:** a correction passes only when **every one of its targets** resolves to `expected`. It fails if a target keeps the old value, lands on a third value, or disappears.

**Never** verify by checking that the old value's count across the page reached zero. An approved merge may cover only some of its uses, and a global count would hide a change to the wrong element.

---

## Stack

Next.js 15 (App Router, TypeScript) · Playwright + Chromium · sharp for stitching · Tailwind.

**No database.** Scans persist as JSON files on disk under `.scans/`. No API keys, no env secrets, no LLM calls.

---

## UI standing rule

Build product UI from `docs/ui-reference.html` — the approved, signed-off design. Reuse its CSS token values and class naming; do not invent palette, type, or spacing. Class names **are** the structure (CSS-only reference). Do not copy JavaScript from the reference. If something is uncovered by the reference, ask before inventing it.

---

## Scope guard — do NOT do these

With several agents running, things wander. None of the following are in scope today:

- Any LLM or model call anywhere in the product
- A database, auth, or user accounts
- Inventing token values that aren't already on the page — corrections are **merge-only**
- A single composite "design quality score" — we tried it, it rated a Lovable site above stripe.com. Position against the corpus instead.
- Re-implementing accessibility auditing (if we add a11y at all, pin `axe-core`)
- Class-name-based component detection — cluster on visual shape only
- Reformatting or restyling files an agent wasn't asked to touch

---

## Provenance — matters for eligibility

- `public/corpus.json` is a **dataset of 573 sites fingerprinted on 18 Sep 2026, before the event.** Say so in the README. It is data, not code.
- Slop Patterns pattern *concepts and thresholds* may be referenced — ideas are allowed.
- Slop Patterns *detector implementations* must NOT be copied. Write every detector fresh in this repo.

---

## What "done" sounds like

> "This page has two buttons that don't match your other buttons. Here they are on the page. Here's the correction. Paste it into Cursor, then re-scan — it says PASS when all three targets hit 16px."

Not:

> "We found 73 inconsistencies."

The first helps someone make a decision. The second hands them homework.
