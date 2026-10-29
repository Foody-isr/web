import type { CartLine, OrderPayload, OrderType } from "@/lib/types";
import { isByWeight, lineUnitPrice } from "@/lib/cart";

/** Quotes a weight authorization in minor units without inventing an unknown policy. */
export function weightHoldPreview(lines: CartLine[], total: number, bufferPercent?: number): number | null {
  if (bufferPercent === undefined || !Number.isFinite(bufferPercent) || bufferPercent < 0 || bufferPercent > 100 || !Number.isFinite(total) || total < 0) return null;
  const weighted = lines.filter(line => isByWeight(line.item)).reduce((sum, line) => sum + Math.round(lineUnitPrice(line) * 100) / 100 * line.quantity, 0);
  if (!Number.isFinite(weighted) || weighted <= 0) return null;
  const minor = Math.round((total + weighted * bufferPercent / 100) * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export type CheckoutPaymentChoice = "card" | "cash";

type CashPolicyInput = {
  orderType: OrderType;
  onlinePaymentOnly: boolean;
  tourRequiresPrepayment: boolean;
  cashPaymentPolicy?: string;
};

/** Reports whether this checkout may offer the trusted-customer cash path. */
export function cashPolicyAllows({
  orderType,
  onlinePaymentOnly,
  tourRequiresPrepayment,
  cashPaymentPolicy,
}: CashPolicyInput): boolean {
  return (
    (orderType === "pickup" || orderType === "delivery") &&
    !onlinePaymentOnly &&
    cashPaymentPolicy !== "disabled" &&
    !tourRequiresPrepayment
  );
}

/** Reports whether cash is safe to submit under policy and trust state. */
export function cashSelectionAllowed({
  policyAllows,
  trusted,
  otpRequired,
  hasCurrentPhoneProof,
  trustRequired = true,
}: {
  policyAllows: boolean;
  trusted: boolean;
  trustRequired?: boolean;
  otpRequired: boolean;
  hasCurrentPhoneProof: boolean;
}): boolean {
  return policyAllows && (!trustRequired || trusted) && (!otpRequired || hasCurrentPhoneProof);
}

/** Resolve the public order payment contract from policy plus the guest's choice. */
export function resolveCheckoutPayment(
  configuredPrepayment: boolean,
  choice: CheckoutPaymentChoice,
  cashGuaranteeRequired = false,
): {
  paymentMethod: OrderPayload["paymentMethod"];
  paymentRequired: boolean;
} {
  if (choice === "cash") {
    return { paymentMethod: "cash", paymentRequired: cashGuaranteeRequired };
  }
  return configuredPrepayment
    ? { paymentMethod: "pay_now", paymentRequired: true }
    : { paymentMethod: "pay_later", paymentRequired: false };
}

type SubmitLabelInput = {
  paymentRequired: boolean;
  orderType: OrderType;
  isScheduled: boolean;
  isBatch: boolean;
};

/** Select the CTA translation from the payment contract actually being sent. */
export function checkoutSubmitLabelKey({
  paymentRequired,
  orderType,
  isScheduled,
  isBatch,
}: SubmitLabelInput):
  | "confirmAndPay"
  | "placeOrderAndPay"
  | "scheduleAndPay"
  | "confirmAndOrder"
  | "scheduleOrder"
  | "placeOrder" {
  if (paymentRequired) {
    if (isScheduled) return "scheduleAndPay";
    if (isBatch) return "placeOrderAndPay";
    return "confirmAndPay";
  }
  if (orderType === "dine_in") return "confirmAndOrder";
  if (isScheduled) return "scheduleOrder";
  return "placeOrder";
}
