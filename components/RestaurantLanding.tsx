"use client";

import { useState, useEffect } from "react";
import { Restaurant, WebsiteSection } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

/** Convert snake_case admin section to camelCase foodyweb section. */
function mapAdminSection(s: Record<string, any>): WebsiteSection {
  return {
    id: s.id,
    sectionType: s.section_type ?? s.sectionType,
    page: s.page || "home",
    sortOrder: s.sort_order ?? s.sortOrder ?? 0,
    isVisible: s.is_visible ?? s.isVisible ?? true,
    layout: s.layout || "",
    content: s.content || {},
    settings: s.settings || {},
  };
}

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { direction } = useI18n();
  const { config } = useRestaurantTheme();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [overrideSections, setOverrideSections] = useState<WebsiteSection[] | null>(null);

  // Listen for real-time section overrides from admin iframe parent
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "foody-sections-override" && Array.isArray(e.data.sections)) {
        const mapped = e.data.sections.map(mapAdminSection);
        setOverrideSections(mapped);
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
  const orderUrl = `/r/${slug}/order`;

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
      style={isHidden && restaurant.logoUrl ? { '--nav-height': `${(logoSize || 60) + 16}px` } as React.CSSProperties : { '--nav-height': '60px' } as React.CSSProperties}
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
            <div className="fixed top-2 left-0 right-0 z-20 flex justify-center pointer-events-none">
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
            <Link
              href={orderUrl}
              className={`px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity ${
                isTransparent || isCustom
                  ? "bg-white/20 text-white backdrop-blur-sm border border-white/30"
                  : "bg-brand text-white"
              }`}
            >
              Order Now
            </Link>
          </div>
        </nav>
      )}

      {/* All content is section-based — z-30 ensures sections render above the fixed logo (z-20) in hidden navbar mode */}
      <div className="relative" style={{ zIndex: 30 }}>
        <SectionRenderer sections={sections} restaurant={restaurant} />
      </div>

      {/* Navigation Drawer */}
      <NavigationDrawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        restaurant={restaurant}
      />
    </div>
  );
}
