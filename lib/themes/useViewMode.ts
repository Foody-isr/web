"use client";

import { useEffect, useState, useCallback } from "react";
import type { ViewMode } from "./types";

const KEY = (rid: string | number) => `foody.layout.${rid}`;

/**
 * True below Tailwind's `md` breakpoint (768px). Starts false on the server
 * and resolves after mount, so consumers must tolerate one desktop-first
 * render before the mobile value kicks in.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function useViewMode(
  restaurantId: string | number,
  defaultMode: ViewMode,
): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY(restaurantId));
    if (stored === "compact" || stored === "magazine") setMode(stored);
  }, [restaurantId]);

  const set = useCallback((m: ViewMode) => {
    setMode(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY(restaurantId), m);
    }
  }, [restaurantId]);

  return [mode, set];
}
