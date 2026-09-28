/** @type {import('tailwindcss').Config} */
module.exports = {
  // The app is dark-only and uses no `dark:` variants. "media" makes NativeWind's
  // web runtime throw "Cannot manually set color scheme" when the dev stylesheet
  // is injected after the runtime loads.
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), require("./packages/tokens/preset.js")],
  plugins: [],
};
