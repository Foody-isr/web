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

/**
 * Watches all dine-in orders for status changes via WebSocket (through useTableSession).
 * Shows a full-screen popup when any order transitions to a "ready" status.
 * Renders at the page level — works even when TableDrawer is closed.
 */
export function DineInOrderReadyPopup() {
  const orders = useTableSession((s) => s.orders);
  const guestId = useTableSession((s) => s.guestId);
  const prevStatusMapRef = useRef<Record<number, OrderStatus>>({});
  const [readyOrder, setReadyOrder] = useState<{
    id: number;
    status: OrderStatus;
  } | null>(null);

  useEffect(() => {
    const prev = prevStatusMapRef.current;

    // Build new status map and detect transitions
    const newMap: Record<number, OrderStatus> = {};
    for (const order of orders) {
      newMap[order.id] = order.status;

      const oldStatus = prev[order.id];
      // Only fire if we had a previous status and it changed to a ready status
      if (oldStatus && oldStatus !== order.status && READY_STATUSES.includes(order.status)) {
        // Only alert for the current guest's orders (or all if no guestId)
        if (!guestId || order.guest_id === guestId) {
          setReadyOrder({ id: order.id, status: order.status });
        }
      }
    }

    prevStatusMapRef.current = newMap;
  }, [orders, guestId]);

  if (!readyOrder) return null;

  const info = statusInfo(readyOrder.status);

  return (
    <AnimatePresence>
      {readyOrder && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setReadyOrder(null)}
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
            <p className="text-gray-600 mb-1">{info.subtitle}</p>
            <p className="text-sm text-gray-400 mb-6">Order #{readyOrder.id}</p>
            <button
              onClick={() => setReadyOrder(null)}
              className="w-full py-3 rounded-xl bg-brand text-white font-bold text-lg shadow-lg shadow-brand/30 hover:bg-brand-dark transition active:scale-95"
            >
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function statusInfo(status: OrderStatus) {
  switch (status) {
    case "ready":
    case "ready_for_pickup":
      return {
        emoji: "🎉",
        title: "Your order is ready!",
        subtitle: "Please pick it up at the counter.",
      };
    case "ready_for_delivery":
      return {
        emoji: "📦",
        title: "Your order is ready!",
        subtitle: "It will be delivered to you soon.",
      };
    case "out_for_delivery":
      return {
        emoji: "🛵",
        title: "On its way!",
        subtitle: "Your order is out for delivery.",
      };
    case "served":
      return {
        emoji: "🍽️",
        title: "Order served!",
        subtitle: "Enjoy your meal!",
      };
    default:
      return {
        emoji: "✅",
        title: "Order updated",
        subtitle: "Your order status has changed.",
      };
  }
}
