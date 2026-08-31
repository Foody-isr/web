"use client";

import { useI18n } from "@/lib/i18n";

/** Marketing site the attribution points at. Overridable per environment. */
const FOODY_SITE_URL =
  process.env.NEXT_PUBLIC_FOODY_SITE_URL || "https://foody-pos.co.il";

/**
 * Platform attribution, rendered on every customer-facing page.
 *
 * This deliberately lives OUTSIDE the restaurant's footer. The footer is a
 * restaurant-owned surface: its copyright line is fully overridable via
 * `custom_text`, and any page can hide the footer outright. Attribution parked
 * inside it therefore disappears on exactly the pages with the most reach —
 * the order page, which every guest sees and most owners hide the footer on
 * because it collides with the cart dock. This strip is not a WebsiteSection,
 * so the builder cannot edit or hide it.
 *
 * Kept deliberately quiet. Loud attribution makes owners ask to remove it;
 * small and unobtrusive survives.
 */
export function PoweredByFoody({ restaurantSlug }: { restaurantSlug?: string }) {
  const { t } = useI18n();

  // UTM tagging so the traffic this earns is actually measurable per restaurant.
  const href =
    `${FOODY_SITE_URL}?utm_source=restaurant&utm_medium=powered_by` +
    (restaurantSlug ? `&utm_campaign=${encodeURIComponent(restaurantSlug)}` : "");

  return (
    <div
      className="mt-auto bg-[var(--bg-page)] px-4 pt-3 text-center"
      // The order page's cart dock is a fixed bar that would otherwise cover
      // this. It publishes its height on :root; everywhere else this is 0.
      style={{ paddingBottom: "calc(0.75rem + var(--bottom-dock-h, 0px))" }}
    >
      <a
        href={href}
        target="_blank"
        // No `noreferrer`: the referrer is half the point of the attribution.
        rel="noopener"
        className="text-[11px] text-[var(--text)] opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
      >
        {t("poweredByFoody")}
      </a>
    </div>
  );
}
