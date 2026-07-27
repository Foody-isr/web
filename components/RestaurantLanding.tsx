"use client";

import { useState, useEffect } from "react";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SiteFooter } from "@/components/SiteFooter";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { useI18n } from "@/lib/i18n";
import { buildNavPageItems } from "@/lib/siteNav";
import { mapAdminSection, postEditorReady, usePreviewMode } from "@/lib/preview-mode";
import { LandingNavbar, resolveNavbar, DraftNavbar } from "@/components/LandingNavbar";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { t, direction } = useI18n();
  const { config } = useRestaurantTheme();
  const previewActive = usePreviewMode();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [overrideSections, setOverrideSections] = useState<WebsiteSection[] | null>(null);
  // Draft config from the editor (snake_case) so navbar edits preview live.
  const [draftConfig, setDraftConfig] = useState<DraftNavbar | null>(null);

  // Tell the editor parent we're alive so it can post the initial draft state.
  useEffect(() => {
    if (previewActive) postEditorReady();
  }, [previewActive]);

  // Accept draft state from the editor parent. Two message shapes are supported
  // so the new editor can roll out without breaking the legacy one:
  //   - foody-draft-state  (new): { state: { config, sections, ... } }
  //   - foody-sections-override (legacy): { sections: [...] }
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-draft-state" && e.data.state) {
        if (e.data.state.sections) setOverrideSections(e.data.state.sections.map(mapAdminSection));
        if (e.data.state.config) setDraftConfig(e.data.state.config);
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
  const sections = baseSections.filter(
    (s) => !s.page || s.page === "home"
  );

  const slug = restaurant.slug || String(restaurant.id);
  // Catering-only restaurants have no classic menu — the primary CTA points to
  // the catering shop instead of the order flow.
  const effectiveCateringOnly = restaurant.cateringEnabled === true && restaurant.cateringOnly === true;
  const orderUrl = effectiveCateringOnly ? `/r/${slug}/catering` : `/r/${slug}/order`;
  // Horizontal page links for the standard navbar (custom pages + catering).
  const navPageItems = buildNavPageItems(restaurant, t("navCatering") || "Catering");

  // Resolve navbar settings — draft config (preview) wins over the saved config
  // so navbar edits preview live in the builder.
  const nb = resolveNavbar(config, draftConfig);
  const cateringLabel = t("navCatering") || "Catering";

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]"
      dir={direction}
      style={{
        '--nav-height': nb.style === 'hidden' ? '0px' : '60px',
        '--logo-offset': nb.style === 'hidden' && restaurant.logoUrl ? `${(nb.logoSize || 60) + 24}px` : '0px',
      } as React.CSSProperties}
    >
      <LandingNavbar
        restaurant={restaurant}
        nb={nb}
        navPageItems={navPageItems}
        orderUrl={orderUrl}
        effectiveCateringOnly={effectiveCateringOnly}
        cateringLabel={cateringLabel}
        onOpenDrawer={() => setNavDrawerOpen(true)}
      />

      {/* All Website Sections (hero, content -- section-based). Footer is
          rendered site-wide below, not inline. */}
      <SectionRenderer sections={sections} restaurant={restaurant} />

      {/* Site-wide footer */}
      <SiteFooter restaurant={restaurant} sectionsOverride={overrideSections ?? undefined} />

      {/* Navigation Drawer */}
      <NavigationDrawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        restaurant={restaurant}
      />
    </div>
  );
}
