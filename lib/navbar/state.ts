// Website Builder v2 — navbar scroll-state resolver.
//
// Pure logic for the transparent→solid animation, extracted from the component
// so it can be unit-tested. Given the scroll position (or a forced state from
// the editor preview), it decides how the bar paints: transparent-over-hero vs
// solid, which logo variant to show, and whether hide-on-scroll is hiding it.

import type { NavbarScroll } from "./config";

export type NavVisualState = "top" | "scrolled";

/** Forced state streamed by the editor preview so the owner can design each
 * look without scrolling; null = follow live scroll. */
export type ForcedNavState = "top" | "scrolled" | "hover" | null;

export interface NavbarVisual {
  /** "top" = transparent over hero, "scrolled" = solid. */
  state: NavVisualState;
  /** true → paint transparent background + use the transparent-variant logo. */
  transparent: boolean;
  /** hide-on-scroll is currently hiding the bar. */
  hidden: boolean;
  /** the editor is forcing the link-hover look. */
  hover: boolean;
}

/** Pixels scrolled before the bar switches from transparent to solid. */
export const NAV_SCROLL_THRESHOLD = 24;

/**
 * resolveNavbarVisual computes how the bar should paint.
 *
 * When `forced` is set (editor preview) it wins over live scroll. Otherwise:
 *  - transparent_at_top: transparent until scrolled past the threshold.
 *  - hide_on_scroll: hidden while scrolling DOWN past the threshold, shown on UP.
 */
export function resolveNavbarVisual(
  scroll: NavbarScroll,
  scrollY: number,
  lastScrollY: number,
  forced: ForcedNavState,
): NavbarVisual {
  if (forced === "scrolled") {
    return { state: "scrolled", transparent: false, hidden: false, hover: false };
  }
  if (forced === "top" || forced === "hover") {
    const transparent = scroll.transparent_at_top;
    return {
      state: transparent ? "top" : "scrolled",
      transparent,
      hidden: false,
      hover: forced === "hover",
    };
  }
  const scrolledPast = scrollY > NAV_SCROLL_THRESHOLD;
  const transparent = scroll.transparent_at_top && !scrolledPast;
  return {
    state: transparent ? "top" : "scrolled",
    transparent,
    hidden: scroll.hide_on_scroll && scrolledPast && scrollY > lastScrollY,
    hover: false,
  };
}
