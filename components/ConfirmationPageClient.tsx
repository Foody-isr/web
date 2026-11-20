"use client";
import { eventOrderCopy } from "@/lib/event-order-copy";
import { LifecycleFacts } from "@/components/OrderLifecycleFacts";
import { guestOrderPayment, openHostedOrderPayment } from "@/lib/payment-return";
import { formatLifecycleV2Money } from "@/lib/order-lifecycle-v2";
import { LoyaltyPaymentResume } from "./LoyaltyPaymentResume";
import { loyaltyCheckoutEnabled,isLoyaltyCheckoutPath } from "@/lib/loyalty-checkout";
import { OrderDeliveryPromise } from "@/components/OrderDeliveryPromise";
import { useMobileLoyalty } from "@/components/website-v3/MobileExperience";
import type { MobileExperience } from "@/lib/mobileExperience";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CommerceAppearanceScope } from "@/components/CommerceAppearanceScope";
import { formatMoney } from "@/lib/constants";
import { ApiError, initPayment, fetchMenu, fetchOrder } from "@/services/api";
import type {
  CheckoutConfig,
  ConfirmationConfig,
  OrderResponse,
} from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { CustomerInfoCard } from "@/components/CustomerInfoCard";
import { CustomerInfoEditor } from "@/components/CustomerInfoEditor";
import {
  ConfirmationActions,
  ConfirmationFAQList,
  ConfirmationHeader,
  DEFAULT_CONFIRMATION_CONFIG,
} from "@/components/ConfirmationActions";
import { ConfirmationDeliveryCard } from "@/components/ConfirmationDeliveryCard";
import { InstallPrompt } from "@/components/InstallPrompt";
import { CustomerSignIn } from "@/components/CustomerSignIn";
import { useGuestAccount } from "@/store/useGuestAccount";
import { VerifoneOrderPayment } from "@/components/VerifoneOrderPayment";

function confirmationPaymentTitle(orderStatus: OrderResponse["orderStatus"], cancelled: boolean, state: string) {
  if (orderStatus === "rejected") return "receiptRejected";
  if (cancelled) return "statusCancelled";
  if (orderStatus === "refunded") return "paymentRefunded";
  switch (state) {
    case "paid":
    case "authorized": return undefined;
    case "pending":
    case "unpaid": return "orderAwaitingPayment";
    case "partially_paid": return "paymentPartiallyPaid";
    case "refunded": return "paymentRefunded";
    case "partially_refunded": return "paymentPartiallyRefunded";
    default: return "paymentUnknown";
  }
}

function mergeOrderRead(previous: OrderResponse, update: OrderResponse): OrderResponse {
  const next = { ...previous, ...update };
  if (previous.lifecycleV2 && previous.lifecycleV2.kind !== "legacy" && (!update.lifecycleV2 || update.lifecycleV2.kind === "legacy")) next.lifecycleV2 = { kind: "unavailable" };
  if (previous.lifecycle && previous.lifecycle.kind !== "legacy" && (!update.lifecycle || update.lifecycle.kind === "legacy")) next.lifecycle = { kind: "unavailable" };
  return next;
}

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
  /** Receipt token from the URL. Proof the order is the reader's; without it
   *  the edit control is not offered, since the server would answer 404. */
  token?: string;
  // Used by the "add to home screen" prompt below. Empty name suppresses it.
  restaurantName?: string;
  logoUrl?: string;
  restaurantPhone?: string;
  preview?: boolean;
  mobileInstallation?: MobileExperience["installation"];
  restaurantSlug?: string;
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
  token,
  restaurantName,
  logoUrl,
  restaurantPhone,
  preview = false,
  mobileInstallation,
  restaurantSlug,
}: Props) {
  const { t, direction, locale } = useI18n();
  const loyaltyMode = useMobileLoyalty(Number(restaurantId), mobileInstallation?.benefit === "loyalty" && mobileInstallation.confirmation, preview);
  const params = useSearchParams();
  const [liveLoyalty,setLiveLoyalty]=useState(false);
 useEffect(()=>{setLiveLoyalty(window.self===window.top&&!params.has("preview"))},[params]);
  const request=params.get("loyaltyRequestId");
  const loyaltyRequest=liveLoyalty&&!params.has("preview")&&!preview&&loyaltyCheckoutEnabled&&request&&isLoyaltyCheckoutPath(`loyalty/checkouts/${request}`)?request:null;
  const account = useGuestAccount(state => state.account);
  const { data: menu } = useQuery({
    queryKey: ["confirmation-menu", restaurantId],
    queryFn: () => fetchMenu(restaurantId),
    enabled: !preview && Boolean(order.items?.length),
  });
  // Held locally so a correction lands on screen at once, rather than after
  // a round trip through the server-rendered page.
  const [liveOrder, setLiveOrder] = useState(order);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<"unavailable" | "checking" | null>(null);
  const openingPayment = useRef(false);
  const [cardSaveFailed, setCardSaveFailed] = useState(false);
  const refreshDirectPayment = useCallback((saveFailed?: boolean) => {
    if (saveFailed) setCardSaveFailed(true);
    void fetchOrder(orderId, restaurantId, token).then(setLiveOrder).catch(() => {
      // The payment panel still shows the verified payment status.
    });
  }, [orderId, restaurantId, token]);

  // Use the owner's config when present; otherwise the default keeps the page
  // usable for restaurants that haven't customised anything yet.
  const config = confirmationConfig ?? DEFAULT_CONFIRMATION_CONFIG;

  const { lifecycle: lifecycleV2, state: paymentState, cancelled, closed: closedOrder, canPay: paymentNeeded, guaranteePending } = guestOrderPayment(liveOrder);
  const prepaid = !preview && liveOrder.eventConfig?.payment_mode !== "none" && (liveOrder.paymentMethod === "pay_now" || liveOrder.directCard);
  const awaitingPayment = prepaid && !closedOrder && (paymentState === "pending" || paymentState === "unpaid");
  const directPaymentPending = awaitingPayment && liveOrder.directCard && !!token;
  const paymentTitle = guaranteePending && !closedOrder ? "cashGuaranteeCheckoutTitle" : prepaid ? confirmationPaymentTitle(liveOrder.orderStatus, cancelled, paymentState) : undefined;
  const pageUnavailable = params.get("paymentPage") === "unavailable";
  const paymentSubtitle = awaitingPayment && !directPaymentPending
    ? t(pageUnavailable && !paymentError ? "orderPaymentPageUnavailable" : "orderPaymentNotConfirmed")
    : undefined;
  const orderMoney = (amount: number) => lifecycleV2 ? lifecycleV2.payment.amounts.currency && lifecycleV2.payment.amounts.minor_unit_exponent !== null ? formatMoney(amount, lifecycleV2.payment.amounts.currency, { decimals: lifecycleV2.payment.amounts.minor_unit_exponent }) : t("lifecycleV2AmountUnknown") : liveOrder.lifecycleV2?.kind === "unavailable" ? t("lifecycleV2AmountUnknown") : formatMoney(amount, order.currency);

  const handlePayNow = async () => {
    if (preview || !paymentNeeded || openingPayment.current) return;
    if (paymentError === "checking") {
      window.location.reload();
      return;
    }
    openingPayment.current = true;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      // A webhook can settle the order while this tab is at the provider.
      const fresh = mergeOrderRead(liveOrder, await fetchOrder(orderId, restaurantId, token ?? receiptToken));
      setLiveOrder(fresh);
      if (!guestOrderPayment(fresh).canPay || fresh.directCard) return;
      if (token && fresh.receiptToken !== token) { setPaymentError("checking"); return; }
      const result = await initPayment(orderId, restaurantId, token ?? receiptToken);
      if (result.paymentUrl) {
        openHostedOrderPayment(result.paymentUrl, window.location.href);
      } else {
        setPaymentError("unavailable");
      }
    } catch (error: unknown) {
      setPaymentError(error instanceof ApiError && error.status !== 409 ? "unavailable" : "checking");
    } finally {
      openingPayment.current = false;
      setPaymentLoading(false);
    }
  };

  return (
    <CommerceAppearanceScope restaurantId={restaurantId}>
      <main dir={direction} className="commerce-surface confirmation-surface min-h-screen bg-[var(--bg-page)]">
        <div className="commerce-header confirmation-header">
          <Link
            href={menuHref || `/r/${restaurantId}/order`}
            className="inline-flex items-center gap-2 text-sm"
          >
            <span aria-hidden="true">←</span>
            <span>{t("backToMenu")}</span>
          </Link>
          <div className="commerce-logo">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={restaurantName || ""}
                width={64}
                height={64}
                className="mx-auto h-12 w-auto object-contain"
              />
            ) : (
              restaurantName
            )}
          </div>
          <span />
        </div>
        <div className="confirmation-content">
          {(liveOrder.externalMetadata?.card_save_status === "unavailable" || paymentState === "paid" &&
            (cardSaveFailed || params.get("cardSave") === "unavailable")) && <p role="status" className="commerce-notice mb-5">{t("cardSaveUnavailable")}</p>}
          <section className="confirmation-intro">
            <span className="confirmation-status-dot" aria-hidden="true" />
            <div className="min-w-0">
              <ConfirmationHeader
                config={paymentTitle ? undefined : confirmationConfig}
                fallbackTitle={t(paymentTitle ?? "orderConfirmedTitle")}
                fallbackSubtitle={paymentTitle ? paymentSubtitle : t("orderConfirmedSubtitle")}
              />
              <p className="commerce-muted mt-3 text-sm">
                {t("order")} #{orderId}
              </p>
            </div>
          </section>
          {directPaymentPending && <div className="mb-6">
            <VerifoneOrderPayment orderId={orderId} restaurantId={restaurantId} receiptToken={token} merchantName={restaurantName}
              total={liveOrder.total} onPaid={refreshDirectPayment} />
          </div>}
          {paymentNeeded && !loyaltyRequest && !liveOrder.directCard && (
            <div className="mb-6 space-y-2">
              <button
                onClick={handlePayNow}
                disabled={paymentLoading}
                className="commerce-primary"
              >
                {t(paymentLoading ? "processing" : paymentError === "checking" ? "verifonePaymentDetails" : guaranteePending ? "resumeCardGuarantee" : "payNow")}
              </button>
              {paymentError && (
                <p role="alert" className="text-sm text-[var(--error)]">
                  {t(paymentError === "checking" ? "verifonePaymentVerification" : "orderPaymentPageUnavailable")}
                </p>
              )}
            </div>
          )}
          {!preview && !directPaymentPending && !paymentNeeded && (!tableId || !mobileInstallation) && (
            <InstallPrompt
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              restaurantSlug={restaurantSlug}
              logoUrl={logoUrl}
              installation={mobileInstallation}
              loyaltyMode={loyaltyMode}
            />
          )}
          {paymentState === "authorized" && (
            <div role="status" className="mb-6 space-y-2 border-y border-[var(--divider)] py-5 text-sm leading-6">
              <p className="font-semibold">{t("paymentAuthorized")}</p>
              <p className="text-[var(--text-muted)]">{t("paymentAuthorizedMessage")}</p>
            </div>
          )}
          {liveOrder.eventConfig&&<section className="mb-6 space-y-3 border-y border-[var(--divider)] py-5"><h2 className="font-semibold">{eventOrderCopy[locale].information}</h2><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{(['name','guests','event_date','event_time','venue','contact','notes'] as const).map(key=>liveOrder.eventConfig?.[key]?<div key={key}><dt className="commerce-muted">{eventOrderCopy[locale][key]}</dt><dd className="whitespace-pre-wrap">{liveOrder.eventConfig[key]}</dd></div>:null)}<div><dt className="commerce-muted">{eventOrderCopy[locale].remaining}</dt><dd>{orderMoney(Math.max(0,liveOrder.total-Number(liveOrder.externalMetadata?.paid_amount??(liveOrder.paymentStatus==='paid'?liveOrder.total:0))))}</dd></div></dl></section>}
          <OrderDeliveryPromise order={liveOrder} restaurantId={restaurantId} receiptToken={receiptToken} preview={preview} />
          {!preview && (order.paymentStatus === "paid" || order.paymentStatus === "authorized") && account?.email_verified === false && <section data-checkout-email-verification className="mb-6 space-y-3 border-y border-[var(--divider)] py-5 text-sm leading-relaxed">
            <p className="text-[var(--text-muted)]">{t("checkoutEmailVerifyLater")}</p>
            <CustomerSignIn variant="verify" initialEmail={account.email} initialName={account.name} />
          </section>}
          <ConfirmationDeliveryCard
            delivery={order.delivery}
            orderType={order.orderType}
          />
          {restaurantPhone && (
            <section className="confirmation-contact">
              <p>
                {t("orderContactQuestion")}
              </p>
              <p className="commerce-muted mt-2">
                {restaurantName} ·{" "}
                <a
                  className="commerce-edit"
                  href={`tel:${restaurantPhone.replace(/[^+\d]/g, "")}`}
                >
                  {restaurantPhone}
                </a>
              </p>
            </section>
          )}
          <section className="confirmation-order">
            <h2 className="commerce-section-title">{t("yourOrder")}</h2>
            <ul className="commerce-items" data-compact="true">
              {order.items?.map((item) => {
                const image = menu?.items.find(
                  (entry) => String(entry.id) === item.menuItemId,
                )?.imageUrl;
                return (
                  <li className="commerce-item" key={item.id}>
                    <div className="commerce-item-image">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="confirmation-item-quantity">
                          {item.quantity}×
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p>
                        {item.quantity > 1 ? `${item.quantity} × ` : ""}
                        {item.name}
                      </p>
                      {item.details.map((detail, index) => (
                        <p className="commerce-muted mt-1 text-sm" key={index}>
                          {detail}
                        </p>
                      ))}
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {orderMoney(item.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="commerce-totals flex justify-between gap-4 font-semibold">
              <span>{t(paymentState === "authorized" ? "estimatedOrderTotal" : "total")}</span>
              <span>{lifecycleV2 ? formatLifecycleV2Money(lifecycleV2.payment.amounts, "total_minor", locale) ?? t("lifecycleV2AmountUnknown") : liveOrder.lifecycleV2?.kind === "unavailable" ? t("lifecycleV2AmountUnknown") : formatMoney(order.total, order.currency)}</span>
            </div>
            {tableId && (
              <p className="commerce-muted mt-3 text-sm">
                {t("table")} {tableId}
              </p>
            )}
          </section>

          {lifecycleV2 && <section className="confirmation-order"><LifecycleFacts value={lifecycleV2} /></section>}
          {(liveOrder.lifecycleV2?.kind === "unavailable" || lifecycleV2 && lifecycleV2.payment.amounts.balance_due_minor === null) && <p role="status" className="text-sm mb-5">{t("orderRefreshFailed")} <button type="button" className="underline" onClick={() => window.location.reload()}>{t("orderRefreshRetry")}</button></p>}

          {/* What the customer typed at checkout, read back so a mistyped
          address or building code can be caught while it still matters. */}
          <CustomerInfoCard
            contact={token && liveOrder.receiptToken === token ? { name: liveOrder.customerName, phone: liveOrder.customerPhone, email: liveOrder.customerEmail } : undefined}
            address={
              liveOrder.orderType === "delivery"
                ? {
                    street: liveOrder.deliveryAddress,
                    city: liveOrder.deliveryCity,
                    floor: liveOrder.deliveryFloor,
                    apt: liveOrder.deliveryApt,
                    entryCode: liveOrder.deliveryEntryCode,
                    notes: liveOrder.deliveryNotes,
                  }
                : undefined
            }
            customFields={liveOrder.customFields}
            checkoutConfig={checkoutConfig}
          />
          {!preview && (
            <div className="-mt-2">
              <CustomerInfoEditor
                order={liveOrder}
                restaurantId={restaurantId}
                token={token}
                checkoutConfig={checkoutConfig}
                onSaved={next => setLiveOrder(previous => mergeOrderRead(previous, next))}
              />
            </div>
          )}

          {/* Courier / ETA info for delivery orders. Renders nothing until the
          backend populates external_metadata.delivery. */}
          {loyaltyRequest&&<LoyaltyPaymentResume key={`${restaurantId}:${loyaltyRequest}:${account?.id}`} restaurant={Number(restaurantId)} request={loyaltyRequest} order={orderId} />}


          <ConfirmationActions
            config={config}
            ctx={{
              orderId,
              restaurantId,
              tableId,
              sessionId,
              receiptToken,
              menuHref,
              pageSlug: params.get("pageSlug") || undefined,
            }}
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
        </div>
      </main>
    </CommerceAppearanceScope>
  );
}
