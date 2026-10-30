import assert from "node:assert/strict";
import test from "node:test";

import {
  cashPolicyAllows,
  cashSelectionAllowed,
  checkoutSubmitLabelKey,
  resolveCheckoutPayment,
} from "@/lib/checkout-payment";


test("OTP-skip accepts trusted cash without proof but OTP-required does not", () => {
  assert.equal(
    cashSelectionAllowed({
      policyAllows: true,
      trusted: true,
      otpRequired: false,
      hasCurrentPhoneProof: false,
    }),
    true,
  );
  assert.equal(
    cashSelectionAllowed({
      policyAllows: true,
      trusted: true,
      otpRequired: true,
      hasCurrentPhoneProof: false,
    }),
    false,
  );
  assert.equal(
    cashSelectionAllowed({
      policyAllows: false,
      trusted: true,
      otpRequired: false,
      hasCurrentPhoneProof: false,
    }),
    false,
  );
});

test("trusted cash policy remains available when ordinary pickup requires prepayment", () => {
  assert.equal(
    cashPolicyAllows({
      orderType: "pickup",
      onlinePaymentOnly: false,
      tourRequiresPrepayment: false,
    }),
    true,
  );
  assert.deepEqual(resolveCheckoutPayment(true, "cash"), {
    paymentMethod: "cash",
    paymentRequired: false,
  });
});

test("cash is blocked for dine-in, online-only restaurants and prepaid tours", () => {
  assert.equal(
    cashPolicyAllows({
      orderType: "dine_in",
      onlinePaymentOnly: false,
      tourRequiresPrepayment: false,
    }),
    false,
  );
  assert.equal(
    cashPolicyAllows({
      orderType: "delivery",
      onlinePaymentOnly: true,
      tourRequiresPrepayment: false,
    }),
    false,
  );
  assert.equal(
    cashPolicyAllows({
      orderType: "delivery",
      onlinePaymentOnly: false,
      tourRequiresPrepayment: true,
    }),
    false,
  );
});

test("card follows the configured payment timing", () => {
  assert.deepEqual(resolveCheckoutPayment(true, "card"), {
    paymentMethod: "pay_now",
    paymentRequired: true,
  });
  assert.deepEqual(resolveCheckoutPayment(false, "card"), {
    paymentMethod: "pay_later",
    paymentRequired: false,
  });
});

test("submit label follows the effective payment contract", () => {
  assert.equal(
    checkoutSubmitLabelKey({
      paymentRequired: false,
      orderType: "pickup",
      isScheduled: false,
      isBatch: false,
    }),
    "placeOrder",
  );
  assert.equal(
    checkoutSubmitLabelKey({
      paymentRequired: true,
      orderType: "delivery",
      isScheduled: false,
      isBatch: true,
    }),
    "placeOrderAndPay",
  );
  assert.equal(
    checkoutSubmitLabelKey({
      paymentRequired: false,
      orderType: "delivery",
      isScheduled: true,
      isBatch: false,
    }),
    "scheduleOrder",
  );
});

test('cash eligibility distinguishes all customers, trusted customers and disabled cash', () => {
  assert.equal(cashSelectionAllowed({ policyAllows: true, trusted: false, trustRequired: false, otpRequired: false, hasCurrentPhoneProof: false }), true);
  assert.equal(cashSelectionAllowed({ policyAllows: true, trusted: false, trustRequired: true, otpRequired: false, hasCurrentPhoneProof: false }), false);
  assert.equal(cashSelectionAllowed({ policyAllows: true, trusted: false, trustRequired: false, otpRequired: true, hasCurrentPhoneProof: false }), false);
  assert.equal(cashPolicyAllows({ orderType: 'pickup', onlinePaymentOnly: false, tourRequiresPrepayment: false, cashPaymentPolicy: 'disabled' }), false);
  assert.equal(cashPolicyAllows({ orderType: 'delivery', onlinePaymentOnly: true, tourRequiresPrepayment: false, cashPaymentPolicy: 'all' }), false);
});

test('a guaranteed cash order requests authorization without selecting a card sale', () => {
  assert.deepEqual(resolveCheckoutPayment(false, 'cash', true), { paymentMethod: 'cash', paymentRequired: true });
  assert.deepEqual(resolveCheckoutPayment(true, 'cash', false), { paymentMethod: 'cash', paymentRequired: false });
});
