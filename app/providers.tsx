"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

type Props = {
  children: ReactNode;
};

// Auto-recovery for webpack ChunkLoadError. Triggered when a deploy lands
// while a user is mid-session: the in-memory HTML references chunk hashes
// from the new build, but the new chunks haven't propagated to the edge
// yet. The result is a 404 on the chunk URL, surfaced as ChunkLoadError.
//
// Recovery: catch the error globally, wait briefly for the CDN to settle,
// then hard-reload the page. The cooldown prevents an infinite loop when
// the error is non-transient (broken build, persistent CDN issue, etc.) —
// after one reload attempt we let the user see the error.
const RELOAD_COOLDOWN_MS = 60_000;
const RELOAD_DELAY_MS = 1_500;
const RELOAD_KEY = "foody-chunk-reload-at";

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const e = reason as { name?: string; message?: string };
  if (e.name === "ChunkLoadError") return true;
  const msg = e.message ?? String(reason);
  // Matches webpack's chunk-load error strings for both JS and CSS chunks.
  return /Loading (CSS )?chunk \d+ failed/.test(msg);
}

function tryRecoverFromChunkError(reason: unknown): void {
  if (!isChunkLoadError(reason)) return;
  if (typeof window === "undefined") return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage can throw in private mode / sandboxed iframes; without
    // a cooldown store we still reload once, but the original navigation
    // will catch any infinite loop via the same throw on re-render.
  }
  window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
}

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

  useEffect(() => {
    const onError = (e: ErrorEvent) => tryRecoverFromChunkError(e.error ?? { message: e.message });
    const onRejection = (e: PromiseRejectionEvent) => tryRecoverFromChunkError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
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
