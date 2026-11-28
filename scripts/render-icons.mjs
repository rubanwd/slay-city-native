#!/usr/bin/env node
/**
 * Renders the native app icons on the PWA's gradient tile.
 *
 * The installed PWA shows the mascot on a neon-pink → purple diagonal
 * gradient; the native build used a flat `#111111` tile. This draws the same
 * gradient (brand `neonPink` → `purple`, 135°) in headless Chromium, puts the
 * transparent mascot cut-out from `assets/splash/splash-icon.png` on it, and
 * writes:
 *
 *   assets/icons/icon.png                     iOS (and iOS-on-Mac), 1024², opaque
 *   assets/icons/android-icon-background.png  adaptive-icon background layer
 *   assets/icons/android-icon-foreground.png  adaptive-icon mascot, inside the safe zone
 *   assets/icons/android-icon-monochrome.png  themed-icon silhouette, same geometry
 *
 *   PW=$(npm root -g)/playwright npm run icons:render
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? "playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const asset = (p) => path.join(root, "assets", p);
const dataUrl = (p) => `data:image/png;base64,${fs.readFileSync(asset(p)).toString("base64")}`;

// Brand tokens from packages/tokens/src/colors.ts (neonPink, purple).
const GRADIENT = "linear-gradient(135deg, #FF2D8E 0%, #6A00FF 100%)";
const SIZE = 1024;
/**
 * Mascot height as a share of the canvas. iOS gets a full tile like the PWA;
 * Android keeps the mascot inside the 66dp-of-108dp safe circle so no launcher
 * mask (circle, squircle, teardrop) clips the headphones or the tail.
 */
const IOS_HEIGHT = 0.84;
const ANDROID_HEIGHT = 0.6;

const mascot = dataUrl("splash/splash-icon.png");
const silhouette = dataUrl("icons/android-icon-monochrome.png");

/** Crops an image to its opaque bounding box and centres it at `height` px. */
const page = (background, src, height) => `<!doctype html><html><body style="margin:0">
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<div id="bg" style="position:absolute;inset:0;width:${SIZE}px;height:${SIZE}px;background:${background};z-index:-1"></div>
<script>
window.ready = (async () => {
  if (!${JSON.stringify(src)}) return;
  const img = new Image();
  img.src = ${JSON.stringify(src)};
  await img.decode();
  const probe = new OffscreenCanvas(img.width, img.height).getContext("2d");
  probe.drawImage(img, 0, 0);
  const { data } = probe.getImageData(0, 0, img.width, img.height);
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (data[(y * img.width + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, s = ${height} / h;
  const ctx = document.getElementById("c").getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x0, y0, w, h, (${SIZE} - w * s) / 2, (${SIZE} - h * s) / 2, w * s, h * s);
})();
</script></body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
});

async function render(out, background, src, height) {
  await tab.setContent(page(background, src, height));
  await tab.evaluate(() => window.ready);
  await tab.screenshot({
    path: asset(out),
    clip: { x: 0, y: 0, width: SIZE, height: SIZE },
    omitBackground: background === "transparent",
  });
  console.log(`wrote assets/${out}`);
}

await render("icons/icon.png", GRADIENT, mascot, SIZE * IOS_HEIGHT);
await render("icons/android-icon-background.png", GRADIENT, null, 0);
await render("icons/android-icon-foreground.png", "transparent", mascot, SIZE * ANDROID_HEIGHT);
await render("icons/android-icon-monochrome.png", "transparent", silhouette, SIZE * ANDROID_HEIGHT);

await browser.close();
