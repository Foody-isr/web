import type { OrderPayload, OrderType } from "@/lib/types";

export type CheckoutPaymentChoice = "card" | "cash" | "cibus";

type CashPolicyInput = {
  orderType: OrderType;
  onlinePaymentOnly: boolean;
  tourRequiresPrepayment: boolean;
};

/** Reports whether this checkout may offer the trusted-customer cash path. */
export function cashPolicyAllows({
  orderType,
  onlinePaymentOnly,
  tourRequiresPrepayment,
}: CashPolicyInput): boolean {
  return (
    (orderType === "pickup" || orderType === "delivery") &&
    !onlinePaymentOnly &&
    !tourRequiresPrepayment
  );
}

/** Resolve the public order payment contract from policy plus the guest's choice. */
export function resolveCheckoutPayment(
  configuredPrepayment: boolean,
  choice: CheckoutPaymentChoice,
): {
  paymentMethod: OrderPayload["paymentMethod"];
  paymentRequired: boolean;
} {
  if (choice === "cash") {
    return { paymentMethod: "cash", paymentRequired: false };
  }
  if (choice === "cibus") {
    return { paymentMethod: "cibus", paymentRequired: true };
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
