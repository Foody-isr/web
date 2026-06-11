"use client";

import { OrderType, BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type Props = {
  orderType: OrderType;
  /** When dine-in, the table label (e.g. "Table 1") shown after the order type. */
  tableLabel?: string;
  /** Optional — when present, the chip becomes a button (only for pickup/delivery). */
  onTap?: () => void;
  /** Inline variant — drops the floating wrapper (no centering / overlap) so
   *  the pill can sit as a flex item inside the hero's web info bar. */
  inline?: boolean;
};

/**
 * Order-type selector ("🍽 Sur place · Table 1", "🛍 À emporter", "🛵 Livraison").
 *
 *   • Mobile (default): a Wolt-style full-width flat button below the hero
 *     band — 48px tall, 16px page margins, `--surface-subtle` background (the
 *     same token as the search bar), content left-aligned with the chevron
 *     right after the label. No border, shadow, or hero overlap.
 *   • `inline` (sm+): the original compact pill, sitting as a flex item inside
 *     the hero's web info row.
 *
 * Becomes a button (with a chevron) when `onTap` is provided. Batch (preorder)
 * restaurants surface their fulfilment week as plain text in the hero info
 * line instead — see formatBatchStatusInline.
 */
export function ModeChip({ orderType, tableLabel, onTap, inline }: Props) {
  const { t } = useI18n();

  const icon = (() => {
    switch (orderType) {
      case "delivery":
        return "🛵";
      case "pickup":
        return "🛍️";
      case "dine_in":
        return "🍽️";
    }
  })();

  const label = (() => {
    switch (orderType) {
      case "delivery":
        return t("delivery") || "Delivery";
      case "pickup":
        return t("pickup") || "Pickup";
      case "dine_in":
        return t("dineIn") || "Sur place";
    }
  })();

  const tappable = !!onTap;
  const Tag = tappable ? "button" : "div";

  const chipClass = inline
    ? `inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--surface)] text-[var(--text-primary)] text-[13.5px] font-bold whitespace-nowrap shadow-[0_6px_18px_rgba(30,44,24,0.10)] border border-[var(--divider)] ${
        tappable ? "active:scale-[0.98] transition" : ""
      }`
    : `flex w-full items-center gap-2.5 h-12 px-4 rounded-2xl bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[15px] font-bold whitespace-nowrap ${
        tappable ? "active:scale-[0.99] transition" : ""
      }`;

  return (
    <div className={inline ? "contents" : "relative z-[3] px-4 pb-5"}>
      <Tag onClick={onTap} className={chipClass}>
        <span className={`leading-none ${inline ? "text-base" : "text-lg"}`}>{icon}</span>
        <span>
          {label}
          {tableLabel && (
            <>
              <span className="opacity-50 mx-1.5">·</span>
              {tableLabel}
            </>
          )}
        </span>
        {tappable && (
          <svg
            className={inline ? "w-3 h-3 rtl:rotate-180 opacity-50" : "w-3.5 h-3.5 rtl:rotate-180 opacity-70"}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </Tag>
    </div>
  );
}

/* ───────────────────────── Batch-week formatters ─────────────────────────
   Compact, locale-aware. Used by the hero info line via formatBatchStatusInline. */

function chipLocaleTag(locale: string): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "he") return "he-IL";
  return locale || "en-US";
}

/** "Vendredi 12 juin" / "Friday 12 June" / "ו׳ 12 יוני" — full weekday so it
 *  reads naturally. */
function formatChipDateLine(isoDate: string, locale: string): string {
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  const raw = d.toLocaleDateString(chipLocaleTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.length === 0 ? raw : raw[0].toLocaleUpperCase() + raw.slice(1);
}

/** "Mercredi 22:00" — reopen label for the gap state. Full weekday name so it
 *  can't be misread (an abbreviated "Mer" / "Wed" is ambiguous). */
function formatChipReopen(isoDateTime: string, locale: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  const tag = chipLocaleTag(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: "long" }).replace(/\.$/, "");
  const time = d.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const cap = weekday.length === 0 ? weekday : weekday[0].toLocaleUpperCase() + weekday.slice(1);
  return `${cap} ${time}`;
}

/**
 * Plain-text batch status for the hero info line (Wolt "Open until …" style).
 * Open → the fulfilment date ("Vendredi 12 juin"); closed → when ordering
 * reopens ("Ouvre Mercredi 22:00"). `opensWord` is the localized "Opens" verb.
 */
export function formatBatchStatusInline(
  batchConfig: BatchFulfillmentConfigResponse,
  locale: string,
  opensWord: string,
): string {
  const primaryDay = batchConfig.fulfillmentDays?.[0];
  if (batchConfig.orderingOpen) {
    return primaryDay ? formatChipDateLine(primaryDay.date, locale) : "";
  }
  return `${opensWord} ${formatChipReopen(batchConfig.currentBatchOpenAt, locale)}`;
}
