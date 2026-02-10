"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  // Enable dark theme by default (Wolt-style)
  useEffect(() => {
    // Check for user preference, default to dark
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    // Default to dark theme like Wolt
    const theme = savedTheme || (prefersDark ? "dark" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return (
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
