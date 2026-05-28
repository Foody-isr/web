"use client";

import { ReactNode, useEffect, useRef } from "react";
import { postSectionClick, postSectionBounds, rafThrottle, PreviewBounds } from "@/lib/preview-mode";

/**
 * Registry tracking every mounted preview section's element. Used to compute
 * a single batch of bounds whenever any section resizes, the document scrolls,
 * or section content mutates. Lives at module scope so all wrappers share it.
 */
const sectionElements = new Map<number | string, HTMLElement>();
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let scrollListenerAttached = false;

const postAllBoundsThrottled = rafThrottle(() => {
  const out: PreviewBounds[] = [];
  sectionElements.forEach((el, id) => {
    const rect = el.getBoundingClientRect();
    out.push({
      id,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  });
  postSectionBounds(out);
});

function ensureObservers(): void {
  if (typeof window === "undefined") return;
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(postAllBoundsThrottled);
  }
  if (!mutationObserver) {
    mutationObserver = new MutationObserver(postAllBoundsThrottled);
  }
  if (!scrollListenerAttached) {
    window.addEventListener("scroll", postAllBoundsThrottled, { passive: true });
    window.addEventListener("resize", postAllBoundsThrottled, { passive: true });
    scrollListenerAttached = true;
  }
}

type Props = {
  id: number | string;
  active: boolean;
  children: ReactNode;
};

/**
 * Wraps a section in preview mode: stamps `data-section-id`, registers the
 * element for bounds tracking, forwards click events to the editor parent.
 *
 * When `active` is false, renders children directly with no wrapping div, so
 * customer-facing pages pay zero cost.
 */
export function PreviewSectionWrapper({ id, active, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    ensureObservers();
    sectionElements.set(id, el);
    resizeObserver?.observe(el);
    mutationObserver?.observe(el, { childList: true, subtree: true, characterData: true });
    postAllBoundsThrottled();
    return () => {
      sectionElements.delete(id);
      resizeObserver?.unobserve(el);
      postAllBoundsThrottled();
    };
  }, [id, active]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      data-section-id={id}
      onClick={(e) => {
        e.stopPropagation();
        postSectionClick(id);
      }}
      style={{ cursor: "pointer" }}
    >
      {children}
    </div>
  );
}
