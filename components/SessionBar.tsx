"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { currencySymbol } from "@/lib/constants";
import { useCartStore } from "@/store/useCartStore";
import { useTableSession } from "@/store/useTableSession";

type Props = {
  currency: string;
  onOpenTable: () => void;
  onOpenCart: () => void;
  /** Increments each time an order is confirmed; triggers the cart-to-table fly animation. */
  flyTrigger: number;
  /** When true, the floating cart button shows as disabled (restaurant closed). */
  disabled?: boolean;
};

/**
 * The single anchor for dine-in mode. Replaces both the top TableContextBar
 * and the bottom floating cart in dine-in. Always carries the session context;
 * splits into a table-pill + cart-action when the cart has items.
 */
export function SessionBar({ currency, onOpenTable, onOpenCart, flyTrigger, disabled }: Props) {
  const { t, direction } = useI18n();
  const tableCode = useTableSession((s) => s.tableCode);
  const tableName = useTableSession((s) => s.tableName);
  const guests = useTableSession((s) => s.guests);
  const orders = useTableSession((s) => s.orders);
  const guestEmoji = useTableSession((s) => s.guestEmoji);
  const guestId = useTableSession((s) => s.guestId);
  const status = useTableSession((s) => s.status);

  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);
  const totalAmount = total();
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasCart = totalItems > 0;

  const tableLabel = tableName || `${t("table") || "Table"} ${tableCode}`;
  const activeOrderCount = orders.filter(
    (o) => !["served", "cancelled", "rejected"].includes(o.status),
  ).length;

  // Pulse the table pill when another guest's order activity arrives.
  const lastOtherEventRef = useRef<{ key: string }>({ key: "" });
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!guestId) return;
    // Composite signature of orders from OTHER guests — changes when other
    // guests place/modify orders (which is exactly what we want to surface).
    const sig = orders
      .filter((o) => o.guest_id && o.guest_id !== guestId)
      .map((o) => `${o.id}:${o.status}:${o.items?.length ?? 0}`)
      .sort()
      .join("|");
    if (lastOtherEventRef.current.key !== "" && lastOtherEventRef.current.key !== sig) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1400);
      return () => clearTimeout(timer);
    }
    lastOtherEventRef.current.key = sig;
  }, [orders, guestId]);

  // Fly animation: when flyTrigger increments, animate a chip from the cart
  // side into the table pill. We render the chip absolutely so it doesn't
  // disturb layout, and key it on flyTrigger so each confirm replays the motion.
  const [flying, setFlying] = useState<number | null>(null);
  const prevFlyRef = useRef(flyTrigger);
  useEffect(() => {
    if (flyTrigger !== prevFlyRef.current) {
      prevFlyRef.current = flyTrigger;
      setFlying(flyTrigger);
      const timer = setTimeout(() => setFlying(null), 700);
      return () => clearTimeout(timer);
    }
  }, [flyTrigger]);

  if (status !== "active") return null;

  // Subtitle for the table pill depends on what's happening at the table.
  const subtitle =
    activeOrderCount > 0
      ? `${activeOrderCount} ${activeOrderCount === 1 ? t("order") || "order" : t("orders") || "orders"}`
      : t("sessionBarTapItemsToStart") || "Tap items to start ordering";

  // RTL-safe: use logical "start/end" via direction flag on parent.
  const isRtl = direction === "rtl";

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 bg-[var(--surface-elevated,var(--surface))] border-t border-[var(--divider)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
      dir={direction}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-16 max-w-screen-sm mx-auto relative">
        {/* Table pill — left side, always visible */}
        <motion.button
          onClick={onOpenTable}
          animate={pulse ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--surface-subtle)] active:bg-[var(--surface-subtle)] ${
            hasCart ? "flex-shrink-0" : "flex-1"
          } ${pulse ? "bg-brand/5" : ""}`}
          aria-label={t("viewTable") || "View table"}
        >
          <div className="relative w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center flex-shrink-0">
            <span className="text-lg leading-none">🪑</span>
            {activeOrderCount > 0 && (
              <motion.span
                key={activeOrderCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center"
              >
                {activeOrderCount}
              </motion.span>
            )}
          </div>

          <div className="text-start min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
                {tableLabel}
              </span>
              {guestEmoji && !hasCart && (
                <span className="text-xs">{guestEmoji}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-soft)] truncate">
              <span className="truncate">{subtitle}</span>
              {!hasCart && guests.length > 0 && (
                <div className="flex -space-x-1 flex-shrink-0">
                  {guests.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      className="w-4 h-4 rounded-full bg-[var(--surface)] border border-[var(--bg-page)] flex items-center justify-center text-[9px]"
                      title={g.display_name}
                    >
                      {g.avatar_emoji}
                    </span>
                  ))}
                  {guests.length > 3 && (
                    <span className="w-4 h-4 rounded-full bg-[var(--surface-subtle)] border border-[var(--bg-page)] flex items-center justify-center text-[8px] font-bold text-[var(--text-soft)]">
                      +{guests.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.button>

        {/* Cart action — right side, only when cart has items */}
        <AnimatePresence mode="wait">
          {hasCart && (
            <motion.button
              key="cart-side"
              initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={onOpenCart}
              disabled={disabled}
              className={`flex-1 flex items-center justify-between gap-3 px-4 bg-brand text-white font-bold transition-opacity ${
                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-brand-dark active:opacity-90"
              }`}
              style={{ boxShadow: "0 -2px 12px rgba(235, 82, 4, 0.25)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/25 text-xs font-bold flex items-center justify-center">
                  {totalItems}
                </span>
                <span className="text-sm truncate">
                  {t("confirmAndOrder") || "Confirm Order"}
                </span>
              </div>
              <span className="text-sm whitespace-nowrap">
                {currencySymbol(currency)}
                {totalAmount.toFixed(2)}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Fly animation: a chip flies from cart side into the table pill */}
        <AnimatePresence>
          {flying !== null && (
            <motion.div
              key={flying}
              initial={{
                x: isRtl ? "-60%" : "60%",
                y: 0,
                opacity: 0,
                scale: 0.6,
              }}
              animate={{
                x: isRtl ? "60%" : "-60%",
                y: -4,
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1, 1, 0.4],
              }}
              transition={{ duration: 0.7, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
              className="pointer-events-none absolute top-1/2 start-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-brand text-white text-base font-bold flex items-center justify-center shadow-lg"
            >
              ✓
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
