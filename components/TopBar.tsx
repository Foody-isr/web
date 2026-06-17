"use client";

import { useEffect, useState, useRef } from "react";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { GuestAccountMenu } from "@/components/GuestAccountMenu";
import type { GuestOrder } from "@/services/api";

type TopBarProps = {
  restaurant?: {
    name: string;
    logoUrl?: string;
    slug?: string;
  };
  onMenuToggle?: () => void;
  viewMode?: "compact" | "magazine";
  onToggleViewMode?: () => void;
  showViewToggle?: boolean;
  /** Guest account control (sign in / reorder). Omitted in preview/editor. */
  restaurantId?: string;
  currency?: string;
  onReorder?: (order: GuestOrder) => void;
};

/**
 * Top bar overlaid on the restaurant hero. Wolt-style: floating circular
 * icon buttons with semi-transparent dark backgrounds over the cover image,
 * which morph to a solid surface with neutral icons once the user scrolls
 * past the hero.
 */
export function TopBar({ restaurant, onMenuToggle, viewMode, onToggleViewMode, showViewToggle, restaurantId, currency, onReorder }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { config } = useRestaurantTheme();

  const navbarStyle = config?.navbarStyle || "solid";
  const navbarColor = config?.navbarColor || "";
  const hideNavbarName = config?.hideNavbarName || false;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 50);
      if (currentScrollY > 150) {
        if (currentScrollY > lastScrollY.current) {
          setHidden(true);
        } else {
          setHidden(false);
        }
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isCustomNav = navbarStyle === "custom" && navbarColor;
  const isTransparentNav = navbarStyle === "transparent";

  // Background of the bar itself: transparent when over the hero (so the
  // floating buttons read against the cover image), solid when scrolled.
  let barBgClass: string;
  let barBgStyle: React.CSSProperties | undefined;
  if (scrolled) {
    if (isCustomNav) {
      barBgClass = "shadow-[0_1px_0_0_rgba(255,255,255,0.1)]";
      barBgStyle = { backgroundColor: navbarColor };
    } else {
      // Solid bar: the per-section navbar override wins, else the theme surface.
      barBgClass = "shadow-[0_1px_0_0_var(--divider)]";
      barBgStyle = { backgroundColor: "var(--navbar-bg, var(--surface))" };
    }
  } else {
    barBgClass = "bg-transparent";
    barBgStyle = undefined;
  }

  // Button treatment: dark semi-transparent over hero (Wolt-style), neutral
  // surface once scrolled.
  const overHero = !scrolled && !isCustomNav && !isTransparentNav;
  const buttonBgClass = overHero
    ? "bg-black/45 hover:bg-black/60 backdrop-blur-md"
    : "bg-[var(--surface-subtle)] hover:bg-[var(--divider)]";
  const iconColorClass = overHero ? "text-white" : "text-[var(--text-primary)]";
  // Over the hero the name is white for legibility; once the solid bar shows it
  // uses the per-section navbar text override (falling back to the theme ink).
  const nameThemed = scrolled && !isCustomNav && !isTransparentNav;
  const nameColorClass = nameThemed ? "" : "text-white";
  const nameColorStyle: React.CSSProperties | undefined = nameThemed
    ? { color: "var(--navbar-text, var(--text))" }
    : undefined;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${barBgClass} ${
        hidden ? "md:translate-y-0 -translate-y-full" : "translate-y-0"
      }`}
      style={barBgStyle}
    >
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 h-14">
        {/* Menu button — circular, Wolt-style */}
        <button
          onClick={onMenuToggle}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition ${buttonBgClass} ${iconColorClass}`}
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Restaurant branding — only shown when scrolled or on desktop, so
            the hero gets to breathe on mobile while still anchoring the
            customer once they're deep in the menu. */}
        <div
          className={`hidden sm:flex items-center gap-2 transition-opacity duration-200 ${
            scrolled ? "opacity-100" : "opacity-0 sm:opacity-100"
          }`}
        >
          {/* The logo lives only on the hero now (Wolt-style brand band), never
              in the top bar. The bar keeps just the restaurant name. */}
          {!hideNavbarName && (
            <span className={`font-bold text-sm truncate max-w-[180px] transition ${nameColorClass}`} style={nameColorStyle}>
              {restaurant?.name || ""}
            </span>
          )}
        </div>

        {/* Right cluster: density toggle (desktop) inside a pill */}
        <div className="flex items-center gap-2">
          {showViewToggle && viewMode && onToggleViewMode ? (
            <div
              className={`hidden sm:flex items-center rounded-full p-0.5 transition ${
                overHero ? "bg-black/45 backdrop-blur-md" : "bg-[var(--surface-subtle)]"
              }`}
            >
              <button
                type="button"
                aria-label="Compact list view"
                aria-pressed={viewMode === "compact"}
                onClick={() => viewMode !== "compact" && onToggleViewMode()}
                className={`p-1.5 rounded-full transition ${
                  viewMode === "compact"
                    ? "bg-white text-[var(--text-primary)]"
                    : overHero
                      ? "text-white hover:bg-white/15"
                      : "text-[var(--text-soft)] hover:bg-[var(--divider)]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Magazine view"
                aria-pressed={viewMode === "magazine"}
                onClick={() => viewMode !== "magazine" && onToggleViewMode()}
                className={`p-1.5 rounded-full transition ${
                  viewMode === "magazine"
                    ? "bg-white text-[var(--text-primary)]"
                    : overHero
                      ? "text-white hover:bg-white/15"
                      : "text-[var(--text-soft)] hover:bg-[var(--divider)]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="2" width="10" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}

          {/* Guest account — sign in / avatar + reorder */}
          {restaurantId && onReorder ? (
            <GuestAccountMenu
              restaurantId={restaurantId}
              currency={currency || "ILS"}
              onReorder={onReorder}
              buttonClassName={`w-10 h-10 flex items-center justify-center rounded-full transition ${buttonBgClass} ${iconColorClass}`}
            />
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
    </header>
  );
}
