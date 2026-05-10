"use client";

import { useEffect, useState, useCallback } from "react";
import type { ViewMode } from "./types";

const KEY = (rid: string | number) => `foody.layout.${rid}`;

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
