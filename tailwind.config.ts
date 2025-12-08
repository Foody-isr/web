import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F8B8D",
          light: "#53c2c4",
          dark: "#0c6b6d"
        }
      },
      boxShadow: {
        floating: "0 12px 40px rgba(0,0,0,0.12)"
      }
    }
  },
  plugins: []
};

export default config;
