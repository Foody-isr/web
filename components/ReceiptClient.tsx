"use client";

import { ReceiptData } from "@/services/api";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

type Props = {
  receipt: ReceiptData;
};

const orderTypeEmoji: Record<string, string> = {
  dine_in: "🍽️",
  pickup: "🛍️",
  delivery: "🚗",
};

const orderStatusColors: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  in_kitchen: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  served: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-purple-100 text-purple-800",
};

export function ReceiptClient({ receipt }: Props) {
  const { t, direction } = useI18n();
  const { order, restaurant, items } = receipt;

  const formattedDate = new Date(order.created_at).toLocaleString(
    direction === "rtl" ? "he-IL" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const orderTypeLabelMap: Record<string, string> = {
    dine_in: t("dineIn"),
    pickup: t("pickup"),
    delivery: t("delivery"),
  };
  const orderTypeLabel = orderTypeLabelMap[order.order_type] || order.order_type;

  return (
    <main className="min-h-screen bg-light-surface py-8 px-4" dir={direction}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto"
      >
        {/* Header Card */}
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            {restaurant.logo_url && (
              <Image
                src={restaurant.logo_url}
                alt={restaurant.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-xl object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">{restaurant.name}</h1>
              <p className="text-sm text-ink-muted">{restaurant.address}</p>
              {restaurant.phone && (
                <p className="text-sm text-ink-muted">{restaurant.phone}</p>
              )}
            </div>
          </div>

          <div className="border-t border-light-divider pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-muted">{t("order")} #</span>
              <span className="font-mono font-bold">{order.id}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-muted">{t("date")}</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink-muted">{t("type")}</span>
              <span>
                {orderTypeEmoji[order.order_type] || "📦"} {orderTypeLabel}
              </span>
            </div>
            {order.table_code && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-ink-muted">{t("table")}</span>
                <span className="font-mono">{order.table_code}</span>
              </div>
            )}
            {order.customer_name && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-ink-muted">{t("name")}</span>
                <span>{order.customer_name}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                orderStatusColors[order.order_status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {order.order_status.replace("_", " ")}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                paymentStatusColors[order.payment_status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {order.payment_status}
            </span>
          </div>
        </div>

        {/* Items Card */}
        <div className="card p-6 mb-4">
          <h2 className="font-bold text-lg mb-4">{t("items")}</h2>
          
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border-b border-light-divider pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">
                      {item.quantity}× {item.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.modifiers.map((mod, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-light-surface-2 text-ink-muted"
                          >
                            {mod.action === "add" ? "+" : "-"}{mod.name}
                            {mod.price_delta !== 0 && (
                              <> ({mod.price_delta > 0 ? "+" : ""}{mod.price_delta.toFixed(2)})</>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-ink-muted mt-1 italic">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium">₪{item.total.toFixed(2)}</p>
                    {item.quantity > 1 && (
                      <p className="text-xs text-ink-muted">₪{item.unit_price.toFixed(2)} each</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-light-divider mt-4 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">{t("total")}</span>
              <span className="text-2xl font-bold text-brand">
                ₪{order.total_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-ink-muted space-y-2">
          <p>🍕 Thank you for ordering with Foody!</p>
          <p className="text-xs">
            Receipt #{order.receipt_token.substring(0, 8)}...
          </p>
        </div>

        {/* Print Button */}
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand-dark transition"
          >
            🖨️ {t("print") || "Print Receipt"}
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Receipt #${order.id}`,
                  text: `Order from ${restaurant.name}`,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
              }
            }}
            className="px-6 py-3 bg-light-surface-2 text-ink rounded-xl font-medium hover:bg-light-divider transition"
          >
            🔗 {t("share") || "Share"}
          </button>
        </div>

        {/* Order History Link */}
        <div className="mt-4 text-center">
          <Link
            href="/orders"
            className="text-sm text-brand hover:underline"
          >
            📋 {t("orderHistory") || "View All Orders"}
          </Link>
        </div>
      </motion.div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .card {
            box-shadow: none;
            border: 1px solid #e5e7eb;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
