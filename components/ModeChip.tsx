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
  /** When true, hide the order-type (À emporter / Livraison) line in batch mode.
   *  Used when the order type is chosen only at checkout (lock_order_type), so
   *  the chip just shows the fulfilment week instead of a mode the customer
   *  hasn't picked yet. */
  hideOrderType?: boolean;
  /** Inline variant — drops the floating wrapper (no centering / overlap) so
   *  the pill can sit as a flex item inside the hero's web info bar. */
  inline?: boolean;
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
export function ModeChip({ orderType, tableLabel, onTap, batchConfig, hideOrderType, inline }: Props) {
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
    const closesIn = t("closesIn") || "Ferme dans";

    // Accessible single-sentence description for screen readers.
    const ariaLabel = isOpen
      ? hideOrderType
        ? `${headline}${countdown ? `, ${closesIn} ${countdown}` : ""}`
        : `${label} ${t("forShort") || "for"} ${headline}${countdown ? `, ${closesIn} ${countdown}` : ""}`
      : headline;

    return (
      <div
        // pb-4 sm:pb-5 pushes the search/category strip below this chip down
        // so the chip reads as its own floating card with room to breathe,
        // not as a wedge between two adjacent UI bands. translateY is reduced
        // so the chip sits mostly BELOW the hero edge (small overlap kept as
        // a design link to the hero above), leaving the bulk of its mass in
        // the open space between hero and menu — centered both ways.
        className={inline ? "contents" : "relative z-[3] flex justify-center sm:justify-start px-3 sm:px-6 lg:px-10 pb-4 sm:pb-5"}
        style={inline ? undefined : { transform: "translateY(-14px)" }}
      >
        <Tag
          onClick={onTap}
          aria-label={ariaLabel}
          className={`max-w-[calc(100vw-24px)] inline-flex items-center gap-3 ps-4 pe-3 py-2.5 rounded-xl bg-[var(--surface)] text-[var(--text-primary)] whitespace-nowrap shadow-[0_10px_28px_rgba(30,44,24,0.18)] border border-[var(--divider)] ${
            tappable ? "active:scale-[0.98] transition" : ""
          }`}
        >
          <div className="flex flex-col items-start gap-1.5 text-start min-w-0">
            {/* Headline — fulfilment date as a handwritten note. Italic serif
                reads like an old-French-menu cursive rather than a system
                notification; the brand "Mamie Tlv" is set in serif too so this
                ties back to the masthead. Only the current week's fulfilment
                date is shown (the next-week hint was removed by request). */}
            <span className="inline-flex items-baseline gap-2 truncate leading-[1.05]">
              <span
                className="text-[16px] sm:text-[17px] italic truncate"
                style={{
                  fontFamily:
                    "var(--font-serif, ui-serif, 'Cormorant Garamond', Georgia, 'Times New Roman', serif)",
                  letterSpacing: "-0.005em",
                  fontWeight: 500,
                }}
              >
                {headline}
              </span>
            </span>
            {/* Subline — order type, then deadline promoted to an accent
                badge so it doesn't get scanned past as muted footer text.
                "Ferme dans 2j 20h" reads naturally; without the verb it could
                be misread as prep time. When hideOrderType is set (batch +
                choose-mode-at-checkout), the order type is dropped — only the
                fulfilment week (+ deadline) remains. */}
            {(!hideOrderType || (isOpen && !!countdown)) && (
              <span className="text-[11px] sm:text-[11.5px] leading-none inline-flex items-center gap-2 truncate">
                {!hideOrderType && (
                  <span className="inline-flex items-center gap-1 opacity-65">
                    <span aria-hidden className="text-[12px] leading-none">
                      {icon}
                    </span>
                    <span className="font-medium">{label}</span>
                  </span>
                )}
                {isOpen && countdown && (
                  <span
                    className="inline-flex items-center px-1.5 py-1 rounded-md text-[10px] font-bold leading-none uppercase tracking-wide"
                    style={{
                      background:
                        "color-mix(in oklab, var(--brand-500, #ED7D31) 12%, transparent)",
                      color: "var(--brand-700, var(--brand-500, #ED7D31))",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {closesIn} {countdown}
                  </span>
                )}
              </span>
            )}
          </div>
          {tappable && (
            <div className="flex items-center gap-1 opacity-60 shrink-0 ms-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] hidden sm:inline">
                {t("modify") || "Modifier"}
              </span>
              <svg
                className="w-3.5 h-3.5 rtl:rotate-180"
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
            </div>
          )}
        </Tag>
      </div>
    );
  }

  // ── Default layout: single-line pill (unchanged) ──
  return (
    <div
      className={inline ? "contents" : "relative z-[3] flex justify-center sm:justify-start sm:px-6 lg:px-10"}
      style={inline ? undefined : { transform: "translateY(-22px)" }}
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
