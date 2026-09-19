/**
 * ONE resolver for scan identity (rule 12).
 * Every host → slug / .scans path / API path goes through here.
 * Must match lib/capture.ts write paths (slugFromHost).
 *
 * Client-safe: do NOT import capture.ts / measure.ts (Playwright, sharp).
 */

import { normalizeHost } from "@/lib/corpus";

export type ScanKeys = {
  /** Host as stored on the capture (URL host, incl. port when present). */
  host: string;
  /** Filename-safe slug — same as capture/measure writers. */
  slug: string;
  /** Corpus-style normalized host (www stripped, lowercased). */
  corpusKey: string;
  scanJsonPath: string;
  scanImagePath: string;
  apiJsonPath: string;
  apiImagePath: string;
};

/** Match capture.ts hostFromUrl — keep port; do not strip www here. */
export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Match capture.ts slugFromHost — underscores for unsafe chars. */
export function slugFromHost(host: string): string {
  return host.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/** Resolve a URL or bare host to every scan key used on disk and in the API. */
export function resolveScanKeys(urlOrHost: string): ScanKeys {
  const trimmed = urlOrHost.trim();
  let host: string;
  if (/^https?:\/\//i.test(trimmed)) {
    host = hostFromUrl(trimmed);
  } else if (trimmed.includes("/") && /:\d+/.test(trimmed)) {
    try {
      host = hostFromUrl(`http://${trimmed}`);
    } catch {
      host = trimmed;
    }
  } else if (trimmed.includes("/") && !trimmed.includes("://")) {
    try {
      host = hostFromUrl(`http://${trimmed}`);
    } catch {
      host = trimmed;
    }
  } else {
    host = trimmed;
  }

  const slug = slugFromHost(host);
  return {
    host,
    slug,
    corpusKey: normalizeHost(host),
    scanJsonPath: `.scans/${slug}.json`,
    scanImagePath: `.scans/${slug}.png`,
    apiJsonPath: `/api/scans/${encodeURIComponent(slug)}`,
    apiImagePath: `/api/scans/${encodeURIComponent(slug)}/image`,
  };
}

/** True when the URL is the in-app Ledgerly demo specimen (mock allowed). */
export function isDemoScanUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === "/demo" || u.pathname === "/demo/";
  } catch {
    return false;
  }
}

/** Hosts match for binding — case-insensitive exact host (port-sensitive). */
export function hostsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
