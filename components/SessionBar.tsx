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
  /** Increments each time an order is confirmed; the pill plays a celebratory pulse. */
  flyTrigger: number;
  /** When true, the cart half shows as disabled (restaurant closed). */
  disabled?: boolean;
};

const COMPLETED_STATUSES = new Set(["served", "cancelled", "rejected"]);

/**
 * Dynamic Pill — single floating element at the bottom that morphs in place
 * between two visual states. There is never more than one element on screen.
 *
 *   Idle (no cart):
 *   ┌──────────────────────────────────┐
 *   │  🪑  Table 1  ·  😎🐻🦊   ›      │   ← dark pill, content-driven width
 *   └──────────────────────────────────┘
 *
 *   Idle with placed orders:
 *   ┌──────────────────────────────────────┐
 *   │  🪑  Table 1  ·  4 orders · ₪435  ›  │
 *   └──────────────────────────────────────┘
 *
 *   Cart active:
 *   ┌──────────────────────────────────────────┐
 *   │  [1]  Voir le panier   ₪69  → │ 🪑 4  │   ← brand pill, two tap zones
 *   └──────────────────────────────────────────┘
 *           primary action zone     │ table peek
 *
 * The pill itself is the celebration: when an order is confirmed, the pill
 * morphs from green → dark, the active-order count animates up, and the
 * whole thing scales briefly. No separate fly chip needed — the morph IS
 * the handoff.
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

  // Other guests (not "you") — the social moment of the strip
  const otherGuests = guestId ? guests.filter((g) => g.id !== guestId) : guests;

  // Pulse when another guest places/modifies an order.
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
      const timer = setTimeout(() => setPulse(false), 1400);
      return () => clearTimeout(timer);
    }
    lastOtherSigRef.current = sig;
  }, [orders, guestId]);

  // Celebrate the confirm — the whole pill briefly scales up as it morphs
  // from green back to dark. flyTrigger increments per confirm so the
  // animation replays each time.
  const [celebrate, setCelebrate] = useState(false);
  const prevFlyRef = useRef(flyTrigger);
  useEffect(() => {
    if (flyTrigger !== prevFlyRef.current) {
      prevFlyRef.current = flyTrigger;
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), 900);
      return () => clearTimeout(timer);
    }
  }, [flyTrigger]);

  if (status !== "active") return null;

  // Visual mode controls color + content. Active = cart side dominates.
  // Idle = compact identity + optional order summary.
  const mode = hasCart ? "active" : "idle";

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none px-3"
      dir={direction}
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
    >
      <motion.div
        layout
        animate={
          celebrate
            ? { scale: [1, 1.05, 1] }
            : pulse
              ? { scale: [1, 1.02, 1] }
              : { scale: 1 }
        }
        transition={{
          layout: { type: "spring", damping: 28, stiffness: 320 },
          scale: { duration: 0.55, ease: "easeOut" },
        }}
        className="pointer-events-auto rounded-full overflow-hidden flex items-stretch max-w-full"
        style={{
          background: mode === "active" ? "var(--brand)" : "#1d2820",
          boxShadow:
            mode === "active"
              ? "0 14px 36px -8px color-mix(in srgb, var(--brand) 55%, transparent), 0 0 0 1px rgba(255,255,255,0.06) inset"
              : "0 14px 36px -8px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
          color: "white",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mode === "idle" ? (
            <motion.button
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onOpenTable}
              className="flex items-center gap-2.5 px-4 py-2.5 text-white text-[13px] font-semibold active:opacity-80 transition-opacity min-h-[44px]"
              aria-label={t("viewTable") || "View table"}
            >
              <span className="text-base leading-none">🪑</span>
              <span className="tracking-tight truncate max-w-[140px]">{tableLabel}</span>

              {/* "You" emoji */}
              {guestEmoji && (
                <>
                  <span className="opacity-40 text-[11px]">·</span>
                  <span className="text-sm leading-none">{guestEmoji}</span>
                </>
              )}

              {/* Other guests stack */}
              {otherGuests.length > 0 && (
                <div className="flex -space-x-1.5">
                  {otherGuests.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      className="w-5 h-5 rounded-full bg-white/10 border border-[#1d2820] flex items-center justify-center text-[10px]"
                      title={g.display_name}
                    >
                      {g.avatar_emoji}
                    </span>
                  ))}
                  {otherGuests.length > 3 && (
                    <span className="w-5 h-5 rounded-full bg-white/10 border border-[#1d2820] flex items-center justify-center text-[8px] font-bold">
                      +{otherGuests.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Order summary — only when there are placed orders */}
              {hasOrders && (
                <>
                  <span className="opacity-40 text-[11px]">·</span>
                  <motion.span
                    key={activeOrderCount}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 280 }}
                    className="tabular-nums text-white/90 whitespace-nowrap"
                  >
                    {activeOrderCount} {activeOrderCount === 1
                      ? t("order") || "order"
                      : t("orders") || "orders"}
                    {" · "}
                    {currencySymbol(currency)}
                    {tableTotal.toFixed(2)}
                  </motion.span>
                </>
              )}

              <svg
                className="w-3 h-3 opacity-60"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </motion.button>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-stretch"
            >
              {/* Primary action zone: tap to open cart */}
              <button
                onClick={onOpenCart}
                disabled={disabled}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-white text-[13px] font-bold transition-opacity min-h-[44px] ${
                  disabled ? "opacity-60 cursor-not-allowed" : "active:opacity-85"
                }`}
              >
                <motion.span
                  key={cartItems}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 14, stiffness: 320 }}
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-white/22 text-[11px] font-extrabold flex items-center justify-center"
                >
                  {cartItems}
                </motion.span>
                <span className="tracking-tight whitespace-nowrap">
                  {t("viewCart") || "View cart"}
                </span>
                <span className="opacity-40 text-[11px]">·</span>
                <span className="tabular-nums whitespace-nowrap">
                  {currencySymbol(currency)}
                  {cartAmount.toFixed(2)}
                </span>
                <svg
                  className="w-3.5 h-3.5 rtl:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Hairline divider */}
              <div className="w-px bg-white/22 my-2" />

              {/* Table peek: tap to open table drawer. Compact — shows order
                  count if any, else just the chair. */}
              <button
                onClick={onOpenTable}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-white text-[12px] font-bold active:opacity-80 transition-opacity"
                aria-label={t("viewTable") || "View table"}
              >
                <span className="text-sm leading-none">🪑</span>
                {hasOrders && (
                  <motion.span
                    key={activeOrderCount}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 320 }}
                    className="tabular-nums"
                  >
                    {activeOrderCount}
                  </motion.span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
