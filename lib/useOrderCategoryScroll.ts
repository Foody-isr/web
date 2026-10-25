"use client";

import { useEffect, type RefObject } from "react";

/** Reveals one category within its rail, clamping Safari's elastic offsets in either direction. */
export function revealOrderCategory(
  container: HTMLElement,
  direction: "ltr" | "rtl",
): void {
  const links = container.querySelectorAll<HTMLElement>("a, button");
  const selected = container.querySelector<HTMLElement>(
    '[aria-current="location"]',
  );
  if (!selected) return;
  // Always reset the first category, even while it is already visible.
  // An older smooth scroll or Safari's elastic offset must not survive it.
  if (selected === links[0]) {
    container.scrollTo({ left: 0, behavior: "instant" });
    return;
  }
  const bounds = container.getBoundingClientRect();
  const item = selected.getBoundingClientRect();
  const clipped = item.left < bounds.left || item.right > bounds.right;
  const extent = Math.max(0, container.scrollWidth - container.clientWidth);
  const delta = clipped
    ? item.left + item.width / 2 - bounds.left - bounds.width / 2
    : 0;
  const left = Math.min(
    direction === "rtl" ? 0 : extent,
    Math.max(direction === "rtl" ? -extent : 0, container.scrollLeft + delta),
  );
  // Vertical scrolling can change the active category several times per frame.
  // Keep the rail synchronized instead of stacking horizontal animations.
  container.scrollTo({ left, behavior: "instant" });
}

/** Keeps the active category visible without scrolling the page or leaving an edge overscrolled. */
export function useOrderCategoryScroll(
  ref: RefObject<HTMLElement | null>,
  activeId: string | undefined,
  linkIds: string,
  direction: "ltr" | "rtl",
): void {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    revealOrderCategory(container, direction);
    let measured = false;
    const observer = new ResizeObserver(() => {
      if (measured) revealOrderCategory(container, direction);
      measured = true;
    });
    observer.observe(container);
    if (container.firstElementChild)
      observer.observe(container.firstElementChild);
    return () => observer.disconnect();
  }, [ref, activeId, linkIds, direction]);
}
