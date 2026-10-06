import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkAll, checkManifest, findManifests, sha256 } from "./check-upstream-drift.mjs";

const SCRIPT = fileURLToPath(new URL("./check-upstream-drift.mjs", import.meta.url));

/** Builds <root>/packages/<pkg>/.upstream.json and <root>/upstream/<upstream path> from one fixture entry. */
function writeFixture(root, { local, upstream, content, adapted, note }) {
  const upstreamPath = join(root, "upstream", upstream);
  mkdirSync(join(upstreamPath, ".."), { recursive: true });
  writeFileSync(upstreamPath, content, "utf8");

  const manifestDir = join(root, "packages", "core");
  mkdirSync(manifestDir, { recursive: true });
  const manifest = {
    upstream: "https://github.com/rubanwd/slay-city",
    syncedAt: "2026-01-01T00:00:00Z",
    syncedFrom: "abc1234",
    files: [{ local, upstream, sha256: sha256(content), adapted: !!adapted, ...(note ? { note } : {}) }],
  };
  writeFileSync(join(manifestDir, ".upstream.json"), JSON.stringify(manifest, null, 2), "utf8");
  return { manifestPath: join(manifestDir, ".upstream.json"), upstreamDir: join(root, "upstream") };
}

describe("sha256", () => {
  it("normalizes CRLF to LF so Windows checkouts hash the same as Git's stored content", () => {
    const lf = sha256("line one\nline two\n");
    const crlf = sha256("line one\r\nline two\r\n");
    expect(crlf).toBe(lf);
  });
});

describe("findManifests", () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("finds every packages/*/.upstream.json", () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-"));
    mkdirSync(join(root, "packages", "core"), { recursive: true });
    mkdirSync(join(root, "packages", "data"), { recursive: true });
    writeFileSync(join(root, "packages", "core", ".upstream.json"), "{}", "utf8");
    // packages/data has no manifest — not tracked, per docs/SYNC.md §6.

    const found = findManifests(join(root, "packages"));
    expect(found).toEqual([join(root, "packages", "core", ".upstream.json")]);
  });

  it("returns an empty list when the packages directory does not exist", () => {
    expect(findManifests(join(tmpdir(), "scn-50-does-not-exist"))).toEqual([]);
  });
});

describe("checkManifest / checkAll", () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("reports a file in sync when its upstream content still matches the recorded hash", async () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-"));
    const { manifestPath, upstreamDir } = writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });

    const [result] = await checkAll({ manifestPaths: [manifestPath], upstreamDir });
    expect(result.inSync).toHaveLength(1);
    expect(result.drifted).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it("reports drift when the upstream file's content changes after the manifest was recorded", async () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-"));
    const { manifestPath, upstreamDir } = writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });

    // Upstream moved after the hash was recorded.
    writeFileSync(join(upstreamDir, "src/features/levels/levels.ts"), "export const LEVEL_XP = 150;\n", "utf8");

    const [result] = await checkAll({ manifestPaths: [manifestPath], upstreamDir });
    expect(result.inSync).toHaveLength(0);
    expect(result.drifted).toHaveLength(1);
    expect(result.drifted[0].local).toBe("packages/core/src/levels.ts");
    expect(result.missing).toHaveLength(0);
  });

  it("reports missing when the upstream file was deleted or renamed", async () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-"));
    const manifest = {
      upstream: "https://github.com/rubanwd/slay-city",
      syncedAt: "2026-01-01T00:00:00Z",
      syncedFrom: "abc1234",
      files: [{ local: "packages/core/src/gone.ts", upstream: "src/features/gone.ts", sha256: "deadbeef", adapted: false }],
    };
    mkdirSync(join(root, "packages", "core"), { recursive: true });
    const manifestPath = join(root, "packages", "core", ".upstream.json");
    writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    mkdirSync(join(root, "upstream"), { recursive: true });

    const result = await checkManifest(manifest, join(root, "upstream"));
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].upstream).toBe("src/features/gone.ts");
    expect(result.drifted).toHaveLength(0);
  });
});

describe("CLI exit codes", () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function run(args) {
    try {
      const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8" });
      return { status: 0, stdout };
    } catch (error) {
      return { status: error.status, stdout: error.stdout };
    }
  }

  it("exits 0 and reports in sync immediately after the manifest is generated", () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-cli-"));
    writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });

    const { status, stdout } = run(["--upstream", "./upstream"]);
    expect(status).toBe(0);
    expect(stdout).toContain("in sync");
  });

  it("exits 1 and names the file after a tracked upstream fixture file is modified", () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-cli-"));
    const { upstreamDir } = writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });

    writeFileSync(join(upstreamDir, "src/features/levels/levels.ts"), "export const LEVEL_XP = 999;\n", "utf8");

    const { status, stdout } = run(["--upstream", "./upstream"]);
    expect(status).toBe(1);
    expect(stdout).toContain("packages/core/src/levels.ts");
  });

  it("reports the same drift as --json for machine-readable consumption", () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-cli-"));
    const { upstreamDir } = writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });
    writeFileSync(join(upstreamDir, "src/features/levels/levels.ts"), "export const LEVEL_XP = 999;\n", "utf8");

    const { status, stdout } = run(["--upstream", "./upstream", "--json"]);
    expect(status).toBe(1);
    const [report] = JSON.parse(stdout);
    expect(report.drifted).toHaveLength(1);
    expect(report.drifted[0].local).toBe("packages/core/src/levels.ts");
  });

  it("exits 2 when --upstream points at a checkout that does not exist", () => {
    root = mkdtempSync(join(tmpdir(), "scn-50-cli-"));
    writeFixture(root, {
      local: "packages/core/src/levels.ts",
      upstream: "src/features/levels/levels.ts",
      content: "export const LEVEL_XP = 100;\n",
    });

    const { status } = run(["--upstream", "./does-not-exist"]);
    expect(status).toBe(2);
  });
});
