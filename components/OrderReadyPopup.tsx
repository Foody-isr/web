"use client";

import { useEffect, useState, useRef } from "react";
import { OrderStatus } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const READY_STATUSES: OrderStatus[] = [
  "ready",
  "ready_for_pickup",
  "ready_for_delivery",
  "out_for_delivery",
  "served",
];

type Props = {
  /** Current order status (from WebSocket). */
  status: OrderStatus;
  /** Optional order ID to display. */
  orderId?: string;
};

/**
 * Full-screen popup that fires when an order transitions to a "ready" status.
 * Uses the existing WebSocket-driven status — no push notifications needed.
 * Dismisses on user tap / OK button.
 */
export function OrderReadyPopup({ status, orderId }: Props) {
  const [visible, setVisible] = useState(false);
  const prevStatusRef = useRef<OrderStatus | null>(null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // Only show popup when transitioning INTO a ready status (not on initial load)
    if (prev && prev !== status && READY_STATUSES.includes(status)) {
      setVisible(true);
    }
  }, [status]);

  if (!visible) return null;

  const info = statusInfo(status);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setVisible(false)}
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
            {orderId && (
              <p className="text-sm text-gray-400 mb-6">Order #{orderId}</p>
            )}
            <button
              onClick={() => setVisible(false)}
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
