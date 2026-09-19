import { NextResponse } from "next/server";
import { readStoredScanJson } from "@/lib/scan-store";
import { slugFromHost } from "@/lib/scan-keys";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

function publicCaptureImage(slug: string): string {
  return `/api/scans/${encodeURIComponent(slug)}/image`;
}

/**
 * GET /api/scans/[slug] — load the host-keyed scan record only.
 * Never falls back to another host's scan (rule 13).
 * Reads `.scans/` (local) then `scans/` (committed specimens for production).
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw || "").trim();
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return NextResponse.json({ error: "Invalid scan slug." }, { status: 400 });
  }

  try {
    const stored = await readStoredScanJson(slug);
    if (!stored) {
      return NextResponse.json(
        {
          error: "No scan on file for this host.",
          slug,
          absence: true,
        },
        { status: 404 },
      );
    }

    const { data } = stored;
    const host = typeof data.host === "string" ? data.host : "";
    const expectedSlug = host ? slugFromHost(host) : slug;
    if (expectedSlug !== slug) {
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
