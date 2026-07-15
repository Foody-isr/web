"use client";

import { useI18n } from "@/lib/i18n";
import { formatCutoffLabel, formatDateLabel } from "@/lib/scheduling";
import type { TourInfo } from "@/lib/types";

type Props = {
  tour: TourInfo;
};

/**
 * Header for a delivery tour's dedicated page.
 *
 * A tour is a one-off delivery run to a city the restaurant does not normally
 * serve, reached only through its own link. This strip is the whole context the
 * customer lands with, so it announces the run like a small departure card: the
 * destination as the headline (in the restaurant's display face), then the two
 * facts that matter — when it arrives, and by when to order.
 */
export function TourBanner({ tour }: Props) {
  const { t, locale } = useI18n();

  const day = formatDateLabel(tour.deliveryDate, locale, { lowerRelative: true });
  const slot =
    tour.deliveryStart && tour.deliveryEnd ? `${tour.deliveryStart} - ${tour.deliveryEnd}` : null;
  const cutoff = formatCutoffLabel(tour.cutoffAt, locale, { lowerRelative: true });

  return (
    <section
      aria-label={tour.name}
      className="mx-4 mt-4 flex overflow-hidden rounded-2xl text-start"
      style={{
        background: "var(--surface-elevated)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand) 20%, transparent)",
      }}
    >
      {/* Brand rail: this run, heading to its destination. */}
      <span aria-hidden="true" className="w-1.5 shrink-0" style={{ background: "var(--brand)" }} />

      <div className="flex-1 p-4 sm:p-5">
        <p
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--brand)" }}
        >
          <span aria-hidden="true">🚚</span>
          {t("tourEyebrow")}
        </p>

        <h2
          className="mt-1.5 text-2xl font-bold leading-tight sm:text-3xl"
          style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}
        >
          {tour.name}
        </h2>

        <dl className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
          <div>
            <dt
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-soft)" }}
            >
              {t("delivery")}
            </dt>
            <dd className="mt-0.5 text-sm font-medium" style={{ color: "var(--text)" }}>
              {day}
              {slot ? <span style={{ color: "var(--text-muted)" }}> · {slot}</span> : null}
            </dd>
          </div>
          <div>
            <dt
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-soft)" }}
            >
              {t("tourOrderByLabel")}
            </dt>
            <dd className="mt-0.5 text-sm font-medium" style={{ color: "var(--text)" }}>
              {cutoff}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
