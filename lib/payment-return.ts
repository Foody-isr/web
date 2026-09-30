import type { OrderResponse, PaymentStatus } from "@/lib/types";

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
 * Classifies the payment status owned by Foody's API. Unknown states fail
 * closed as pending so a provider redirect can never manufacture success.
 */
export function classifyPaymentReturn(
  status: PaymentStatus | string | undefined,
): PaymentReturnOutcome {
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
    const outcome = classifyPaymentReturn(lastOrder.paymentStatus);
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
