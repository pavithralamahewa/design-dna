/**
 * One-off runner: capture specimen URLs with the same logic as POST /api/capture.
 * Usage: npx tsx scripts/run-capture-specimens.mts
 */
import { capturePage } from "../lib/capture.ts";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

const STORE_MEDIA =
  "/cursor/stores/bc-083c82d7-f150-4b4c-a6ff-e2fe754e33ff/media";
const STORE_INTERNAL =
  "/cursor/stores/bc-083c82d7-f150-4b4c-a6ff-e2fe754e33ff/internal";

const specimens = [
  {
    url: "https://stripe.com",
    png: path.join(STORE_MEDIA, "capture-stripe.png"),
    meta: path.join(STORE_MEDIA, "capture-stripe.json"),
  },
  {
    url: "https://trumoveinc.lovable.app",
    png: path.join(STORE_MEDIA, "capture-trumove.png"),
    meta: path.join(STORE_MEDIA, "capture-trumove.json"),
  },
] as const;

async function assertExists(filePath: string): Promise<void> {
  await access(filePath);
}

async function main() {
  await mkdir(STORE_MEDIA, { recursive: true });
  await mkdir(STORE_INTERNAL, { recursive: true });

  const summary: unknown[] = [];

  for (const spec of specimens) {
    console.log(`Capturing ${spec.url} → ${spec.png}`);
    const started = Date.now();
    const result = await capturePage(spec.url, { imagePath: spec.png });
    const elapsedMs = Date.now() - started;

    await assertExists(spec.png);

    const meta = {
      url: result.url,
      host: result.host,
      capturedAt: result.capturedAt,
      viewport: result.viewport,
      pageHeight: result.pageHeight,
      heightCapped: result.heightCapped,
      heightCapNote: result.heightCapNote ?? null,
      tileCount: result.tiles.length,
      tiles: result.tiles,
      image: result.image,
      elementCount: result.elements.length,
      elapsedMs,
    };

    await writeFile(spec.meta, JSON.stringify(meta, null, 2));
    summary.push(meta);

    console.log(
      `  done: pageHeight=${result.pageHeight} tiles=${result.tiles.length} capped=${result.heightCapped} (${elapsedMs}ms)`,
    );
    if (result.heightCapNote) {
      console.log(`  NOTE: ${result.heightCapNote}`);
    }
  }

  const summaryPath = path.join(STORE_INTERNAL, "capture-api-run.md");
  const lines = [
    "---",
    'cursor:',
    '  subagentId: "bc-1deb9aff-4b98-561d-8a68-8d0c57d095f3"',
    "---",
    "",
    "# Capture API specimen run",
    "",
    ...summary.map((s) => {
      const m = s as {
        url: string;
        image: string;
        pageHeight: number;
        heightCapped: boolean;
        heightCapNote: string | null;
        tileCount: number;
        elapsedMs: number;
      };
      return [
        `## ${m.url}`,
        "",
        `- PNG: \`${m.image}\``,
        `- pageHeight: ${m.pageHeight}`,
        `- heightCapped: ${m.heightCapped}`,
        m.heightCapNote ? `- note: ${m.heightCapNote}` : null,
        `- tiles: ${m.tileCount}`,
        `- elapsedMs: ${m.elapsedMs}`,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ];
  await writeFile(summaryPath, lines.join("\n"));
  console.log(`Summary written to ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
