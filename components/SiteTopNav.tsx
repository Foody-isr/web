"use client";

import { useState } from "react";
import Link from "next/link";
import { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { buildNavPageItems } from "@/lib/siteNav";

/**
 * Shared horizontal top nav for the marketing/site pages (custom pages, catering,
 * and the order page). Desktop shows the page links inline; mobile collapses to a
 * hamburger that opens the existing NavigationDrawer. Used by custom pages, the
 * catering page, and the order page so they all link to one another — matching a
 * standard multi-page site. The home landing keeps its own hero-aware nav.
 *
 * `activeKey` highlights the current page ("catering", a page slug, or "order").
 */
export function SiteTopNav({ restaurant, activeKey }: { restaurant: Restaurant; activeKey?: string }) {
  const { t } = useI18n();
  const slug = restaurant.slug || String(restaurant.id);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = buildNavPageItems(restaurant, t("navCatering") || "Catering");
  const effectiveCateringOnly = restaurant.cateringEnabled === true && restaurant.cateringOnly === true;

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-[var(--divider)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={t("navPrimary") || "Menu"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] md:hidden"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href={`/r/${slug}`} className="flex items-center gap-2.5">
              {restaurant.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={restaurant.logoUrl} alt={restaurant.name} className="h-9 w-auto rounded-full object-cover" />
              )}
              <span className="text-lg font-bold text-[var(--text)]">{restaurant.name}</span>
            </Link>
          </div>

          {/* Desktop page links */}
          <div className="hidden items-center gap-6 md:flex">
            {items.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className={`text-sm font-medium transition-colors hover:text-[var(--brand)] ${
                  activeKey === it.key ? "text-[var(--brand)]" : "text-[var(--text-muted)]"
                }`}
              >
                {it.label}
              </Link>
            ))}
          </div>

          {/* Primary CTA — the order flow (hidden for catering-only sites) */}
          {!effectiveCateringOnly && (
            <Link
              href={`/r/${slug}/order`}
              className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("navOrderCta") || "Order"}
            </Link>
          )}
        </div>
      </nav>

      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} restaurant={restaurant} />
    </>
  );
}
