"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { currencySymbol } from "@/lib/constants";
import { useCartStore } from "@/store/useCartStore";
import { useTableSession } from "@/store/useTableSession";
import { OrderStatus } from "@/lib/types";
import { usePublishHeight } from "@/lib/useStickyChrome";

type Props = {
  currency: string;
  onOpenTable: () => void;
  onOpenCart: () => void;
  /** Increments each time an order is confirmed; the dock pulses to acknowledge. */
  flyTrigger: number;
  /** When true, the cart CTA is disabled (restaurant closed). */
  disabled?: boolean;
};

const COMPLETED_STATUSES = new Set<OrderStatus>(["served", "cancelled", "rejected", "delivered", "received"]);

/**
 * Smart Dock — design handoff from claude.ai/design (foody-admin-design-system,
 * `dock.jsx` → DockMorphing variant). Three vertically stacked zones, all
 * tied to one surface card with rounded top corners and a top shadow.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  🛎️  1 plat prêt · le serveur arrive    Détails →│  ← ready banner
 *   ├──────────────────────────────────────────────────┤   (when ready > 0)
 *   │  🪑  Table 1 · 😎🐻🦊             ▴              │
 *   │      ●●●⚪⚪  4 en cuisine · 1 prêt              │  ← table identity
 *   ├──────────────────────────────────────────────────┤   (always)
 *   │  [2]  Voir le panier              ₪94.00  →     │  ← cart CTA
 *   └──────────────────────────────────────────────────┘   (when cart has items)
 *
 * Solves the "lost visibility after Envoyer en cuisine" problem: after the
 * cart empties the kitchen progress remains visible in the table-strip
 * subtitle (dot strip + "N en cuisine"), so the customer never wonders what
 * happened to their food.
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

  // Kitchen summary — per-status counts across the table.
  const summary = useMemo(() => {
    const live = orders.filter((o) => !COMPLETED_STATUSES.has(o.status));
    const pending = orders.filter(
      (o) => o.status === "pending_review" || o.status === "accepted",
    ).length;
    const cooking = orders.filter((o) => o.status === "in_kitchen").length;
    const ready = orders.filter(
      (o) =>
        o.status === "ready" ||
        o.status === "ready_for_delivery" ||
        o.status === "out_for_delivery",
    ).length;
    return { live: live.length, pending, cooking, ready };
  }, [orders]);

  const hasOrders = summary.live > 0;
  const hasKitchenActivity = summary.pending + summary.cooking + summary.ready > 0;
  const tableTotal = totalTableAmount();

  // Other guests at the table — the "you're not alone here" social moment.
  const otherGuests = guestId ? guests.filter((g) => g.id !== guestId) : guests;

  // Pulse on the chair badge when another guest does something.
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

  // Confirm celebration — the dock briefly scales as the cart hands off.
  const [celebrate, setCelebrate] = useState(false);
  const prevFlyRef = useRef(flyTrigger);
  useEffect(() => {
    if (flyTrigger !== prevFlyRef.current) {
      prevFlyRef.current = flyTrigger;
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), 700);
      return () => clearTimeout(timer);
    }
  }, [flyTrigger]);

  // The Smart Dock stacks one to three rows, so the page can only clear it by
  // measuring it. Publishing the shared bottom-dock token means the document's
  // closing spacer reserves the real height instead of a worst-case guess.
  const dockRef = useRef<HTMLDivElement>(null);
  usePublishHeight(dockRef, "--bottom-dock-h");

  if (status !== "active") return null;
  if (!hasCart && !hasOrders && otherGuests.length === 0 && !guestEmoji) {
    // Truly empty session, no guest joined yet — skip the dock until there's
    // something to anchor to. (Guest join modal owns this moment.)
    return null;
  }

  return (
    <div
      ref={dockRef}
      className="fixed bottom-0 inset-x-0 z-40 px-2 sm:flex sm:justify-center"
      dir={direction}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <motion.div
        animate={celebrate ? { scale: [1, 1.015, 1] } : { scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-[var(--surface)] rounded-t-3xl shadow-[0_-8px_24px_rgba(30,44,24,0.10),0_-1px_0_rgba(30,44,24,0.05)] overflow-hidden sm:w-full sm:max-w-md sm:rounded-3xl sm:mb-3"
      >
        {/* READY BANNER — when one or more orders are marked ready */}
        <AnimatePresence initial={false}>
          {summary.ready > 0 && (
            <motion.button
              key="ready-banner"
              onClick={onOpenTable}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full overflow-hidden text-start"
              style={{
                background: "color-mix(in srgb, var(--brand) 16%, white)",
              }}
            >
              <div
                className="flex items-center gap-2.5 px-4 py-2.5"
                style={{ color: "color-mix(in srgb, var(--brand) 70%, black)" }}
              >
                <span className="text-base leading-none">🛎️</span>
                <span className="flex-1 text-[13px] font-bold">
                  {summary.ready}{" "}
                  {summary.ready > 1
                    ? t("ordersReady") || "plats prêts"
                    : t("orderReady") || "plat prêt"}{" "}
                  · {t("serverArriving") || "le serveur arrive"}
                </span>
                <span className="text-[11px] font-semibold opacity-80">
                  {t("details") || "Détails"} →
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* TABLE IDENTITY STRIP — always */}
        <button
          onClick={onOpenTable}
          className="w-full flex items-center gap-3 px-4 py-3 text-start transition-colors active:bg-[var(--surface-subtle)]"
          aria-label={t("viewTable") || "View table"}
        >
          {/* Chair badge */}
          <motion.div
            animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}
          >
            <span className="text-base leading-none">🪑</span>
          </motion.div>

          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            {/* Line 1: table label · "you" emoji · guest avatars */}
            <div className="flex items-center gap-2 text-[14px] font-extrabold text-[var(--text-primary)] truncate">
              <span className="truncate">{tableLabel}</span>
              {(guestEmoji || otherGuests.length > 0) && (
                <span className="text-[var(--text-soft)] font-medium">·</span>
              )}
              <GuestAvatars
                youEmoji={guestEmoji}
                others={otherGuests}
                max={3}
              />
            </div>

            {/* Line 2: kitchen status OR default guests + total */}
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-soft)] truncate">
              {hasKitchenActivity ? (
                <>
                  <KitchenDotStrip
                    pending={summary.pending}
                    cooking={summary.cooking}
                    ready={summary.ready}
                  />
                  <span className="truncate">
                    {summary.cooking > 0 && (
                      <>
                        {summary.cooking} {t("inKitchen") || "en cuisine"}
                      </>
                    )}
                    {summary.cooking > 0 && summary.ready > 0 && " · "}
                    {summary.ready > 0 && (
                      <>
                        {summary.ready}{" "}
                        {summary.ready > 1
                          ? t("ready_plural") || "prêts"
                          : t("ready_singular") || "prêt"}
                      </>
                    )}
                    {summary.cooking === 0 && summary.ready === 0 && summary.pending > 0 && (
                      <>
                        {summary.pending} {t("pendingKitchen") || "en attente"}
                      </>
                    )}
                  </span>
                </>
              ) : (
                <span className="truncate tabular-nums">
                  {guests.length}{" "}
                  {guests.length === 1 ? t("guest") || "guest" : t("guests") || "guests"}
                  {hasOrders && (
                    <>
                      {" · "}
                      {currencySymbol(currency)}
                      {tableTotal.toFixed(2)}
                    </>
                  )}
                  {!hasOrders && !hasCart && (
                    <>{" · "}{t("sessionBarTapItemsToStart") || "Tap items to start ordering"}</>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Chevron — points UP because the drawer opens upward */}
          <svg
            className="w-4 h-4 text-[var(--text-soft)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
          </svg>
        </button>

        {/* CART CTA — only when the cart has items */}
        <AnimatePresence initial={false}>
          {hasCart && (
            <motion.div
              key="cart-cta"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3">
                <button
                  onClick={onOpenCart}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-full text-white font-extrabold text-[15px] transition-opacity ${
                    disabled ? "opacity-50 cursor-not-allowed" : "active:opacity-90 active:scale-[0.99]"
                  }`}
                  style={{
                    background: "var(--brand)",
                    boxShadow:
                      "0 6px 18px -2px color-mix(in srgb, var(--brand) 45%, transparent)",
                  }}
                >
                  <motion.span
                    key={cartItems}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 320 }}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-white/22 text-[12px] font-extrabold flex items-center justify-center"
                  >
                    {cartItems}
                  </motion.span>
                  <span className="flex-1 text-start truncate">
                    {t("viewCart") || "View cart"}
                  </span>
                  <span className="tabular-nums flex-shrink-0">
                    {currencySymbol(currency)}
                    {cartAmount.toFixed(2)}
                  </span>
                  <svg
                    className="w-4 h-4 rtl:rotate-180 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Kitchen-cooking dot pulse animation */}
      <style>{`
        @keyframes dock-cook-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────── Guest Avatars ───────────────────────────────── */

function GuestAvatars({
  youEmoji,
  others,
  max = 3,
}: {
  youEmoji: string | null;
  others: Array<{ id: string; avatar_emoji: string; display_name: string }>;
  max?: number;
}) {
  const avatars: Array<{ key: string; emoji: string; title: string; isYou?: boolean }> = [];
  if (youEmoji) {
    avatars.push({ key: "you", emoji: youEmoji, title: "You", isYou: true });
  }
  for (const g of others) {
    avatars.push({ key: g.id, emoji: g.avatar_emoji, title: g.display_name });
  }
  if (avatars.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {avatars.slice(0, max).map((a) => (
        <span
          key={a.key}
          className="w-5 h-5 rounded-full bg-[var(--surface-subtle)] border-2 border-[var(--surface)] flex items-center justify-center text-[11px]"
          title={a.title}
        >
          {a.emoji}
        </span>
      ))}
      {avatars.length > max && (
        <span className="w-5 h-5 rounded-full bg-[var(--surface-subtle)] border-2 border-[var(--surface)] flex items-center justify-center text-[9px] font-bold text-[var(--text-soft)]">
          +{avatars.length - max}
        </span>
      )}
    </div>
  );
}

/* ────────────────────── Kitchen Dot Strip ─────────────────────────────── */

function KitchenDotStrip({
  pending,
  cooking,
  ready,
  max = 5,
}: {
  pending: number;
  cooking: number;
  ready: number;
  max?: number;
}) {
  // Build a flat list of dots in priority order (pending → cooking → ready).
  // The cooking ones get a soft pulse, the ready ones are solid emerald.
  const dots: Array<"pending" | "cooking" | "ready"> = [];
  for (let i = 0; i < pending; i++) dots.push("pending");
  for (let i = 0; i < cooking; i++) dots.push("cooking");
  for (let i = 0; i < ready; i++) dots.push("ready");
  const visible = dots.slice(0, max);
  const overflow = dots.length - visible.length;
  if (visible.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0">
      {visible.map((s, i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full"
          style={{
            background:
              s === "ready"
                ? "#5FA341"
                : s === "cooking"
                  ? "#D89B35"
                  : "#C28A2F",
            animation: s === "cooking" ? "dock-cook-pulse 1.6s ease-in-out infinite" : undefined,
          }}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-bold text-[var(--text-soft)] ms-0.5">
          +{overflow}
        </span>
      )}
    </span>
  );
}
