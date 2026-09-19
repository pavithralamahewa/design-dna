import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const VIEWPORT = { w: 1440, h: 900 } as const;
export const TILE_STEP = 900;
export const SCROLL_PAUSE_MS = 400;
export const HEIGHT_POLL_COUNT = 12;
export const HEIGHT_POLL_MS = 900;
export const MAX_PAGE_HEIGHT = 16000;

const ANIMATION_PIN_CSS = `
html{scroll-behavior:auto!important}
*,*::before,*::after{transition:none!important;animation-delay:0s!important;animation-duration:0s!important;animation-fill-mode:forwards!important;animation-iteration-count:1!important;scroll-snap-type:none!important;scroll-behavior:auto!important}
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
  /** True when the live page was taller than MAX_PAGE_HEIGHT and we only captured the first 16000px. */
  heightCapped: boolean;
  /** Present when heightCapped — never silently truncate. */
  heightCapNote?: string;
  image: string;
  elements: CaptureElement[];
  tiles: CaptureTile[];
};

export type CaptureOptions = {
  /** Absolute or project-relative path for the stitched PNG. Defaults under `.scans/`. */
  imagePath?: string;
  /** Also return a data URL in `image` instead of a filesystem path. */
  asDataUrl?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function slugFromHost(host: string): string {
  return host.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function forceImagesEager(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      img.setAttribute("loading", "eager");
      if (img.hasAttribute("decoding")) {
        img.setAttribute("decoding", "sync");
      }
    }
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return img
          .decode()
          .catch(() => undefined)
          .then(() => undefined);
      }),
    );
  });
}

async function revealScroll(page: Page): Promise<void> {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += TILE_STEP) {
    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, y);
    await sleep(SCROLL_PAUSE_MS);
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await sleep(SCROLL_PAUSE_MS);
}

async function pinAnimations(page: Page): Promise<void> {
  await page.addStyleTag({ content: ANIMATION_PIN_CSS });
}

async function pollMaxScrollHeight(page: Page): Promise<number> {
  let max = 0;
  for (let i = 0; i < HEIGHT_POLL_COUNT; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h > max) max = h;
    if (i < HEIGHT_POLL_COUNT - 1) {
      await sleep(HEIGHT_POLL_MS);
    }
  }
  return max;
}

async function markFixedSticky(page: Page): Promise<void> {
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("*"));
    for (const el of nodes) {
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") {
        el.setAttribute("data-dna-fixed-sticky", pos);
      }
    }
  });
}

async function setFixedStickyHidden(page: Page, hide: boolean): Promise<void> {
  await page.evaluate((shouldHide) => {
    document.documentElement.toggleAttribute("data-dna-hide-fixed", shouldHide);
  }, hide);
}

async function ensureHideStyle(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `html[data-dna-hide-fixed] [data-dna-fixed-sticky],
html[data-dna-hide-fixed] [data-dna-fixed-sticky]::before,
html[data-dna-hide-fixed] [data-dna-fixed-sticky]::after {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}`,
  });
}

type RawTile = {
  y: number;
  height: number;
  buffer: Buffer;
};

async function captureTiles(
  page: Page,
  pageHeight: number,
): Promise<RawTile[]> {
  await markFixedSticky(page);
  await ensureHideStyle(page);

  const tiles: RawTile[] = [];
  const requestedYs: number[] = [];
  for (let y = 0; y < pageHeight; y += TILE_STEP) {
    requestedYs.push(y);
  }
  // Ensure we cover the bottom even when pageHeight isn't a multiple of step
  const lastRequested = Math.max(0, pageHeight - VIEWPORT.h);
  if (!requestedYs.includes(lastRequested) && lastRequested > 0) {
    requestedYs.push(lastRequested);
  }

  let isFirst = true;
  const seenY = new Set<number>();

  for (const requestedY of requestedYs) {
    await page.evaluate((y) => {
      window.scrollTo(0, y);
    }, requestedY);

    // Brief settle so layout catches up after scroll
    await sleep(50);

    const actualY = await page.evaluate(() => Math.round(window.scrollY));
    if (seenY.has(actualY)) {
      continue;
    }
    seenY.add(actualY);

    if (!isFirst) {
      await setFixedStickyHidden(page, true);
    } else {
      await setFixedStickyHidden(page, false);
    }

    const buffer = Buffer.from(await page.screenshot({ type: "png" }));
    const meta = await sharp(buffer).metadata();
    const height = meta.height ?? VIEWPORT.h;

    tiles.push({ y: actualY, height, buffer });
    isFirst = false;
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

  const canvasHeight = Math.max(
    pageHeight,
    ...tiles.map((t) => t.y + t.height),
  );

  const composites = tiles.map((t) => ({
    input: t.buffer,
    top: t.y,
    left: 0,
  }));

  return sharp({
    create: {
      width: VIEWPORT.w,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
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

    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });

    await forceImagesEager(page);
    await revealScroll(page);
    await pinAnimations(page);

    const rawHeight = await pollMaxScrollHeight(page);
    const heightCapped = rawHeight > MAX_PAGE_HEIGHT;
    const pageHeight = Math.min(rawHeight, MAX_PAGE_HEIGHT);

    // Scroll to top before tiling
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(100);

    const rawTiles = await captureTiles(page, pageHeight);
    const stitched = await stitchTiles(rawTiles, pageHeight);

    const host = hostFromUrl(url);
    const scansDir = path.join(process.cwd(), ".scans");
    await mkdir(scansDir, { recursive: true });

    const defaultPath = path.join(
      scansDir,
      `${slugFromHost(host)}-${Date.now()}.png`,
    );
    const imagePath = options.imagePath
      ? path.isAbsolute(options.imagePath)
        ? options.imagePath
        : path.join(process.cwd(), options.imagePath)
      : defaultPath;

    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, stitched);

    const image = options.asDataUrl
      ? `data:image/png;base64,${stitched.toString("base64")}`
      : imagePath;

    const tiles: CaptureTile[] = rawTiles.map((t) => ({
      y: t.y,
      height: t.height,
    }));

    const result: CaptureResult = {
      url,
      host,
      capturedAt,
      viewport: { w: VIEWPORT.w, h: VIEWPORT.h },
      pageHeight,
      heightCapped,
      image,
      // Stage 1: capture only — measurement comes in a later stage (same paint later).
      elements: [],
      tiles,
    };

    if (heightCapped) {
      result.heightCapNote = `Page scrollHeight was ${rawHeight}px; captured only the first ${MAX_PAGE_HEIGHT}px.`;
    }

    return result;
  } finally {
    await browser.close();
  }
}
