"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRestaurantTheme } from "@/lib/restaurant-theme";

type TopBarProps = {
  restaurant?: {
    name: string;
    logoUrl?: string;
    slug?: string;
  };
  onMenuToggle?: () => void;
};

export function TopBar({ restaurant, onMenuToggle }: TopBarProps) {
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
            <Image
              src={restaurant.logoUrl}
              alt={restaurant.name}
              width={logoSize * 2.5}
              height={logoSize}
              className="object-contain"
              style={{ height: logoSize, width: 'auto', maxWidth: logoSize * 2.5 }}
            />
          ) : null}
          {!hideNavbarName && (
            <span
              className={`font-bold text-sm truncate max-w-[180px] transition ${textColor}`}
            >
              {restaurant?.name || ""}
            </span>
          )}
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-10" />
      </div>
    </header>
  );
}
