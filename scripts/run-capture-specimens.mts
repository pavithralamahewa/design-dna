/**
 * Specimen runner — same capturePage() as POST /api/capture.
 * Usage: npm run capture:specimens
 */
import { capturePage } from "../lib/capture.ts";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";

const STORE_MEDIA =
  "/cursor/stores/bc-083c82d7-f150-4b4c-a6ff-e2fe754e33ff/media";
const STORE_INTERNAL =
  "/cursor/stores/bc-083c82d7-f150-4b4c-a6ff-e2fe754e33ff/internal";

const specimens = [
  {
    url: "https://stripe.com",
    copyTo: path.join(STORE_MEDIA, "capture-stripe-v2.png"),
  },
  {
    url: "https://trumoveinc.com",
    copyTo: path.join(STORE_MEDIA, "capture-trumoveinc.png"),
  },
] as const;

async function main() {
  await mkdir(STORE_MEDIA, { recursive: true });
  await mkdir(STORE_INTERNAL, { recursive: true });

  const summary: Array<{
    url: string;
    pageHeight: number;
    heightCapped: boolean;
    heightCapNote?: string;
    tileCount: number;
    tileYs: number[];
    image: string;
    json: string;
    copyTo: string;
    elapsedMs: number;
  }> = [];

  for (const spec of specimens) {
    console.log(`Capturing ${spec.url}`);
    const started = Date.now();
    const result = await capturePage(spec.url, { copyImageTo: spec.copyTo });
    const elapsedMs = Date.now() - started;

    await access(result.image);
    await access(result.json);
    await access(spec.copyTo);

    const entry = {
      url: result.url,
      pageHeight: result.pageHeight,
      heightCapped: result.heightCapped,
      heightCapNote: result.heightCapNote,
      tileCount: result.tiles.length,
      tileYs: result.tiles.map((t) => t.y),
      image: result.image,
      json: result.json,
      copyTo: spec.copyTo,
      elapsedMs,
    };
    summary.push(entry);

    console.log(
      `  pageHeight=${result.pageHeight} tiles=${result.tiles.length} capped=${result.heightCapped}`,
    );
    console.log(`  tileYs=[${entry.tileYs.join(", ")}]`);
    console.log(`  image=${result.image}`);
    console.log(`  copy=${spec.copyTo}`);
    if (result.heightCapNote) console.log(`  NOTE: ${result.heightCapNote}`);
  }

  const reportPath = path.join(STORE_INTERNAL, "capture-api-v2-run.md");
  const lines = [
    "---",
    "cursor:",
    '  subagentId: "bc-1deb9aff-4b98-561d-8a68-8d0c57d095f3"',
    "---",
    "",
    "# Capture API v2 specimen run",
    "",
    ...summary.flatMap((s) => [
      `## ${s.url}`,
      "",
      `- pageHeight: **${s.pageHeight}**`,
      `- heightCapped: ${s.heightCapped}`,
      s.heightCapNote ? `- note: ${s.heightCapNote}` : null,
      `- tile count: **${s.tileCount}**`,
      `- tile y (actual): \`${JSON.stringify(s.tileYs)}\``,
      `- scans PNG: \`${s.image}\``,
      `- scans JSON: \`${s.json}\``,
      `- media PNG: \`${s.copyTo}\``,
      `- elapsedMs: ${s.elapsedMs}`,
      "",
    ]),
  ].filter((l) => l !== null);

  await writeFile(reportPath, lines.join("\n"));
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
