"use client";

import { OrderType, BatchFulfillmentConfigResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";

type Props = {
  orderType: OrderType;
  /** When dine-in, the table label (e.g. "Table 1") shown after the order type. */
  tableLabel?: string;
  /** Optional — when present, the chip becomes a button (only for pickup/delivery). */
  onTap?: () => void;
  /** Batch fulfillment config — when present and enabled, the chip switches to
   *  a two-line layout with the fulfilment date as the headline. This is the
   *  page's main "you are ordering for ___" surface. */
  batchConfig?: BatchFulfillmentConfigResponse | null;
};

/**
 * Floating mode chip that overlaps the bottom edge of the hero. For regular
 * restaurants it's a tiny one-line pill ("🍽 Sur place · Table 1"). For batch
 * (weekly preorder) restaurants it expands into a two-line chip with the
 * fulfilment date as the headline — guarantees customers can't miss which
 * day they're actually ordering for.
 *
 *   ┌──── hero (cover image) ────┐
 *   │                            │
 *   │   [glass info pills row]   │
 *   ╰──~~~~~~~ wave ~~~~~~~──────╯
 *           ┌── ModeChip ──┐
 *           │ Vendredi 12 juin │   ← batch headline (serif)
 *           │ 🛍 À emporter · ferme 2j 21h ⌄ │
 *           └──────────────────┘
 *   ┌───── menu content ─────────┐
 */
export function ModeChip({ orderType, tableLabel, onTap, batchConfig }: Props) {
  const { t, locale } = useI18n();

  // Live re-render every minute so the countdown advances ("2j 22h" → "2j 21h").
  // Only mounts the timer when batch mode is actually relevant.
  const [, setTick] = useState(0);
  const batchActive =
    !!batchConfig?.enabled &&
    !!batchConfig.fulfillmentDays?.[0] &&
    orderType !== "dine_in";
  useEffect(() => {
    if (!batchActive) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [batchActive]);

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

  // ── Batch-mode layout: two-line chip with the date as the headline ──
  if (batchActive && batchConfig) {
    const primaryDay = batchConfig.fulfillmentDays[0];
    const isOpen = batchConfig.orderingOpen;
    const targetIso = isOpen
      ? batchConfig.currentBatchCutoff
      : batchConfig.currentBatchOpenAt;

    const headline = isOpen
      ? formatChipDateLine(primaryDay.date, locale)
      : `${t("opensAt") || "Opens"} ${formatChipReopen(targetIso, locale)}`;
    const countdown = isOpen ? formatChipCountdown(targetIso, locale) : "";
    const closesShort = t("closesShort") || "ferme";

    // Accessible single-sentence description for screen readers.
    const ariaLabel = isOpen
      ? `${label} ${t("forShort") || "for"} ${headline}${countdown ? ` · ${closesShort} ${countdown}` : ""}`
      : headline;

    return (
      <div
        className="relative z-[3] flex justify-center px-3"
        style={{ transform: "translateY(-24px)" }}
      >
        <Tag
          onClick={onTap}
          aria-label={ariaLabel}
          className={`max-w-[calc(100vw-24px)] inline-flex items-center gap-3 ps-4 pe-3.5 py-2.5 rounded-xl bg-[var(--surface)] text-[var(--text-primary)] whitespace-nowrap shadow-[0_8px_24px_rgba(30,44,24,0.16)] border border-[var(--divider)] ${
            tappable ? "active:scale-[0.98] transition" : ""
          }`}
        >
          <div className="flex flex-col items-start gap-1 text-start min-w-0">
            {/* Headline — fulfilment date in serif. Visually dominant so
                customers can't scan past it on their way to the menu. */}
            <span
              className="text-[15px] sm:text-[16px] font-semibold leading-[1.1] truncate"
              style={{
                fontFamily:
                  "var(--font-serif, ui-serif, 'Cormorant Garamond', Georgia, 'Times New Roman', serif)",
                letterSpacing: "-0.005em",
              }}
            >
              {headline}
            </span>
            {/* Subline — order type + deadline. The supporting info. */}
            <span className="text-[11px] sm:text-[11.5px] leading-[1.1] opacity-65 inline-flex items-center gap-1.5 truncate">
              <span aria-hidden className="text-[12px] leading-none">
                {icon}
              </span>
              <span className="font-medium">{label}</span>
              {isOpen && countdown && (
                <>
                  <span aria-hidden className="opacity-50">·</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {closesShort} {countdown}
                  </span>
                </>
              )}
            </span>
          </div>
          {tappable && (
            <svg
              className="w-3.5 h-3.5 rtl:rotate-180 opacity-45 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              viewBox="0 0 24 24"
              aria-hidden
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

  // ── Default layout: single-line pill (unchanged) ──
  return (
    <div
      className="relative z-[3] flex justify-center"
      style={{ transform: "translateY(-22px)" }}
    >
      <Tag
        onClick={onTap}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--surface)] text-[var(--text-primary)] text-[13.5px] font-bold whitespace-nowrap shadow-[0_6px_18px_rgba(30,44,24,0.10)] border border-[var(--divider)] ${
          tappable ? "active:scale-[0.98] transition" : ""
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
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
            className="w-3 h-3 rtl:rotate-180 opacity-50"
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

/* ───────────────────────── Batch-chip formatters ─────────────────────────
   Compact, locale-aware. Kept inline so the chip stays a single file. */

function chipLocaleTag(locale: string): string {
  if (locale === "fr") return "fr-FR";
  if (locale === "he") return "he-IL";
  return locale || "en-US";
}

/** "Vendredi 12 juin" / "Friday 12 June" / "ו׳ 12 יוני" — full weekday for the
 *  headline so it reads naturally. The hero pill uses the shorter form. */
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

/** "2j 21h" / "2d 21h" / Hebrew shorthand. */
function formatChipCountdown(isoDateTime: string, locale: string): string {
  const diffMs = new Date(isoDateTime).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const totalMins = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (locale === "he") {
    if (days > 0) return `${days} י׳ ${hours} ש׳`;
    if (hours > 0) return `${hours} ש׳`;
    return `${mins} ד׳`;
  }
  if (days > 0) return locale === "fr" ? `${days}j ${hours}h` : `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  return `${mins} min`;
}

/** "mer. 22:00" — reopen label for the gap state. */
function formatChipReopen(isoDateTime: string, locale: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  const tag = chipLocaleTag(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: "short" }).replace(/\.$/, "");
  const time = d.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const cap = weekday.length === 0 ? weekday : weekday[0].toLocaleUpperCase() + weekday.slice(1);
  return `${cap} ${time}`;
}
