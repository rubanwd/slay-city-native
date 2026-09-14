const expoConfig = require("eslint-config-expo/flat");

/**
 * The layer rules from docs/ARCHITECTURE.md, enforced rather than trusted.
 *
 * A single import of React into packages/core is how a shared module stops being
 * shareable, and it is invisible in review until the web app cannot use it.
 */
const SHARED_PACKAGE_BANS = [
  { group: ["react", "react-dom", "react-native", "react-native/*", "next", "next/*", "expo", "expo/*", "expo-*"], message: "packages/core and packages/data are platform-free. Move this to src/." },
];

module.exports = [
  ...expoConfig,
  { ignores: ["node_modules/", ".expo/", "upstream/", "dist/", "android/", "ios/"] },
  {
    files: ["packages/core/**/*.ts", "packages/core/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [...SHARED_PACKAGE_BANS, { group: ["@supabase/*"], message: "packages/core is data-free. Supabase access belongs in packages/data." }] }],
    },
  },
  {
    files: ["packages/data/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: SHARED_PACKAGE_BANS }],
    },
  },
  {
    files: ["app/**/*.tsx", "src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["next", "next/*", "../upstream/*", "upstream/*"], message: "The upstream checkout is read-only reference. Never import from it." }] }],
    },
  },
];
