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

export type CorpusMatch = {
  host: string;
  key: string;
  score: number;
  thumbnail: string | null;
  entry: CorpusEntry;
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
  const slug = hostToSlug(normalized);
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

  return {
    host,
    key,
    thumbnail: thumb,
    fonts: toTokenList(tokens.fonts ?? tokens.fontSizes ?? tokens.fontSize),
    radii: toTokenList(tokens.radii ?? tokens.radius ?? tokens.borderRadii),
    spacing: toTokenList(tokens.spacing ?? tokens.spacings ?? tokens.gaps),
    sizes: toTokenList(tokens.sizes ?? tokens.typeSizes ?? tokens.fontSizeValues),
    groundLuminance: toTokenList(
      tokens.groundLuminance ??
        tokens.groundLuminances ??
        tokens.luminance ??
        tokens.grounds,
    ),
  };
}

function toTokenList(value: unknown): Array<string | number> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim()) return v.trim();
        if (v && typeof v === "object" && "value" in (v as object)) {
          const inner = (v as { value: unknown }).value;
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

export function weightedSimilarity(
  a: TokenFingerprint,
  b: TokenFingerprint,
): number {
  let score = 0;
  for (const key of TOKEN_KEYS) {
    score += WEIGHTS[key] * jaccard(a[key], b[key]);
  }
  return score;
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
    return {
      host: entry.host,
      key: entry.key,
      score: weightedSimilarity(fingerprint, entry),
      thumbnail: id.hasThumbnail ? id.thumbnailPath : null,
      entry,
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

  if (!identity.hasCorpusEntry && !hasMatchAboveFloor) {
    if (closest) {
      return `Nothing in the corpus looks like you. The closest is ${formatPct(closest.score)}.`;
    }
    return "Nothing in the corpus looks like you.";
  }

  if (!hasMatchAboveFloor && closest) {
    return `Nothing in the corpus looks like you. The closest is ${formatPct(closest.score)}.`;
  }

  if (!identity.hasThumbnail && identity.hasCorpusEntry) {
    return `No thumbnail on file for ${identity.host}.`;
  }

  return null;
}

export function formatPct(score: number): string {
  const pct = Math.round(score * 100);
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
