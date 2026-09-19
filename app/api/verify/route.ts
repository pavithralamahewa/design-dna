import { NextResponse } from "next/server";
import { capturePageWithMeasure } from "@/lib/measure";
import {
  checkPostconditions,
  type VerifyResult,
} from "@/lib/verify";
import {
  emitPostconditions,
  emitPostconditionsFromElements,
  type Finding,
  type Postcondition,
} from "@/lib/postconditions";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  url?: unknown;
  postconditions?: unknown;
  findings?: unknown;
  /** When true and postconditions omitted, emit from a fresh capture's strays. */
  emit?: unknown;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isPostcondition(value: unknown): value is Postcondition {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.property === "string" &&
    typeof p.before === "string" &&
    typeof p.expected === "string" &&
    Array.isArray(p.targets) &&
    p.targets.every((t) => typeof t === "string") &&
    (p.class === "FIX" || p.class === "REVIEW")
  );
}

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === "string" &&
    typeof f.label === "string" &&
    (f.class === "FAIL" ||
      f.class === "REVIEW" ||
      f.class === "PASS" ||
      f.class === "UNSUPPORTED") &&
    typeof f.value === "string" &&
    typeof f.note === "string" &&
    Array.isArray(f.elementIds) &&
    f.elementIds.every((id) => typeof id === "string")
  );
}

/**
 * POST /api/verify
 * Body: { url, postconditions } — re-captures URL and checks named targets.
 * Optional: { findings } to emit postconditions from findings + capture.
 * Optional: { emit: true } to detect strays on the fresh capture and check them
 *   (useful only when validating emission; normal verify always takes postconditions).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body must be JSON with { url, postconditions } (or findings/emit).",
      },
      { status: 400 },
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isValidHttpUrl(url)) {
    return NextResponse.json(
      { error: "Provide a valid http(s) url in { url }." },
      { status: 400 },
    );
  }

  let postconditions: Postcondition[] | null = null;
  if (Array.isArray(body.postconditions)) {
    if (!body.postconditions.every(isPostcondition)) {
      return NextResponse.json(
        {
          error:
            "postconditions must be { id, property, before, expected, targets[], class }[].",
        },
        { status: 400 },
      );
    }
    postconditions = body.postconditions;
  }

  const findings = Array.isArray(body.findings)
    ? body.findings.filter(isFinding)
    : null;
  const emit = body.emit === true;

  try {
    const capture = await capturePageWithMeasure(url);

    if (!postconditions) {
      if (findings && findings.length > 0) {
        postconditions = emitPostconditions(findings, capture.elements);
      } else if (emit) {
        postconditions = emitPostconditionsFromElements(capture.elements);
      } else {
        return NextResponse.json(
          {
            error:
              "Provide postconditions[], or findings[] to emit from, or emit:true.",
          },
          { status: 400 },
        );
      }
    }

    const results: VerifyResult[] = checkPostconditions(
      capture.elements,
      postconditions,
    );

    return NextResponse.json({
      url: capture.url,
      host: capture.host,
      capturedAt: capture.capturedAt,
      viewport: capture.viewport,
      postconditions,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Verify failed", detail: message },
      { status: 500 },
    );
  }
}
