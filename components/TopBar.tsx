"use client";

import { useEffect, useState, useRef } from "react";
import { useRestaurantTheme } from "@/lib/restaurant-theme";

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
};

export function TopBar({ restaurant, onMenuToggle, viewMode, onToggleViewMode, showViewToggle }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { config } = useRestaurantTheme();

  const navbarStyle = config?.navbarStyle || "solid";
  const navbarColor = config?.navbarColor || "";
  const logoSize = config?.logoSize || 32;
  const hideNavbarName = config?.hideNavbarName || false;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Change to solid background after scrolling 50px
      setScrolled(currentScrollY > 50);

      // Hide/show on mobile based on scroll direction (after scrolling past 150px)
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

  // Compute background based on navbar style
  const isCustomNav = navbarStyle === "custom" && navbarColor;
  const isTransparentNav = navbarStyle === "transparent";

  let bgClass: string;
  let bgStyle: React.CSSProperties | undefined;

  if (scrolled) {
    if (isCustomNav) {
      bgClass = "shadow-[0_1px_0_0_rgba(255,255,255,0.1)]";
      bgStyle = { backgroundColor: navbarColor };
    } else {
      bgClass = "bg-[var(--surface)] shadow-[0_1px_0_0_var(--divider)]";
      bgStyle = undefined;
    }
  } else {
    if (isTransparentNav) {
      bgClass = "bg-transparent";
      bgStyle = undefined;
    } else if (isCustomNav) {
      bgClass = "";
      bgStyle = { backgroundColor: navbarColor };
    } else {
      bgClass = "bg-gradient-to-b from-black/50 to-transparent";
      bgStyle = undefined;
    }
  }

  // Text color: custom/transparent always white, solid depends on scroll
  const alwaysWhiteText = isCustomNav || isTransparentNav;
  const textColor = alwaysWhiteText || !scrolled ? "text-white" : "text-[var(--text)]";
  const hoverBg = alwaysWhiteText || !scrolled ? "hover:bg-white/10" : "hover:bg-[var(--surface-subtle)]";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bgClass} ${
        hidden ? "md:translate-y-0 -translate-y-full" : "translate-y-0"
      }`}
      style={bgStyle}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        {/* Hamburger menu */}
        <button
          onClick={onMenuToggle}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition ${textColor} ${hoverBg}`}
          aria-label="Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Restaurant branding */}
        <div className="flex items-center gap-2">
          {restaurant?.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="flex-shrink-0"
              style={{ height: logoSize, width: 'auto' }}
            />
          ) : null}
          {!hideNavbarName && (
            <span
              className={`font-bold text-sm truncate max-w-[180px] transition ${textColor}`}
              style={{ display: 'var(--hide-navbar-name, inline)' }}
            >
              {restaurant?.name || ""}
            </span>
          )}
        </div>

        {/* Right side: density toggle (when allowed by theme) */}
        <div className="flex items-center gap-2">
          {showViewToggle && viewMode && onToggleViewMode ? (
            <div className={`flex items-center rounded-full p-0.5 ${alwaysWhiteText || !scrolled ? "bg-white/15" : "bg-[var(--surface-subtle)]"}`}>
              <button
                type="button"
                aria-label="Compact list view"
                aria-pressed={viewMode === "compact"}
                onClick={() => viewMode !== "compact" && onToggleViewMode()}
                className={`p-1.5 rounded-full transition ${
                  viewMode === "compact"
                    ? "bg-white text-[var(--text)]"
                    : `${textColor} ${hoverBg}`
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
                    ? "bg-white text-[var(--text)]"
                    : `${textColor} ${hoverBg}`
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="2" width="10" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
    </header>
  );
}
