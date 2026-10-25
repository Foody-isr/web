"use client";

import { Suspense, useEffect, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowPathIcon, PhoneIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useI18n, useCurrency } from "@/lib/i18n";
import { fetchOrder, fetchRestaurant, initPayment } from "@/services/api";
import { PaymentReturnFrame } from "@/components/PaymentReturnFrame";
import { recalledOrderPage } from "@/lib/order-page-context";
import type { OrderResponse, Restaurant } from "@/lib/types";

function PaymentFailedLoading() {
  const { t, direction } = useI18n();
  return (
    <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6 text-[var(--text)]" dir={direction}>
      <p role="status" className="flex items-center gap-3">
        <ArrowPathIcon className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />
        {t("loading")}
      </p>
    </main>
  );
}

function PaymentFailedContent({ params }: { params: { restaurantId: string } }) {
  const { money } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const orderId = searchParams.get("orderId");
  const errorMessage = searchParams.get("error") || searchParams.get("errorMessage");
  const token = searchParams.get("t");
  const requestedPage = searchParams.get("pageSlug");
  const restaurantId = params.restaurantId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(null);
  const [pageSlug, setPageSlug] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setOrderData(null);
    setRestaurantData(null);
    setPageSlug("");
    const loadOrderData = async () => {
      if (!orderId || !restaurantId) {
        setError(t("invalidOrderId"));
        setLoading(false);
        return;
      }

      try {
        // Route aliases remain in navigation; order/payment APIs use numeric scope.
        const restaurant = await fetchRestaurant(restaurantId);
        if (controller.signal.aborted) return;
        setRestaurantData(restaurant);
        setPageSlug(requestedPage || recalledOrderPage(String(restaurant.id), orderId) || "");
        const order = await fetchOrder(orderId, String(restaurant.id), token ?? undefined, controller.signal);
        if (controller.signal.aborted) return;
        setOrderData(order);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t("unableToLoadOrder"));
        setLoading(false);
      }
    };

    void loadOrderData();
    return () => controller.abort();
  }, [orderId, restaurantId, requestedPage, t, token]);

  const handleRetryPayment = async () => {
    if (!orderId || !restaurantData || retrying) return;
    setRetrying(true);
    setRetryError(null);

    try {
      const data = await initPayment(orderId, String(restaurantData.id), token ?? undefined);
      if (!data.paymentUrl) throw new Error(t("noPaymentUrl"));
      window.location.href = data.paymentUrl;
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : t("failedToRetryPayment"));
      setRetrying(false);
    }
  };

  const confirmCancelOrder = () => {
    const tableCode = orderData?.tableCode;
    const sessionId = orderData?.sessionId;
    if (tableCode) {
      router.push(`/r/${restaurantId}/table/${tableCode}${sessionId ? `?sessionId=${sessionId}` : ""}`);
    } else {
      router.push(`/r/${restaurantId}`);
    }
  };

  if (loading) return <PaymentFailedLoading />;

  if (error || !orderData) {
    return (
      <PaymentReturnFrame restaurant={restaurantData} pageSlug={pageSlug}>
        <section className="space-y-6" aria-labelledby="payment-error-title">
          <XCircleIcon className="h-12 w-12 text-[var(--error)]" aria-hidden="true" />
          <h1 id="payment-error-title" className="text-2xl font-semibold">{t("orderNotFound")}</h1>
          <p role="alert" className="text-[var(--text-muted)]">{error || t("unableToLoadOrder")}</p>
          <Link href={`/r/${restaurantId}`} className="commerce-primary border border-[var(--text)]">{t("returnToMenu")}</Link>
        </section>
      </PaymentReturnFrame>
    );
  }

  return (
    <PaymentReturnFrame restaurant={restaurantData} pageSlug={pageSlug}>
      <section aria-labelledby="payment-failed-title" className="space-y-7">
        <div className="space-y-3">
          <XCircleIcon className="mb-5 h-12 w-12 text-[var(--error)]" aria-hidden="true" />
          <h1 id="payment-failed-title" className="text-2xl font-semibold leading-tight sm:text-3xl">{t("paymentFailed")}</h1>
          <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">{t("paymentFailedMessage")}</p>
        </div>

        <div className="space-y-5 border-y border-[var(--divider)] py-5">
          <p className="text-sm text-[var(--text-muted)]">{t("order")} <bdi>#{orderId}</bdi></p>
          {errorMessage && (
            <div className="space-y-1 border-s-2 border-[var(--error)] ps-4 text-sm">
              <p className="font-medium">{t("reason")}:</p>
              <p className="break-words text-[var(--text-muted)]">{errorMessage}</p>
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-sm">{t("amount")}:</span>
            <bdi className="text-2xl font-semibold tabular-nums">{money(orderData.total)}</bdi>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleRetryPayment()}
            disabled={retrying}
            aria-busy={retrying}
            className="commerce-primary gap-2 border border-[var(--text)] disabled:!cursor-wait disabled:!opacity-100"
          >
            {retrying && <ArrowPathIcon className="h-5 w-5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}
            <span aria-live="polite" aria-atomic="true">{retrying ? t("redirectingToPayment") : t("tryAgain")}</span>
          </button>
          {retryError && <p role="alert" className="break-words text-sm leading-6 text-[var(--error)]">{retryError}</p>}
          <button type="button" onClick={() => setShowCancelConfirm(true)} disabled={retrying} className="commerce-secondary">
            {t("cancelOrder")}
          </button>
        </div>

        <div className="space-y-3 text-sm leading-6 text-[var(--text-muted)]">
          <p>{t("needHelp")}</p>
          {restaurantData?.phone && (
            <a href={`tel:${restaurantData.phone}`} className="inline-flex min-h-11 items-center gap-2 text-[var(--text)] underline underline-offset-4">
              <PhoneIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <bdi dir="ltr">{restaurantData.phone}</bdi>
            </a>
          )}
        </div>
      </section>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-description" className="w-full max-w-sm space-y-4 rounded-[16px] border border-[var(--divider)] bg-[var(--surface)] p-6 text-[var(--text)]">
            <h2 id="cancel-title" className="text-lg font-semibold">{t("cancelOrderConfirm")}</h2>
            <p id="cancel-description" className="text-sm leading-6 text-[var(--text-muted)]">{t("cancelOrderConfirmMessage")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="commerce-secondary">{t("goBack")}</button>
              <button type="button" onClick={confirmCancelOrder} className="commerce-primary !bg-red-700 !text-white">{t("cancelOrder")}</button>
            </div>
          </div>
        </div>
      )}
    </PaymentReturnFrame>
  );
}

/** Renders a failed payment with the originating restaurant checkout's appearance. */
export default function PaymentFailedPage(props: { params: Promise<{ restaurantId: string }> }) {
  const params = use(props.params);
  return <Suspense fallback={<PaymentFailedLoading />}><PaymentFailedContent params={params} /></Suspense>;
}
