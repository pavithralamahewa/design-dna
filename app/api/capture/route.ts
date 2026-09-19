import { NextResponse } from "next/server";
import { capturePage } from "@/lib/capture";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  url?: unknown;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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
      { error: "Provide a valid http(s) url in { url }." },
      { status: 400 },
    );
  }

  try {
    const result = await capturePage(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Capture failed", detail: message },
      { status: 500 },
    );
  }
}
