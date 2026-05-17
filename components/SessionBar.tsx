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
 * Bottom-anchored bar for dine-in mode, designed for progressive disclosure.
 *
 * A QR-ordering customer goes through four mental states. The bar shows the
 * minimum chrome required for each — never introducing the "table" concept
 * before the customer has any reason to care about it.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ State 1 (nothing in cart, nothing ordered):  no bar at all.      │
 *   │   The customer is browsing the menu, like any food app.          │
 *   │                                                                  │
 *   │ State 2 (cart has items, nothing ordered yet):                   │
 *   │   ┌──────────────────────────────────────────────────────────┐   │
 *   │   │  [3]  Send to kitchen                    ₪35  →          │   │
 *   │   └──────────────────────────────────────────────────────────┘   │
 *   │   Plain cart bar. No "table" yet — the concept hasn't earned     │
 *   │   its place. Looks like takeaway, behaves like takeaway.         │
 *   │                                                                  │
 *   │ State 3 (no cart, some orders placed):                           │
 *   │   ┌──────────────────────────────────────────────────────────┐   │
 *   │   │  🪑  Table 1                          ₪35  ›             │   │
 *   │   │      1 order at the kitchen                              │   │
 *   │   └──────────────────────────────────────────────────────────┘   │
 *   │   Session anchor — now meaningful, because there's something at  │
 *   │   the table. Tap opens the table drawer.                         │
 *   │                                                                  │
 *   │ State 4 (cart + orders): clear hierarchy.                        │
 *   │   ┌──────────────────────────────────────────────────────────┐   │
 *   │   │  🪑  Table 1 · 1 envoyée · ₪35              ›            │   │ ← thin, neutral
 *   │   ├──────────────────────────────────────────────────────────┤   │
 *   │   │  [2]  Send to kitchen                    ₪25  →          │   │ ← primary CTA
 *   │   └──────────────────────────────────────────────────────────┘   │
 *   │   Cart action is the big colored thing. Table summary is the     │
 *   │   small gray strip above. "What I will do" vs "What I did."      │
 *   └──────────────────────────────────────────────────────────────────┘
 */
export function SessionBar({ currency, onOpenTable, onOpenCart, flyTrigger, disabled }: Props) {
  const { t, direction } = useI18n();
  const tableCode = useTableSession((s) => s.tableCode);
  const tableName = useTableSession((s) => s.tableName);
  const guests = useTableSession((s) => s.guests);
  const orders = useTableSession((s) => s.orders);
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

  // Pulse when another guest places/modifies an order. Only meaningful when
  // the strip or anchor is on screen — otherwise we skip the work.
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
  // CTA up to where the session strip will land after the cart empties.
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

  // State 1: nothing happening. Don't render anything — the menu owns the screen.
  if (status !== "active") return null;
  if (!hasCart && !hasOrders) return null;

  // Shared session-strip content. Used both as a standalone "session anchor"
  // when there's no cart, and as a small context strip when the cart is also
  // active. The visual treatment changes between the two; the content does not.
  const orderSummary = `${activeOrderCount} ${activeOrderCount === 1 ? t("order") || "order" : t("orders") || "orders"}`;
  const guestsLabel =
    guests.length > 0 && !hasCart
      ? `${guests.length} ${guests.length === 1 ? t("guest") || "guest" : t("guests") || "guests"}`
      : null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40"
      dir={direction}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Unified surface — survives themes that collide --surface with --bg-page */}
      <div
        className="relative border-t border-black/[0.08] shadow-[0_-2px_0_rgba(255,255,255,0.4)_inset,0_-12px_28px_-10px_rgba(0,0,0,0.14),0_-28px_64px_-20px_rgba(0,0,0,0.12)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface) 100%, var(--brand) 1.5%) 0%, var(--surface) 100%)",
        }}
      >
        {/* SESSION STRIP — only when orders exist. When the cart is also
            active, this is a small secondary context strip ABOVE the cart
            bar. When cart is empty, this is the only thing on screen and
            takes the full session-anchor treatment. */}
        <AnimatePresence initial={false}>
          {hasOrders && (
            <motion.button
              key="session-strip"
              onClick={onOpenTable}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className={`w-full overflow-hidden text-start transition-colors active:bg-black/[0.04] ${
                hasCart ? "" : ""
              }`}
              aria-label={t("viewTable") || "View table"}
            >
              <div className={`flex items-center gap-3 px-4 ${hasCart ? "py-2.5" : "py-3"}`}>
                {/* Chair badge — smaller in combined mode, prominent solo */}
                <div className="relative flex-shrink-0">
                  <motion.div
                    animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`rounded-2xl flex items-center justify-center ${
                      hasCart ? "w-8 h-8" : "w-11 h-11"
                    }`}
                    style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}
                  >
                    <span className={hasCart ? "text-base leading-none" : "text-xl leading-none"}>
                      🪑
                    </span>
                  </motion.div>
                  {/* Order count badge — only in solo mode so the combined
                      mode stays minimal; the count is shown inline as text. */}
                  {!hasCart && (
                    <motion.span
                      key={activeOrderCount}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", damping: 14, stiffness: 280 }}
                      className="absolute -top-1 -end-1 min-w-[20px] h-5 px-1 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-[var(--surface)]"
                    >
                      {activeOrderCount}
                    </motion.span>
                  )}
                </div>

                {/* Identity + meta */}
                <div className="flex-1 min-w-0">
                  {hasCart ? (
                    // Combined mode: single inline line, compact
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-soft)] truncate">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {tableLabel}
                      </span>
                      <span>·</span>
                      <span>{orderSummary}</span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {currencySymbol(currency)}
                        {tableTotal.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    // Solo session anchor: two-line treatment
                    <>
                      <div className="font-bold text-[15px] text-[var(--text-primary)] truncate tracking-tight">
                        {tableLabel}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-soft)] uppercase tracking-[0.14em] font-semibold truncate mt-0.5">
                        {orderSummary}
                        {guestsLabel && (
                          <>
                            {" · "}
                            {guestsLabel}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right cluster: total (solo only) + chevron */}
                {!hasCart && (
                  <span className="font-bold text-[14px] tabular-nums text-[var(--text-primary)] flex-shrink-0">
                    {currencySymbol(currency)}
                    {tableTotal.toFixed(2)}
                  </span>
                )}
                <svg
                  className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* CART BAR — when items are in cart. In state 2 (no orders) this is
            the only thing on screen, so it sits flush. In state 4 (orders +
            cart) it sits below the session strip and the divider above. */}
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
              {hasOrders && <div className="h-px bg-black/[0.06] mx-4" />}
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

        {/* Fly animation: ✓ chip arcs from the cart bar up to where the
            session strip's chair badge sits. Only meaningful in transitions
            from state 2/4 → 3/4 (i.e. when an order is confirmed). */}
        <AnimatePresence>
          {flying !== null && (
            <motion.div
              key={flying}
              aria-hidden
              className="pointer-events-none absolute top-[14px] start-[22px] w-8 h-8 rounded-full text-white text-base font-extrabold flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(0,0,0,0.35)] z-10"
              style={{ background: "var(--brand)" }}
              initial={{ y: 80, x: 28, scale: 0.5, opacity: 0 }}
              animate={{
                y: [80, 40, 0],
                x: [28, 14, 0],
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
