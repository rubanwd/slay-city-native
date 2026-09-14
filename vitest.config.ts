import { defineConfig } from "vitest/config";

/**
 * Tests cover the shared packages, which are plain TypeScript and need no React
 * Native runtime. Screen tests arrive with the design system in M1.
 *
 * `passWithNoTests` holds only until WP-0.2 copies packages/core across with its
 * suite. Remove it then: a green test run over zero tests is not a signal.
 */
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
