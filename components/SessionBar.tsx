"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
  /** When true, the cart CTA shows as disabled (restaurant closed). */
  disabled?: boolean;
};

const COMPLETED_STATUSES = new Set(["served", "cancelled", "rejected"]);

/**
 * Bottom-anchored bar for dine-in mode. Two parts with very different jobs:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  🪑  Table 1 · 😎 + 👤👤 · 1 envoyée · ₪35              ›        │ ← presence strip
 *   ├──────────────────────────────────────────────────────────────────┤   (always when
 *   │  [2]  Send to kitchen                       ₪25  →               │   session active)
 *   └──────────────────────────────────────────────────────────────────┘
 *                                                                       ← cart bar
 *                                                                          (only when cart
 *                                                                           has items)
 *
 * The hierarchy is deliberate:
 *   • Strip — small, neutral, never the brand color. It exists to tell the
 *     customer "you're here, your friends are here, here's what's been sent."
 *     It's purely informational. Tap to open the table drawer.
 *   • Bar — full-width brand color, big count badge, action verb. The single
 *     primary action whenever the cart has anything. The verb "Send to
 *     kitchen" implies more can be sent later — the pay-at-end mental model.
 *
 * By giving the two parts very different visual weights, the customer never
 * has to wonder "what's the cart, what's the table" — the small gray thing
 * is context, the big colored thing is the next action.
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
  const totalTableAmount = useTableSession((s) => s.totalTableAmount);

  const lines = useCartStore((s) => s.lines);
  const total = useCartStore((s) => s.total);
  const cartAmount = total();
  const cartItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasCart = cartItems > 0;

  const tableLabel = tableName || `${t("table") || "Table"} ${tableCode}`;
  const activeOrders = useMemo(
    () => orders.filter((o) => !COMPLETED_STATUSES.has(o.status)),
    [orders],
  );
  const activeOrderCount = activeOrders.length;
  const hasOrders = activeOrderCount > 0;
  const tableTotal = totalTableAmount();

  // Other guests at the table (excluding "you"). When present, the strip
  // shows their avatars — the social moment of "you're not alone here".
  const otherGuests = guestId ? guests.filter((g) => g.id !== guestId) : guests;

  // Pulse the chair badge when another guest places/modifies an order.
  const lastOtherSigRef = useRef<string>("");
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!guestId) return;
    const sig = orders
      .filter((o) => o.guest_id && o.guest_id !== guestId)
      .map((o) => `${o.id}:${o.status}:${o.items?.length ?? 0}`)
      .sort()
      .join("|");
    if (lastOtherSigRef.current !== "" && lastOtherSigRef.current !== sig) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1600);
      return () => clearTimeout(timer);
    }
    lastOtherSigRef.current = sig;
  }, [orders, guestId]);

  // Fly animation token — increments per confirm, replays the arc from cart
  // CTA up to the chair badge after the cart empties.
  const [flying, setFlying] = useState<number | null>(null);
  const prevFlyRef = useRef(flyTrigger);
  useEffect(() => {
    if (flyTrigger !== prevFlyRef.current) {
      prevFlyRef.current = flyTrigger;
      setFlying(flyTrigger);
      const timer = setTimeout(() => setFlying(null), 900);
      return () => clearTimeout(timer);
    }
  }, [flyTrigger]);

  if (status !== "active") return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40"
      dir={direction}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Unified surface — survives themes where --surface and --bg-page
          collide. The gradient + shadow give it visible elevation regardless. */}
      <div
        className="relative border-t border-black/[0.08] shadow-[0_-2px_0_rgba(255,255,255,0.4)_inset,0_-12px_28px_-10px_rgba(0,0,0,0.14),0_-28px_64px_-20px_rgba(0,0,0,0.12)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface) 100%, var(--brand) 1.5%) 0%, var(--surface) 100%)",
        }}
      >
        {/* PRESENCE STRIP — always while session is active. Single line, small
            text, neutral colors. Pure context: who's here, what's been sent. */}
        <button
          onClick={onOpenTable}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors active:bg-black/[0.04] text-start"
          aria-label={t("viewTable") || "View table"}
        >
          {/* Compact chair badge */}
          <motion.div
            animate={pulse ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}
          >
            <span className="text-sm leading-none">🪑</span>
          </motion.div>

          {/* Inline content: label · you · others · order summary */}
          <div className="flex-1 flex items-center gap-1.5 text-[12.5px] min-w-0">
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {tableLabel}
            </span>

            {/* "You" chip — small inline emoji */}
            {guestEmoji && (
              <>
                <span className="text-[var(--text-soft)]">·</span>
                <span className="flex-shrink-0">{guestEmoji}</span>
              </>
            )}

            {/* Other guests — compact avatar stack */}
            {otherGuests.length > 0 && (
              <div className="flex -space-x-1 flex-shrink-0">
                {otherGuests.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="w-5 h-5 rounded-full bg-[var(--surface-subtle)] border border-[var(--surface)] flex items-center justify-center text-[10px]"
                    title={g.display_name}
                  >
                    {g.avatar_emoji}
                  </span>
                ))}
                {otherGuests.length > 3 && (
                  <span className="w-5 h-5 rounded-full bg-[var(--surface-subtle)] border border-[var(--surface)] flex items-center justify-center text-[8px] font-bold text-[var(--text-soft)]">
                    +{otherGuests.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Activity summary — appears when orders have been placed */}
            {hasOrders && (
              <>
                <span className="text-[var(--text-soft)]">·</span>
                <span className="text-[var(--text-soft)] truncate tabular-nums">
                  {activeOrderCount} {activeOrderCount === 1
                    ? t("order") || "order"
                    : t("orders") || "orders"}
                  {" · "}
                  {currencySymbol(currency)}
                  {tableTotal.toFixed(2)}
                </span>
              </>
            )}
          </div>

          {/* Chevron — points UP because the drawer opens upward */}
          <svg
            className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* CART BAR — full-color, big, primary action. Only when the cart
            has items. Sits below the strip with a hairline divider. */}
        <AnimatePresence initial={false}>
          {hasCart && (
            <motion.div
              key="cart-bar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="overflow-hidden"
            >
              <div className="h-px bg-black/[0.06] mx-4" />
              <button
                onClick={onOpenCart}
                disabled={disabled}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-white font-bold transition-opacity ${
                  disabled ? "opacity-50 cursor-not-allowed" : "active:opacity-90"
                }`}
                style={{ background: "var(--brand)" }}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <motion.span
                    key={cartItems}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 320 }}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-white/22 text-[13px] font-extrabold flex items-center justify-center"
                  >
                    {cartItems}
                  </motion.span>
                  <span className="text-[15px] tracking-tight truncate">
                    {t("viewCart") || "View cart"}
                  </span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[15px] tabular-nums">
                    {currencySymbol(currency)}
                    {cartAmount.toFixed(2)}
                  </span>
                  <svg
                    className="w-4 h-4 rtl:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fly animation: ✓ chip arcs from the cart row up to the chair badge
            after a confirm. Anchored at the chair's position and animated
            purely via transform for reliable cross-browser timing. */}
        <AnimatePresence>
          {flying !== null && (
            <motion.div
              key={flying}
              aria-hidden
              className="pointer-events-none absolute top-[12px] start-[18px] w-7 h-7 rounded-full text-white text-sm font-extrabold flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(0,0,0,0.35)] z-10"
              style={{ background: "var(--brand)" }}
              initial={{ y: 80, x: 28, scale: 0.5, opacity: 0 }}
              animate={{
                y: [80, 40, 0],
                x: [28, 14, 0],
                scale: [0.5, 1.1, 0.55],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 0.85, times: [0, 0.45, 1], ease: [0.34, 1.2, 0.4, 1] }}
            >
              ✓
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
