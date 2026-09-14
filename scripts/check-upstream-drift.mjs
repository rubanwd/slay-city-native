#!/usr/bin/env node
/**
 * Detects drift between this repository's tracked copies of shared logic and the
 * upstream web repository they were copied from.
 *
 * Two repositories hold the same logic. Copies drift; the only question is whether
 * drift is detected here or discovered by a user whose phone and browser disagree
 * about how much XP a mission paid. See docs/SYNC.md.
 *
 *   node scripts/check-upstream-drift.mjs --upstream /path/to/slay-city
 *
 * Exit codes: 0 in sync · 1 drift detected · 2 manifest or path error.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const MANIFEST = "packages/core/.upstream.json";

function parseArgs(argv) {
  const i = argv.indexOf("--upstream");
  if (i === -1 || !argv[i + 1]) {
    console.error("usage: check-upstream-drift.mjs --upstream <path to slay-city checkout>");
    process.exit(2);
  }
  return { upstream: resolve(argv[i + 1]) };
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** ANSI colour, suppressed when not a TTY or when NO_COLOR is set. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint("31", s);
const yellow = (s) => paint("33", s);
const green = (s) => paint("32", s);
const dim = (s) => paint("2", s);

async function main() {
  const { upstream } = parseArgs(process.argv.slice(2));

  if (!existsSync(upstream)) {
    console.error(`upstream checkout not found: ${upstream}`);
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch (error) {
    console.error(`cannot read ${MANIFEST}: ${error.message}`);
    process.exit(2);
  }

  const drifted = [];
  const missing = [];

  for (const entry of manifest.files) {
    const upstreamPath = join(upstream, entry.upstream);

    if (!existsSync(upstreamPath)) {
      // An upstream file that moved or was deleted is drift of the worst kind:
      // the manifest now points at nothing, so no hash comparison can catch it.
      missing.push(entry);
      continue;
    }

    const current = sha256(await readFile(upstreamPath));
    if (current !== entry.sha256) {
      drifted.push({ ...entry, current });
    }
  }

  const total = manifest.files.length;

  if (!drifted.length && !missing.length) {
    const noun = total === 1 ? "file" : "files";
    console.log(green(`✓ ${total} tracked ${noun} in sync with ${manifest.upstream}`));
    console.log(dim(`  last synced from ${manifest.syncedFrom} on ${manifest.syncedAt}`));
    return 0;
  }

  if (missing.length) {
    console.log(red(`\n✗ ${missing.length} upstream file(s) moved or deleted\n`));
    for (const entry of missing) {
      console.log(`  ${entry.upstream}`);
      console.log(dim(`    tracked as ${entry.local}`));
    }
    console.log(dim("\n  Find where it went, update the manifest, then re-run."));
  }

  if (drifted.length) {
    console.log(red(`\n✗ ${drifted.length} of ${total} tracked files drifted\n`));
    for (const entry of drifted) {
      const flag = entry.adapted ? yellow(" [adapted — needs judgement]") : "";
      console.log(`  ${entry.local}${flag}`);
      console.log(dim(`    upstream: ${entry.upstream}`));
      if (entry.note) console.log(dim(`    note: ${entry.note}`));
    }
    console.log(dim("\n  Review each change:"));
    console.log(dim("    git -C <upstream> log -p -- <upstream path>"));
    console.log(dim("  Then copy it across (or hand-apply it, if adapted), run the"));
    console.log(dim("  tests, and update the sha256 in the manifest."));
    console.log(dim("  Resolution rules: docs/SYNC.md §4."));
  }

  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(2);
  }
);
