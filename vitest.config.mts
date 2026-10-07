import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Two projects, because the repository has two kinds of test.
 *
 * `packages` covers the shared packages, which are plain TypeScript and need no
 * React Native runtime. The suites under packages/core are upstream's own, copied
 * unchanged alongside the logic they cover — they are what makes a blind sync
 * safe, so they must run exactly as they do upstream rather than being adjusted
 * to pass here. `src/lib/**\/*.test.ts` (plain TypeScript, no JSX) runs here too
 * — e.g. the SecureStore adapter in `secure-storage.ts` — rather than in
 * `components`, which only collects `.test.tsx`.
 *
 * `components` renders the design-system primitives in `src/` (SCN-56). React
 * Native's own source is Flow-typed and cannot be parsed by vitest, so the
 * renderer is `react-native-web` in jsdom — the same substitution `expo start
 * --web` makes, and the only way to render these components without a device.
 * `.web.*` files win over their native siblings so the web build of each native
 * module is picked up, exactly as Metro resolves for the web platform.
 *
 * What these tests assert is therefore structure, text and accessibility — which
 * variants render, what a screen reader is told, which states disable touch — not
 * computed pixels, which `react-native-web` turns into CSS classes.
 */
const WEB_FIRST_EXTENSIONS = [
  ".web.tsx",
  ".web.ts",
  ".web.jsx",
  ".web.js",
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".json",
];

const SHARED_ALIASES = {
  // Mirrors tsconfig: the copied modules import each other as "@/…".
  "@/": `${r("./packages/core/src")}/`,
  "@slay/core": r("./packages/core/src/index.ts"),
  "@slay/data": r("./packages/data/src/index.ts"),
  "@slay/tokens": r("./packages/tokens/src/index.ts"),
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["packages/core/src/**/*.test.ts", "packages/core/src/index.ts"],
      reporter: ["text-summary", "json-summary"],
    },
    projects: [
      {
        resolve: { alias: SHARED_ALIASES },
        test: {
          name: "packages",
          include: ["packages/**/*.test.ts", "scripts/**/*.test.mjs", "src/lib/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        define: { __DEV__: "true" },
        resolve: {
          extensions: WEB_FIRST_EXTENSIONS,
          alias: {
            // `react-native-svg`'s own entry point resolves `./ReactNativeSVG`
            // through Metro's platform extensions; point at the web build
            // directly so the native one is never loaded.
            "react-native-svg": "react-native-svg/lib/module/ReactNativeSVG.web.js",
            "react-native": "react-native-web",
            "~/": `${r("./src")}/`,
            ...SHARED_ALIASES,
          },
        },
        test: {
          name: "components",
          include: ["src/**/*.test.tsx", "app/**/*.test.tsx"],
          environment: "jsdom",
          env: { EXPO_OS: "web" },
          setupFiles: [r("./scripts/test/setup-components.ts")],
        },
      },
    ],
  },
});
