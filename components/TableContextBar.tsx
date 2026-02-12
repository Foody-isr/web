"use client";

import { useI18n } from "@/lib/i18n";
import { useTableSession } from "@/store/useTableSession";

type Props = {
  onOpenDrawer: () => void;
};

export function TableContextBar({ onOpenDrawer }: Props) {
  const { t } = useI18n();
  const tableCode = useTableSession((s) => s.tableCode);
  const guests = useTableSession((s) => s.guests);
  const orders = useTableSession((s) => s.orders);
  const status = useTableSession((s) => s.status);
  const guestEmoji = useTableSession((s) => s.guestEmoji);

  if (status !== "active") return null;

  const guestCount = guests.length;
  const orderCount = orders.length;

  return (
    <button
      onClick={onOpenDrawer}
      className="w-full bg-gradient-to-r from-brand/10 to-brand/5 border-b border-brand/20 px-4 py-2.5 flex items-center justify-between transition-all hover:from-brand/15 hover:to-brand/10 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        {/* Table icon */}
        <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center">
          <span className="text-base">🪑</span>
        </div>
        <div className="text-start">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-[var(--text-primary)]">
              {t("table") || "Table"} {tableCode}
            </span>
            {guestEmoji && (
              <span className="text-xs bg-brand/10 px-1.5 py-0.5 rounded-full">
                {guestEmoji} {t("you") || "you"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
            <span className="flex items-center gap-1">
              <span>👥</span>
              {guestCount} {guestCount === 1 ? (t("guest") || "guest") : (t("guests") || "guests")}
            </span>
            {orderCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span>📋</span>
                  {orderCount} {orderCount === 1 ? (t("order") || "order") : (t("orders") || "orders")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guests avatars stack */}
      <div className="flex items-center gap-1">
        <div className="flex -space-x-1.5">
          {guests.slice(0, 4).map((g) => (
            <div
              key={g.id}
              className="w-7 h-7 rounded-full bg-[var(--surface)] border-2 border-[var(--bg-page)] flex items-center justify-center text-sm"
              title={g.display_name}
            >
              {g.avatar_emoji}
            </div>
          ))}
          {guests.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-[var(--surface-subtle)] border-2 border-[var(--bg-page)] flex items-center justify-center text-[10px] font-bold text-[var(--text-soft)]">
              +{guests.length - 4}
            </div>
          )}
        </div>
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
  );
}
