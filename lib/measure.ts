import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  GOTO_TIMEOUT_MS,
  HEIGHT_POLL_COUNT,
  HEIGHT_POLL_MS,
  MAX_PAGE_HEIGHT,
  REVEAL_PAUSE_MS,
  TILE_PAUSE_MS,
  TILE_STEP,
  VIEWPORT,
  hostFromUrl,
  slugFromHost,
  type CaptureElement,
  type CaptureOptions,
  type CaptureResult,
  type CaptureTile,
} from "./capture";

const ANIMATION_PIN_CSS = `
html { scroll-behavior: auto !important; }
*, *::before, *::after {
  animation-play-state: paused !important;
  transition: none !important;
  animation-delay: 0s !important;
}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Assign stable data-dna-id before tiling. Index only advances for kept nodes. */
export async function assignDnaIds(page: Page): Promise<number> {
  return page.evaluate(() => {
    let index = 0;
    const nodes = document.querySelectorAll<HTMLElement>("*");
    for (const el of nodes) {
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "HEAD") continue;
      if (el.closest("head")) continue;
      el.dataset.dnaId = "e" + index;
      index += 1;
    }
    return index;
  });
}

type RawMeasured = CaptureElement;

/**
 * Measure every element whose rect intersects the current viewport.
 * Must run in the same tile pass, immediately after that tile's screenshot.
 */
export async function measureViewportElements(
  page: Page,
): Promise<RawMeasured[]> {
  // Body must stay free of nested function declarations — tsx/esbuild injects
  // __name helpers that do not exist in the browser context.
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const out: Array<{
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      viewportIntersectionFraction: number;
      tag: string;
      styles: {
        fontSize: number;
        fontWeight: string;
        lineHeight: number;
        letterSpacing: string;
        color: string;
        background: string;
        radius: number;
        borderWidth: number;
        boxShadow: string | null;
        marginTop: number;
        marginBottom: number;
        paddingTop: number;
        paddingBottom: number;
      };
    }> = [];

    const nodes = document.querySelectorAll<HTMLElement>("[data-dna-id]");
    for (const el of nodes) {
      const id = el.dataset.dnaId;
      if (!id) continue;

      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;

      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) continue;

      const overlapW = Math.max(
        0,
        Math.min(rect.right, vw) - Math.max(rect.left, 0),
      );
      const overlapH = Math.max(
        0,
        Math.min(rect.bottom, vh) - Math.max(rect.top, 0),
      );
      const overlapArea = overlapW * overlapH;
      if (overlapArea <= 0) continue;

      const area = w * h;
      const viewportIntersectionFraction = Math.min(
        1,
        Math.max(0, overlapArea / area),
      );

      const fs = parseFloat(cs.fontSize);
      const fontSize = Number.isFinite(fs) ? fs : 0;
      const lhRaw = cs.lineHeight;
      let lineHeight: number;
      if (lhRaw === "normal") {
        lineHeight = fontSize * 1.2;
      } else {
        const lh = parseFloat(lhRaw);
        lineHeight = Number.isFinite(lh) ? lh : 0;
      }

      const shadow = cs.boxShadow;
      const boxShadow = !shadow || shadow === "none" ? null : shadow;

      const r = parseFloat(cs.borderTopLeftRadius);
      const bw = parseFloat(cs.borderTopWidth);
      const mt = parseFloat(cs.marginTop);
      const mb = parseFloat(cs.marginBottom);
      const pt = parseFloat(cs.paddingTop);
      const pb = parseFloat(cs.paddingBottom);

      out.push({
        id,
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        w,
        h,
        viewportIntersectionFraction,
        tag: el.tagName.toLowerCase(),
        styles: {
          fontSize,
          fontWeight: cs.fontWeight,
          lineHeight,
          letterSpacing: cs.letterSpacing,
          color: cs.color,
          background: cs.backgroundColor,
          radius: Number.isFinite(r) ? r : 0,
          borderWidth: Number.isFinite(bw) ? bw : 0,
          boxShadow,
          marginTop: Number.isFinite(mt) ? mt : 0,
          marginBottom: Number.isFinite(mb) ? mb : 0,
          paddingTop: Number.isFinite(pt) ? pt : 0,
          paddingBottom: Number.isFinite(pb) ? pb : 0,
        },
      });
    }

    return out;
  });
}

/**
 * Keep, per id, the reading with the highest viewportIntersectionFraction.
 * On a tie the later tile wins (caller should pass tiles in order).
 */
export function mergeElementReading(
  best: Map<string, CaptureElement>,
  reading: CaptureElement,
): void {
  const prev = best.get(reading.id);
  if (!prev) {
    best.set(reading.id, reading);
    return;
  }
  if (
    reading.viewportIntersectionFraction >= prev.viewportIntersectionFraction
  ) {
    best.set(reading.id, reading);
  }
}

export function mergeTileReadings(
  best: Map<string, CaptureElement>,
  readings: CaptureElement[],
): void {
  for (const reading of readings) {
    mergeElementReading(best, reading);
  }
}

async function forceImagesEagerAndFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const lazy = Array.from(
      document.querySelectorAll<HTMLImageElement>("img[loading=lazy]"),
    );
    for (const img of lazy) {
      img.setAttribute("loading", "eager");
      img.setAttribute("decoding", "sync");
    }

    const all = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
    for (const img of all) {
      if (!img.getAttribute("decoding")) {
        img.setAttribute("decoding", "sync");
      }
    }

    await Promise.all(
      all
        .filter((img) => img.complete === false)
        .map((img) =>
          img
            .decode()
            .catch(() => undefined)
            .then(() => undefined),
        ),
    );

    await document.fonts.ready;
  });
}

async function revealScroll(page: Page): Promise<void> {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += TILE_STEP) {
    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, y);
    await sleep(REVEAL_PAUSE_MS);
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await sleep(REVEAL_PAUSE_MS);
}

async function pollStableScrollHeight(page: Page): Promise<number> {
  let previous: number | null = null;
  let height = 0;

  for (let i = 0; i < HEIGHT_POLL_COUNT; i++) {
    height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (previous !== null && height === previous) {
      return height;
    }
    previous = height;
    if (i < HEIGHT_POLL_COUNT - 1) {
      await sleep(HEIGHT_POLL_MS);
    }
  }

  return height;
}

async function pinAnimationsAndReveals(page: Page): Promise<void> {
  await page.addStyleTag({ content: ANIMATION_PIN_CSS });

  await page.evaluate(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      '[data-aos], .reveal, [class*="fade"], [class*="slide"]',
    );
    for (const el of nodes) {
      if (getComputedStyle(el).opacity === "0") {
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("transform", "none", "important");
      }
    }
  });
}

async function hideFixedAndSticky(page: Page): Promise<void> {
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("*"));
    for (const el of nodes) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") {
        el.style.setProperty("visibility", "hidden", "important");
      }
    }
  });
}

type RawTile = {
  y: number;
  height: number;
  buffer: Buffer;
};

/**
 * Tile loop: scroll → read scrollY → screenshot → measure viewport → merge.
 * Measurement is never a second pass.
 */
async function captureTilesWithMeasure(
  page: Page,
  pageHeight: number,
  best: Map<string, CaptureElement>,
): Promise<RawTile[]> {
  const tiles: RawTile[] = [];
  let previousActualY = -1;

  for (let y = 0; y < pageHeight; y += TILE_STEP) {
    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, y);
    await sleep(TILE_PAUSE_MS);

    const actualY = await page.evaluate(() => window.scrollY);

    if (actualY <= previousActualY) {
      break;
    }

    if (tiles.length > 0) {
      await hideFixedAndSticky(page);
    }

    const buffer = Buffer.from(
      await page.screenshot({
        type: "png",
        clip: {
          x: 0,
          y: 0,
          width: VIEWPORT.w,
          height: VIEWPORT.h,
        },
      }),
    );

    // Measure immediately after screenshot, before scrolling again.
    const readings = await measureViewportElements(page);
    mergeTileReadings(best, readings);

    tiles.push({ y: actualY, height: VIEWPORT.h, buffer });
    previousActualY = actualY;
  }

  return tiles;
}

async function stitchTiles(
  tiles: RawTile[],
  pageHeight: number,
): Promise<Buffer> {
  if (tiles.length === 0) {
    throw new Error("No tiles to stitch");
  }

  const composites = tiles.map((t) => ({
    input: t.buffer,
    top: Math.round(t.y),
    left: 0,
  }));

  return sharp({
    create: {
      width: VIEWPORT.w,
      height: pageHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * Capture + measure in one paint. Same contract as capturePage, with elements[].
 */
export async function capturePageWithMeasure(
  url: string,
  options: CaptureOptions = {},
): Promise<CaptureResult> {
  const browser = await chromium.launch({ headless: true });
  const capturedAt = new Date().toISOString();

  try {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT.w, height: VIEWPORT.h },
      deviceScaleFactor: 1,
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: GOTO_TIMEOUT_MS,
    });

    await forceImagesEagerAndFonts(page);
    await revealScroll(page);

    const rawHeight = await pollStableScrollHeight(page);
    const heightCapped = rawHeight > MAX_PAGE_HEIGHT;
    const pageHeight = Math.min(rawHeight, MAX_PAGE_HEIGHT);

    await pinAnimationsAndReveals(page);

    // Stable ids before tiling — never during/after a separate measure pass.
    await assignDnaIds(page);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(TILE_PAUSE_MS);

    const best = new Map<string, CaptureElement>();
    const rawTiles = await captureTilesWithMeasure(page, pageHeight, best);

    const stitched = await stitchTiles(rawTiles, pageHeight);

    const host = hostFromUrl(url);
    const slug = slugFromHost(host);
    const scansDir = path.join(process.cwd(), ".scans");
    await mkdir(scansDir, { recursive: true });

    const imagePath = path.join(scansDir, `${slug}.png`);
    const jsonPath = path.join(scansDir, `${slug}.json`);
    await writeFile(imagePath, stitched);

    if (options.copyImageTo) {
      await mkdir(path.dirname(options.copyImageTo), { recursive: true });
      await copyFile(imagePath, options.copyImageTo);
    }

    const tiles: CaptureTile[] = rawTiles.map((t) => ({
      y: t.y,
      height: VIEWPORT.h,
    }));

    const elements = Array.from(best.values()).sort((a, b) => {
      const ai = parseInt(a.id.slice(1), 10);
      const bi = parseInt(b.id.slice(1), 10);
      return ai - bi;
    });

    const result: CaptureResult = {
      url,
      host,
      capturedAt,
      viewport: { w: VIEWPORT.w, h: VIEWPORT.h },
      pageHeight,
      heightCapped,
      image: imagePath,
      json: jsonPath,
      elements,
      tiles,
    };

    if (heightCapped) {
      result.heightCapNote = `Page scrollHeight was ${rawHeight}px; captured only the first ${MAX_PAGE_HEIGHT}px.`;
    }

    await writeFile(jsonPath, JSON.stringify(result, null, 2));

    return result;
  } finally {
    await browser.close();
  }
}
