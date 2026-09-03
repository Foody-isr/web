"use client";

import { OrderType, BatchFulfillmentConfigResponse, OrderTypeSelectorConfig } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";

type Props = {
  orderType: OrderType;
  /** When dine-in, the table label (e.g. "Table 1") shown after the order type. */
  tableLabel?: string;
  /** Optional — when present, the chip becomes a button (only for pickup/delivery). */
  onTap?: () => void;
  /** Inline variant — drops the full-width wrapper so the button can sit as
   *  an auto-width flex item inside the hero's web info bar (sm+). */
  inline?: boolean;
};

/**
 * Order-type selector ("Sur place · Table 1", "À emporter", "Livraison") —
 * a Wolt-style flat button: 48px tall, 12px corners, `--surface-subtle`
 * background (the same token as the search bar), brand-tinted line icon +
 * bold label with the chevron right after it. No border, shadow, or hero
 * overlap.
 *
 *   • Mobile (default): full width below the hero band, 16px page margins.
 *   • `inline` (sm+): auto width, sitting as a flex item inside the hero's
 *     web info row.
 *
 * Becomes a button (with a chevron) when `onTap` is provided. Batch (preorder)
 * restaurants surface their fulfilment week as plain text in the hero info
 * line instead — see formatBatchStatusInline.
 */
export function ModeChip({ orderType, tableLabel, onTap, inline }: Props) {
  const { t } = useI18n();
  const { config } = useRestaurantTheme();
  const appearance = config?.orderTypeSelector ?? {};

  // Wolt-style monochrome line icons, tinted via currentColor.
  const icon = (() => {
    const common = {
      className: "w-5 h-5 shrink-0",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.9,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      viewBox: "0 0 24 24",
    };
    switch (orderType) {
      case "delivery":
        return (
          <svg {...common}>
            <circle cx="18.5" cy="17.5" r="3.5" />
            <circle cx="5.5" cy="17.5" r="3.5" />
            <circle cx="15" cy="5" r="1" />
            <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
          </svg>
        );
      case "pickup":
        return (
          <svg {...common}>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        );
      case "dine_in":
        return (
          <svg {...common}>
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
          </svg>
        );
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

  const chipClass = `${
    inline ? "inline-flex" : "flex w-full"
  } items-center gap-2.5 ${selectorSizeClass(appearance.size)} ${selectorShapeClass(appearance.shape)} ${selectorVariantClass(appearance.variant)} font-bold whitespace-nowrap ${
    tappable ? "active:scale-[0.99] transition" : ""
  }`;
  const chipStyle = selectorStyle(appearance);

  return (
    <div className={inline ? "contents" : "relative z-[3] px-4 pb-5"}>
      <Tag onClick={onTap} className={chipClass} style={chipStyle}>
        {icon}
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
            className="w-3.5 h-3.5 rtl:rotate-180"
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

/** Resolves the configured selector corner treatment. */
export function selectorShapeClass(
  shape: OrderTypeSelectorConfig["shape"],
): string {
  if (shape === "pill") return "rounded-full";
  if (shape === "square") return "rounded-none";
  return "rounded-xl";
}

/** Resolves the configured selector height and spacing. */
export function selectorSizeClass(
  size: OrderTypeSelectorConfig["size"],
): string {
  if (size === "sm") return "h-10 px-3 text-[14px]";
  if (size === "lg") return "h-14 px-5 text-[16px]";
  return "h-12 px-4 text-[15px]";
}

/** Resolves the configured selector surface treatment. */
export function selectorVariantClass(
  variant: OrderTypeSelectorConfig["variant"],
): string {
  if (variant === "outline") {
    return "border border-[var(--brand)] bg-transparent text-[var(--brand)]";
  }
  if (variant === "ghost") return "border border-transparent bg-transparent text-[var(--brand)]";
  return "border border-transparent bg-[var(--surface-subtle)] text-[var(--brand)]";
}

/** Resolves optional custom selector colors. */
export function selectorStyle(
  appearance: OrderTypeSelectorConfig,
): React.CSSProperties {
  return {
    ...(appearance.bg ? { backgroundColor: appearance.bg } : {}),
    ...(appearance.text_color ? { color: appearance.text_color } : {}),
    ...(appearance.border_color ? { borderColor: appearance.border_color } : {}),
  };
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
