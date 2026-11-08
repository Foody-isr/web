"use client";

import { useEffect, type RefObject } from "react";

/** Keeps a native modal inside the viewport while aligning it with its desktop trigger. */
export function useWebsitePanelAnchor(dialog: RefObject<HTMLDialogElement | null>, anchor: HTMLElement | null | undefined, open: boolean) {
  useEffect(() => {
    const panel = dialog.current;
    if (!open || !panel || !anchor) return;
    const update = () => {
      const bounds = anchor.getBoundingClientRect();
      const x = getComputedStyle(anchor).direction === "rtl" ? bounds.right - panel.offsetWidth : bounds.left;
      const y = bounds.bottom + 8 + panel.offsetHeight <= window.innerHeight - 16
        ? bounds.bottom + 8
        : bounds.top - panel.offsetHeight - 8;
      panel.style.setProperty("--entry-anchor-x", `${Math.max(16, Math.min(x, window.innerWidth - panel.offsetWidth - 16))}px`);
      panel.style.setProperty("--entry-anchor-y", `${Math.max(16, Math.min(y, window.innerHeight - panel.offsetHeight - 16))}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    observer.observe(anchor);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [dialog, anchor, open]);
}
