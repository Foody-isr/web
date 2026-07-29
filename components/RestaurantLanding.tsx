"use client";

import { useState, useEffect } from "react";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { useI18n } from "@/lib/i18n";
import { mapAdminSection, postEditorReady, usePreviewMode } from "@/lib/preview-mode";
import { useNavbarSettings } from "@/components/SiteNavbar";
import { SiteNavbarAuto } from "@/components/SiteNavbarAuto";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { direction } = useI18n();
  const previewActive = usePreviewMode();
  const [overrideSections, setOverrideSections] = useState<WebsiteSection[] | null>(null);

  // Tell the editor parent we're alive so it can post the initial draft state.
  useEffect(() => {
    if (previewActive) postEditorReady();
  }, [previewActive]);

  // Accept draft state from the editor parent (sections here; the navbar reads
  // the draft config itself via useNavbarSettings).
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

  const baseSections = overrideSections ?? (restaurant.websiteSections || []);
  const sections = baseSections.filter((s) => !s.page || s.page === "home");

  // The bar reserves height in flow only when it sits above the hero. Overlay
  // floats over the hero (0); every other background is a sticky bar (60px).
  const { nb } = useNavbarSettings();
  const navInFlow = nb.style !== "overlay";

  return (
    <div
      className="relative min-h-screen bg-[var(--bg-page)] text-[var(--text)]"
      dir={direction}
      style={{
        "--nav-height": navInFlow ? "60px" : "0px",
        "--logo-offset": "0px",
      } as React.CSSProperties}
    >
      {/* The landing opens with a full-bleed hero, so the overlay style can float. */}
      <SiteNavbarAuto restaurant={restaurant} overHero />

      {/* Website sections (hero, content). Footer is rendered site-wide below. */}
      <SectionRenderer sections={sections} restaurant={restaurant} />

      <SiteFooter restaurant={restaurant} sectionsOverride={overrideSections ?? undefined} />
    </div>
  );
}
