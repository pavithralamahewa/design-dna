import { NextResponse } from "next/server";
import { isValidHttpUrl } from "@/lib/scan-errors";
import { resolveScanKeys, slugFromHost } from "@/lib/scan-keys";
import { readStoredScanJson } from "@/lib/scan-store";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  url?: unknown;
};

function publicCaptureImage(slug: string): string {
  return `/api/scans/${encodeURIComponent(slug)}/image`;
}

/**
 * Prefer a host-keyed stored scan (local `.scans/` or committed `scans/`)
 * before launching Playwright — required on Vercel where Chromium is unavailable.
 */
async function tryStoredCapture(url: string) {
  const keys = resolveScanKeys(url);
  const stored = await readStoredScanJson(keys.slug);
  if (!stored) return null;

  const host = typeof stored.data.host === "string" ? stored.data.host : "";
  if (host && slugFromHost(host) !== keys.slug) return null;

  return {
    ...stored.data,
    url,
    image: publicCaptureImage(keys.slug),
  };
}

function captureInfraMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("executable doesn't exist") ||
    lower.includes("browserType.launch") ||
    lower.includes("libnspr") ||
    lower.includes("chromium") ||
    lower.includes("playwright") ||
    lower.includes("spawn") ||
    lower.includes("enoent")
  ) {
    return (
      "Live browser capture is not available in this environment " +
      "(Chromium/Playwright missing on the server). " +
      "Use a stored specimen host (e.g. stripe.com, linear.app) or /demo, " +
      "or run capture locally with `npx playwright install chromium`."
    );
  }
  return message;
}

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
    const stored = await tryStoredCapture(url);
    if (stored) {
      return NextResponse.json(stored);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to read stored scan", detail: message },
      { status: 500 },
    );
  }

  try {
    // Dynamic import so a missing Playwright binary does not crash module init
    // into an opaque HTML 500 — we return JSON the client can classify.
    const { capturePageWithMeasure } = await import("@/lib/measure");
    const result = await capturePageWithMeasure(url);
    const keys = resolveScanKeys(result.host || url);
    return NextResponse.json({
      ...result,
      image: keys.apiImagePath,
    });
  } catch (err) {
    const detail = captureInfraMessage(err);
    return NextResponse.json(
      {
        error: "Capture failed",
        detail,
        kind: "capture_unavailable",
      },
      { status: 503 },
    );
  }
}
