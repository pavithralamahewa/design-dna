import { NextResponse } from "next/server";
import { capturePageWithMeasure } from "@/lib/measure";
import { isValidHttpUrl } from "@/lib/scan-errors";
import { resolveScanKeys } from "@/lib/scan-keys";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  url?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with { url }." },
      { status: 400 },
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isValidHttpUrl(url)) {
    return NextResponse.json(
      {
        error: "Provide a valid http(s) url in { url }.",
        detail: url ? `Entered: ${url}` : "Empty URL",
        kind: "invalid_url",
      },
      { status: 400 },
    );
  }

  try {
    const result = await capturePageWithMeasure(url);
    const keys = resolveScanKeys(result.host || url);
    // Client must never receive a filesystem path — serve via host-keyed API.
    return NextResponse.json({
      ...result,
      image: keys.apiImagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Capture failed", detail: message },
      { status: 500 },
    );
  }
}
