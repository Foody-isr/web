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
      fontFamily: {
        sans: ["'Nunito Sans'", "NunitoSans", "Roboto", "sans-serif"]
      },
      colors: {
        // Core Brand Colors
        brand: {
          DEFAULT: "#EB5204", // primaryOrange
          light: "#F5A375",
          dark: "#C94400"
        },
        accent: {
          green: "#77BA4B",
          red: "#F73838",
          gold: "#D89B35"
        },
        // Semantic/Status Colors
        success: "#34D399",
        info: "#60A5FA",
        warning: "#F59E0B",
        error: "#EF4444",
        // Neutral surfaces - Dark theme
        dark: {
          bg: "#272834",
          surface: "#3C3D4D",
          subtle: "#32333F",
          divider: "#4A4B5A"
        },
        // Neutral surfaces - Light theme
        light: {
          bg: "#F5F6F8",
          surface: "#FFFFFF",
          subtle: "#F0F2F5",
          divider: "#E4E5E7"
        },
        // Text colors
        ink: {
          DEFAULT: "#1A1A1A", // textLightPrimary
          muted: "#4B5563", // textLightSecondary
          soft: "#B8B9C3",
          dark: "#FFFFFF", // textDarkPrimary
          "dark-muted": "#B8B9C3" // textDarkSecondary
        },
        // Legacy compatibility
        "soft-grey": "#2A2E33"
      },
      boxShadow: {
        floating: "0 12px 40px rgba(0,0,0,0.12)",
        light: "0 10px 20px rgba(39,40,52,0.12)",
        dark: "0 12px 28px rgba(0,0,0,0.5)",
        "card-light": "0 4px 12px rgba(0,0,0,0.08)",
        "card-dark": "0 4px 12px 2px rgba(0,0,0,0.3)"
      },
      borderRadius: {
        standard: "10px",
        button: "10px",
        card: "12px",
        chip: "12px",
        modal: "24px"
      },
      spacing: {
        micro: "6px",
        xsmall: "10px",
        small: "14px",
        medium: "20px",
        large: "28px",
        xlarge: "36px"
      }
    }
  },
  plugins: []
};

export default config;
