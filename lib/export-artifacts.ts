/**
 * Export artifacts for the Export tab: fix prompt, measured tokens, postconditions JSON.
 * FAIL findings only drive the fix prompt — never REVIEW as things to change.
 */

import type {
  Finding,
  MeasuredElement,
  MockScanBundle,
  Postcondition,
} from "@/lib/mock-scan";
import { formatPx, parsePx } from "@/lib/postconditions";
import { isDemoScanUrl } from "@/lib/scan-keys";

function parseArrow(value: string): { before: string; expected: string } | null {
  const m = value.match(/(-?[\d.]+px)\s*→\s*(-?[\d.]+px)/i);
  if (!m) return null;
  return { before: m[1], expected: m[2] };
}

function countStyleUses(
  elements: MeasuredElement[],
  key: keyof MeasuredElement["styles"],
  expected: string,
): number {
  if (key === "color" || key === "background" || key === "boxShadow" || key === "letterSpacing" || key === "fontWeight") {
    return elements.filter((el) => String(el.styles[key]).trim() === expected.trim()).length;
  }
  const want = parsePx(expected);
  if (want === null) return 0;
  const bucket = Math.round(want);
  return elements.filter((el) => {
    const raw = el.styles[key] as number;
    return Number.isFinite(raw) && Math.round(raw) === bucket;
  }).length;
}

function propertyPlain(cssProp: string): string {
  if (cssProp.includes("radius")) return "border-radius";
  if (cssProp === "font-size") return "font-size";
  return cssProp;
}

function guessDemoFile(finding: Finding, pc: Postcondition | undefined): string {
  if (pc?.property.includes("radius") || /radius/i.test(finding.label)) {
    return "app/demo/demo.css";
  }
  return "app/demo/demo.css";
}

function matchPostcondition(
  finding: Finding,
  postconditions: Postcondition[],
): Postcondition | undefined {
  return postconditions.find(
    (pc) =>
      pc.class === "FIX" &&
      pc.targets.some((t) => finding.elementIds.includes(t)),
  );
}

/**
 * Ready-to-paste coding-agent prompt from FAIL findings only.
 */
export function buildFixPrompt(
  bundle: MockScanBundle,
  scanUrl: string,
): string {
  const fails = bundle.findings.filter((f) => f.class === "FAIL");
  const reviews = bundle.findings.filter((f) => f.class === "REVIEW");
  const isDemo = isDemoScanUrl(scanUrl) || /demo/i.test(bundle.capture.host);

  if (fails.length === 0) {
    return [
      "No FAIL findings on this scan — nothing to change.",
      reviews.length
        ? `REVIEW items exist (${reviews.map((r) => r.elementIds.join(", ")).filter(Boolean).join("; ") || reviews.length}) — leave them alone until intent is confirmed.`
        : null,
      `Re-scan ${scanUrl || bundle.capture.url} after any future edits; only named FAIL targets are checked.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const blocks: string[] = [];

  for (const finding of fails) {
    const pc = matchPostcondition(finding, bundle.postconditions);
    const arrow = parseArrow(finding.value);
    const before = pc?.before ?? arrow?.before ?? "?";
    const expected = pc?.expected ?? arrow?.expected ?? "?";
    const targets = pc?.targets?.length
      ? pc.targets
      : finding.elementIds;
    const prop = pc?.property ?? "border-top-left-radius";
    const plain = propertyPlain(prop);

    let uses = 0;
    if (expected.endsWith("px") && /radius/i.test(prop + finding.label)) {
      uses = countStyleUses(bundle.capture.elements, "radius", expected);
    } else if (expected.endsWith("px") && /font/i.test(finding.label)) {
      uses = countStyleUses(bundle.capture.elements, "fontSize", expected);
    }

    const file = isDemo
      ? guessDemoFile(finding, pc)
      : `the stylesheet that sets ${plain} on ${targets.join(", ")}`;

    const subject = isDemo
      ? "the third feature card's border-radius"
      : `${targets.length === 1 ? "element" : "elements"} ${targets.join(", ")}'s ${plain}`;

    let para = `In ${file}, change ${subject} from\n${before} to ${expected}.`;
    if (uses > 0) {
      para += ` ${expected} is the radius used by the other ${uses} elements on this page.`;
    } else if (expected !== "?") {
      para += ` ${expected} is already present on this page — merge-only, do not invent a new value.`;
    }

    if (reviews.length > 0) {
      if (isDemo && reviews.some((r) => /cta/i.test(r.label) || r.elementIds.includes("e17"))) {
        para +=
          "\nDo not change the primary CTA button — its radius is intentionally\ndifferent and is marked REVIEW.";
      } else {
        const reviewBits = reviews
          .map((r) => {
            const ids = r.elementIds.join(", ") || r.label;
            return `${r.label} (${ids})`;
          })
          .join("; ");
        para += `\nDo not change REVIEW findings — ${reviewBits} — leave them until intent is confirmed.`;
      }
    }

    para += `\n\nAfter applying, re-scan ${scanUrl || bundle.capture.url}. The check passes only\nwhen ${
      targets.length === 1 ? `element ${targets[0]}` : `elements ${targets.join(", ")}`
    } resolve${targets.length === 1 ? "s" : ""} to ${prop}: ${expected}.`;

    blocks.push(para);
  }

  return blocks.join("\n\n");
}

type TokenBucket = { name: string; value: string; count: number };

function collectNumericTokens(
  elements: MeasuredElement[],
  key: "radius" | "fontSize" | "marginTop" | "marginBottom" | "paddingTop" | "paddingBottom",
  prefix: string,
): TokenBucket[] {
  const counts = new Map<number, number>();
  for (const el of elements) {
    const raw = el.styles[key];
    if (!Number.isFinite(raw)) continue;
    if (key !== "fontSize" && raw === 0) continue;
    const b = key === "fontSize" ? Math.round(raw * 100) / 100 : Math.round(raw);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([n, count]) => ({
      name: `--${prefix}-${String(n).replace(".", "_")}`,
      value: formatPx(n),
      count,
    }));
}

function collectColorTokens(elements: MeasuredElement[]): TokenBucket[] {
  const counts = new Map<string, number>();
  for (const el of elements) {
    const c = el.styles.color?.trim();
    if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([value, count], i) => ({
      name: `--color-${i + 1}`,
      value,
      count,
    }));
}

/** Measured token sets as CSS custom properties with usage comments. */
export function buildTokensCss(elements: MeasuredElement[]): string {
  const lines: string[] = [
    "/* Measured rendered values from this capture — not a recovered design system. */",
    ":root {",
  ];

  const groups: { title: string; tokens: TokenBucket[] }[] = [
    { title: "radii", tokens: collectNumericTokens(elements, "radius", "radius") },
    {
      title: "font sizes",
      tokens: collectNumericTokens(elements, "fontSize", "font-size"),
    },
    {
      title: "spacing (margin-top)",
      tokens: collectNumericTokens(elements, "marginTop", "space-mt"),
    },
    {
      title: "spacing (padding-top)",
      tokens: collectNumericTokens(elements, "paddingTop", "space-pt"),
    },
    { title: "colours (text)", tokens: collectColorTokens(elements) },
  ];

  for (const g of groups) {
    if (g.tokens.length === 0) continue;
    lines.push(`  /* ${g.title} */`);
    for (const t of g.tokens) {
      lines.push(`  ${t.name}: ${t.value};  /* ${t.count} use${t.count === 1 ? "" : "s"} */`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

/** Raw postconditions JSON for verify loop. */
export function buildPostconditionsJson(postconditions: Postcondition[]): string {
  const rows = postconditions.map((pc) => ({
    id: pc.id,
    property: pc.property,
    before: pc.before,
    expected: pc.expected,
    targets: pc.targets,
    class: pc.class,
  }));
  return JSON.stringify(rows, null, 2);
}
