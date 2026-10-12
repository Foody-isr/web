import type { HostedSignupResult } from "@/services/api";
import type { OrderType } from "./types";

/** Polls registration verification only; this callback must never charge an order. */
export async function waitForHostedSignup(
  verify: () => Promise<HostedSignupResult>,
  options: {
    signal?: AbortSignal;
    maxAttempts?: number;
    wait?: () => Promise<void>;
  } = {},
): Promise<HostedSignupResult | null> {
  const wait = options.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 1_500)));
  let result: HostedSignupResult | null = null;
  for (let attempt = 0; attempt < (options.maxAttempts ?? 6); attempt++) {
    if (options.signal?.aborted) return null;
    result = await verify();
    if (options.signal?.aborted) return null;
    if (result.completed || result.charge_attempted || result.declined || result.ready) return result;
    if (attempt + 1 < (options.maxAttempts ?? 6)) await wait();
  }
  return result;
}

/** Preserves restaurant/page context when a server-confirmed payment finishes. */
export function hostedSignupDestination({
  restaurantId, orderId, receipt, pageSlug, orderType,
}: {
  restaurantId: string;
  orderId: string;
  receipt?: string | null;
  pageSlug?: string | null;
  orderType?: OrderType;
}): string {
  if (orderType === "pickup" || orderType === "delivery") {
    const query = new URLSearchParams({ restaurantId });
    if (receipt) query.set("t", receipt);
    if (pageSlug) query.set("pageSlug", pageSlug);
    return `/order/confirmation/${encodeURIComponent(orderId)}?${query}`;
  }
  const query = new URLSearchParams({ orderId });
  if (receipt) query.set("t", receipt);
  if (pageSlug) query.set("pageSlug", pageSlug);
  return `/r/${encodeURIComponent(restaurantId)}/payment/success?${query}`;
}
