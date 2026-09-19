/**
 * Corpus comparison — weighted Jaccard against public/corpus.json.
 *
 * Dataset (when present): 573 sites fingerprinted 18 Sep 2026. Data, not code.
 * This module never fabricates entries; missing corpus → empty results + honest absence.
 */

export const MATCH_FLOOR = 0.4;

export const WEIGHTS = {
  fonts: 0.3,
  radii: 0.26,
  spacing: 0.26,
  sizes: 0.1,
  groundLuminance: 0.08,
} as const;

/** Measured token sets from a scan (or a corpus entry). */
export type TokenFingerprint = {
  fonts: Array<string | number>;
  radii: Array<string | number>;
  spacing: Array<string | number>;
  sizes: Array<string | number>;
  groundLuminance: Array<string | number>;
};

export type CorpusEntry = TokenFingerprint & {
  /** Display / match host, e.g. "stripe.com" */
  host: string;
  /** Stable corpus key (often same as host). */
  key: string;
  /** Public path to thumbnail, if one was captured. */
  thumbnail?: string | null;
};

export type SiteIdentity = {
  host: string;
  /** Filename-safe slug used for thumbs and .scans JSON. */
  slug: string;
  /** Corpus lookup key (hostname, lowercased, www stripped). */
  corpusKey: string;
  thumbnailPath: string;
  scanPath: string;
  entry: CorpusEntry | null;
  hasCorpusEntry: boolean;
  hasThumbnail: boolean;
};

export type ChannelBreakdown = {
  key: keyof typeof WEIGHTS;
  weight: number;
  jaccard: number;
  weighted: number;
  scanCount: number;
  corpusCount: number;
  intersection: number;
};

export type SimilarityExplain = {
  host: string;
  score: number;
  channels: ChannelBreakdown[];
};

export type CorpusMatch = {
  host: string;
  key: string;
  score: number;
  thumbnail: string | null;
  entry: CorpusEntry;
  /** Raw weighted-Jaccard inputs for this match (printed for the top candidate). */
  explain: SimilarityExplain;
};

export type CorpusMatchResult = {
  top5: CorpusMatch[];
  /** Scanned host's own corpus row, when present (even if not in top 5). */
  self: CorpusMatch | null;
  /** Highest score across the whole corpus (may be below MATCH_FLOOR). */
  closest: CorpusMatch | null;
  /** True when at least one match scores ≥ MATCH_FLOOR. */
  hasMatchAboveFloor: boolean;
  /** Human-readable absence / low-match note, or null when top matches qualify. */
  absenceNote: string | null;
};

export type CorpusFile = {
  generatedAt?: string;
  note?: string;
  sites: CorpusEntry[];
};

const TOKEN_KEYS = [
  "fonts",
  "radii",
  "spacing",
  "sizes",
  "groundLuminance",
] as const;

/** ONE resolver — every host → key / thumb / scan / entry lookup goes through here. */
export function resolveSite(
  host: string,
  corpus: readonly CorpusEntry[] = [],
): SiteIdentity {
  const normalized = normalizeHost(host);
  // Match capture.ts slugFromHost so .scans/<slug>.json keys agree (rule 12).
  const slug = normalized.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const corpusKey = normalized;
  const thumbnailPath = `/thumbs/${slug}.webp`;
  const scanPath = `.scans/${slug}.json`;

  const entry =
    corpus.find(
      (row) =>
        normalizeHost(row.key) === corpusKey ||
        normalizeHost(row.host) === corpusKey,
    ) ?? null;

  const thumbFromEntry =
    entry?.thumbnail && String(entry.thumbnail).trim().length > 0
      ? String(entry.thumbnail)
      : null;

  return {
    host: normalized,
    slug,
    corpusKey,
    thumbnailPath: thumbFromEntry ?? thumbnailPath,
    scanPath,
    entry,
    hasCorpusEntry: entry !== null,
    hasThumbnail: thumbFromEntry !== null,
  };
}

export function normalizeHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith("http://") || h.startsWith("https://")) {
    try {
      h = new URL(h).host.toLowerCase();
    } catch {
      /* keep trimmed lower */
    }
  }
  if (h.startsWith("www.")) h = h.slice(4);
  return h.replace(/\/+$/, "");
}

export function hostToSlug(host: string): string {
  return normalizeHost(host).replace(/[^a-z0-9._-]+/gi, "-");
}

export function isLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  const hostname = h.split(":")[0] ?? h;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

/** Parse public/corpus.json (or equivalent). Returns [] sites if shape is wrong — never invents rows. */
export function parseCorpusJson(raw: unknown): CorpusFile {
  if (raw == null) {
    return { sites: [] };
  }
  if (Array.isArray(raw)) {
    return { sites: raw.map(normalizeEntry).filter((e): e is CorpusEntry => e !== null) };
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const list =
      (Array.isArray(obj.sites) && obj.sites) ||
      (Array.isArray(obj.entries) && obj.entries) ||
      (Array.isArray(obj.corpus) && obj.corpus) ||
      [];
    return {
      generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : undefined,
      note: typeof obj.note === "string" ? obj.note : undefined,
      sites: list.map(normalizeEntry).filter((e): e is CorpusEntry => e !== null),
    };
  }
  return { sites: [] };
}

function normalizeEntry(row: unknown): CorpusEntry | null {
  if (row == null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const hostRaw =
    (typeof r.host === "string" && r.host) ||
    (typeof r.hostname === "string" && r.hostname) ||
    (typeof r.domain === "string" && r.domain) ||
    (typeof r.key === "string" && r.key) ||
    "";
  if (!hostRaw) return null;
  const host = normalizeHost(hostRaw);
  const key = normalizeHost(
    typeof r.key === "string" && r.key ? r.key : host,
  );
  const thumb =
    typeof r.thumbnail === "string"
      ? r.thumbnail
      : typeof r.thumb === "string"
        ? r.thumb
        : typeof r.image === "string"
          ? r.image
          : null;

  const tokens = r.tokens && typeof r.tokens === "object"
    ? (r.tokens as Record<string, unknown>)
    : r;

  // Real corpus rows use { v, c } bags: sizes=font sizes, fams=families,
  // spaces/gaps=spacing, bgs→ground luminance. Flat TokenFingerprint rows
  // already use fonts/radii/spacing/sizes/groundLuminance directly.
  const corpusBag =
    Array.isArray(r.fams) ||
    Array.isArray(r.spaces) ||
    Array.isArray(r.gaps) ||
    Array.isArray(r.bgs);

  const fonts = uniqueTokens([
    ...toTokenList(tokens.fonts ?? tokens.fontSizes ?? tokens.fontSize),
    ...(corpusBag
      ? toTokenList(tokens.sizes ?? tokens.typeSizes ?? tokens.fontSizeValues)
      : toTokenList(tokens.typeSizes ?? tokens.fontSizeValues)),
    ...toTokenList(tokens.fams ?? tokens.families ?? tokens.fontFamilies),
  ]);
  const radii = toTokenList(tokens.radii ?? tokens.radius ?? tokens.borderRadii);
  const spacing = uniqueTokens([
    ...toTokenList(tokens.spacing ?? tokens.spacings),
    ...toTokenList(tokens.spaces),
    ...toTokenList(tokens.gaps),
  ]);
  const sizes = toTokenList(
    corpusBag
      ? (tokens.componentSizes ?? tokens.widths ?? tokens.dims)
      : (tokens.sizes ?? tokens.componentSizes ?? tokens.widths ?? tokens.dims),
  );
  const groundLuminance = uniqueTokens([
    ...toTokenList(
      tokens.groundLuminance ??
        tokens.groundLuminances ??
        tokens.luminance ??
        tokens.grounds,
    ),
    ...luminanceFromColors(tokens.bgs ?? tokens.backgrounds),
  ]);

  return {
    host,
    key,
    thumbnail: thumb,
    fonts,
    radii,
    spacing,
    sizes,
    groundLuminance,
  };
}

function uniqueTokens(values: Array<string | number>): Array<string | number> {
  const seen = new Set<string>();
  const out: Array<string | number> = [];
  for (const v of values) {
    const k =
      typeof v === "number" ? `n:${Math.round(v * 1000) / 1000}` : `s:${String(v).toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function luminanceFromColors(value: unknown): number[] {
  const colors = toTokenList(value);
  const out: number[] = [];
  for (const c of colors) {
    if (typeof c !== "string") continue;
    const L = relativeLuminance(c);
    if (L != null) out.push(L);
  }
  return out;
}

function relativeLuminance(cssColor: string): number | null {
  const m = cssColor.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!m) return null;
  const channel = (raw: string) => {
    let c = Number(raw) / 255;
    if (!Number.isFinite(c)) return null;
    c = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return c;
  };
  const r = channel(m[1]!);
  const g = channel(m[2]!);
  const b = channel(m[3]!);
  if (r == null || g == null || b == null) return null;
  return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 1000) / 1000;
}

function toTokenList(value: unknown): Array<string | number> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim()) return v.trim();
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          // Corpus uses { v, c }; some fixtures use { value }.
          const inner =
            "v" in obj
              ? obj.v
              : "value" in obj
                ? obj.value
                : undefined;
          if (typeof inner === "number" && Number.isFinite(inner)) return inner;
          if (typeof inner === "string" && inner.trim()) return inner.trim();
        }
        return null;
      })
      .filter((v): v is string | number => v !== null);
  }
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function jaccard(
  a: Iterable<string | number>,
  b: Iterable<string | number>,
): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const x of setA) {
    if (setB.has(x)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function tokenize(values: Iterable<string | number>): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      // Quantize continuous measures so near-equal px / luminance still intersect.
      const q = Math.round(v * 1000) / 1000;
      out.add(String(q));
    } else if (typeof v === "string" && v.trim()) {
      out.add(v.trim().toLowerCase());
    }
  }
  return out;
}

export function explainSimilarity(
  scan: TokenFingerprint,
  corpus: TokenFingerprint,
  host: string,
): SimilarityExplain {
  const channels: ChannelBreakdown[] = TOKEN_KEYS.map((key) => {
    const setA = tokenize(scan[key]);
    const setB = tokenize(corpus[key]);
    let intersection = 0;
    for (const x of setA) {
      if (setB.has(x)) intersection += 1;
    }
    const j =
      setA.size === 0 && setB.size === 0
        ? 1
        : setA.size === 0 || setB.size === 0
          ? 0
          : intersection / (setA.size + setB.size - intersection);
    return {
      key,
      weight: WEIGHTS[key],
      jaccard: j,
      weighted: WEIGHTS[key] * j,
      scanCount: setA.size,
      corpusCount: setB.size,
      intersection,
    };
  });
  const score = channels.reduce((s, c) => s + c.weighted, 0);
  return { host, score, channels };
}

export function weightedSimilarity(
  a: TokenFingerprint,
  b: TokenFingerprint,
): number {
  return explainSimilarity(a, b, "").score;
}

/**
 * Compare a scan fingerprint to every corpus entry.
 * Returns top 5 by score, plus the scanned host's own entry when present.
 */
export function matchCorpus(
  fingerprint: TokenFingerprint,
  corpus: readonly CorpusEntry[],
  scannedHost: string,
): CorpusMatchResult {
  const identity = resolveSite(scannedHost, corpus);
  const scored: CorpusMatch[] = corpus.map((entry) => {
    const id = resolveSite(entry.host, corpus);
    const explain = explainSimilarity(fingerprint, entry, entry.host);
    return {
      host: entry.host,
      key: entry.key,
      score: explain.score,
      thumbnail: id.hasThumbnail ? id.thumbnailPath : null,
      entry,
      explain,
    };
  });

  scored.sort((x, y) => y.score - x.score || x.host.localeCompare(y.host));

  const top5 = scored.slice(0, 5);
  const closest = scored[0] ?? null;
  const selfRow =
    scored.find(
      (m) =>
        normalizeHost(m.key) === identity.corpusKey ||
        normalizeHost(m.host) === identity.corpusKey,
    ) ?? null;

  const hasMatchAboveFloor = scored.some((m) => m.score >= MATCH_FLOOR);
  const absenceNote = buildAbsenceNote({
    identity,
    closest,
    hasMatchAboveFloor,
    corpusEmpty: corpus.length === 0,
  });

  if (closest) {
    // eslint-disable-next-line no-console -- required: print raw weighted-Jaccard inputs for top candidate
    console.info(
      "[corpus] top candidate weighted-Jaccard inputs",
      closest.host,
      closest.explain.channels.map((c) => ({
        channel: c.key,
        weight: c.weight,
        scanTokens: c.scanCount,
        corpusTokens: c.corpusCount,
        intersection: c.intersection,
        jaccard: Number(c.jaccard.toFixed(4)),
        weighted: Number(c.weighted.toFixed(4)),
      })),
      "score",
      Number(closest.score.toFixed(4)),
    );
  }

  return {
    top5,
    self: selfRow,
    closest,
    hasMatchAboveFloor,
    absenceNote,
  };
}

function buildAbsenceNote(args: {
  identity: SiteIdentity;
  closest: CorpusMatch | null;
  hasMatchAboveFloor: boolean;
  corpusEmpty: boolean;
}): string | null {
  const { identity, closest, hasMatchAboveFloor, corpusEmpty } = args;

  if (corpusEmpty) {
    return "Corpus data is missing. Nothing to compare against.";
  }

  if (isLocalHost(identity.host) && !identity.hasCorpusEntry) {
    if (closest) {
      return `This is a local page, so it has no corpus entry. ${closestNeighbour(closest)}.`;
    }
    return "This is a local page, so it has no corpus entry.";
  }

  if (!identity.hasCorpusEntry && !hasMatchAboveFloor) {
    if (closest) {
      return `Nothing in the corpus looks like you. ${closestNeighbour(closest)}.`;
    }
    return "Nothing in the corpus looks like you.";
  }

  if (!hasMatchAboveFloor && closest) {
    return `Nothing in the corpus looks like you. ${closestNeighbour(closest)}.`;
  }

  if (!identity.hasThumbnail && identity.hasCorpusEntry) {
    return `No thumbnail on file for ${identity.host}.`;
  }

  return null;
}

function closestNeighbour(closest: CorpusMatch): string {
  // Never a bare "0%" — that reads as "found nothing" (Rule 10).
  if (!(closest.score > 0)) {
    return `Closest measured neighbour: ${closest.host} — no shared measured tokens`;
  }
  const pct = Math.round(closest.score * 100);
  if (pct === 0) {
    return `Closest measured neighbour: ${closest.host} at <1%`;
  }
  return `Closest measured neighbour: ${closest.host} at ${pct}%`;
}

export function formatPct(score: number): string {
  if (!(score > 0)) return "no shared tokens";
  const pct = Math.round(score * 100);
  if (pct === 0) return "<1%";
  return `${pct}%`;
}

/** Build a fingerprint from distinct measured values (caller supplies the sets). */
export function fingerprintFromSets(sets: Partial<TokenFingerprint>): TokenFingerprint {
  return {
    fonts: sets.fonts ?? [],
    radii: sets.radii ?? [],
    spacing: sets.spacing ?? [],
    sizes: sets.sizes ?? [],
    groundLuminance: sets.groundLuminance ?? [],
  };
}
