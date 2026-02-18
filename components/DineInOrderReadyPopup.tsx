"use client";

import { useEffect, useRef, useState } from "react";
import { useTableSession } from "@/store/useTableSession";
import { OrderStatus } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const READY_STATUSES: OrderStatus[] = [
  "ready",
  "ready_for_pickup",
  "ready_for_delivery",
  "out_for_delivery",
  "served",
];

type ReadyEntry = { id: number; status: OrderStatus };

/**
 * Watches all dine-in orders for status changes via WebSocket (through useTableSession).
 * Shows a single popup listing ALL orders that just became ready — handles
 * multiple orders transitioning at the same time gracefully.
 * Renders at the page level — works even when TableDrawer is closed.
 */
export function DineInOrderReadyPopup() {
  const orders = useTableSession((s) => s.orders);
  const guestId = useTableSession((s) => s.guestId);
  const prevStatusMapRef = useRef<Record<number, OrderStatus>>({});
  const [readyOrders, setReadyOrders] = useState<ReadyEntry[]>([]);

  useEffect(() => {
    const prev = prevStatusMapRef.current;

    // Build new status map and detect transitions
    const newMap: Record<number, OrderStatus> = {};
    const newlyReady: ReadyEntry[] = [];

    for (const order of orders) {
      newMap[order.id] = order.status;

      const oldStatus = prev[order.id];
      // Only fire if we had a previous status and it changed to a ready status
      if (oldStatus && oldStatus !== order.status && READY_STATUSES.includes(order.status)) {
        // Only alert for the current guest's orders (or all if no guestId)
        if (!guestId || order.guest_id === guestId) {
          newlyReady.push({ id: order.id, status: order.status });
        }
      }
    }

    prevStatusMapRef.current = newMap;

    if (newlyReady.length > 0) {
      // Merge with any already-visible ready orders (in case popup is still open)
      setReadyOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const merged = [...prev];
        for (const entry of newlyReady) {
          if (!existingIds.has(entry.id)) merged.push(entry);
        }
        return merged;
      });
    }
  }, [orders, guestId]);

  const dismiss = () => setReadyOrders([]);

  if (readyOrders.length === 0) return null;

  // Pick the "highest priority" status for the main emoji/title
  const primaryStatus = pickPrimaryStatus(readyOrders);
  const info = statusInfo(primaryStatus, readyOrders.length);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <motion.div
          className="mx-6 w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-6xl mb-4">{info.emoji}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{info.title}</h2>
          <p className="text-gray-600 mb-2">{info.subtitle}</p>

          {/* List all ready order IDs */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {readyOrders.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium"
              >
                {statusEmoji(o.status)} #{o.id}
              </span>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl bg-brand text-white font-bold text-lg shadow-lg shadow-brand/30 hover:bg-brand-dark transition active:scale-95"
          >
            OK
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Pick the most relevant status when multiple orders are ready at once. */
function pickPrimaryStatus(entries: ReadyEntry[]): OrderStatus {
  // Priority: out_for_delivery > ready_for_delivery > ready/ready_for_pickup > served
  const priority: OrderStatus[] = ["out_for_delivery", "ready_for_delivery", "ready", "ready_for_pickup", "served"];
  for (const s of priority) {
    if (entries.some((e) => e.status === s)) return s;
  }
  return entries[0].status;
}

function statusEmoji(status: OrderStatus): string {
  switch (status) {
    case "ready":
    case "ready_for_pickup":
      return "🎉";
    case "ready_for_delivery":
      return "📦";
    case "out_for_delivery":
      return "🛵";
    case "served":
      return "🍽️";
    default:
      return "✅";
  }
}

function statusInfo(status: OrderStatus, count: number) {
  const plural = count > 1;
  switch (status) {
    case "ready":
    case "ready_for_pickup":
      return {
        emoji: "🎉",
        title: plural ? `${count} orders are ready!` : "Your order is ready!",
        subtitle: "Please pick up at the counter.",
      };
    case "ready_for_delivery":
      return {
        emoji: "📦",
        title: plural ? `${count} orders are ready!` : "Your order is ready!",
        subtitle: plural ? "They will be delivered soon." : "It will be delivered to you soon.",
      };
    case "out_for_delivery":
      return {
        emoji: "🛵",
        title: plural ? `${count} orders on the way!` : "On its way!",
        subtitle: plural ? "Your orders are out for delivery." : "Your order is out for delivery.",
      };
    case "served":
      return {
        emoji: "🍽️",
        title: plural ? `${count} orders served!` : "Order served!",
        subtitle: "Enjoy your meal!",
      };
    default:
      return {
        emoji: "✅",
        title: plural ? `${count} orders updated` : "Order updated",
        subtitle: "Your order status has changed.",
      };
  }
}
