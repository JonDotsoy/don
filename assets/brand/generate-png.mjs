#!/usr/bin/env node
// Renders cover.html to PNG using Playwright (light + dark variants).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "cover.html");

const variants = [
  { theme: "light", out: "cover-light.png" },
  { theme: "dark", out: "cover-dark.png" },
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });

  for (const { theme, out } of variants) {
    await page.goto(`file://${htmlPath}?theme=${theme}`);
    const cover = page.locator("#cover");
    const outPath = path.join(dir, out);
    await cover.screenshot({ path: outPath });
    console.log(`Wrote ${outPath}`);
  }
} finally {
  await browser.close();
}
