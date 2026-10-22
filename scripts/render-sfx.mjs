#!/usr/bin/env node
/**
 * Renders the web app's synthesised sound effects to audio files.
 *
 * Upstream builds its mission sounds live with the Web Audio API
 * (`src/lib/sfx.ts`), which a phone doesn't have. Rather than re-describe the
 * same sounds by hand, this runs upstream's own synthesis code once, in
 * headless Chromium's OfflineAudioContext, and writes the result to
 * `assets/sounds/` for `expo-audio` to play. Re-run it when upstream changes
 * a sound:
 *
 *   npm run upstream:fetch
 *   PW=$(npm root -g)/playwright node scripts/render-sfx.mjs
 *
 * Needs Playwright's Chromium and ffmpeg. Upstream's randomness (claps,
 * noise) is seeded, so a re-run renders the same sound; the bytes can still
 * differ by Chromium's float rounding, around -87 dB — inaudible, but enough
 * that an unchanged sound shouldn't be re-committed.
 */
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { chromium } = require(process.env.PW ?? "playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const upstream = path.join(root, "upstream/src/lib");
const out = path.join(root, "assets/sounds");

/** Which upstream player becomes which file, and how long to render. */
const SOUNDS = [{ name: "reward-applause", play: "playRewardApplauseSfx", seconds: 2.6 }];
const SAMPLE_RATE = 44100;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sfx-"));
const compile = (file) =>
  ts.transpileModule(fs.readFileSync(path.join(upstream, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

// Upstream's modules as ES modules; its shared live context is swapped for the
// offline one this page renders into.
fs.writeFileSync(path.join(work, "sfx.js"), compile("sfx.ts").replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
fs.writeFileSync(path.join(work, "hiss.js"), compile("hiss.ts").replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
fs.writeFileSync(
  path.join(work, "audioContext.js"),
  "export const getSharedAudioContext = () => globalThis.__ctx;\nexport const resumeSharedAudioContext = async () => globalThis.__ctx;\n",
);
fs.writeFileSync(path.join(work, "index.html"), "<!doctype html><title>sfx</title>");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.route("http://sfx.local/**", (route) => {
  const file = path.join(work, new URL(route.request().url()).pathname);
  route.fulfill({ path: file, contentType: file.endsWith(".js") ? "text/javascript" : "text/html" });
});
await page.goto("http://sfx.local/index.html");

fs.mkdirSync(out, { recursive: true });
for (const sound of SOUNDS) {
  const pcm = await page.evaluate(
    async ({ play, seconds, rate }) => {
      // A seeded generator in place of Math.random, so renders are reproducible.
      let seed = 0x5eed;
      Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
      const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
      globalThis.__ctx = ctx;
      // Resolved inside the page, from the compiled upstream modules above.
      // eslint-disable-next-line import/no-unresolved
      const sfx = await import("./sfx.js");
      await sfx[play]();
      const rendered = await ctx.startRendering();
      return Array.from(rendered.getChannelData(0));
    },
    { play: sound.play, seconds: sound.seconds, rate: SAMPLE_RATE },
  );

  const raw = path.join(work, `${sound.name}.f32`);
  fs.writeFileSync(raw, Buffer.from(new Float32Array(pcm).buffer));
  const target = path.join(out, `${sound.name}.m4a`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", raw, "-c:a", "aac", "-b:a", "96k", target]);
  console.log(`✓ ${path.relative(root, target)} (${fs.statSync(target).size} bytes)`);
}

await browser.close();
fs.rmSync(work, { recursive: true, force: true });
