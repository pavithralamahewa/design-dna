import { chromium } from "playwright";

const urls = [
  "https://stripe.com",
  "https://trumoveinc.lovable.app",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  for (const url of urls) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    console.log(`URL: ${url}`);
    console.log(`title: ${title}`);
    console.log(`scrollHeight: ${scrollHeight}`);
    console.log("---");
  }
} finally {
  await browser.close();
}
