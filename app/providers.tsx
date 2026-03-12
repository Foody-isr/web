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

  // Theme is now controlled per-route:
  // - Landing pages use light (default :root CSS vars)
  // - Order pages set data-theme="dark" on their own wrapper
  // No global override needed.

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
