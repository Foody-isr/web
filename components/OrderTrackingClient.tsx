"use client";

import Link from "next/link";
import { useState } from "react";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import { PushNotificationBanner } from "@/components/PushNotificationBanner";
import { OrderResponse } from "@/lib/types";
import { initPayment } from "@/services/api";

type Props = {
  order: OrderResponse;
  orderId: string;
  restaurantId: string;
  tableId?: string;
  menuHref?: string;
  receiptToken?: string;
  showWsHint?: boolean;
  serviceMode?: string;
};

export function OrderTrackingClient({
  order,
  orderId,
  restaurantId,
  tableId,
  menuHref,
  receiptToken,
  showWsHint,
  serviceMode,
}: Props) {
  const status = useOrderStatus(orderId, restaurantId, order.orderStatus);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const paymentLabel = {
    paid: "Paid",
    unpaid: "Unpaid",
    pending: "Pending",
    refunded: "Refunded"
  }[order.paymentStatus] ?? "Unpaid";
  const paymentColor =
    order.paymentStatus === "paid" ? "text-success" : "text-warning";

  const handlePayNow = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await initPayment(orderId, restaurantId);
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setPaymentError("Payment service unavailable. Please try again later.");
      }
    } catch (error: any) {
      setPaymentError(error.message || "Failed to initialize payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">Order {orderId}</p>
          <h1 className="text-2xl font-bold">Track your order</h1>
          <p className="text-sm text-ink-muted">
            {tableId ? `Table ${tableId} · ` : ""}
            {order.currency} {order.total.toFixed(2)}
          </p>
        </div>
        {menuHref && (
          <Link
            href={menuHref}
            className="px-4 py-2 rounded-button border border-light-divider text-sm hover:border-brand bg-light-surface transition font-medium"
          >
            Back to menu
          </Link>
        )}
      </header>
      <OrderStatusTimeline status={status} orderType={order.orderType} serviceMode={serviceMode} />

      {/* Push notification opt-in banner */}
      <PushNotificationBanner orderId={orderId} restaurantId={restaurantId} />

      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="font-bold">Payment:</span>
        <span className={paymentColor}>{paymentLabel}</span>
      </div>

      {/* Pay Now Button for pending payments */}
      {order.paymentStatus === "pending" && (
        <div className="space-y-2">
          <button
            onClick={handlePayNow}
            disabled={paymentLoading}
            className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition disabled:opacity-50"
          >
            {paymentLoading ? "Processing..." : "💳 Pay Now"}
          </button>
          {paymentError && (
            <p className="text-sm text-red-500 text-center">{paymentError}</p>
          )}
        </div>
      )}
      
      {/* Receipt Link */}
      {receiptToken && (
        <Link
          href={`/receipt/${receiptToken}`}
          className="block card p-4 text-center hover:shadow-lg transition"
        >
          <span className="text-brand font-medium">🧾 View Receipt</span>
        </Link>
      )}

      {/* Order History Link */}
      <div className="text-center">
        <Link
          href="/orders"
          className="text-sm text-ink-muted hover:text-brand hover:underline"
        >
          📋 View Past Orders
        </Link>
      </div>
      
      {showWsHint && (
        <div className="card p-4 text-sm text-ink-muted">
          WebSocket endpoint: <code className="bg-light-subtle px-1 py-0.5 rounded">/ws?restaurant_id={restaurantId}&amp;order_id={orderId}</code>{" "}
          (requires auth). The UI listens for payloads like{" "}
          <code className="bg-light-subtle px-1 py-0.5 rounded">{`{ "payload": { "status": "in_kitchen" } }`}</code>.
        </div>
      )}
    </main>
  );
}
