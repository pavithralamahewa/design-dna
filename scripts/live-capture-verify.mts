/**
 * Fresh live capture verification — calls capturePageWithMeasure (same as POST /api/capture).
 */
import { capturePageWithMeasure } from "../lib/measure.ts";
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";

const STORE =
  "/cursor/stores/bc-083c82d7-f150-4b4c-a6ff-e2fe754e33ff";
const MEDIA = path.join(STORE, "media");
const INTERNAL = path.join(STORE, "internal");

const jobs = [
  {
    label: "demo",
    url: "http://127.0.0.1:43135/demo",
    png: path.join(MEDIA, "live-demo-capture.png"),
    json: path.join(MEDIA, "live-demo-capture.json"),
  },
  {
    label: "stripe",
    url: "https://stripe.com",
    png: path.join(MEDIA, "live-stripe-capture.png"),
    json: path.join(MEDIA, "live-stripe-capture.json"),
  },
] as const;

type Meta = {
  url: string;
  capturedAt: string;
  pageHeight: number;
  heightCapped: boolean;
  heightCapNote?: string;
  tileCount: number;
  tileYs: number[];
  tiles: { y: number; height: number }[];
  elementsMeasured: number;
  sampleElements: Array<{
    id: string;
    y: number;
    viewportIntersectionFraction: number;
  }>;
  image: string;
  scansImage: string;
  scansJson: string;
  elapsedMs: number;
};

async function runOne(job: (typeof jobs)[number]): Promise<Meta> {
  console.log(`\n=== Capturing ${job.label}: ${job.url} ===`);
  const started = Date.now();
  const result = await capturePageWithMeasure(job.url, {
    copyImageTo: job.png,
  });
  const elapsedMs = Date.now() - started;

  // Prefer 3 named elements with non-trivial intersection if available
  const sorted = [...result.elements].sort(
    (a, b) =>
      b.viewportIntersectionFraction - a.viewportIntersectionFraction,
  );
  const sample =
    sorted.length >= 3
      ? sorted.slice(0, 3)
      : result.elements.slice(0, 3);

  const meta: Meta = {
    url: result.url,
    capturedAt: result.capturedAt,
    pageHeight: result.pageHeight,
    heightCapped: result.heightCapped,
    heightCapNote: result.heightCapNote,
    tileCount: result.tiles.length,
    tileYs: result.tiles.map((t) => t.y),
    tiles: result.tiles,
    elementsMeasured: result.elements.length,
    sampleElements: sample.map((e) => ({
      id: e.id,
      y: e.y,
      viewportIntersectionFraction: e.viewportIntersectionFraction,
    })),
    image: job.png,
    scansImage: result.image,
    scansJson: result.json,
    elapsedMs,
  };

  await writeFile(job.json, JSON.stringify(meta, null, 2));

  // Ensure PNG landed (copyImageTo should have done it)
  await copyFile(result.image, job.png).catch(() => undefined);

  console.log(`pageHeight=${meta.pageHeight}`);
  console.log(`tileCount=${meta.tileCount}`);
  console.log(`tileYs=${JSON.stringify(meta.tileYs)}`);
  console.log(`elementsMeasured=${meta.elementsMeasured}`);
  console.log(`sampleElements=${JSON.stringify(meta.sampleElements, null, 2)}`);
  console.log(`elapsedMs=${elapsedMs}`);
  console.log(`png=${job.png}`);
  console.log(`json=${job.json}`);

  return meta;
}

async function main() {
  await mkdir(MEDIA, { recursive: true });
  await mkdir(INTERNAL, { recursive: true });

  const results: Meta[] = [];
  for (const job of jobs) {
    results.push(await runOne(job));
  }

  const reportPath = path.join(INTERNAL, "live-capture-verification.md");
  const lines = [
    "---",
    "cursor:",
    '  subagentId: "bc-535012a4-1110-5d92-9ebf-ef135fb91680"',
    "---",
    "",
    "# Live capture verification (fresh execution)",
    "",
    `Ran via \`capturePageWithMeasure\` (same path as \`POST /api/capture\`).`,
    `Captured at: ${new Date().toISOString()}`,
    "",
    ...results.flatMap((r) => [
      `## ${r.url}`,
      "",
      `- **pageHeight:** ${r.pageHeight}`,
      `- **heightCapped:** ${r.heightCapped}${r.heightCapNote ? ` — ${r.heightCapNote}` : ""}`,
      `- **tile count:** ${r.tileCount}`,
      `- **tile y (every tile):** \`${JSON.stringify(r.tileYs)}\``,
      `- **elements measured:** ${r.elementsMeasured}`,
      `- **3 named elements:**`,
      ...r.sampleElements.map(
        (e) =>
          `  - id=\`${e.id}\` y=${e.y} viewportIntersectionFraction=${e.viewportIntersectionFraction}`,
      ),
      `- PNG: \`${r.image}\``,
      `- JSON meta: \`${r.image.replace(/\\.png$/, ".json")}\``,
      `- elapsedMs: ${r.elapsedMs}`,
      "",
    ]),
  ];

  await writeFile(reportPath, lines.join("\n"));
  console.log(`\nReport: ${reportPath}`);
  console.log("\n=== RAW SUMMARY JSON ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
