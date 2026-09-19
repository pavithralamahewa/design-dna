# LEARNINGS.md
_Notes only — no implementation. Everything here has to be written from scratch on the day._
_Purpose: don't rediscover in four hours what already took a day to find._

---

## 0. Build order (the discipline that decides this)

Build **one flow**: paste URL → redlines drawn on the real page → three insights.
Nothing else exists until that works end to end.

| Order | Thing | Cut if behind |
|---|---|---|
| 1 | URL in → page captured | never |
| 2 | Redlines at real coordinates | never |
| 3 | Three insights (rhythm, strays, one pattern) | never |
| 4 | Corpus comparison numbers | keep — data already exists |
| 5 | Token grid | cut |
| 6 | Components grid | cut |
| 7 | Export | cut |
| 8 | 3D autopsy | cut |

Record the video the first time the flow works. Polish after, only if time remains.

---

## 1. The architectural rule everything else depends on

**Measure coordinates and capture pixels in the SAME browser session, in the SAME paint.**

Measuring in one pass and screenshotting in another is the obvious approach and it is wrong. Any difference
between the two — viewport height, animation state, lazy images, fonts, video frames — desynchronises
coordinates from pixels, and every drawn box lands in the wrong place.

Symptom when you get this wrong: boxes are offset by a consistent amount, or drift further down the page.

**Shape of the correct sequence, per page:**
1. load, wait for network idle
2. force lazy images eager
3. scroll top→bottom in steps so reveal animations fire and images decode
4. pin animations so nothing un-reveals
5. for each tile: scroll → screenshot → **measure what is on screen right now**
6. stitch tiles
7. run the analysis last, then overwrite every element's coordinates with the measured ones

---

## 2. The three bugs that cost the most time

### 2a. Scroll position is not what you asked for
`scrollTo(0, y)` does not reliably leave you at `y`. Smooth-scroll behaviour, scroll snapping and clamping at
the document end all shift it. If you paste the tile at the *requested* offset but measure at the *actual*
one, every element in that tile is off by the difference.

**Do:** read the real scroll position back after scrolling, and use that number for both the paste and the
measurement. Also force `scroll-behavior: auto` and disable scroll-snap before tiling.

**Impact when fixed:** corrections on one test site dropped from 253 to 20.

### 2b. Measuring an element while it is still animating in
If you record each element the first time it appears in a tile, you catch it mid reveal — translated down,
part-transparent, not yet where it will settle. Boxes end up roughly 90px above their elements.

**Do:** record how much of the element the current tile actually shows. Keep the reading where it is most
fully on screen; on a tie prefer the later tile, because by then the entrance animation has finished.

### 2c. Full-page screenshot ≠ what the user sees
Playwright's `fullPage: true` expands the viewport in one go, so scroll-triggered reveals never fire. A page
built with reveal-on-scroll captures as large areas of blank background.

**Do:** scroll-and-stitch, viewport-sized tiles, ~400ms per tile. This is also the documented community
consensus, not just our finding.

**Also:** `position: fixed` and `sticky` elements re-stamp themselves into every tile. Hide them for all tiles
after the first.

**Also:** a playing video gives a different frame per tile, so a seam is visible. Unavoidable. Don't panic.

---

## 2d. Two bugs that only show up across specimens

Found on the prototype after everything "worked" on the test site. Both are silent — nothing throws, the layout stays full, the numbers look plausible.

**Identity resolved in more than one place.** The thumbnail store is keyed by a filename-safe slug, the corpus by hostname, the analysis by whatever the page reported. Each lookup wrote its own matching, so `awiant.com` never matched `awiant.lovable.app` and that panel fell back to a placeholder without saying so. One resolver, used everywhere.

**Falling back to a default record.** When a site had no entry in the comparison set, the wall rendered the first demo subject instead — so the header said `stripe.com` while the panel showed another site's 92% match. Absence has to render as absence. Once fixed, scanning Stripe returns "nothing in the corpus looks like you, the closest is 36%", which is a better result than the bug was hiding.

**How they were caught:** a script that ran all four specimens and asserted stage reached, findings rendered, wall subject equal to scanned host, and zero console errors. Manual review of one site had passed both. Write that script early — it is twenty lines.

---

## 3. Finding components

**Cluster on visual shape, not class names.** Two instances of the same button routinely carry different class
strings. Fingerprint on: role-ish kind (interactive / heading / media / box), corner radius, background,
border presence, font-size bucket, font weight, shadow presence, coarse size bucket.

**Cluster first, name second.** Naming each element as you walk the DOM produces garbage. Group by identical
fingerprint, then label the group.

**Scan the whole page, not the first screen.** Scanning only the top viewport found 5 components on a test
site; the whole page found 14.

**Drop nested duplicates** — a cluster whose representative sits entirely inside a larger cluster of the same
role is the same thing counted twice.

Useful signal, cheap to compute: count each component's **decoration children** — absolutely positioned or
`pointer-events:none` children with no text. One test card carried four.

---

## 4. Detection rules: element-local vs page-level

The Slop Patterns rules were written to read **code an agent is writing**. They do not transfer cleanly to a
rendered third-party page.

- Running them on a slice of a live DOM gives either false page-level accusations (*Landmark-Free Page* blamed
  on a button) or almost nothing at all.
- **Keep a blocklist of page-level codes** and never attribute those to a component.
- The join between the corpus and the library is a **mapping**, not re-detection: this token / this component
  → the pattern that explains it, with the evidence that matched.

**Rule-design lesson, learned the hard way:** a rule must measure a *decision*, not a *convention or a
framework default*. A three-column grid is a convention. "Page has a pulse animation" AND "page has a round
element" are both always true on Tailwind — the association has to be same-element or same-rule-block.

---

## 5. Insight design

An insight is not a paragraph in a grey box. Structure every one as:

**eyebrow → headline with the number in it → evidence chips → Found / Why / Do this**

The "Why" has to be a real reason, not a restatement. Example that works:
> *A reader learns a page's rhythm by repetition. A large gap only reads as "new subject" when it breaks a
> pattern they have already learned. Ten different gaps teach no pattern, so nothing can break one.*

**Vertical rhythm is the strongest single insight.** Measure the gap a reader actually sees between sections:
previous section's bottom padding + margin + next section's top padding. Then find the most-used value (the
page's own pulse), the near-duplicate pairs (values a few px apart — one decision typed twice), and the
outliers. Recommend two values, one of them already theirs.

---

## 6. Honesty rules that make the output defensible

- **Merge-only corrections.** Snap a stray to the neighbour it was already closest to. Never invent a scale,
  a palette or a radius set. The moment it invents intent once and gets it wrong, the whole output stops
  being trusted.
- **Say when merging can't help.** Twenty type sizes with no consistent step is not drift, it's volume — and
  no tool can merge its way to a type scale. Say so rather than faking a correction.
- **Don't let a single number be dominated by one huge element.** A full-bleed container that holds content is
  the stage, not decoration. Classifying it as decoration inflated a headline figure from 38% to 50%.
- **Scores don't separate; positions do.** A "% designed" score rated a Lovable site above Stripe. Replace
  scores with position against a measured corpus — a fact rather than an opinion.
- **When extraction fails, that's a finding.** If sections can't be identified by name, the page has no
  semantic landmarks — and screen readers, reader mode and crawlers have the same problem, except they can't
  fall back to measuring pixels.

---

## 7. The corpus (pre-existing, brings over as data)

96 fully extracted: 76 AI-built (Lovable, Bolt, Replit, Base44) + 20 studio-built control.

| | AI-built median | Studio-built median |
|---|---|---|
| Distinct radii | 4 | **8** |
| Distinct spacing values | 10 | **16** |
| Saturated colours | 5 | 3 |
| Distinct type sizes | 8 | 7 |

**The finding: colour and type do not separate AI-built from studio-built work. Radius and spacing do, and
they double.** A considered system distinguishes a chip from a card from a modal; generated output stamps one
radius everywhere.

Other corpus facts: ~58% use Inter or the default sans stack; ~20% use an accent that is byte-identical to a
Tailwind palette swatch; 6px is the most common radius.

---

## 8. Practical traps

- Python `re.sub` treats `\n` in the *replacement* as a real newline — broke JS string literals three times.
  Pass a function instead.
- An unclosed `/* ... */` in CSS silently kills every rule after it. Count your comment markers.
- If an edit "didn't take", check the rendered page — don't trust that the edit applied.
- `checkDesign`-style wrappers that swallow rule exceptions will hide a broken rule completely. Don't
  silently `continue` on error while developing.
- Artifact/browser sandboxes block downloads — offer copy-to-clipboard, not `<a download>`.
- Venue wifi: the extractor hits live sites. Hotspot ready. Test two backup URLs before 2:00.

---

## 9. What to put in `.cursor/rules`

Condense sections 1, 2, 3 and 6 into project rules so the agent doesn't reintroduce the bugs. Specifically:
- never measure coordinates outside the capture session
- always read back real scroll position
- cluster components on computed style, never class names
- corrections are merge-only; never invent design intent
- keep page-level detections off individual components

Then reference the file in the submission as evidence of how Cursor was used.
