import { lineUnitPrice } from "./cart";
import type { CartLine, LoyaltyCustomerReward } from "./types";

/** Financial customer checkout is independently disabled until its own rollout. */
export const loyaltyCheckoutEnabled =
  process.env.NEXT_PUBLIC_LOYALTY_CHECKOUT_ENABLED === "true";
export interface LoyaltyCheckoutSelection {
  request_id: string;
  reward_id: string;
  reward_revision: number;
  expected_reduction_minor: number;
  expected_total_minor: number;
}
export interface LoyaltyCheckoutIntent {
  version: 1;
  restaurant: number;
  account: number;
  selection: LoyaltyCheckoutSelection;
  payload_fingerprint: string;
  cart_fingerprint: string;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const integer = (n: unknown, min = 0) =>
  Number.isSafeInteger(n) && Number(n) >= min;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const failure = (): never => {
  throw new Error("loyalty_checkout_invalid");
};
const minor = (n: number) =>
  Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100))
    ? Math.round(n * 100)
    : null;

/** Estimate the existing standard-item contract. Only the API can accept a price. */
export function estimateLoyaltyReward(
  reward: LoyaltyCustomerReward,
  lines: CartLine[],
  fee: number,
  currency: string,
): { reductionMinor: number; totalMinor: number } | null {
  if (
    reward.status !== "available" ||
    reward.blocked_reason !== "" ||
    reward.rules.currency !== currency ||
    lines.length === 0 ||
    lines.length > 1000
  )
    return null;
  let gross = 0,
    freeBase: number | null = null;
  for (const line of lines) {
    if (
      line.comboId ||
      line.item.pricingMode === "by_weight" ||
      !integer(line.quantity, 1) ||
      line.quantity > 1000
    )
      return null;
    const base = minor(
        line.selectedVariantPrice && line.selectedVariantPrice > 0
          ? line.selectedVariantPrice
          : line.item.price,
      ),
      unit = minor(lineUnitPrice(line));
    if (base === null || unit === null || unit < base) return null;
    gross += unit * line.quantity;
    if (!Number.isSafeInteger(gross)) return null;
    if (
      reward.rules.reward_type === "item" &&
      Number(line.item.id) === reward.rules.reward_item_id &&
      (line.selectedVariantId ?? null) ===
        (reward.rules.reward_variant_id ?? null) &&
      base > 0
    )
      freeBase = freeBase === null ? base : Math.min(freeBase, base);
  }
  const delivery = minor(fee);
  if (delivery === null) return null;
  const reduction =
    reward.rules.reward_type === "fixed"
      ? Math.min(gross, reward.rules.reward_amount_minor)
      : freeBase;
  if (
    reduction === null ||
    reduction <= 0 ||
    !Number.isSafeInteger(gross + delivery)
  )
    return null;
  return {
    reductionMinor: reduction,
    totalMinor: gross + delivery - reduction,
  };
}

/** Accept only explicit preview assertions, never identity or a payment outcome. */
export function checkedLoyaltyCheckoutSelection(
  value: unknown,
): LoyaltyCheckoutSelection {
  if (
    !object(value) ||
    Object.keys(value).length !== 5 ||
    Object.keys(value).some(
      (k) =>
        ![
          "request_id",
          "reward_id",
          "reward_revision",
          "expected_reduction_minor",
          "expected_total_minor",
        ].includes(k),
    ) ||
    typeof value.request_id !== "string" ||
    !uuid.test(value.request_id) ||
    typeof value.reward_id !== "string" ||
    !uuid.test(value.reward_id) ||
    !integer(value.reward_revision, 1) ||
    !integer(value.expected_reduction_minor, 1) ||
    !integer(value.expected_total_minor)
  )
    return failure();
  return value as unknown as LoyaltyCheckoutSelection;
}
/** Recognize the creation protocol without opening staff or arbitrary order paths. */
export function isLoyaltyCheckoutPath(path: string): boolean {
  return (
    path === "loyalty/checkouts" ||
    (/^loyalty\/checkouts\/[a-f0-9-]{36}(?:\/cancel)?$/i.test(path) &&
      uuid.test(path.split("/")[2]))
  );
}
/** Only dedicated loyalty creation accepts the extra assertion; receipts stay session-owned. */
export function checkedLoyaltyCheckoutBody(
  value: unknown,
): Record<string, unknown> {
  if (
    !object(value) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 1000 ||
    (value.order_type !== "pickup" && value.order_type !== "delivery") ||
    !["pay_now", "pay_later"].includes(String(value.payment_method)) ||
    value.save_card ||
    value.direct_card ||
    value.payment_method_token_id ||
    (Array.isArray(value.combos) && value.combos.length > 0)
  )
    return failure();
  const forbidden = [
    "customer_account_id",
    "user_id",
    "restaurant_id",
    "membership_id",
    "order_id",
    "id",
    "payment_status",
    "discount",
    "discount_amount",
    "manual_discount",
    "pos_discounts",
    "check_id",
    "session_id",
  ];
  if (forbidden.some((k) => Object.hasOwn(value, k) && value[k] !== undefined))
    return failure();
  checkedLoyaltyCheckoutSelection(value.loyalty_reward);
  return value;
}

/** Digest only; plaintext contacts, address proofs and payment data are never journalled. */
export async function loyaltyFingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
/** Renewal of a transport proof does not change the buyer's order choices. */
export async function loyaltyPayloadFingerprint(wire: string): Promise<string> {
  const parsed = checkedLoyaltyCheckoutBody(JSON.parse(wire));
  const semantic = { ...parsed };
  delete semantic.otp_proof;
  delete semantic.delivery_address_token;
  return loyaltyFingerprint(semantic);
}
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (rid: number, account: number) =>
  `foody.loyalty-checkout.v1:${rid}:${account}`;
function intent(
  value: unknown,
  rid: number,
  account: number,
): LoyaltyCheckoutIntent {
  if (
    !object(value) ||
    value.version !== 1 ||
    value.restaurant !== rid ||
    value.account !== account ||
    !integer(rid, 1) ||
    !integer(account, 1) ||
    typeof value.payload_fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.payload_fingerprint) ||
    typeof value.cart_fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.cart_fingerprint)
  )
    return failure();
  checkedLoyaltyCheckoutSelection(value.selection);
  return value as unknown as LoyaltyCheckoutIntent;
}
/** Read only this account/restaurant's pending checkout; corrupt storage fails closed. */
export function readLoyaltyCheckout(
  store: Store,
  rid: number,
  account: number,
): LoyaltyCheckoutIntent | null {
  try {
    const raw = store.getItem(key(rid, account));
    return raw === null ? null : intent(JSON.parse(raw), rid, account);
  } catch {
    throw new Error("loyalty_checkout_storage");
  }
}
/** Persist exact intent fingerprints before its first order request. */
export function saveLoyaltyCheckout(
  store: Store,
  value: LoyaltyCheckoutIntent,
): void {
  try {
    intent(value, value.restaurant, value.account);
    const prior = readLoyaltyCheckout(store, value.restaurant, value.account);
    if (prior && JSON.stringify(prior) !== JSON.stringify(value))
      throw new Error();
    store.setItem(key(value.restaurant, value.account), JSON.stringify(value));
    if (
      JSON.stringify(
        readLoyaltyCheckout(store, value.restaurant, value.account),
      ) !== JSON.stringify(value)
    )
      throw new Error();
  } catch {
    throw new Error("loyalty_checkout_storage");
  }
}
/** Clear only a positively acknowledged creation or explicit cancellation tombstone. */
export function clearLoyaltyCheckout(
  store: Store,
  value: LoyaltyCheckoutIntent,
): void {
  try {
    if (
      JSON.stringify(
        readLoyaltyCheckout(store, value.restaurant, value.account),
      ) !== JSON.stringify(value)
    )
      throw new Error();
    store.removeItem(key(value.restaurant, value.account));
    if (readLoyaltyCheckout(store, value.restaurant, value.account) !== null)
      throw new Error();
  } catch {
    throw new Error("loyalty_checkout_storage");
  }
}
