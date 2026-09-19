import { NextResponse } from "next/server";
import { readStoredScanImage } from "@/lib/scan-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/scans/[slug]/image — stitched PNG for that host only. */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw || "").trim();
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return NextResponse.json({ error: "Invalid scan slug." }, { status: 400 });
  }

  try {
    const stored = await readStoredScanImage(slug);
    if (!stored) {
      return NextResponse.json(
        { error: "No capture image on file for this host.", slug, absence: true },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(stored.buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to read capture image", detail: message },
      { status: 500 },
    );
  }
}
