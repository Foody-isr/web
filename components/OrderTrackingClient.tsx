"use client";

import Link from "next/link";
import { useState } from "react";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import { OrderReadyPopup } from "@/components/OrderReadyPopup";
import { OrderResponse } from "@/lib/types";
import { initPayment } from "@/services/api";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const status = useOrderStatus(orderId, restaurantId, order.orderStatus);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentStatusKey: Record<string, string> = {
    paid: "paymentPaid",
    unpaid: "paymentUnpaid",
    pending: "paymentPending",
    refunded: "paymentRefunded",
  };
  const paymentLabel = t(paymentStatusKey[order.paymentStatus] ?? "paymentUnpaid");
  const paymentColor =
    order.paymentStatus === "paid"
      ? "text-green-600"
      : order.paymentStatus === "refunded"
      ? "text-ink-muted"
      : "text-amber-500";

  const handlePayNow = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await initPayment(orderId, restaurantId);
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setPaymentError(t("paymentServiceUnavailable"));
      }
    } catch (error: any) {
      setPaymentError(error.message || t("failedToInitPayment"));
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-ink-muted">
            {t("order")} #{orderId}
          </p>
          {menuHref && (
            <Link
              href={menuHref}
              className="px-3 py-1.5 rounded-full border border-light-divider text-xs font-medium hover:border-brand hover:text-brand transition"
            >
              {t("backToMenu")}
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-bold">{t("trackYourOrder")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          {tableId ? `${t("table")} ${tableId} · ` : ""}
          {order.currency} {order.total.toFixed(2)}
        </p>
      </header>

      {/* Timeline */}
      <OrderStatusTimeline
        status={status}
        orderType={order.orderType}
        serviceMode={serviceMode}
        paymentStatus={order.paymentStatus}
      />

      {/* Popup when order becomes ready */}
      <OrderReadyPopup status={status} orderId={orderId} />

      {/* Payment status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-ink-muted">{t("paymentLabel")}:</span>
        <span className={`font-medium ${paymentColor}`}>{paymentLabel}</span>
      </div>

      {/* Pay Now Button */}
      {(order.paymentStatus === "pending" ||
        (order.paymentStatus === "unpaid" &&
          order.orderType === "dine_in" &&
          (status === "served" || status === "received")) ||
        (order.paymentStatus === "unpaid" &&
          (order.orderType === "pickup" || order.orderType === "delivery"))) && (
        <div className="space-y-2">
          <button
            onClick={handlePayNow}
            disabled={paymentLoading}
            className="w-full py-4 rounded-xl bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {paymentLoading ? t("processing") : t("payNow")}
          </button>
          {paymentError && (
            <p className="text-sm text-red-500 text-center">{paymentError}</p>
          )}
        </div>
      )}

      {/* Receipt & Order History Links */}
      <div className="flex flex-col gap-3 pt-1">
        {receiptToken && (
          <Link
            href={`/receipt/${receiptToken}`}
            className="card p-4 text-center hover:shadow-lg transition"
          >
            <span className="text-brand font-medium">{t("viewReceipt")}</span>
          </Link>
        )}
        <div className="text-center">
          <Link
            href="/orders"
            className="text-sm text-ink-muted hover:text-brand hover:underline transition"
          >
            {t("viewPastOrders")}
          </Link>
        </div>
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
