#!/usr/bin/env node
/**
 * Regenerates packages/core/.upstream.json from a checkout of the upstream web
 * repository, so the manifest is a reproducible artifact rather than a hand-typed
 * list of hashes.
 *
 * The file list itself (which local file maps to which upstream path, whether it
 * is `adapted`, and why) stays a human decision — that mapping is read back from
 * the existing manifest, not rediscovered. What this script recomputes is the
 * thing a human should never hand-type: the SHA-256 of each upstream file in the
 * given checkout, and the commit it was read at.
 *
 *   node scripts/generate-upstream-manifest.mjs --upstream ./upstream
 *   node scripts/generate-upstream-manifest.mjs --upstream ./upstream --out packages/core/.upstream.json
 *
 * Typical use: `npm run upstream:fetch -- --ref <sha>` to pin the checkout to the
 * commit you just synced against, then run this to stamp the manifest from it.
 *
 * Exit codes: 0 on success · 2 on a missing upstream file or bad arguments.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const MANIFEST = "packages/core/.upstream.json";

function parseArgs(argv) {
  const upstreamIndex = argv.indexOf("--upstream");
  if (upstreamIndex === -1 || !argv[upstreamIndex + 1]) {
    console.error("usage: generate-upstream-manifest.mjs --upstream <path to slay-city checkout> [--out <manifest path>]");
    process.exit(2);
  }

  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 && argv[outIndex + 1] ? argv[outIndex + 1] : MANIFEST;

  return { upstream: resolve(argv[upstreamIndex + 1]), out };
}

// Must match scripts/check-upstream-drift.mjs: hash the content Git stores (LF),
// not whatever a given checkout produces on disk, so the manifest this script
// writes and the check that reads it always agree regardless of core.autocrlf.
const sha256 = (buf) => createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");

async function main() {
  const { upstream, out } = parseArgs(process.argv.slice(2));

  if (!existsSync(upstream)) {
    console.error(`upstream checkout not found: ${upstream}`);
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(out, "utf8"));
  } catch (error) {
    console.error(`cannot read existing manifest ${out}: ${error.message}`);
    console.error("this script regenerates hashes for the file list already recorded there — add new entries by hand first.");
    process.exit(2);
  }

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: upstream, encoding: "utf8" }).trim();

  const files = [];
  for (const entry of manifest.files) {
    const upstreamPath = join(upstream, entry.upstream);
    if (!existsSync(upstreamPath)) {
      console.error(`upstream file missing from checkout: ${entry.upstream} (tracked as ${entry.local})`);
      process.exit(2);
    }
    const sha256Hash = sha256(await readFile(upstreamPath));
    files.push({ ...entry, sha256: sha256Hash });
  }

  const next = {
    upstream: manifest.upstream,
    syncedAt: new Date().toISOString(),
    syncedFrom: commit,
    files,
  };

  await writeFile(out, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  console.log(`wrote ${files.length} file(s) to ${out}`);
  console.log(`  synced from ${commit}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
