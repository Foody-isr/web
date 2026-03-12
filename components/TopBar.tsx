"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";

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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--surface)] shadow-[0_1px_0_0_var(--divider)]"
          : "bg-gradient-to-b from-black/50 to-transparent"
      } ${
        hidden ? "md:translate-y-0 -translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        {/* Hamburger menu */}
        <button
          onClick={onMenuToggle}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition ${
            scrolled
              ? "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
              : "text-white hover:bg-white/10"
          }`}
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
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : null}
          <span
            className={`font-bold text-sm truncate max-w-[180px] transition ${
              scrolled ? "text-[var(--text)]" : "text-white"
            }`}
          >
            {restaurant?.name || ""}
          </span>
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-10" />
      </div>
    </header>
  );
}
