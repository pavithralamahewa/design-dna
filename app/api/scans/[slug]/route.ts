import { NextResponse } from "next/server";
import { access, readFile } from "fs/promises";
import path from "path";
import { slugFromHost } from "@/lib/scan-keys";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

function publicCaptureImage(slug: string): string {
  return `/api/scans/${encodeURIComponent(slug)}/image`;
}

/**
 * GET /api/scans/[slug] — load the host-keyed scan record only.
 * Never falls back to another host's scan (rule 13).
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw || "").trim();
  // Reject path traversal; slugFromHost strips unsafe chars when derived from a host,
  // but callers may pass arbitrary strings.
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return NextResponse.json({ error: "Invalid scan slug." }, { status: 400 });
  }

  const jsonPath = path.join(process.cwd(), ".scans", `${slug}.json`);
  try {
    await access(jsonPath);
  } catch {
    return NextResponse.json(
      {
        error: "No scan on file for this host.",
        slug,
        absence: true,
      },
      { status: 404 },
    );
  }

  try {
    const rawJson = await readFile(jsonPath, "utf8");
    const data = JSON.parse(rawJson) as Record<string, unknown>;
    const host = typeof data.host === "string" ? data.host : "";
    const expectedSlug = host ? slugFromHost(host) : slug;
    if (expectedSlug !== slug) {
      // Disk key disagrees with record host — refuse rather than serve wrong site.
      return NextResponse.json(
        {
          error: "Scan record host does not match slug.",
          slug,
          host,
          absence: true,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ...data,
      image: publicCaptureImage(slug),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to read scan", detail: message },
      { status: 500 },
    );
  }
}
