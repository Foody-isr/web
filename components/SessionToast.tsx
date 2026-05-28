"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { OrderStatus } from "@/lib/types";
import { useTableSession } from "@/store/useTableSession";

/** Statuses that already trigger the full-screen DineInOrderReadyPopup —
 *  the toast must NOT fire for these to avoid double-notifying. */
const POPUP_OWNED_STATUSES: Set<OrderStatus> = new Set([
  "ready",
  "ready_for_delivery",
  "out_for_delivery",
  "served",
]);

/** Statuses worth a toast — intermediate, "your order is progressing" signals. */
const TOAST_STATUSES: Partial<Record<OrderStatus, { emoji: string; key: string }>> = {
  accepted: { emoji: "✅", key: "statusToastAccepted" },
  in_kitchen: { emoji: "🔥", key: "statusToastInKitchen" },
};

type Toast = {
  id: number;
  orderId: number;
  emoji: string;
  label: string;
};

/**
 * Lightweight toast for own-order intermediate status changes. The heavier
 * "ready" transitions are still handled by DineInOrderReadyPopup. This sits
 * between "nothing" and "full-screen popup" — a low-friction signal that
 * the kitchen has acknowledged you.
 */
export function SessionToast() {
  const { t, direction } = useI18n();
  const orders = useTableSession((s) => s.orders);
  const guestId = useTableSession((s) => s.guestId);
  const sessionStatus = useTableSession((s) => s.status);

  // Per-order previous status snapshot so we can detect transitions.
  const prevStatusRef = useRef<Record<number, OrderStatus>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  useEffect(() => {
    if (sessionStatus !== "active") return;

    const prev = prevStatusRef.current;
    const next: Record<number, OrderStatus> = {};
    const newToasts: Toast[] = [];

    for (const order of orders) {
      next[order.id] = order.status;
      const old = prev[order.id];
      // Only my orders, only intermediate transitions, only when we had a prior snapshot.
      if (
        old &&
        old !== order.status &&
        order.guest_id === guestId &&
        !POPUP_OWNED_STATUSES.has(order.status) &&
        TOAST_STATUSES[order.status]
      ) {
        const meta = TOAST_STATUSES[order.status]!;
        toastIdRef.current += 1;
        newToasts.push({
          id: toastIdRef.current,
          orderId: order.id,
          emoji: meta.emoji,
          label: t(meta.key) || meta.key,
        });
      }
    }

    prevStatusRef.current = next;

    if (newToasts.length > 0) {
      setToasts((curr) => [...curr, ...newToasts]);
      // Auto-dismiss each toast after 3.5s.
      for (const toast of newToasts) {
        setTimeout(() => {
          setToasts((curr) => curr.filter((x) => x.id !== toast.id));
        }, 3500);
      }
    }
  }, [orders, guestId, sessionStatus, t]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 inset-x-0 z-[150] flex flex-col items-center gap-2 pointer-events-none px-4"
      dir={direction}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--surface-elevated,var(--surface))] shadow-lg border border-[var(--divider)] max-w-sm w-fit"
          >
            <span className="text-xl leading-none">{toast.emoji}</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {toast.label}
            </span>
            <span className="text-xs text-[var(--text-soft)]">#{toast.orderId}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
