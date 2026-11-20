import type { OrderResponse, PaymentStatus } from "@/lib/types";
import { orderCollectionAllowed } from "./order-tracking";

/** Derives payment eligibility for the existing order from its current server status. */
export function guestOrderPayment(order: OrderResponse) {
  const lifecycle = order.lifecycleV2?.kind === "available" ? order.lifecycleV2.value : undefined;
  const priorState = order.lifecycle?.kind === "available" ? order.lifecycle.value.payment.state
    : order.lifecycle?.kind === "unavailable" ? "unknown" : order.paymentStatus;
  const state = order.lifecycleV2?.kind === "unavailable" ? "unknown" : lifecycle?.payment.state ?? priorState;
  const cancelled = order.orderStatus === "cancelled" || lifecycle?.commercial.state === "cancelled";
  const closed = cancelled || order.orderStatus === "rejected" || order.orderStatus === "refunded";
  const guaranteePending = order.paymentMethod === "cash" && order.externalMetadata?.cash_guarantee?.status === "pending" && order.paymentStatus === "pending";
  const outstanding = state === "pending" || (state === "unpaid" && (order.paymentMethod === "pay_now" || order.orderType === "pickup" || order.orderType === "delivery"));
  const canPay = !closed && outstanding && (order.paymentStatus === "pending" || order.paymentStatus === "unpaid") &&
    order.eventConfig?.payment_mode !== "none" && (order.paymentMethod !== "cash" || guaranteePending) &&
    orderCollectionAllowed(order.lifecycle, order.lifecycleV2);
  return { lifecycle, state, cancelled, closed, canPay, guaranteePending };
}

export type PaymentReturnOutcome = "confirmed" | "declined" | "pending";

export type PaymentReturnResult = {
  outcome: PaymentReturnOutcome;
  order: OrderResponse | null;
};

type WaitForPaymentReturnOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  wait?: (milliseconds: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 15;
const DEFAULT_INTERVAL_MS = 1_000;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * The server has already created the order. Give its private summary the
 * current history entry before leaving for the hosted payment page. A browser
 * restoring the checkout document from its back/forward cache must load that
 * summary too. The browser retains no extra copy of the form or payment link.
 */
export function openHostedOrderPayment(paymentUrl: string, orderHref: string): void {
  const restoreOrder = (event: PageTransitionEvent) => {
    if (event.persisted) window.location.replace(orderHref);
  };
  try {
    const target = new URL(paymentUrl, window.location.origin);
    const sameSiteHttp = target.protocol === "http:" && target.origin === window.location.origin;
    if ((target.protocol !== "https:" && !sameSiteHttp) || target.username || target.password) {
      window.location.replace(orderHref);
      return;
    }
    window.history.replaceState(window.history.state, "", orderHref);
    window.addEventListener("pageshow", restoreOrder, { once: true });
    window.location.assign(target.href);
  } catch {
    window.removeEventListener("pageshow", restoreOrder);
    window.location.replace(orderHref);
  }
}

/**
 * Classifies the payment status owned by Foody's API. Unknown states fail
 * closed as pending so a provider redirect can never manufacture success.
 */
export function classifyPaymentReturn(
  status: PaymentStatus | string | undefined,
  cashGuaranteeStatus?: string,
): PaymentReturnOutcome {
  if (status === "unpaid" && cashGuaranteeStatus === "authorized") return "confirmed";
  if (status === "paid" || status === "authorized") return "confirmed";
  if (status === "unpaid" || status === "refunded") return "declined";
  return "pending";
}

/**
 * Polls Foody while a signed provider webhook or backend reconciliation is
 * settling the payment. The browser return URL is not evidence of approval.
 */
export async function waitForPaymentReturn(
  loadOrder: () => Promise<OrderResponse>,
  options: WaitForPaymentReturnOptions = {},
): Promise<PaymentReturnResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  const wait = options.wait ?? delay;
  let lastOrder: OrderResponse | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      return { outcome: "pending", order: lastOrder };
    }

    lastOrder = await loadOrder();
    if (options.signal?.aborted) return { outcome: "pending", order: lastOrder };
    const outcome = classifyPaymentReturn(lastOrder.paymentStatus, lastOrder.externalMetadata?.cash_guarantee?.status);
    if (outcome !== "pending") return { outcome, order: lastOrder };

    if (attempt + 1 < maxAttempts) await wait(intervalMs);
  }

  return { outcome: "pending", order: lastOrder };
}

/** Builds the existing guest failure route without dropping its receipt token. */
export function buildPaymentFailureURL(
  restaurantId: string,
  orderId: string,
  receiptToken?: string | null,
): string {
  const query = new URLSearchParams({ orderId });
  if (receiptToken) query.set("t", receiptToken);
  return `/r/${encodeURIComponent(restaurantId)}/payment/failed?${query.toString()}`;
}
