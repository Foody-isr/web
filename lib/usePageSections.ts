"use client";

import { useEffect, useState } from "react";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { mapAdminSection, postEditorReady, usePreviewMode } from "@/lib/preview-mode";

/**
 * Returns the website sections for one page (by slug), with live-preview support
 * inside the foodyadmin website builder. In preview mode it announces itself to
 * the editor parent and swaps in the draft sections it receives via postMessage
 * (the same `foody-draft-state` / `foody-sections-override` protocol used by the
 * landing and custom pages); outside preview it filters the restaurant's
 * published sections. Also handles `foody-scroll-to-section`.
 *
 * Returns `sections` (this page's, unsorted — SectionRenderer sorts) and
 * `overrideSections` (the raw draft override, or null) which callers pass to
 * SiteFooter so the site-wide footer previews too.
 */
export function usePageSections(
  restaurant: Restaurant,
  pageSlug: string,
): { sections: WebsiteSection[]; overrideSections: WebsiteSection[] | null } {
  const previewActive = usePreviewMode();
  const [overrideSections, setOverrideSections] = useState<WebsiteSection[] | null>(null);

  // Tell the editor parent we're ready so it posts the initial draft state.
  useEffect(() => {
    if (previewActive) postEditorReady();
  }, [previewActive]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-draft-state" && e.data.state?.sections) {
        setOverrideSections(e.data.state.sections.map(mapAdminSection));
      } else if (e.data?.type === "foody-sections-override" && Array.isArray(e.data.sections)) {
        setOverrideSections(e.data.sections.map(mapAdminSection));
      } else if (e.data?.type === "foody-scroll-to-section" && e.data.id != null) {
        const el = document.querySelector(`[data-section-id="${e.data.id}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const base = overrideSections ?? restaurant.websiteSections ?? [];
  return { sections: base.filter((s) => s.page === pageSlug), overrideSections };
}
