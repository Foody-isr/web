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
 * Bottom-anchored session bar for dine-in mode. Two stacked rows:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  [🪑·2]  Table 1            👥 ›        │  ← session row (always)
 *   ├─────────────────────────────────────────┤
 *   │   [3]   View cart           ₪84  →      │  ← cart row (when hasCart)
 *   └─────────────────────────────────────────┘
 *
 * Replaces both the old top TableContextBar and the bar-bottom floating cart
 * in dine-in. The CTA gets a full-width row so long French/Hebrew labels
 * never truncate; the session row stays present so the customer always sees
 * "you're seated, you're still ordering" no matter what happens to the cart.
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
  const tableTotal = totalTableAmount();

  // Pulse + tint when another guest places/modifies an order. We watch a
  // signature of the other-guest portion of the orders array and trigger a
  // brief animation on each change.
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

  // Fly animation token. Increments per confirm — keys the motion element so
  // each confirm replays the arc from cart row → chair badge.
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

  // Subtitle hierarchy. Three states, scaled to the situation:
  //   • Fresh arrival, no cart   → invitation to start
  //   • Cart has items, no orders → quiet hint about the imminent first order
  //   • Any placed orders        → order count + table running total
  // Cart line itself lives in the bottom row, so we never duplicate "items".
  let subtitle: string;
  if (activeOrderCount > 0) {
    subtitle = `${activeOrderCount} ${activeOrderCount === 1 ? t("order") || "order" : t("orders") || "orders"} · ${currencySymbol(currency)}${tableTotal.toFixed(2)}`;
  } else if (hasCart) {
    subtitle = t("sessionBarFirstOrder") || "Your first order is taking shape";
  } else {
    subtitle = t("sessionBarTapItemsToStart") || "Tap items to start ordering";
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40"
      dir={direction}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Unified surface — robust against any theme. We layer a subtle warm
          tint over the theme surface so the bar reads as elevated even when
          the restaurant's theme uses the same color for surface and page.
          The border + dual shadow do the rest of the visual lift. */}
      <div
        className="relative border-t border-black/[0.08] shadow-[0_-2px_0_rgba(255,255,255,0.4)_inset,0_-12px_28px_-10px_rgba(0,0,0,0.14),0_-28px_64px_-20px_rgba(0,0,0,0.12)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface) 100%, var(--brand) 1.5%) 0%, var(--surface) 100%)",
          backdropFilter: "saturate(1.05)",
        }}
      >
        {/* SESSION ROW — always visible while session is active */}
        <button
          onClick={onOpenTable}
          className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-black/[0.04] text-start"
          aria-label={t("viewTable") || "View table"}
        >
          {/* Chair badge with order count overlay. The ring matches surface so
              the badge floats cleanly when pulse darkens the chair tile. */}
          <div className="relative flex-shrink-0">
            <motion.div
              animate={
                pulse
                  ? { scale: [1, 1.08, 1], backgroundColor: ["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0)"] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}
            >
              <span className="text-xl leading-none">🪑</span>
            </motion.div>
            <AnimatePresence>
              {activeOrderCount > 0 && (
                <motion.span
                  key={activeOrderCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", damping: 14, stiffness: 280 }}
                  className="absolute -top-1 -end-1 min-w-[20px] h-5 px-1 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-[var(--surface)]"
                >
                  {activeOrderCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Identity + subtitle. Subtitle is the editorial layer — small,
              uppercase, letter-spaced, like a wine label. */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-[15px] text-[var(--text-primary)] truncate tracking-tight">
                {tableLabel}
              </span>
              {guestEmoji && (
                <span className="text-[11px] text-[var(--text-soft)] flex-shrink-0">
                  · {guestEmoji}
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-[var(--text-soft)] uppercase tracking-[0.14em] font-semibold truncate mt-0.5">
              {subtitle}
            </div>
          </div>

          {/* Guest stack — small, refined, never crowded */}
          {guests.length > 0 && (
            <div className="flex -space-x-1.5 flex-shrink-0">
              {guests.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="w-6 h-6 rounded-full bg-[var(--surface-subtle)] border-2 border-[var(--surface)] flex items-center justify-center text-[11px]"
                  title={g.display_name}
                >
                  {g.avatar_emoji}
                </span>
              ))}
              {guests.length > 3 && (
                <span className="w-6 h-6 rounded-full bg-[var(--surface-subtle)] border-2 border-[var(--surface)] flex items-center justify-center text-[9px] font-bold text-[var(--text-soft)]">
                  +{guests.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Chevron — points UP because the drawer opens upward */}
          <svg
            className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* CART ROW — expands from height: 0 when first item is added */}
        <AnimatePresence initial={false}>
          {hasCart && (
            <motion.div
              key="cart-row"
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

        {/* Fly animation: a brand-colored chip rises from where the cart row
            sat (bottom ~18px) up to where the chair badge lives (top ~14px),
            with a small inward drift toward the badge. Keyed on `flying` so
            each confirm replays; positioned at the chair-badge anchor and
            animated purely via transform for reliable cross-browser timing. */}
        <AnimatePresence>
          {flying !== null && (
            <motion.div
              key={flying}
              aria-hidden
              className="pointer-events-none absolute top-[14px] start-[22px] w-8 h-8 rounded-full text-white text-base font-extrabold flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(0,0,0,0.35)] z-10"
              style={{ background: "var(--brand)" }}
              initial={{ y: 70, x: 24, scale: 0.5, opacity: 0 }}
              animate={{
                y: [70, 36, 0],
                x: [24, 12, 0],
                scale: [0.5, 1.08, 0.55],
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
