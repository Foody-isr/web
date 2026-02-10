"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Always use light theme for now. Theme types and API preserved for future re-enablement.
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "light",
      setTheme: (_theme: Theme) => {}, // No-op for now, API preserved for compatibility
      resolvedTheme: "light"
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
