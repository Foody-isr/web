"use client";

import { LanguageToggle } from "@/components/LanguageToggle";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";

export function TopBar() {
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
          // Scrolling down - hide
          setHidden(true);
        } else {
          // Scrolling up - show
          setHidden(false);
        }
      } else {
        // Near top - always show
        setHidden(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

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
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Foody"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>

        {/* Language Toggle */}
        <LanguageToggle variant={scrolled ? "default" : "transparent"} />
      </div>
    </header>
  );
}
