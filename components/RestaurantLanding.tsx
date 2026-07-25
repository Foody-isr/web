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
import Link from "next/link";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { t, direction } = useI18n();
  const { config } = useRestaurantTheme();
  const previewActive = usePreviewMode();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [overrideSections, setOverrideSections] = useState<WebsiteSection[] | null>(null);

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

  // Navbar styling
  const navbarStyle = config?.navbarStyle || "solid";
  const navbarColor = config?.navbarColor || "";
  const logoSize = config?.logoSize || 40;
  const hideNavbarName = config?.hideNavbarName || false;
  const isHidden = navbarStyle === "hidden";
  const isTransparent = navbarStyle === "transparent";
  const isCustom = navbarStyle === "custom" && navbarColor;

  const navClasses = isTransparent
    ? "sticky top-0 z-40 bg-transparent text-white"
    : isCustom
    ? "sticky top-0 z-40 backdrop-blur-md border-b border-white/10"
    : "sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--divider)]";

  const navStyle = isCustom ? { backgroundColor: navbarColor } : undefined;
  const navTextColor = isTransparent || isCustom ? "text-white" : "";

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]"
      dir={direction}
      style={{
        '--nav-height': isHidden ? '0px' : '60px',
        '--logo-offset': isHidden && restaurant.logoUrl ? `${(logoSize || 60) + 24}px` : '0px',
      } as React.CSSProperties}
    >
      {isHidden ? (
        <>
          {/* Hidden navbar mode: floating hamburger + floating centered logo */}
          <button
            onClick={() => setNavDrawerOpen(true)}
            className="fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {restaurant.logoUrl && (
            <div className="absolute top-3 left-0 right-0 z-40 flex justify-center pointer-events-none">
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                style={{ height: logoSize || 60, width: 'auto' }}
              />
            </div>
          )}
        </>
      ) : (
        /* Standard Navigation Bar */
        <nav className={navClasses} style={navStyle}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNavDrawerOpen(true)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition ${
                  navTextColor ? `${navTextColor} hover:bg-white/10` : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
                }`}
                aria-label="Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {restaurant.logoUrl && (
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="flex-shrink-0"
                  style={{ height: logoSize, width: 'auto' }}
                />
              )}
              {!hideNavbarName && (
                <span className={`font-bold text-lg ${navTextColor}`}>{restaurant.name}</span>
              )}
            </div>
            {navPageItems.length > 0 && (
              <div className="hidden md:flex items-center gap-6">
                {navPageItems.map((it) => (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={`text-sm font-medium transition-opacity hover:opacity-80 ${navTextColor || "text-[var(--text-muted)]"}`}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
            <Link
              href={orderUrl}
              className={`px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity ${
                isTransparent || isCustom
                  ? "bg-white/20 text-white backdrop-blur-sm border border-white/30"
                  : "bg-brand text-white"
              }`}
            >
              {effectiveCateringOnly ? (t("navCatering") || "Catering") : "Order Now"}
            </Link>
          </div>
        </nav>
      )}

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
