import type { OrderPayload, OrderType } from "@/lib/types";

export type CheckoutPaymentChoice = "card" | "cash" | "cibus";
export type CashEligibilityAction = "phone_required" | "verify_phone" | "check_trusted";

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

/** Select the next cash-eligibility step from the restaurant's OTP policy. */
export function cashEligibilityAction({
  hasPhone,
  otpRequired,
  hasCurrentPhoneProof,
}: {
  hasPhone: boolean;
  otpRequired: boolean;
  hasCurrentPhoneProof: boolean;
}): CashEligibilityAction {
  if (!hasPhone) return "phone_required";
  if (otpRequired && !hasCurrentPhoneProof) return "verify_phone";
  return "check_trusted";
}

/** Reports whether cash is safe to submit under policy and trust state. */
export function cashSelectionAllowed({
  policyAllows,
  trusted,
  otpRequired,
  hasCurrentPhoneProof,
}: {
  policyAllows: boolean;
  trusted: boolean;
  otpRequired: boolean;
  hasCurrentPhoneProof: boolean;
}): boolean {
  return (
    policyAllows &&
    trusted &&
    (!otpRequired || hasCurrentPhoneProof)
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
