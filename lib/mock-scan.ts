/**
 * Scan bundle shaped like Capture / Finding / Postcondition contracts.
 * Demo (/demo) uses the Ledgerly mock. Every other URL loads that host's
 * scan only — never a relabelled mock (rules 12 & 13).
 */

import {
  detectStrayFindings,
  emitPostconditions,
} from "@/lib/postconditions";
import {
  hostsMatch,
  isDemoScanUrl,
  resolveScanKeys,
} from "@/lib/scan-keys";

export { isDemoScanUrl, resolveScanKeys, hostsMatch } from "@/lib/scan-keys";

/** @deprecated Prefer isDemoScanUrl / runCapture. Kept false so UI never auto-mocks. */
export const USE_MOCK = false;

export type ElementStyles = {
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
  x: number;
  y: number;
  w: number;
  h: number;
  viewportIntersectionFraction: number;
  tag: string;
  styles: ElementStyles;
};

export type Capture = {
  url: string;
  host: string;
  capturedAt: string;
  viewport: { w: number; h: number };
  pageHeight: number;
  image: string;
  elements: MeasuredElement[];
  tiles: { y: number; height: number }[];
};

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

export type ReportFact = {
  value: string;
  label: string;
  detail: string;
};

export type TopFix = {
  n: number;
  title: string;
  detail: string;
  jump: string;
};

export type ComponentCluster = {
  id: string;
  role: string;
  count: number;
  label: string;
  recipe: string[];
  warn?: boolean;
  /** Crop window in page px — used for CSS background-position when image exists */
  crop?: { x: number; y: number; w: number; h: number };
};

export type TokenFingerprint = {
  fonts: Array<string | number>;
  radii: Array<string | number>;
  spacing: Array<string | number>;
  sizes: Array<string | number>;
  groundLuminance: Array<string | number>;
};

export type MockScanBundle = {
  capture: Capture;
  findings: Finding[];
  postconditions: Postcondition[];
  facts: ReportFact[];
  topFixes: TopFix[];
  components: ComponentCluster[];
  fingerprint: TokenFingerprint;
  verdict: { headline: string; emphasis: string; sub: string };
};

/** Fallback capture if public/mock-scan.json is missing — still contract-shaped. */
const FALLBACK_CAPTURE: Capture = {
  url: "http://127.0.0.1:43135/demo",
  host: "127.0.0.1:43135",
  capturedAt: "2026-09-19T16:22:12.112Z",
  viewport: { w: 1440, h: 900 },
  pageHeight: 2217,
  image: "/mock-capture.png",
  tiles: [
    { y: 0, height: 900 },
    { y: 900, height: 900 },
    { y: 1317, height: 900 },
  ],
  elements: [
    {
      id: "e14",
      x: 180,
      y: 167.9,
      w: 542,
      h: 174,
      viewportIntersectionFraction: 1,
      tag: "h1",
      styles: {
        fontSize: 53.6,
        fontWeight: "600",
        lineHeight: 58,
        letterSpacing: "-0.02em",
        color: "rgb(20, 20, 20)",
        background: "rgba(0, 0, 0, 0)",
        radius: 0,
        borderWidth: 0,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      },
    },
    {
      id: "e17",
      x: 180,
      y: 466.5,
      w: 209,
      h: 51,
      viewportIntersectionFraction: 1,
      tag: "a",
      styles: {
        fontSize: 16,
        fontWeight: "600",
        lineHeight: 22,
        letterSpacing: "normal",
        color: "rgb(255, 255, 255)",
        background: "rgb(20, 20, 20)",
        radius: 999,
        borderWidth: 0,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 13.6,
        paddingBottom: 13.6,
      },
    },
    {
      id: "e18",
      x: 401,
      y: 468.7,
      w: 170,
      h: 47,
      viewportIntersectionFraction: 1,
      tag: "a",
      styles: {
        fontSize: 15,
        fontWeight: "600",
        lineHeight: 22,
        letterSpacing: "normal",
        color: "rgb(20, 20, 20)",
        background: "rgba(0, 0, 0, 0)",
        radius: 8,
        borderWidth: 1,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 11.2,
        paddingBottom: 11.2,
      },
    },
    {
      id: "e46",
      x: 936.7,
      y: 778.8,
      w: 346.7,
      h: 203,
      viewportIntersectionFraction: 1,
      tag: "article",
      styles: {
        fontSize: 16,
        fontWeight: "400",
        lineHeight: 24,
        letterSpacing: "normal",
        color: "rgb(20, 20, 20)",
        background: "rgb(255, 255, 255)",
        radius: 11,
        borderWidth: 1,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 20,
        paddingBottom: 20,
      },
    },
    {
      id: "e38",
      x: 180,
      y: 778.8,
      w: 346.7,
      h: 203,
      viewportIntersectionFraction: 1,
      tag: "article",
      styles: {
        fontSize: 16,
        fontWeight: "400",
        lineHeight: 24,
        letterSpacing: "normal",
        color: "rgb(20, 20, 20)",
        background: "rgb(255, 255, 255)",
        radius: 12,
        borderWidth: 1,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 20,
        paddingBottom: 20,
      },
    },
    {
      id: "e42",
      x: 558.3,
      y: 778.8,
      w: 346.7,
      h: 203,
      viewportIntersectionFraction: 1,
      tag: "article",
      styles: {
        fontSize: 16,
        fontWeight: "400",
        lineHeight: 24,
        letterSpacing: "normal",
        color: "rgb(20, 20, 20)",
        background: "rgb(255, 255, 255)",
        radius: 12,
        borderWidth: 1,
        boxShadow: null,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 20,
        paddingBottom: 20,
      },
    },
  ],
};

export const MOCK_FINDINGS: Finding[] = [
  {
    id: "f-radius-stray",
    label: "Radius stray",
    class: "FAIL",
    value: "11px → 12px",
    note: "One feature card uses 11px while the system radius on this page is 12px (7 uses).",
    elementIds: ["e46"],
  },
  {
    id: "f-cta-intent",
    label: "Primary CTA radius",
    class: "REVIEW",
    value: "999px vs 8px",
    note: "Primary pill and secondary button differ on purpose — confirm before merging.",
    elementIds: ["e17", "e18"],
  },
  {
    id: "f-type-scale",
    label: "Display type",
    class: "PASS",
    value: "53.6 / 33.6",
    note: "Hero and section headings sit on two clear size buckets with no mid-strays.",
    elementIds: ["e14"],
  },
  {
    id: "f-shadow-stack",
    label: "Layered shadows",
    class: "UNSUPPORTED",
    value: "not measured",
    note: "Multi-layer box-shadow stacks are not resolved reliably on this capture.",
    elementIds: [],
  },
];

export const MOCK_POSTCONDITIONS: Postcondition[] = [
  {
    id: "pc-radius-e46",
    property: "border-top-left-radius",
    before: "11px",
    expected: "12px",
    targets: ["e46"],
    class: "FIX",
  },
  {
    id: "pc-cta-review",
    property: "border-radius",
    before: "999px",
    expected: "8px",
    targets: ["e17"],
    class: "REVIEW",
  },
];

export const MOCK_FACTS: ReportFact[] = [
  {
    value: "98",
    label: "Elements",
    detail: "Measured in one paint with the stitched capture",
  },
  {
    value: "3",
    label: "Tiles",
    detail: "Scroll positions read back: 0 · 900 · 1317",
  },
  {
    value: "1 FAIL",
    label: "Contracts",
    detail: "Radius stray on feature card e46",
  },
  {
    value: "negligible",
    label: "Decoration share",
    detail: "2 decorative paint nodes — not expressed as 0%",
  },
];

export const MOCK_TOP_FIXES: TopFix[] = [
  {
    n: 1,
    title: "Snap feature card radius 11px → 12px",
    detail: "Targets e46 only — the other two cards already match the system.",
    jump: "#finding-f-radius-stray",
  },
  {
    n: 2,
    title: "Decide on primary CTA pill vs 8px buttons",
    detail: "REVIEW — intentional difference until you say otherwise.",
    jump: "#finding-f-cta-intent",
  },
  {
    n: 3,
    title: "Re-scan after the radius merge",
    detail: "Verifier checks every listed target hits expected — not a page-wide count.",
    jump: "#verify",
  },
];

export const MOCK_COMPONENTS: ComponentCluster[] = [
  {
    id: "c-feature-card",
    role: "Card",
    count: 3,
    label: "Feature cards · white ground · 12px system",
    recipe: ["r12", "fill white", "pad 20", "w≈347"],
    warn: true,
    crop: { x: 180, y: 778, w: 347, h: 203 },
  },
  {
    id: "c-primary-cta",
    role: "Button",
    count: 1,
    label: "Primary CTA · full pill",
    recipe: ["r999", "ink fill", "16px"],
    crop: { x: 180, y: 466, w: 209, h: 51 },
  },
  {
    id: "c-ghost-btn",
    role: "Button",
    count: 4,
    label: "Ghost / secondary · 8px",
    recipe: ["r8", "hairline", "15px"],
    crop: { x: 401, y: 468, w: 170, h: 47 },
  },
];

export const MOCK_FINGERPRINT: TokenFingerprint = {
  fonts: [53.6, 33.6, 20, 16, 15, 14],
  radii: [0, 8, 12, 11, 999],
  spacing: [0, 11.2, 13.6, 17.6, 20, 28],
  sizes: [36, 47, 51, 203, 347],
  groundLuminance: [0.97, 0.96],
};

export const MOCK_VERDICT = {
  headline: "One card drifts from your radius system",
  emphasis: "One card drifts",
  sub: "Everything else on this page is either on-system or marked REVIEW for intent — no composite quality score.",
};

function fingerprintFromElements(elements: MeasuredElement[]): TokenFingerprint {
  const fonts: number[] = [];
  const radii: number[] = [];
  const spacing: number[] = [];
  const sizes: number[] = [];
  const seen = {
    fonts: new Set<number>(),
    radii: new Set<number>(),
    spacing: new Set<number>(),
    sizes: new Set<number>(),
  };

  for (const el of elements) {
    const fs = el.styles.fontSize;
    if (Number.isFinite(fs) && !seen.fonts.has(fs)) {
      seen.fonts.add(fs);
      fonts.push(fs);
    }
    const r = el.styles.radius;
    if (Number.isFinite(r) && !seen.radii.has(r)) {
      seen.radii.add(r);
      radii.push(r);
    }
    for (const sp of [
      el.styles.marginTop,
      el.styles.marginBottom,
      el.styles.paddingTop,
      el.styles.paddingBottom,
    ]) {
      if (Number.isFinite(sp) && sp !== 0 && !seen.spacing.has(sp)) {
        seen.spacing.add(sp);
        spacing.push(sp);
      }
    }
    const dim = Math.round(el.w);
    if (dim > 0 && !seen.sizes.has(dim)) {
      seen.sizes.add(dim);
      sizes.push(dim);
    }
  }

  fonts.sort((a, b) => b - a);
  radii.sort((a, b) => a - b);
  spacing.sort((a, b) => a - b);
  sizes.sort((a, b) => a - b);

  return {
    fonts: fonts.slice(0, 24),
    radii: radii.slice(0, 24),
    spacing: spacing.slice(0, 24),
    sizes: sizes.slice(0, 24),
    groundLuminance: [],
  };
}

function annotateMock(capture: Capture): MockScanBundle {
  const elementCount = capture.elements.length;
  const facts: ReportFact[] = [
    {
      value: String(elementCount),
      label: "Elements",
      detail: "Measured in one paint with the stitched capture",
    },
    {
      value: String(capture.tiles.length),
      label: "Tiles",
      detail: `Scroll positions read back: ${capture.tiles.map((t) => t.y).join(" · ")}`,
    },
    MOCK_FACTS[2],
    MOCK_FACTS[3],
  ];

  return {
    capture,
    findings: MOCK_FINDINGS,
    postconditions: MOCK_POSTCONDITIONS,
    facts,
    topFixes: MOCK_TOP_FIXES,
    components: MOCK_COMPONENTS,
    fingerprint: MOCK_FINGERPRINT,
    verdict: MOCK_VERDICT,
  };
}

/** Live / stored scan — findings from THIS capture's elements only. */
function annotateLive(capture: Capture): MockScanBundle {
  const findings = detectStrayFindings(capture.elements);
  const postconditions = emitPostconditions(findings, capture.elements);
  const failCount = findings.filter((f) => f.class === "FAIL").length;
  const reviewCount = findings.filter((f) => f.class === "REVIEW").length;

  const facts: ReportFact[] = [
    {
      value: String(capture.elements.length),
      label: "Elements",
      detail: "Measured in one paint with the stitched capture",
    },
    {
      value: String(capture.tiles.length),
      label: "Tiles",
      detail: `Scroll positions read back: ${capture.tiles.map((t) => t.y).join(" · ")}`,
    },
    {
      value:
        failCount > 0
          ? `${failCount} FAIL`
          : reviewCount > 0
            ? `${reviewCount} REVIEW`
            : "0 FAIL",
      label: "Contracts",
      detail:
        failCount > 0
          ? `${failCount} merge-only stray(s) on this host`
          : "No merge-only strays detected on this host",
    },
    {
      value: "negligible",
      label: "Decoration share",
      detail: "Decoration share not scored for live scans — absence over invention",
    },
  ];

  const topFixes: TopFix[] = findings
    .filter((f) => f.class === "FAIL" || f.class === "REVIEW")
    .slice(0, 3)
    .map((f, i) => ({
      n: i + 1,
      title: `${f.label}: ${f.value}`,
      detail: f.note,
      jump: `#finding-${f.id}`,
    }));

  if (topFixes.length === 0) {
    topFixes.push({
      n: 1,
      title: "No merge-only fixes on this scan",
      detail: "Nothing to snap — this host's measured values stand alone.",
      jump: "#findings",
    });
  }

  const verdict =
    failCount > 0
      ? {
          headline: `${failCount} measured stray${failCount === 1 ? "" : "s"} on this page`,
          emphasis: `${failCount} measured stray${failCount === 1 ? "" : "s"}`,
          sub: `Host ${capture.host} — findings computed from this capture only.`,
        }
      : {
          headline: "No merge-only strays on this capture",
          emphasis: "No merge-only strays",
          sub: `Host ${capture.host} — absence reported, not filled with another site's data.`,
        };

  return {
    capture,
    findings,
    postconditions,
    facts,
    topFixes,
    components: [],
    fingerprint: fingerprintFromElements(capture.elements),
    verdict,
  };
}

/** Load Ledgerly mock — only for /demo (or explicit mock callers). */
export async function loadMockScan(): Promise<MockScanBundle> {
  try {
    const res = await fetch("/mock-scan.json", { cache: "no-store" });
    if (res.ok) {
      const capture = (await res.json()) as Capture;
      return annotateMock(capture);
    }
  } catch {
    /* fall through */
  }

  return annotateMock(FALLBACK_CAPTURE);
}

/**
 * Load the scan record for this URL's host only.
 * Returns null when absent — never another host's bundle (rule 13).
 */
export async function loadHostScan(url: string): Promise<MockScanBundle | null> {
  const keys = resolveScanKeys(url);
  const res = await fetch(keys.apiJsonPath, { cache: "no-store" });
  if (res.status === 404) return null;
  if (res.status === 409) {
    throw new Error(`Scan on disk is mis-keyed for ${keys.host}`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Failed to load scan (${res.status})`);
  }

  const capture = (await res.json()) as Capture;
  if (!hostsMatch(capture.host, keys.host)) {
    throw new Error(
      `Refusing mismatched scan: asked for ${keys.host}, record is ${capture.host}`,
    );
  }

  // Ensure image is the host-keyed API path even if JSON was written with a file path.
  const withImage: Capture = {
    ...capture,
    image: keys.apiImagePath,
  };
  return annotateLive(withImage);
}

export class ScanAbsentError extends Error {
  host: string;
  constructor(host: string, detail?: string) {
    super(
      detail ||
        `No scan on file for ${host}. Capture it first, or try again when the capture API is available.`,
    );
    this.name = "ScanAbsentError";
    this.host = host;
  }
}

/**
 * Resolve a scan for `url`:
 * - /demo → Ledgerly mock only
 * - else → that host's stored scan, else live capture
 * - never relabel another site's data
 */
export async function runCapture(url: string): Promise<MockScanBundle> {
  if (isDemoScanUrl(url)) {
    const bundle = await loadMockScan();
    // Keep Ledgerly numbers; only align url/host to the demo address being inspected.
    return {
      ...bundle,
      capture: {
        ...bundle.capture,
        url,
        host: resolveScanKeys(url).host,
      },
    };
  }

  const keys = resolveScanKeys(url);

  const stored = await loadHostScan(url);
  if (stored) {
    return {
      ...stored,
      capture: {
        ...stored.capture,
        url, // preserve the requested URL; host stays from the record
      },
    };
  }

  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string; error?: string };
      detail = body.detail || body.error || "";
    } catch {
      /* ignore */
    }
    // Pass through the capture engine's message so the UI can classify it.
    // Do not wrap in "No scan on file…" — that buried ERR_NAME_NOT_RESOLVED.
    throw new Error(
      detail ||
        `Capture failed for ${keys.host} (HTTP ${res.status}). Nothing was measured.`,
    );
  }

  const capture = (await res.json()) as Capture;
  if (!hostsMatch(capture.host, keys.host)) {
    throw new Error(
      `Capture host mismatch: asked for ${keys.host}, got ${capture.host}`,
    );
  }

  return annotateLive({
    ...capture,
    image: capture.image?.startsWith("/")
      ? capture.image
      : keys.apiImagePath,
  });
}
