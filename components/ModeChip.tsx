"use client";

import { OrderType } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type Props = {
  orderType: OrderType;
  /** When dine-in, the table label (e.g. "Table 1") shown after the order type. */
  tableLabel?: string;
  /** Optional — when present, the chip becomes a button (only for pickup/delivery). */
  onTap?: () => void;
};

/**
 * Floating mode chip that overlaps the bottom edge of the hero. Tiny white
 * pill on the surface — answers "where am I, what's my service mode" without
 * competing with the info pills above or the menu below.
 *
 *   ┌──── hero (cover image) ────┐
 *   │                            │
 *   │   [glass info pills row]   │
 *   ╰──~~~~~~~ wave ~~~~~~~──────╯
 *           ┌─ ModeChip ─┐
 *           │ 🍽 Sur place · Table 1 │
 *           └──────────────┘
 *   ┌───── menu content ─────────┐
 */
export function ModeChip({ orderType, tableLabel, onTap }: Props) {
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
          <svg className="w-3 h-3 rtl:rotate-180 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </Tag>
    </div>
  );
}
