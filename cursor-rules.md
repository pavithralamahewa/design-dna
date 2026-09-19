# Design DNA — architectural rules

These are constraints, not suggestions. If a later instruction conflicts with one of these, stop and say so rather than complying.

## 1. One paint

Coordinates and pixels are captured in the same browser session, in the same paint. Never measure in one pass and screenshot in another. Any difference between the two passes — viewport height, animation state, lazy images, fonts, video frames — desynchronises coordinates from pixels and every drawn box lands in the wrong place.

The correct sequence per page:
1. load, wait for network idle
2. force lazy images eager, wait for decode
3. scroll top to bottom in steps so reveal animations fire
4. pin animations so nothing un-reveals
5. for each tile: scroll, read back the real scroll position, screenshot, then measure what is on screen right now
6. stitch tiles at the real offsets
7. run analysis last, then overwrite every element's coordinates with the measured ones

## 2. Never use fullPage screenshots

`page.screenshot({ fullPage: true })` expands the viewport in one go. Scroll-triggered reveals never fire and the capture comes back blank or half-empty. Always scroll and stitch.

## 3. Scroll position is not what you asked for

`scrollTo(0, y)` does not reliably leave you at `y` — smooth-scroll, scroll snapping and clamping at the document end all shift it. Read `window.scrollY` back after scrolling and use that number for both the paste offset and the measurement.

## 4. Keep the most-visible reading

An element seen half-on-screen mid-animation is a bad place to measure from. For each element keep the reading from the tile where it was most completely visible. On a tie the later tile wins, because by then the entrance animation has finished.

## 5. Hide fixed and sticky elements after the first tile

Otherwise headers, nav bars and cookie banners are stamped into every tile of the stitched image.

## 6. Cluster components on visual shape only

Never on class names — generated code has meaningless class names and identical components get different ones. Fingerprint on: kind, border radius, background, border, font-size bucket, font weight, shadow, width bucket, height bucket. Merge two clusters of the same role with the same footprint; they are one component the fingerprint split.

## 7. Strays are merge-only

A stray is a value used a few times that sits within tolerance of a value used at least 6× more often. Snap the rare value to the common one. Never invent a value that isn't already on the page. Tolerances: 3px for spacing and radius, 4.5% proportional for font size, ΔE ≤ 30 for colour.

## 8. Element-local vs page-level

Slop Patterns rules were written for generated code, not rendered pages. A page-level finding is never attributed to a component. Keep the two rule sets separate and label which level a finding came from.

## 9. A full-bleed box holding content is layout

Not decoration. Decoration is paint with no content in it: an element with no text, no icon, no image, no interactive children. Otherwise one hero backdrop reads as 50% decoration and the number is meaningless.

## 10. Every number traces to a measured element

No estimates, no scores invented to create separation, no percentages that can't be pointed at on the page. If a number can't be traced, don't show it. When a finding is negligible, say "negligible" and give the element count — not "0%", which reads as "found nothing".

## 11. Look at the result

When anything visual changes, render it and screenshot it before claiming it works. Edits silently fail to apply; sections nest inside hidden wrappers; a single unclosed CSS comment kills every rule after it. Verify by looking, not by reading the diff.

## 12. One resolver for "this site"

The scanned page, its thumbnail, its corpus entry and its analysis record are keyed differently — a host, a filename-safe slug, a corpus key. Write ONE function that resolves a host to each of them and use it everywhere. The moment two places do their own key matching they will disagree, and the failure is silent: a panel quietly falls back to a placeholder, or a section renders a different site's data under this site's name.

Symptom: a screen shows the right hostname in one place and the wrong data in another.

## 13. Missing data is a finding, never a substitution

If the scanned site has no corpus entry, no twin above the confidence floor, or no thumbnail, show that. Never fall back to a default record so the layout stays full — a filled-in panel is read as a measurement, and a borrowed one is a false claim. Absence is often the more interesting result: a page with its own radius set and its own spacing scale genuinely has no twin, and saying so is the strongest evidence the instrument discriminates.

## 14. Verify every specimen after every change

Keep a script that loads each test site end to end and asserts the things that must be true — the stage reached, findings rendered, the wall's subject matching the scanned host, zero console errors. Run it after every change, not at the end. Checking one site proves nothing about the others; two false-data bugs survived manual review of one site and were caught the first time all four ran.
