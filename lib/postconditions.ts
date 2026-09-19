/**
 * Emit merge-only postconditions from scan findings (and optional stray detection).
 * Never invents a value that is not already on the page.
 */

export type FindingClass = "FAIL" | "REVIEW" | "PASS" | "UNSUPPORTED";

export type Finding = {
  id: string;
  label: string;
  class: FindingClass;
  value: string;
  note: string;
  elementIds: string[];
};

export type Postcondition = {
  id: string;
  property: string;
  before: string;
  expected: string;
  targets: string[];
  class: "FIX" | "REVIEW";
};

export type MeasuredStyles = {
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: string;
  color: string;
  background: string;
  radius: number;
  borderWidth: number;
  boxShadow: string | null;
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingBottom: number;
};

export type MeasuredElement = {
  id: string;
  tag: string;
  styles: MeasuredStyles;
};

/** Tolerances from Design DNA §7 */
export const TOLERANCE_PX = 3;
export const TOLERANCE_FONT_RATIO = 0.045;
export const TOLERANCE_DELTA_E = 30;
/** Common value must appear at least this many times more often than the rare one */
export const STRAY_FREQUENCY_RATIO = 6;
/** Strays used this many times or fewer are REVIEW — too few to call drift */
export const STRAY_REVIEW_MAX_USES = 2;

/** Finding note / postcondition reason for low-frequency strays. */
export function strayFewUsesReason(n: number): string {
  return `Used only ${n} time(s). Too few uses to tell drift from a deliberate one-off.`;
}

export type StylePropertyKey =
  | "radius"
  | "marginTop"
  | "marginBottom"
  | "paddingTop"
  | "paddingBottom"
  | "fontSize"
  | "color";

/** CSS property names used in postconditions (contract examples use border-top-left-radius). */
export const PROPERTY_CSS: Record<StylePropertyKey, string> = {
  radius: "border-top-left-radius",
  marginTop: "margin-top",
  marginBottom: "margin-bottom",
  paddingTop: "padding-top",
  paddingBottom: "padding-bottom",
  fontSize: "font-size",
  color: "color",
};

const CSS_TO_STYLE: Record<string, StylePropertyKey> = {
  "border-top-left-radius": "radius",
  "border-radius": "radius",
  "margin-top": "marginTop",
  "margin-bottom": "marginBottom",
  "padding-top": "paddingTop",
  "padding-bottom": "paddingBottom",
  "font-size": "fontSize",
  color: "color",
};

export function styleKeyFromCssProperty(
  property: string,
): StylePropertyKey | null {
  return CSS_TO_STYLE[property] ?? null;
}

export function formatPx(n: number): string {
  if (!Number.isFinite(n)) return "0px";
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? `${rounded}px` : `${rounded}px`;
}

export function parsePx(value: string): number | null {
  const m = String(value)
    .trim()
    .match(/^(-?[\d.]+)px$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function readNumeric(styles: MeasuredStyles, key: StylePropertyKey): number {
  if (key === "color") return NaN;
  return styles[key] as number;
}

function readValueString(
  styles: MeasuredStyles,
  key: StylePropertyKey,
): string {
  if (key === "color") return styles.color;
  return formatPx(readNumeric(styles, key));
}

function withinTolerance(
  a: number,
  b: number,
  key: StylePropertyKey,
): boolean {
  if (key === "fontSize") {
    const base = Math.max(Math.abs(b), Math.abs(a), 1e-6);
    return Math.abs(a - b) / base <= TOLERANCE_FONT_RATIO;
  }
  return Math.abs(a - b) <= TOLERANCE_PX;
}

/** sRGB 0–255 → approx CIE Lab (D65). */
export function rgbToLab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  const xn = 0.95047;
  const yn = 1;
  const zn = 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function parseCssColor(
  input: string,
): { r: number; g: number; b: number } | null {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0 };
  const rgb = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/,
  );
  if (rgb) {
    return {
      r: parseFloat(rgb[1]),
      g: parseFloat(rgb[2]),
      b: parseFloat(rgb[3]),
    };
  }
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

export function deltaE76(a: string, b: string): number | null {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca || !cb) return null;
  const [L1, a1, b1] = rgbToLab(ca.r, ca.g, ca.b);
  const [L2, a2, b2] = rgbToLab(cb.r, cb.g, cb.b);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

function colorWithinTolerance(a: string, b: string): boolean {
  const d = deltaE76(a, b);
  if (d === null) return a.trim() === b.trim();
  return d <= TOLERANCE_DELTA_E;
}

/**
 * Snap rare → common when rare sits within tolerance of a value used
 * at least STRAY_FREQUENCY_RATIO× more often. Merge-only: expected is
 * always a value already present on the page.
 */
export function findMergeTarget(
  rare: number,
  counts: Map<number, number>,
  key: StylePropertyKey,
): number | null {
  const rareCount = counts.get(rare) ?? 0;
  if (rareCount === 0) return null;

  let best: number | null = null;
  let bestDist = Infinity;

  for (const [common, commonCount] of counts) {
    if (common === rare) continue;
    if (commonCount < rareCount * STRAY_FREQUENCY_RATIO) continue;
    if (!withinTolerance(rare, common, key)) continue;
    const dist = Math.abs(rare - common);
    if (dist < bestDist) {
      bestDist = dist;
      best = common;
    }
  }
  return best;
}

function bucketKey(n: number, key: StylePropertyKey): number {
  if (key === "fontSize") return Math.round(n * 100) / 100;
  return Math.round(n);
}

type StrayHit = {
  styleKey: StylePropertyKey;
  before: number;
  expected: number;
  targets: string[];
};

function detectNumericStrays(
  elements: MeasuredElement[],
  styleKey: StylePropertyKey,
): StrayHit[] {
  const counts = new Map<number, number>();
  const byValue = new Map<number, string[]>();

  for (const el of elements) {
    const raw = readNumeric(el.styles, styleKey);
    if (!Number.isFinite(raw)) continue;
    // Skip zero spacing/radius — overwhelmingly layout defaults, not a token set.
    if (styleKey !== "fontSize" && raw === 0) continue;
    const b = bucketKey(raw, styleKey);
    counts.set(b, (counts.get(b) ?? 0) + 1);
    const list = byValue.get(b) ?? [];
    list.push(el.id);
    byValue.set(b, list);
  }

  const hits: StrayHit[] = [];
  for (const [rare, targets] of byValue) {
    const expected = findMergeTarget(rare, counts, styleKey);
    if (expected === null) continue;
    hits.push({ styleKey, before: rare, expected, targets: [...targets] });
  }
  return hits;
}

/**
 * Detect merge-only stray findings from measured elements.
 * Used when a scan has no precomputed findings yet.
 */
export function detectStrayFindings(elements: MeasuredElement[]): Finding[] {
  const findings: Finding[] = [];
  const keys: StylePropertyKey[] = [
    "radius",
    "marginTop",
    "marginBottom",
    "paddingTop",
    "paddingBottom",
    "fontSize",
  ];

  for (const key of keys) {
    for (const hit of detectNumericStrays(elements, key)) {
      const label =
        key === "radius"
          ? "Radius stray"
          : key === "fontSize"
            ? "Font-size stray"
            : "Spacing stray";
      const uses = hit.targets.length;
      const isReview = uses <= STRAY_REVIEW_MAX_USES;
      findings.push({
        id: `f-${key}-${hit.targets.join("-")}`,
        label,
        class: isReview ? "REVIEW" : "FAIL",
        value: `${formatPx(hit.before)} → ${formatPx(hit.expected)}`,
        note: isReview
          ? strayFewUsesReason(uses)
          : `${uses} element(s) use ${formatPx(hit.before)} while ${formatPx(hit.expected)} is the merge target already on this page.`,
        elementIds: hit.targets,
      });
    }
  }

  return findings;
}

function inferStyleKeyFromFinding(finding: Finding): StylePropertyKey | null {
  const label = finding.label.toLowerCase();
  if (label.includes("radius")) return "radius";
  if (label.includes("font")) return "fontSize";
  if (
    label.includes("spacing") ||
    label.includes("margin") ||
    label.includes("padding") ||
    label.includes("rhythm")
  ) {
    return "marginTop";
  }
  if (label.includes("colour") || label.includes("color")) return "color";

  const arrow = finding.value.match(
    /(-?[\d.]+px)\s*→\s*(-?[\d.]+px)/i,
  );
  if (arrow) {
    // Prefer radius when both look like radii and label is silent — caller
    // still passes elements so we can confirm via styleKeyFromCssProperty later.
    return "radius";
  }
  return null;
}

function parseArrowValues(
  value: string,
): { before: string; expected: string } | null {
  const m = value.match(/(-?[\d.]+px)\s*→\s*(-?[\d.]+px)/i);
  if (!m) return null;
  return { before: m[1], expected: m[2] };
}

/**
 * From a scan's findings, emit postconditions.
 * MERGE-ONLY: expected is snapped to a value already on the page (via elements),
 * never invented. FAIL → FIX; REVIEW → REVIEW; PASS/UNSUPPORTED skipped.
 */
export function emitPostconditions(
  findings: Finding[],
  elements: MeasuredElement[],
): Postcondition[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const out: Postcondition[] = [];

  for (const finding of findings) {
    if (finding.class !== "FAIL" && finding.class !== "REVIEW") continue;
    if (finding.elementIds.length === 0) continue;

    const styleKey = inferStyleKeyFromFinding(finding);
    if (!styleKey) continue;

    const cssProp = PROPERTY_CSS[styleKey];
    const arrow = parseArrowValues(finding.value);

    const targets = finding.elementIds.filter((id) => byId.has(id));
    if (targets.length === 0) continue;

    // Resolve before from measured targets (authoritative).
    const first = byId.get(targets[0])!;
    let before = readValueString(first.styles, styleKey);
    let expected: string | null = null;

    if (styleKey === "color") {
      // Colour merge: snap to nearest common colour within ΔE.
      expected = snapColor(first.styles.color, elements);
    } else {
      const rareNum = readNumeric(first.styles, styleKey);
      const counts = new Map<number, number>();
      for (const el of elements) {
        const raw = readNumeric(el.styles, styleKey);
        if (!Number.isFinite(raw)) continue;
        if (styleKey !== "fontSize" && raw === 0) continue;
        const b = bucketKey(raw, styleKey);
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
      const snap = findMergeTarget(
        bucketKey(rareNum, styleKey),
        counts,
        styleKey,
      );
      if (snap !== null) {
        expected = formatPx(snap);
        before = formatPx(bucketKey(rareNum, styleKey));
      } else if (arrow) {
        // Only accept arrow expected if that value exists on the page.
        const want = parsePx(arrow.expected);
        if (want !== null) {
          const exists = elements.some((el) => {
            const v = readNumeric(el.styles, styleKey);
            return (
              Number.isFinite(v) &&
              bucketKey(v, styleKey) === bucketKey(want, styleKey)
            );
          });
          if (exists) {
            expected = formatPx(bucketKey(want, styleKey));
            before = arrow.before;
          }
        }
      }
    }

    if (!expected) continue;
    // Guard: never invent — expected must appear on the page.
    if (styleKey !== "color") {
      const expN = parsePx(expected);
      if (expN === null) continue;
      const onPage = elements.some((el) => {
        const v = readNumeric(el.styles, styleKey);
        return (
          Number.isFinite(v) &&
          bucketKey(v, styleKey) === bucketKey(expN, styleKey)
        );
      });
      if (!onPage) continue;
    }

    out.push({
      id: `pc-${finding.id}`,
      property: cssProp,
      before,
      expected,
      targets,
      class: finding.class === "FAIL" ? "FIX" : "REVIEW",
    });
  }

  return out;
}

function snapColor(
  rare: string,
  elements: MeasuredElement[],
): string | null {
  const counts = new Map<string, number>();
  for (const el of elements) {
    const c = el.styles.color;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const rareCount = counts.get(rare) ?? 0;
  let best: string | null = null;
  let bestD = Infinity;
  for (const [common, commonCount] of counts) {
    if (common === rare) continue;
    if (commonCount < rareCount * STRAY_FREQUENCY_RATIO) continue;
    const d = deltaE76(rare, common);
    if (d === null || d > TOLERANCE_DELTA_E) continue;
    if (d < bestD) {
      bestD = d;
      best = common;
    }
  }
  return best;
}

/**
 * Convenience: detect stray findings from elements, then emit postconditions.
 */
export function emitPostconditionsFromElements(
  elements: MeasuredElement[],
): Postcondition[] {
  return emitPostconditions(detectStrayFindings(elements), elements);
}

/**
 * Stray-detection proximity (3px / 4.5% / ΔE≤30). Used only when deciding
 * whether a rare value may merge onto a common one — never for verify PASS.
 */
export function valuesWithinStrayTolerance(
  resolved: string,
  expected: string,
  styleKey: StylePropertyKey,
): boolean {
  if (styleKey === "color") {
    return colorWithinTolerance(resolved, expected);
  }
  const a = parsePx(resolved);
  const b = parsePx(expected);
  if (a === null || b === null) {
    return resolved.trim() === expected.trim();
  }
  return withinTolerance(a, b, styleKey);
}

/**
 * Verify equality: target must resolve to expected, not merely "near" it.
 * A third value within stray tolerance is still FAIL.
 * Allows ≤0.5px measurement noise for lengths; colours must match exactly
 * (or ΔE < 1 for float rounding in getComputedStyle).
 */
export function valuesMatch(
  resolved: string,
  expected: string,
  styleKey: StylePropertyKey,
): boolean {
  if (styleKey === "color") {
    if (resolved.trim() === expected.trim()) return true;
    const d = deltaE76(resolved, expected);
    return d !== null && d < 1;
  }
  const a = parsePx(resolved);
  const b = parsePx(expected);
  if (a === null || b === null) {
    return resolved.trim() === expected.trim();
  }
  return Math.abs(a - b) <= 0.5;
}
