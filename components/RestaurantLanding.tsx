"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/types";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { useI18n } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";

type Props = {
  restaurant: Restaurant;
};

export function RestaurantLanding({ restaurant }: Props) {
  const { direction } = useI18n();
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const sections = (restaurant.websiteSections || []).filter(
    (s) => !s.page || s.page === "home"
  );

  const slug = restaurant.slug || String(restaurant.id);
  const orderUrl = `/r/${slug}/order`;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text)]" dir={direction}>
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--divider)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] transition"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {restaurant.logoUrl && (
              <Image
                src={restaurant.logoUrl}
                alt={restaurant.name}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            )}
            <span className="font-bold text-lg">{restaurant.name}</span>
          </div>
          <Link
            href={orderUrl}
            className="px-5 py-2.5 rounded-full bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Order Now
          </Link>
        </div>
      </nav>

      {/* All content is section-based */}
      <SectionRenderer sections={sections} restaurant={restaurant} />

      {/* Navigation Drawer */}
      <NavigationDrawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        restaurant={restaurant}
      />
    </div>
  );
}
