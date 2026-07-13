"use client";

import { useI18n } from "@/lib/i18n";
import { formatCutoffLabel, formatDateLabel } from "@/lib/scheduling";
import type { TourInfo } from "@/lib/types";

type Props = {
  tour: TourInfo;
  /** True when this tour's carte is the one currently shown. */
  isActive: boolean;
  /** Switch the page to this tour's carte. Browsing only: never touches the cart. */
  onSelect: () => void;
};

/**
 * Announcement strip for one open delivery tour.
 *
 * This is the discovery mechanism, not a decoration. A tour is a one-off round
 * to a city the restaurant does not normally serve, and it is often opened at
 * 11am for the same evening: the guest arriving from a bookmark lands on the
 * ordinary carte and would never think to look for a new tab. The strip states
 * the city, the delivery day and the cutoff, and hands them the carte.
 */
export function TourBanner({ tour, isActive, onSelect }: Props) {
  const { t, locale } = useI18n();

  const day = formatDateLabel(tour.deliveryDate, locale);
  const slot =
    tour.deliveryStart && tour.deliveryEnd ? `${tour.deliveryStart} - ${tour.deliveryEnd}` : null;
  const cutoff = formatCutoffLabel(tour.cutoffAt, locale);
  const cities = tour.cities.join(", ");

  return (
    <div
      className="mx-4 mt-4 rounded-2xl border p-4 flex flex-wrap items-center gap-3"
      style={{
        background: "color-mix(in srgb, var(--brand) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--brand) 30%, transparent)",
      }}
    >
      <div className="flex-1 min-w-[14rem] text-start">
        <p className="font-bold text-[var(--text)] flex items-center gap-2">
          <span aria-hidden="true">🚚</span>
          <span>{tour.name}</span>
        </p>
        <p className="text-sm text-[var(--text)] opacity-80 mt-1">
          {cities ? `${cities} · ` : ""}
          {t("tourDeliveryOn").replace("{date}", day)}
          {slot ? `, ${slot}` : ""}
        </p>
        <p className="text-xs text-[var(--text)] opacity-70 mt-0.5">
          {t("tourOrdersClose")} {cutoff}
        </p>
      </div>
      <button
        onClick={onSelect}
        aria-current={isActive ? "true" : undefined}
        className="px-4 py-2 rounded-full text-sm font-semibold text-white whitespace-nowrap hover:opacity-90 transition-opacity"
        style={{ background: "var(--brand)" }}
      >
        {t("tourBannerCta")}
      </button>
    </div>
  );
}
