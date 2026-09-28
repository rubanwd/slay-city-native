/**
 * Tailwind preset shared by NativeWind. Derived from the same token modules the
 * TypeScript side imports, so a colour cannot drift between a className and a
 * StyleSheet.
 *
 * Kept in CommonJS because Tailwind config is loaded by Node, not by Metro.
 */
const colors = {
  "neon-pink": "#FF2D8E",
  "lime-green": "#9DFF00",
  cyan: "#00F0FF",
  purple: "#6A00FF",
  "neon-orange": "#FF8A00",
  black: "#111111",
  white: "#FFFFFF",
  // Neutral, not a brand colour: the web SlayCard's raw bg-[#1a1a1a].
  surface: "#1A1A1A",
};

module.exports = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      // Static sizes at the 390pt design width, each with its line height in
      // points (React Native line heights are absolute). The web scale is
      // fluid; a Text component that must track the window width should use
      // fluidFontSize() from packages/tokens instead of these classes.
      fontSize: {
        display: ["40px", "44px"],
        h1: ["28px", "30.8px"],
        h2: ["20px", "25px"],
        h3: ["16px", "20px"],
        body: ["14px", "21px"],
        small: ["12px", "15px"],
        label: ["10px", "12.5px"],
      },
      fontWeight: {
        black: "900",
      },
      borderRadius: {
        card: "24px",
      },
    },
  },
};
