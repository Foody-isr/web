import type { Config } from "tailwindcss";
const tokens = require("./lib/themes/generated/tailwind-tokens.js");

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  darkMode: ["class", '[data-theme]:not([data-theme=""])'],
  theme: {
    extend: {
      colors: {
        ...tokens.colors,
        // Legacy color names — resolve via the CSS vars that applyTheme()
        // bridges from the active theme tokens. Lets existing components
        // (RestaurantLanding, OrderTrackingClient, ComboProgressBar, etc.)
        // keep using bg-brand / text-brand / bg-brand-dark / shadow-brand/30
        // without rewriting them. The /<alpha-value> form requires rgb
        // triples that the bridge populates.
        brand: "rgb(var(--brand-rgb, 235 82 4) / <alpha-value>)",
        "brand-dark": "var(--brand-dark, #C94400)",
        "brand-light": "var(--brand-light, #F5A375)",
        "accent-green": "#10B981",
      },
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
