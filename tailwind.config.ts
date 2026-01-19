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
          DEFAULT: "#43E4C6",
          light: "#B7F3E8",
          dark: "#1B8F73"
        },
        ink: {
          DEFAULT: "#0D1114",
          muted: "#4B5563",
          soft: "#9DA5B4"
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
