"use client";
import { LifecycleFacts } from "@/components/OrderLifecycleFacts";
import { formatLifecycleV2Money } from "@/lib/order-lifecycle-v2";
import { orderCollectionAllowed } from "@/lib/order-tracking";
import { trackedOperationalStatus } from "@/lib/order-timeline";
import { OrderDeliveryPromise } from "@/components/OrderDeliveryPromise";

import Link from "next/link";
import { receiptHref } from "@/lib/receipt";
import { useState } from "react";
import dynamic from "next/dynamic";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { useOrderTracking } from "@/hooks/useOrderStatus";
import { useCourierTracking } from "@/hooks/useCourierTracking";
import { OrderReadyPopup } from "@/components/OrderReadyPopup";
import { OrderResponse } from "@/lib/types";
import { initPayment } from "@/services/api";
import { useI18n } from "@/lib/i18n";

const CourierTrackingMap = dynamic(
  () => import("@/components/CourierTrackingMap"),
  { ssr: false },
);

type Props = {
  order: OrderResponse;
  orderId: string;
  restaurantId: string;
  tableId?: string;
  menuHref?: string;
  receiptToken?: string;
  pageSlug?: string;
  showWsHint?: boolean;
  serviceMode?: string;
};

export function OrderTrackingClient({
  order: initialOrder,
  orderId,
  restaurantId,
  tableId,
  menuHref,
  receiptToken,
  pageSlug,
  showWsHint,
  serviceMode,
}: Props) {
  const { t, locale } = useI18n();
  const { order, refreshFailed, refreshing, retry } = useOrderTracking(orderId, restaurantId, receiptToken, initialOrder);
  const status = order.orderStatus;
  const lifecycleV2 = order.lifecycleV2?.kind === "available" ? order.lifecycleV2.value : undefined;
  const lifecycleUnavailable = order.lifecycleV2?.kind === "unavailable" || !lifecycleV2 && order.lifecycle?.kind === "unavailable";
  const lifecycle = order.lifecycle?.kind === "available" ? order.lifecycle.value : undefined;
  const paymentStatus = lifecycleUnavailable ? "unknown" : lifecycleV2?.payment.state ?? lifecycle?.payment.state ?? order.paymentStatus;
  const collectionAllowed = orderCollectionAllowed(order.lifecycle, order.lifecycleV2);
  const operationalStatus = trackedOperationalStatus(status, order.orderType, order.lifecycle, order.lifecycleV2);
  const isDelivery = order.orderType === "delivery";
  const outForDelivery = operationalStatus === "out_for_delivery";
  const tracking = useCourierTracking(orderId, restaurantId, receiptToken, isDelivery && outForDelivery);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentStatusKey: Record<string, string> = {
    paid: "paymentPaid",
    authorized: "paymentAuthorized",
    partially_paid: "paymentPartiallyPaid",
    partially_refunded: "paymentPartiallyRefunded",
    unpaid: "paymentUnpaid",
    pending: "paymentPending",
    refunded: "paymentRefunded",
  };
  const paymentLabel = t(paymentStatusKey[paymentStatus] ?? "paymentUnknown");
  const paymentColor =
    paymentStatus === "paid"
      ? "text-green-600"
      : paymentStatus === "refunded"
      ? "text-ink-muted"
      : "text-amber-500";

  const handlePayNow = async () => {
    if (!collectionAllowed || refreshFailed || lifecycleUnavailable || paymentStatus === "unknown" || paymentStatus === "mixed") return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await initPayment(orderId, restaurantId, receiptToken);
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
          {lifecycleV2 ? formatLifecycleV2Money(lifecycleV2.payment.amounts, "total_minor", locale) ?? t("lifecycleV2AmountUnknown") : lifecycleUnavailable ? t("lifecycleV2AmountUnknown") : `${order.currency} ${order.total.toFixed(2)}`}
        </p>
      </header>

      {/* Courier map — shown while delivery is out_for_delivery and position is known */}
      {tracking && (
        <CourierTrackingMap
          tracking={tracking}
          restaurantId={restaurantId}
          courierPhone={order.delivery?.courierPhone}
          className="mb-4"
        />
      )}

      <OrderDeliveryPromise order={order} restaurantId={restaurantId} receiptToken={receiptToken} />
      {(refreshFailed || lifecycleUnavailable) && (
        <div role="status" className="card p-4 text-sm text-ink-muted space-y-2">
          <p>{t("orderRefreshFailed")}</p>
          <button type="button" onClick={retry} disabled={refreshing} className="font-semibold text-brand underline disabled:opacity-50">
            {t("orderRefreshRetry")}
          </button>
        </div>
      )}
      {/* Timeline */}
      <OrderStatusTimeline
        status={status}
        orderType={order.orderType}
        serviceMode={serviceMode}
        scheduledFor={order.scheduledFor}
        lifecycle={order.lifecycle}
        lifecycleV2={order.lifecycleV2}
      />

      {/* Popup when order becomes ready */}
      <OrderReadyPopup status={operationalStatus} orderId={orderId} orderType={order.orderType} serviceMode={serviceMode} />

      {/* Payment status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-ink-muted">{t("paymentLabel")}:</span>
        <span className={`font-medium ${paymentColor}`}>{paymentLabel}</span>
      </div>

      {lifecycleV2 && <LifecycleFacts value={lifecycleV2} />}

      {/* Pay Now Button */}
      {collectionAllowed && !refreshFailed && !lifecycleUnavailable && (paymentStatus === "pending" ||
        ((paymentStatus === "unpaid" || paymentStatus === "partially_paid") &&
          order.orderType === "dine_in" &&
          ((order.lifecycleV2?.kind === "available" ? operationalStatus : status) === "served" || (order.lifecycleV2?.kind === "available" ? operationalStatus : status) === "received")) ||
        ((paymentStatus === "unpaid" || paymentStatus === "partially_paid") &&
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
            href={receiptHref(receiptToken, pageSlug)}
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
          WebSocket endpoint: <code className="bg-light-subtle px-1 py-0.5 rounded">/ws/guest?restaurant_id={restaurantId}&amp;order_id={orderId}</code>{" "}
          (requires the order receipt token via WebSocket subprotocol). The UI listens for payloads like{" "}
          <code className="bg-light-subtle px-1 py-0.5 rounded">{`{ "payload": { "status": "in_kitchen" } }`}</code>.
        </div>
      )}
    </main>
  );
}
