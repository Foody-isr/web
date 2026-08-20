"use client";

import { useState } from "react";
import Link from "next/link";
import { initPayment } from "@/services/api";
import type { CheckoutConfig, ConfirmationConfig, OrderResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { ConfirmationActions, ConfirmationFAQList, ConfirmationHeader, DEFAULT_CONFIRMATION_CONFIG } from "@/components/ConfirmationActions";
import { ConfirmationDeliveryCard } from "@/components/ConfirmationDeliveryCard";
import { InstallPrompt } from "@/components/InstallPrompt";

type Props = {
  order: OrderResponse;
  orderId: string;
  restaurantId: string;
  tableId?: string;
  sessionId?: string;
  menuHref?: string;
  receiptToken?: string;
  // Owner-configured post-order layout. When null falls back to a default
  // set of action buttons that mirrors what foodyweb showed historically
  // (track, receipt, new order) so the page is useful out of the box.
  confirmationConfig?: ConfirmationConfig | null;
  /** The whole checkout form, so the answers the customer gave to its
   *  custom fields can be labelled back to them. */
  checkoutConfig?: CheckoutConfig | null;
  // Used by the "add to home screen" prompt below. Empty name suppresses it.
  restaurantName?: string;
  logoUrl?: string;
};

/**
 * ConfirmationPageClient renders the post-order "thank you" page.
 *
 * It is the page users land on after their order is created. It deliberately
 * does NOT show the live order-status timeline — that lives at the separate
 * /order/tracking/[orderId] route and is reachable via the configurable
 * "track_order" action button below.
 */
export function ConfirmationPageClient({
  order,
  orderId,
  restaurantId,
  tableId,
  sessionId,
  menuHref,
  receiptToken,
  confirmationConfig,
  checkoutConfig,
  restaurantName,
  logoUrl,
}: Props) {
  const { t } = useI18n();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Use the owner's config when present; otherwise the default keeps the page
  // usable for restaurants that haven't customised anything yet.
  const config = confirmationConfig ?? DEFAULT_CONFIRMATION_CONFIG;

  const paymentNeeded =
    order.paymentStatus === "pending" ||
    (order.paymentStatus === "unpaid" &&
      (order.orderType === "pickup" || order.orderType === "delivery"));

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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("failedToInitPayment");
      setPaymentError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 space-y-6 max-w-lg mx-auto">
      <div>
        <p className="text-sm text-[var(--text-muted)] mb-1">
          {t("order")} #{orderId}
        </p>
        <ConfirmationHeader
          config={confirmationConfig}
          fallbackTitle={t("orderConfirmedTitle") || "Merci pour votre commande"}
          fallbackSubtitle={t("orderConfirmedSubtitle") || `${order.currency} ${order.total.toFixed(2)}`}
        />
      </div>

      {/* Small order recap card — sized down vs the full tracker so this page
          stays focused on "what next" rather than the order status timeline. */}
      <div className="card p-4 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">{t("total")}</span>
          <span className="font-semibold">
            {order.currency} {order.total.toFixed(2)}
          </span>
        </div>
        {tableId && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">{t("table")}</span>
            <span className="font-medium">{tableId}</span>
          </div>
        )}
      </div>

      {/* What the customer typed at checkout, read back so a mistyped
          address or building code can be caught while it still matters. */}
      <CustomerInfoCard order={order} checkoutConfig={checkoutConfig} />

      {/* "Add to home screen" nudge — shown at peak intent, right after the
          order is confirmed. The component itself decides visibility (renders
          nothing when already installed, when the platform can't install, or
          once dismissed). Do NOT gate on restaurantName — some restaurants have
          no name and the prompt must still show. */}
      <InstallPrompt
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
      />

      {/* Courier / ETA info for delivery orders. Renders nothing until the
          backend populates external_metadata.delivery. */}
      <ConfirmationDeliveryCard delivery={order.delivery} orderType={order.orderType} />

      {paymentNeeded && (
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

      <ConfirmationActions
        config={config}
        ctx={{ orderId, restaurantId, tableId, sessionId, receiptToken, menuHref }}
      />

      <ConfirmationFAQList config={config} />

      {/* Subtle escape hatch for users who want to see all their past orders. */}
      <div className="text-center pt-2">
        <Link
          href="/orders"
          className="text-sm text-[var(--text-muted)] hover:text-brand hover:underline transition"
        >
          {t("viewPastOrders")}
        </Link>
      </div>
    </main>
  );
}
