/**
 * Plain-English tooltip copy for a redline box.
 * Real numbers only — never templates with blanks.
 */

import type { Finding, MeasuredElement } from "@/lib/mock-scan";
import {
  formatPx,
  parsePx,
  type StylePropertyKey,
} from "@/lib/postconditions";

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
  "Twenty",
] as const;

function spellCount(n: number): string {
  if (n >= 0 && n < ONES.length) return ONES[n];
  return String(n);
}

function nounForTag(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "article") return "card";
  if (t === "button") return "button";
  if (t === "a") return "link";
  if (t === "img" || t === "picture") return "image";
  if (t === "input" || t === "textarea") return "input";
  if (/^h[1-6]$/.test(t)) return "heading";
  if (t === "p" || t === "span" || t === "label") return "text";
  if (t === "nav") return "nav";
  if (t === "li") return "list item";
  return "element";
}

function inferStyleKey(finding: Finding): StylePropertyKey | null {
  const label = finding.label.toLowerCase();
  if (label.includes("radius")) return "radius";
  if (label.includes("font")) return "fontSize";
  if (label.includes("padding-top") || label.includes("padding top"))
    return "paddingTop";
  if (label.includes("padding-bottom") || label.includes("padding bottom"))
    return "paddingBottom";
  if (label.includes("margin-top") || label.includes("margin top"))
    return "marginTop";
  if (label.includes("margin-bottom") || label.includes("margin bottom"))
    return "marginBottom";
  if (label.includes("spacing") || label.includes("margin") || label.includes("padding"))
    return "marginTop";
  if (label.includes("colour") || label.includes("color")) return "color";
  if (/(-?[\d.]+px)\s*→\s*(-?[\d.]+px)/i.test(finding.value)) return "radius";
  return null;
}

function propertyPhrase(key: StylePropertyKey): string {
  switch (key) {
    case "radius":
      return "corner radius";
    case "fontSize":
      return "font size";
    case "marginTop":
      return "top margin";
    case "marginBottom":
      return "bottom margin";
    case "paddingTop":
      return "top padding";
    case "paddingBottom":
      return "bottom padding";
    case "color":
      return "text colour";
  }
}

function parseArrow(value: string): { before: string; expected: string } | null {
  const m = value.match(/(-?[\d.]+px)\s*→\s*(-?[\d.]+px)/i);
  if (!m) return null;
  return { before: m[1], expected: m[2] };
}

function readStylePx(
  el: MeasuredElement,
  key: StylePropertyKey,
): string | null {
  if (key === "color") return el.styles.color;
  const n = el.styles[key] as number;
  if (!Number.isFinite(n)) return null;
  return formatPx(Math.round(key === "fontSize" ? n * 100 : n) / (key === "fontSize" ? 100 : 1));
}

function countExpectedUses(
  elements: MeasuredElement[],
  key: StylePropertyKey,
  expected: string,
): number {
  if (key === "color") {
    return elements.filter((el) => el.styles.color.trim() === expected.trim())
      .length;
  }
  const want = parsePx(expected);
  if (want === null) return 0;
  const bucket = key === "fontSize" ? Math.round(want * 100) / 100 : Math.round(want);
  return elements.filter((el) => {
    const raw = el.styles[key] as number;
    if (!Number.isFinite(raw)) return false;
    const b = key === "fontSize" ? Math.round(raw * 100) / 100 : Math.round(raw);
    return b === bucket;
  }).length;
}

/** Tooltip reason for low-frequency REVIEW strays (plain English, not "time(s)"). */
export function strayTooltipReviewReason(n: number): string {
  if (n === 1) {
    return "Used only once. Too few uses to tell drift from a deliberate one-off.";
  }
  return `Used only ${n} times. Too few uses to tell drift from a deliberate one-off.`;
}

export type RedlineTooltipLines = {
  badge: Finding["class"];
  elementId: string;
  measured: string;
  pageContext: string;
  closing: string;
};

/**
 * Build four-line tooltip content from a finding + the hovered element.
 */
export function buildRedlineTooltip(
  finding: Finding,
  el: MeasuredElement,
  elements: MeasuredElement[],
): RedlineTooltipLines {
  const badge = finding.class;
  const elementId = el.id;

  if (finding.class === "UNSUPPORTED") {
    return {
      badge,
      elementId: elementId || "—",
      measured: finding.note || "This measurement is not supported on this page.",
      pageContext: finding.value
        ? `Reported as ${finding.value}.`
        : "Nothing was recorded for this check.",
      closing: "Could not measure this property reliably on this capture.",
    };
  }

  const key = inferStyleKey(finding);
  const arrow = parseArrow(finding.value);
  const noun = nounForTag(el.tag);

  let before = arrow?.before ?? null;
  let expected = arrow?.expected ?? null;
  if (key && !before) {
    before = readStylePx(el, key);
  }
  if (key && before && !expected && arrow) {
    expected = arrow.expected;
  }

  const prop = key ? propertyPhrase(key) : "measured value";
  const measured =
    before != null
      ? `This ${noun}'s ${prop} is ${before}.`
      : finding.value
        ? `This ${noun} measures ${finding.value}.`
        : `This ${noun} was flagged by ${finding.label}.`;

  let pageContext: string;
  if (expected && key) {
    const n = countExpectedUses(elements, key, expected);
    const word = spellCount(n);
    const elWord = n === 1 ? "element" : "elements";
    pageContext = `${word} other ${elWord} on this page use ${expected}.`;
  } else if (finding.note && finding.class === "REVIEW" && !/used only/i.test(finding.note)) {
    pageContext = finding.note;
  } else if (expected) {
    pageContext = `Other elements on this page use ${expected}.`;
  } else {
    pageContext = finding.note || "No merge target was recorded for this finding.";
  }

  let closing: string;
  if (finding.class === "REVIEW") {
    // Prefer count of THIS stray's targets (the rare value), not the finding note.
    const uses = finding.elementIds.length || 1;
    if (/used only/i.test(finding.note)) {
      closing = strayTooltipReviewReason(uses);
    } else {
      // Intentional REVIEW (e.g. demo CTA) — state the measurement reason, no soft language.
      closing = finding.note;
    }
  } else if (finding.class === "FAIL" && expected) {
    closing = `Fix: change it to ${expected} — a value already on this page.`;
  } else if (finding.class === "PASS") {
    closing = "On-system — no change required.";
  } else {
    closing = finding.note || "No correction recorded.";
  }

  return { badge, elementId, measured, pageContext, closing };
}
