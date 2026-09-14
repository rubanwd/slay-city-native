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
};

module.exports = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: "48px",
        h1: "32px",
        h2: "22px",
        h3: "18px",
        body: "16px",
        small: "14px",
        label: "12px",
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
