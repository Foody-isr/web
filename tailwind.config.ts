import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
const tokens = require("./lib/themes/generated/tailwind-tokens.js");

const textScale = "var(--site-text-scale, 1)";
const fontSize = Object.fromEntries(Object.entries(defaultTheme.fontSize).map(([name, [size, { lineHeight }]]) => [
  name,
  [
    `calc(${size} * ${textScale})`,
    { lineHeight: lineHeight === "1" ? lineHeight : `calc(${lineHeight} * ${textScale})` },
  ] as [string, { lineHeight: string }],
]));
const fontWeight = Object.fromEntries(Object.entries(defaultTheme.fontWeight).map(([name, weight]) => [
  name,
  `var(--site-text-weight, ${weight})`,
]));

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
      fontSize,
      fontWeight,
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
