import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Tests cover the shared packages, which are plain TypeScript and need no React
 * Native runtime. Screen tests arrive with the design system in M1.
 *
 * The suites under packages/core are upstream's own, copied unchanged alongside
 * the logic they cover — they are what makes a blind sync safe, so they must run
 * exactly as they do upstream rather than being adjusted to pass here.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig: the copied modules import each other as "@/…".
      "@/": `${r("./packages/core/src")}/`,
      "@slay/core/types": r("./packages/core/src/types/index.ts"),
      "@slay/core": r("./packages/core/src/index.ts"),
      "@slay/data": r("./packages/data/src/index.ts"),
      "@slay/tokens": r("./packages/tokens/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["packages/core/src/**/*.test.ts", "packages/core/src/index.ts"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
