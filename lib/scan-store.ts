/**
 * Resolve host-keyed scan artifacts on disk.
 * Local captures write to `.scans/`. Production ships read-only specimens in `scans/`.
 * Never falls back across hosts — caller must pass the correct slug.
 */

import { access, readFile } from "fs/promises";
import path from "path";

export type StoredScanPaths = {
  jsonPath: string;
  imagePath: string;
  /** Which root the files were found under */
  root: "local" | "specimen";
};

const ROOTS: Array<{ dir: string; root: StoredScanPaths["root"] }> = [
  { dir: ".scans", root: "local" },
  { dir: "scans", root: "specimen" },
];

function isSafeSlug(slug: string): boolean {
  return Boolean(
    slug &&
      !slug.includes("..") &&
      !slug.includes("/") &&
      !slug.includes("\\"),
  );
}

/** Prefer fresh local captures; fall back to committed specimens. */
export async function resolveStoredScan(
  slug: string,
): Promise<StoredScanPaths | null> {
  if (!isSafeSlug(slug)) return null;

  for (const { dir, root } of ROOTS) {
    const jsonPath = path.join(process.cwd(), dir, `${slug}.json`);
    const imagePath = path.join(process.cwd(), dir, `${slug}.png`);
    try {
      await access(jsonPath);
      await access(imagePath);
      return { jsonPath, imagePath, root };
    } catch {
      /* try next root */
    }
  }
  return null;
}

export async function readStoredScanJson(
  slug: string,
): Promise<{ data: Record<string, unknown>; paths: StoredScanPaths } | null> {
  const paths = await resolveStoredScan(slug);
  if (!paths) return null;
  const raw = await readFile(paths.jsonPath, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;
  return { data, paths };
}

export async function readStoredScanImage(
  slug: string,
): Promise<{ buffer: Buffer; paths: StoredScanPaths } | null> {
  const paths = await resolveStoredScan(slug);
  if (!paths) return null;
  const buffer = await readFile(paths.imagePath);
  return { buffer, paths };
}
