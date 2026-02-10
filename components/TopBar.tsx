"use client";

import { LanguageToggle } from "@/components/LanguageToggle";
import Image from "next/image";
import { useEffect, useState } from "react";

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Change to solid background after scrolling 50px
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow] duration-300 ${
        scrolled
          ? "bg-[var(--surface)] shadow-[0_1px_0_0_var(--divider)]"
          : "bg-gradient-to-b from-black/50 to-transparent"
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
