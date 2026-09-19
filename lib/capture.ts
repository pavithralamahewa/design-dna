import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { copyFile, mkdir, writeFile } from "fs/promises";
import path from "path";

export const VIEWPORT = { w: 1440, h: 900 } as const;
export const TILE_STEP = 900;
export const REVEAL_PAUSE_MS = 400;
export const TILE_PAUSE_MS = 250;
export const HEIGHT_POLL_COUNT = 12;
export const HEIGHT_POLL_MS = 300;
export const MAX_PAGE_HEIGHT = 16000;
export const GOTO_TIMEOUT_MS = 45_000;

const ANIMATION_PIN_CSS = `
html { scroll-behavior: auto !important; }
*, *::before, *::after {
  animation-play-state: paused !important;
  transition: none !important;
  animation-delay: 0s !important;
}
`;

export type CaptureElement = {
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
};

export type CaptureTile = {
  y: number;
  height: number;
};

export type CaptureResult = {
  url: string;
  host: string;
  capturedAt: string;
  viewport: { w: number; h: number };
  pageHeight: number;
  /** True when live scrollHeight exceeded MAX_PAGE_HEIGHT — never silent. */
  heightCapped: boolean;
  heightCapNote?: string;
  image: string;
  json: string;
  elements: CaptureElement[];
  tiles: CaptureTile[];
};

export type CaptureOptions = {
  /** Extra copy of the stitched PNG (absolute path). Primary always `.scans/<slug>.png`. */
  copyImageTo?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function slugFromHost(host: string): string {
  return host.replace(/[^a-zA-Z0-9._-]+/g, "_");
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

/**
 * Poll scrollHeight every 300ms, up to 12 times, until the same value
 * appears twice in a row (SPA growth settled).
 */
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

  // Force common reveal-library targets visible only where they are still opacity 0.
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
 * Tile at y = 0, 900, 1800… Read back scrollY. Stop when actualY stops increasing
 * or requested y reaches pageHeight (honours 16000 cap).
 * After tile 0, hide fixed/sticky. Screenshot is viewport clip only — never fullPage.
 */
async function captureTiles(
  page: Page,
  pageHeight: number,
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
 * Capture a URL as a stitched full-page PNG using scroll-and-stitch.
 * Never uses page.screenshot({ fullPage: true }).
 */
export async function capturePage(
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

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(TILE_PAUSE_MS);

    const rawTiles = await captureTiles(page, pageHeight);

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

    const result: CaptureResult = {
      url,
      host,
      capturedAt,
      viewport: { w: VIEWPORT.w, h: VIEWPORT.h },
      pageHeight,
      heightCapped,
      image: imagePath,
      json: jsonPath,
      elements: [],
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
