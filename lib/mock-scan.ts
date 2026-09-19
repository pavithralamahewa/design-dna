/**
 * Mock scan bundle shaped like Capture / Finding / Postcondition contracts.
 * Flip USE_MOCK to false when wiring real `/api/capture`.
 */

export const USE_MOCK = true;

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

function annotate(capture: Capture): MockScanBundle {
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

/** Load mock capture (from public JSON when present). */
export async function loadMockScan(): Promise<MockScanBundle> {
  if (!USE_MOCK) {
    throw new Error("USE_MOCK is false — call real /api/capture instead");
  }

  try {
    const res = await fetch("/mock-scan.json", { cache: "no-store" });
    if (res.ok) {
      const capture = (await res.json()) as Capture;
      return annotate(capture);
    }
  } catch {
    /* fall through */
  }

  return annotate(FALLBACK_CAPTURE);
}

/**
 * When USE_MOCK is false, swap this for a POST to `/api/capture`.
 * One-line change at the call site in ScanApp.
 */
export async function runCapture(url: string): Promise<MockScanBundle> {
  if (USE_MOCK) {
    // Honest wait is driven by StageRun (15–20s of tiled capture + measure).
    // Here we only resolve the finished bundle once the run UI completes.
    void url;
    return loadMockScan();
  }

  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new Error(`Capture failed (${res.status})`);
  }
  const capture = (await res.json()) as Capture;
  return annotate(capture);
}
