#!/usr/bin/env node
/**
 * Detects drift between this repository's tracked copies of shared logic and the
 * upstream web repository they were copied from.
 *
 * Two repositories hold the same logic. Copies drift; the only question is whether
 * drift is detected here or discovered by a user whose phone and browser disagree
 * about how much XP a mission paid. See docs/SYNC.md.
 *
 *   node scripts/check-upstream-drift.mjs                        # ./upstream, fetch current head if missing
 *   node scripts/check-upstream-drift.mjs --upstream /path/to/slay-city
 *   node scripts/check-upstream-drift.mjs --baseline             # pin to UPSTREAM_BASELINE for a reproducible check
 *   node scripts/check-upstream-drift.mjs --json
 *
 * Every `packages/*\/.upstream.json` manifest is checked, not just packages/core's —
 * any other tracked copy added later is picked up without changes here.
 *
 * Exit codes: 0 in sync · 1 drift detected · 2 manifest or path error.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const DEFAULT_UPSTREAM_DIR = "upstream";
const DEFAULT_PACKAGES_DIR = "packages";
const FETCH_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "fetch-upstream.mjs");

// Manifest hashes are computed against the content Git actually stores (LF line
// endings), not whatever a given checkout produces on disk. A machine with
// core.autocrlf=true (the Windows default) checks files out with CRLF, which
// would otherwise hash differently from the same file on a LF checkout and
// report every tracked file as drifted. Normalizing first keeps the check
// deterministic across platforms. Must match scripts/generate-upstream-manifest.mjs.
export const sha256 = (buf) => createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");

/** Every `<packagesDir>/*\/.upstream.json` found, in directory order. */
export function findManifests(packagesDir = DEFAULT_PACKAGES_DIR) {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir)
    .map((name) => join(packagesDir, name, ".upstream.json"))
    .filter((manifestPath) => existsSync(manifestPath));
}

export async function loadManifest(manifestPath) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

/** Compares one manifest's recorded hashes against the content at `upstreamDir`. */
export async function checkManifest(manifest, upstreamDir) {
  const inSync = [];
  const drifted = [];
  const missing = [];

  for (const entry of manifest.files) {
    const upstreamPath = join(upstreamDir, entry.upstream);

    if (!existsSync(upstreamPath)) {
      // An upstream file that moved or was deleted is drift of the worst kind: the
      // manifest now points at nothing, so no hash comparison can catch it.
      missing.push(entry);
      continue;
    }

    const current = sha256(await readFile(upstreamPath));
    if (current === entry.sha256) {
      inSync.push(entry);
    } else {
      drifted.push({ ...entry, current });
    }
  }

  return { inSync, drifted, missing, total: manifest.files.length };
}

/** Loads and checks every manifest found, or an explicit list of manifest paths. */
export async function checkAll({ packagesDir = DEFAULT_PACKAGES_DIR, manifestPaths, upstreamDir }) {
  const paths = manifestPaths ?? findManifests(packagesDir);
  const results = [];
  for (const manifestPath of paths) {
    const manifest = await loadManifest(manifestPath);
    const outcome = await checkManifest(manifest, upstreamDir);
    results.push({ manifestPath, manifest, ...outcome });
  }
  return results;
}

function parseArgs(argv) {
  const upstreamIndex = argv.indexOf("--upstream");
  const explicitUpstream = upstreamIndex !== -1;
  if (explicitUpstream && !argv[upstreamIndex + 1]) {
    console.error("--upstream needs a path");
    process.exit(2);
  }

  return {
    upstream: resolve(explicitUpstream ? argv[upstreamIndex + 1] : DEFAULT_UPSTREAM_DIR),
    explicitUpstream,
    baseline: argv.includes("--baseline"),
    json: argv.includes("--json"),
  };
}

/**
 * Makes sure a usable checkout exists before hashing anything.
 *
 * An explicit `--upstream <path>` means the caller manages the checkout (CI's
 * actions/checkout step, a manually cloned tree) — missing is an error, not
 * something to paper over with a surprise network fetch.
 *
 * Otherwise this is the convenience path: fetch the current head on first run,
 * or re-fetch the pinned `UPSTREAM_BASELINE` commit when `--baseline` is passed,
 * since only a fresh checkout can guarantee the comparison is against that exact
 * commit rather than whatever happened to be on disk already.
 */
function ensureUpstream({ upstream, explicitUpstream, baseline }) {
  if (explicitUpstream) {
    if (!existsSync(upstream)) {
      console.error(`upstream checkout not found: ${upstream}`);
      process.exit(2);
    }
    return;
  }

  if (baseline) {
    console.log("fetching upstream at UPSTREAM_BASELINE for a deterministic comparison");
    execFileSync(process.execPath, [FETCH_SCRIPT, "--baseline"], { stdio: "inherit" });
    return;
  }

  if (!existsSync(upstream)) {
    console.log(`${upstream} not found — fetching current upstream head`);
    execFileSync(process.execPath, [FETCH_SCRIPT], { stdio: "inherit" });
  }
}

/** ANSI colour, suppressed when not a TTY or when NO_COLOR is set. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => paint("31", s);
const yellow = (s) => paint("33", s);
const green = (s) => paint("32", s);
const dim = (s) => paint("2", s);

function printText(results) {
  const totalFiles = results.reduce((sum, r) => sum + r.total, 0);
  const totalDrifted = results.reduce((sum, r) => sum + r.drifted.length, 0);
  const totalMissing = results.reduce((sum, r) => sum + r.missing.length, 0);

  if (!totalDrifted && !totalMissing) {
    const noun = totalFiles === 1 ? "file" : "files";
    console.log(green(`✓ ${totalFiles} tracked ${noun} in sync`));
    for (const { manifest } of results) {
      console.log(dim(`  ${manifest.upstream} — last synced from ${manifest.syncedFrom} on ${manifest.syncedAt}`));
    }
    return;
  }

  for (const { manifestPath, manifest, drifted, missing } of results) {
    if (!drifted.length && !missing.length) continue;

    console.log(dim(`\n${manifestPath} (${manifest.upstream}):`));

    if (missing.length) {
      console.log(red(`✗ ${missing.length} upstream file(s) moved or deleted\n`));
      for (const entry of missing) {
        console.log(`  ${entry.upstream}`);
        console.log(dim(`    tracked as ${entry.local}`));
      }
      console.log(dim("\n  Find where it went, update the manifest, then re-run."));
    }

    if (drifted.length) {
      console.log(red(`✗ ${drifted.length} of ${manifest.files.length} tracked files drifted\n`));
      for (const entry of drifted) {
        const flag = entry.adapted ? yellow(" [adapted — needs judgement]") : "";
        console.log(`  ${entry.local}${flag}`);
        console.log(dim(`    upstream: ${entry.upstream}`));
        if (entry.note) console.log(dim(`    note: ${entry.note}`));
      }
      // `git log` is deliberately not suggested here: fetch-upstream.mjs makes a
      // shallow clone, so history before its tip is absent and the command fails.
      // A plain diff needs no history and answers the actual question — what is
      // different from the copy we hold.
      console.log(dim("\n  See what changed:"));
      console.log(dim("    diff -u <local> <upstream>/<upstream path>"));
      console.log(dim("  For the commits behind it, deepen the shallow checkout first:"));
      console.log(dim("    git -C upstream fetch --depth=100 origin main"));
      console.log(dim("\n  Then copy it across (or hand-apply it, if adapted), run the"));
      console.log(dim("  tests, and update the sha256 in the manifest."));
      console.log(dim("  Resolution rules: docs/SYNC.md §4."));
    }
  }
}

function printJson(results) {
  const payload = results.map(({ manifestPath, manifest, inSync, drifted, missing, total }) => ({
    manifest: manifestPath,
    upstream: manifest.upstream,
    syncedFrom: manifest.syncedFrom,
    syncedAt: manifest.syncedAt,
    total,
    inSync: inSync.map((entry) => entry.local),
    drifted: drifted.map(({ local, upstream, adapted, note, sha256: expected, current }) => ({
      local,
      upstream,
      adapted: !!adapted,
      note: note ?? null,
      expectedSha256: expected,
      currentSha256: current,
    })),
    missing: missing.map(({ local, upstream }) => ({ local, upstream })),
  }));

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureUpstream(args);

  const manifestPaths = findManifests(DEFAULT_PACKAGES_DIR);
  if (!manifestPaths.length) {
    console.error(`no .upstream.json manifest found under ${DEFAULT_PACKAGES_DIR}/*`);
    return 2;
  }

  let results;
  try {
    results = await checkAll({ manifestPaths, upstreamDir: args.upstream });
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  if (args.json) {
    printJson(results);
  } else {
    printText(results);
  }

  const drifted = results.some((r) => r.drifted.length || r.missing.length);
  return drifted ? 1 : 0;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(2);
    }
  );
}
