import type { ReceiptData } from "@/services/api";

type ReceiptGroup = {
  key: string;
  combo: boolean;
  items: ReceiptData["items"];
  total: number;
};

/** Groups combo lines in receipt order and preserves the existing legacy-price fallback. */
export function receiptGroups(receipt: ReceiptData): ReceiptGroup[] {
  const items = receipt.items.filter((item) => item.adjustment_kind !== "void");
  const groups = new Map<string, ReceiptGroup>();
  for (const item of items) {
    const key = item.combo_group
      ? `combo:${item.combo_group}`
      : `item:${item.id}`;
    const group = groups.get(key) ?? {
      key,
      combo: Boolean(item.combo_group),
      items: [],
      total: 0,
    };
    group.items.push(item);
    group.total += item.total;
    groups.set(key, group);
  }
  const combos = [...groups.values()].filter((group) => group.combo);
  const remaining =
    receipt.order.total_amount -
    items.reduce((sum, item) => sum + item.total, 0);
  for (const group of combos) {
    const first = group.items[0];
    const base =
      first.adjustment_kind === "comp"
        ? 0
        : first.combo_price || remaining / combos.length;
    group.total += base;
  }
  return [...groups.values()];
}

/** Resolves receipt copy in the guest's language, falling back to the owner's other translations. */
export function receiptCopy(
  value: Record<string, string> | undefined,
  locale: string,
  fallback: string,
): string {
  return (
    value?.[locale]?.trim() ||
    value?.en?.trim() ||
    value?.fr?.trim() ||
    value?.he?.trim() ||
    fallback
  );
}

/** Maps API statuses to translated guest labels without exposing raw enum values. */
export function receiptStatusKey(status: string, context: string): string {
  if (context === "payment")
    return (
      (
        {
          unpaid: "paymentUnpaid",
          pending: "paymentPending",
          authorized: "paymentAuthorized",
          partially_paid: "paymentPartiallyPaid",
          paid: "paymentPaid",
          refunded: "paymentRefunded",
        } as Record<string, string>
      )[status] || "paymentPending"
    );
  const keys: Record<string, string> = {
    scheduled: "statusScheduled",
    pending_review: "statusPending",
    accepted: "statusAccepted",
    rejected: "receiptRejected",
    in_kitchen: "statusInKitchen",
    ready: "statusReady",
    ready_for_delivery: "statusReadyForDelivery",
    ready_for_pickup: "statusReady",
    out_for_delivery: "statusOnTheWay",
    served: context === "pickup" ? "statusPickedUp" : "statusServed",
    picked_up: "statusPickedUp",
    received: context === "pickup" ? "statusPickedUp" : "statusServed",
    delivered: "statusDelivered",
    cancelled: "statusCancelled",
    refunded: "statusRefunded",
  };
  return keys[status] || "statusPending";
}

/** Keeps a receipt on the published order page that supplied its guest link. */
export function receiptHref(token: string, pageSlug?: string): string {
  const query = pageSlug ? `?${new URLSearchParams({ pageSlug })}` : "";
  return `/receipt/${encodeURIComponent(token)}${query}`;
}
