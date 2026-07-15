"use client";

import { useI18n } from "@/lib/i18n";
import { formatCutoffLabel, formatDateLabel } from "@/lib/scheduling";
import type { TourInfo } from "@/lib/types";

type Props = {
  tour: TourInfo;
};

/**
 * Header strip for a delivery tour on its dedicated page.
 *
 * A tour is a one-off round to a city the restaurant does not normally serve,
 * reachable only through its dedicated link. The customer arriving there sees
 * ONLY this round's carte, so the strip is no longer a discovery tab — it is the
 * page header, stating the city (the tour is named for it), the delivery day and
 * slot, and the order cutoff.
 */
export function TourBanner({ tour }: Props) {
  const { t, locale } = useI18n();

  const day = formatDateLabel(tour.deliveryDate, locale, { lowerRelative: true });
  const slot =
    tour.deliveryStart && tour.deliveryEnd ? `${tour.deliveryStart} - ${tour.deliveryEnd}` : null;
  const cutoff = formatCutoffLabel(tour.cutoffAt, locale, { lowerRelative: true });

  return (
    <div
      className="mx-4 mt-4 rounded-2xl border p-4 text-start"
      style={{
        background: "color-mix(in srgb, var(--brand) 8%, transparent)",
        borderColor: "color-mix(in srgb, var(--brand) 30%, transparent)",
      }}
    >
      {/* Title already names the city (a tour is named for it), so the body
          states the day/slot and cutoff only — no redundant city line. */}
      <p className="font-bold text-[var(--text)] flex items-center gap-2">
        <span aria-hidden="true">🚚</span>
        <span>{tour.name}</span>
      </p>
      <p className="text-sm text-[var(--text)] opacity-80 mt-1">
        {t("tourDeliveryOn").replace("{date}", day)}
        {slot ? `, ${slot}` : ""}
      </p>
      <p className="text-xs text-[var(--text)] opacity-70 mt-0.5">
        {t("tourOrdersClose")} {cutoff}
      </p>
    </div>
  );
}
