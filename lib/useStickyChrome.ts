"use client";

import { RefObject, useEffect, useRef, useState } from "react";

/**
 * Measurement helpers for the chrome that pins to a viewport edge.
 *
 * The order page stacks several bars against the top (navbar, carte tabs,
 * category tabs) and the bottom (cart dock or dine-in Smart Dock).
 * Their heights are not constants: the Website Builder lets the owner pick a
 * navigation mode per device (`full` pins, `compact`/`overlay` float away) and
 * resize the logo, and the dine-in dock stacks one to three rows. Anything that
 * has to clear that chrome must therefore *measure* it rather than guess a
 * pixel value, which is what these hooks exist for.
 */

/**
 * Tracks the element a ref currently points at. A ref alone can't drive an
 * effect: it holds no identity React can depend on, so an effect keyed on it
 * would never re-run when the target mounts later (the cart dock appears only
 * once the cart has items). This runs after every render but only commits when
 * the element actually changed, so the common case costs one identity check.
 */
function useObservedElement(ref: RefObject<HTMLElement>): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);
  // Deliberately dependency-free: keying this on [ref] is what breaks it, since
  // a ref's identity never changes and the effect would miss the mount. The
  // same-value bail-out below is what keeps it from looping.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setElement((prev) => (prev === ref.current ? prev : ref.current));
  });
  return element;
}

/** Tracks an element's rendered height, remeasuring on resize. 0 while unmounted. */
export function useElementHeight(ref: RefObject<HTMLElement>): number {
  const element = useObservedElement(ref);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element) {
      setHeight(0);
      return;
    }
    const update = () => setHeight(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [element]);

  return height;
}

/**
 * Publishes an element's height as a CSS custom property on the document root
 * so unrelated components can reserve exactly that much space.
 *
 * A mounted element is the condition for writing at all, which is what lets
 * several components share one token: the cart dock and the dine-in Smart Dock
 * both own `--bottom-dock-h`, and only the one on screen writes it. On unmount
 * the property is removed so the fallback in globals.css takes over again.
 *
 * `retain` keeps the last measured value published while the element is away.
 * Pass it when the element is unmounted by something transient — the cart dock
 * disappears whenever a modal or the cart drawer opens, and letting the page
 * collapse underneath them would shift the scroll position for no reason.
 */
export function usePublishHeight(
  ref: RefObject<HTMLElement>,
  varName: string,
  retain = false,
): void {
  const element = useObservedElement(ref);
  const height = useElementHeight(ref);
  const lastMeasured = useRef(0);

  useEffect(() => {
    if (height > 0) lastMeasured.current = height;
  }, [height]);

  useEffect(() => {
    const value = element ? height : retain ? lastMeasured.current : 0;
    if (!value) return;
    const root = document.documentElement;
    root.style.setProperty(varName, `${value}px`);
    return () => {
      root.style.removeProperty(varName);
    };
  }, [element, varName, height, retain]);
}

/**
 * Reports where a `position: sticky` element pins and whether it has got there,
 * by comparing its viewport offset to its own resolved `top`.
 *
 * Both come from the same computed-style read, which is the point: `top` is a
 * CSS variable here, so it changes whenever the navbar starts or stops pinning
 * — without the element ever resizing. Anything that derived the offset from a
 * resize would silently go stale the moment the owner switched navigation mode.
 * Both values are primitives, so an unchanged scroll tick bails out of the
 * state update instead of re-rendering.
 */
export function useStuck(ref: RefObject<HTMLElement>): {
  stuck: boolean;
  offset: number;
} {
  const element = useObservedElement(ref);
  const [stuck, setStuck] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!element) {
      setStuck(false);
      setOffset(0);
      return;
    }
    const update = () => {
      const top = parseFloat(getComputedStyle(element).top) || 0;
      setOffset(top);
      setStuck(element.getBoundingClientRect().top <= top + 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [element]);

  return { stuck, offset };
}
