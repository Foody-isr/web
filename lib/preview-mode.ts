"use client";

/**
 * Preview mode helpers — used by the foodyadmin website editor.
 *
 * When the page is rendered inside the editor's iframe (or when ?preview=1 is
 * present in the URL), foodyweb runs in "preview mode": it accepts a draft
 * state from the parent window via postMessage, draws section wrappers with
 * `data-section-id`, reports their bounding boxes back to the parent for
 * overlay positioning, and suppresses interactive behaviour (cart, ordering).
 *
 * The protocol is symmetric:
 *
 *   parent → iframe:
 *     { type: 'foody-draft-state', state: DraftStatePayload }
 *     { type: 'foody-scroll-to-section', id: number }
 *     { type: 'foody-set-device', device: 'mobile'|'tablet'|'desktop' }
 *
 *   iframe → parent:
 *     { type: 'foody-editor-ready' }
 *     { type: 'foody-section-bounds', bounds: [{ id, top, left, width, height }] }
 *     { type: 'foody-section-click', id }
 *     { type: 'foody-scroll', scrollY }
 *
 * Legacy messages still supported for backward compat with the old editor:
 *   parent → iframe: 'foody-sections-override', 'foody-highlight-section'
 *   iframe → parent: 'foody-select-section'
 */

import { useEffect, useState } from "react";
import type { WebsiteSection } from "@/lib/types";

/**
 * Convert a snake_case admin draft section into a camelCase foodyweb
 * WebsiteSection. Shared by every preview surface (landing, custom pages,
 * order-page footer) so the admin → web shape mapping lives in one place.
 */
export function mapAdminSection(s: Record<string, any>): WebsiteSection {
  return {
    id: s.id ?? s.tmp_id,
    sectionType: s.section_type ?? s.sectionType,
    page: s.page || "home",
    sortOrder: s.sort_order ?? s.sortOrder ?? 0,
    isVisible: s.is_visible ?? s.isVisible ?? true,
    layout: s.layout || "",
    content: s.content || {},
    settings: s.settings || {},
    translations: s.translations || undefined,
  };
}

export type PreviewBounds = {
  id: number | string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type DraftStatePayload = {
  config: Record<string, any>;
  sections: Array<{
    id?: number;
    tmp_id?: string;
    section_type: string;
    page: string;
    sort_order: number;
    is_visible: boolean;
    layout: string;
    content: Record<string, any>;
    settings: Record<string, any>;
  }>;
  deleted_section_ids: number[];
};

/** True if rendered inside an iframe OR when ?preview=1 is in the URL. */
export function usePreviewMode(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const insideIframe = window.self !== window.top;
    const hasPreviewParam = new URLSearchParams(window.location.search).has("preview");
    setActive(insideIframe || hasPreviewParam);
  }, []);

  return active;
}

/** Tell the parent we're ready to receive draft state. */
export function postEditorReady(): void {
  if (typeof window === "undefined" || window.self === window.top) return;
  window.parent.postMessage({ type: "foody-editor-ready" }, "*");
}

/** Send a section's click event to the parent. */
export function postSectionClick(id: number | string): void {
  if (typeof window === "undefined" || window.self === window.top) return;
  window.parent.postMessage({ type: "foody-section-click", id }, "*");
  // Legacy event name kept until the old editor is fully replaced.
  if (typeof id === "number") {
    window.parent.postMessage({ type: "foody-select-section", sectionId: id }, "*");
  }
}

/** Send a batch of section bounds to the parent for overlay positioning. */
export function postSectionBounds(bounds: PreviewBounds[]): void {
  if (typeof window === "undefined" || window.self === window.top) return;
  window.parent.postMessage({
    type: "foody-section-bounds",
    bounds,
    scrollY: window.scrollY,
  }, "*");
}

/** Throttle helper for high-frequency posts (scroll / resize). */
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let queued = false;
  let lastArgs: any[] = [];
  return ((...args: any[]) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  }) as T;
}
