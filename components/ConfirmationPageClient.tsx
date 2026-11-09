"use client";
import { eventOrderCopy } from "@/lib/event-order-copy";
import { LifecycleFacts } from "@/components/OrderLifecycleFacts";
import { orderCollectionAllowed } from "@/lib/order-tracking";
import { formatLifecycleV2Money } from "@/lib/order-lifecycle-v2";
import { LoyaltyPaymentResume } from "./LoyaltyPaymentResume";
import { loyaltyCheckoutEnabled,isLoyaltyCheckoutPath } from "@/lib/loyalty-checkout";
import { OrderDeliveryPromise } from "@/components/OrderDeliveryPromise";
import { useMobileLoyalty } from "@/components/website-v3/MobileExperience";
import type { MobileExperience } from "@/lib/mobileExperience";

import { useState,useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CommerceAppearanceScope } from "@/components/CommerceAppearanceScope";
import { formatMoney } from "@/lib/constants";
import { initPayment, fetchMenu } from "@/services/api";
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
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Use the owner's config when present; otherwise the default keeps the page
  // usable for restaurants that haven't customised anything yet.
  const config = confirmationConfig ?? DEFAULT_CONFIRMATION_CONFIG;

  const lifecycleV2 = liveOrder.lifecycleV2?.kind === "available" ? liveOrder.lifecycleV2.value : undefined;
  const paymentState = liveOrder.lifecycleV2?.kind === "unavailable" ? "unknown" : lifecycleV2?.payment.state ?? liveOrder.paymentStatus;
  const orderMoney = (amount: number) => lifecycleV2 ? lifecycleV2.payment.amounts.currency && lifecycleV2.payment.amounts.minor_unit_exponent !== null ? formatMoney(amount, lifecycleV2.payment.amounts.currency, { decimals: lifecycleV2.payment.amounts.minor_unit_exponent }) : t("lifecycleV2AmountUnknown") : liveOrder.lifecycleV2?.kind === "unavailable" ? t("lifecycleV2AmountUnknown") : formatMoney(amount, order.currency);
  const collectionAllowed = orderCollectionAllowed(liveOrder.lifecycle, liveOrder.lifecycleV2);
  const paymentNeeded = liveOrder.eventConfig?.payment_mode !== "none" && collectionAllowed &&
    order.paymentMethod !== "cash" &&
    (paymentState === "pending" ||
      (paymentState === "unpaid" &&
        (order.orderType === "pickup" || order.orderType === "delivery")));

  const handlePayNow = async () => {
    if (preview || !paymentNeeded) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const result = await initPayment(orderId, restaurantId, receiptToken);
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setPaymentError(t("paymentServiceUnavailable"));
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t("failedToInitPayment");
      setPaymentError(msg);
    } finally {
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
          {liveOrder.externalMetadata?.card_save_status === "unavailable" && <p role="status" className="commerce-notice mb-5">{t("cardSaveUnavailable")}</p>}
          <section className="confirmation-intro">
            <span className="confirmation-status-dot" aria-hidden="true" />
            <div className="min-w-0">
              <ConfirmationHeader
                config={confirmationConfig}
                fallbackTitle={t("orderConfirmedTitle")}
                fallbackSubtitle={t("orderConfirmedSubtitle")}
              />
              <p className="commerce-muted mt-3 text-sm">
                {t("order")} #{orderId}
              </p>
            </div>
          </section>
          {!preview && !paymentNeeded && (!tableId || !mobileInstallation) && (
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
                onSaved={next => { setLiveOrder(previous => ({ ...next, ...(previous.lifecycleV2 && previous.lifecycleV2.kind !== "legacy" && (!next.lifecycleV2 || next.lifecycleV2.kind === "legacy") ? { lifecycleV2: { kind: "unavailable" as const } } : {}) })); }}
              />
            </div>
          )}

          {/* Courier / ETA info for delivery orders. Renders nothing until the
          backend populates external_metadata.delivery. */}
          {loyaltyRequest&&<LoyaltyPaymentResume key={`${restaurantId}:${loyaltyRequest}:${account?.id}`} restaurant={Number(restaurantId)} request={loyaltyRequest} order={orderId} />}
          {paymentNeeded && !loyaltyRequest && (
            <div className="space-y-2">
              <button
                onClick={handlePayNow}
                disabled={paymentLoading}
                className="commerce-primary"
              >
                {paymentLoading ? t("processing") : t("payNow")}
              </button>
              {paymentError && (
                <p className="text-sm text-red-500 text-center">
                  {paymentError}
                </p>
              )}
            </div>
          )}

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
