#!/usr/bin/env node
/**
 * Fetches a checkout of the upstream web app into ./upstream (gitignored).
 *
 * Two jobs, one mechanism:
 *
 *   1. Porting. An agent writing src/features/mission/QuizTask.tsx reads the
 *      original next to it, and the diff between the two is exactly what a
 *      reviewer needs to see.
 *   2. The drift check (scripts/check-upstream-drift.mjs) compares tracked copies
 *      in packages/core against this same checkout.
 *
 * By default it fetches the CURRENT upstream head, which is what you want when
 * porting — a frozen snapshot committed into this repository would rot within
 * weeks and an agent would faithfully reproduce behaviour that no longer exists.
 *
 * Pass --baseline to get the exact commit the port started from instead, when you
 * need determinism (reproducing an old review, bisecting a port).
 *
 *   node scripts/fetch-upstream.mjs
 *   node scripts/fetch-upstream.mjs --baseline
 *   node scripts/fetch-upstream.mjs --ref <sha|branch|tag>
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const REPO = "https://github.com/rubanwd/slay-city.git";
const DEST = resolve("upstream");
const BASELINE_FILE = "UPSTREAM_BASELINE";

function parseArgs(argv) {
  if (argv.includes("--baseline")) {
    if (!existsSync(BASELINE_FILE)) {
      console.error(`${BASELINE_FILE} not found — cannot resolve the baseline commit.`);
      process.exit(2);
    }
    const ref = readFileSync(BASELINE_FILE, "utf8").trim().split(/\s+/)[0];
    return { ref, why: `baseline from ${BASELINE_FILE}` };
  }

  const i = argv.indexOf("--ref");
  if (i !== -1) {
    if (!argv[i + 1]) {
      console.error("--ref needs a commit, branch or tag");
      process.exit(2);
    }
    return { ref: argv[i + 1], why: "explicit --ref" };
  }

  return { ref: null, why: "current upstream head" };
}

function run(args, cwd) {
  execFileSync("git", args, { cwd, stdio: "inherit" });
}

function main() {
  const { ref, why } = parseArgs(process.argv.slice(2));

  if (existsSync(DEST)) {
    console.log(`removing existing ${DEST}`);
    rmSync(DEST, { recursive: true, force: true });
  }

  console.log(`cloning ${REPO} (${why})`);

  if (ref) {
    // A pinned ref needs full history: --depth 1 can only shallow-clone a branch
    // tip, and the baseline is usually an older commit.
    run(["clone", REPO, DEST]);
    run(["checkout", "--detach", ref], DEST);
  } else {
    run(["clone", "--depth", "1", REPO, DEST]);
  }

  const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: DEST,
    encoding: "utf8",
  }).trim();

  console.log(`\nupstream ready at ./upstream (${head})`);
  console.log("  read-only reference — never import from it, never edit it");
  console.log("  drift check: npm run upstream:check");
}

main();
