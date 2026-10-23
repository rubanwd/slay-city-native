import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WP-6.6: no screen sets text in a grey fainter than `alpha.white50`, the
 * faintest that meets WCAG AA on the ground and on cards (the ratios are in
 * `tests/a11y/contrast.test.tsx`). Catches a `color` or placeholder prop of
 * `alpha.white5`–`white40`, or white at under 50% via `withAlpha`.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TOO_FAINT = /(?:\bcolor|placeholderTextColor)=\{(?:alpha\.white(?:5|10|15|20|25|40)|withAlpha\(colors\.white, 0\.[0-4]\d*\))\}/;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // Dev previews are not shipped.
    if (statSync(path).isDirectory()) return name === "dev" ? [] : sourceFiles(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("screens", () => {
  it("set no text fainter than AA allows", () => {
    const offenders = [join(ROOT, "src"), join(ROOT, "app")].flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) => (TOO_FAINT.test(line) ? [`${relative(ROOT, file)}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("would catch one", () => {
    expect(TOO_FAINT.test("<SlayText color={alpha.white40}>")).toBe(true);
    expect(TOO_FAINT.test("placeholderTextColor={withAlpha(colors.white, 0.3)}")).toBe(true);
    expect(TOO_FAINT.test("<SlayText color={alpha.white50}>")).toBe(false);
  });
});
