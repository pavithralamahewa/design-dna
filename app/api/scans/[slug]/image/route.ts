import { NextResponse } from "next/server";
import { access, readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/scans/[slug]/image — stitched PNG for that host only. */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw || "").trim();
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return NextResponse.json({ error: "Invalid scan slug." }, { status: 400 });
  }

  const imagePath = path.join(process.cwd(), ".scans", `${slug}.png`);
  try {
    await access(imagePath);
  } catch {
    return NextResponse.json(
      { error: "No capture image on file for this host.", slug, absence: true },
      { status: 404 },
    );
  }

  const buf = await readFile(imagePath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
