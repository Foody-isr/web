"use client";

import { useEffect, useState, useRef } from "react";
import { OrderStatus, OrderType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

const READY_STATUSES: OrderStatus[] = [
  "ready",
  "ready_for_pickup",
  "ready_for_delivery",
  "out_for_delivery",
  "served",
];

type Props = {
  /** Current order status (from WebSocket). */
  status?: OrderStatus;
  /** Optional order ID to display. */
  orderId?: string;
  orderType?: OrderType;
  serviceMode?: string;
};

/**
 * Full-screen popup that fires when an order transitions to a "ready" status.
 * Uses the existing WebSocket-driven status — no push notifications needed.
 * Dismisses on user tap / OK button.
 */
export function OrderReadyPopup({ status, orderId, orderType, serviceMode }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const prevStatusRef = useRef<OrderStatus | undefined | null>(null);

  useEffect(() => {
    prevStatusRef.current = null;
    setVisible(false);
  }, [orderId]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // Only show popup when transitioning INTO a ready status (not on initial load)
    if (prev && status && prev !== status && READY_STATUSES.includes(status)) {
      setVisible(true);
    }
  }, [status]);

  if (!visible || !status) return null;

  const info = statusInfo(status, orderType, serviceMode);

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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t(info.title)}</h2>
            <p className="text-gray-600 mb-1">{t(info.subtitle)}</p>
            {orderId && (
              <p className="text-sm text-gray-400 mb-6">{t("order")} #{orderId}</p>
            )}
            <button
              onClick={() => setVisible(false)}
              className="w-full py-3 rounded-xl bg-brand text-white font-bold text-lg shadow-lg shadow-brand/30 hover:bg-brand-dark transition active:scale-95"
            >
              {t("close")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function statusInfo(status: OrderStatus, orderType?: OrderType, serviceMode?: string) {
  switch (status) {
    case "ready":
    case "ready_for_pickup":
      return {
        emoji: "🎉", title: "statusReady",
        subtitle: orderType === "dine_in" && serviceMode !== "counter" ? "descReadyToBeServed" : "descReadyForPickup",
      };
    case "ready_for_delivery":
      return { emoji: "📦", title: "statusReadyForDelivery", subtitle: "descReadyForDelivery" };
    case "out_for_delivery":
      return { emoji: "🛵", title: "statusOnTheWay", subtitle: "descOutForDelivery" };
    case "served":
      return orderType === "pickup" || serviceMode === "counter"
        ? { emoji: "✅", title: "statusPickedUp", subtitle: "descCollectedByCustomer" }
        : { emoji: "🍽️", title: "statusServed", subtitle: "descDeliveredToTable" };
    default:
      return { emoji: "✅", title: "trackYourOrder", subtitle: "orderProgressUnknown" };
  }
}
