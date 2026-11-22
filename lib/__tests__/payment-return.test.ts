import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentFailureURL,
  classifyPaymentReturn,
  embeddedOrderPaymentHref,
  guestOrderPayment,
  waitForPaymentReturn,
} from "../payment-return";
import { verifoneIframeEvent, verifoneIframeOrigin } from "../verifone-iframe";
import type { OrderResponse, PaymentStatus } from "../types";

function order(paymentStatus: PaymentStatus): OrderResponse {
  return {
    orderId: "465",
    total: 134,
    currency: "ILS",
    orderStatus: "pending_review",
    paymentStatus,
  };
}

test("embedded checkout stays on the storefront and retains the published order page", () => {
  const payment = new URL("https://app.foody-pos.co.il/order/payment/465?restaurantId=17&t=synthetic");
  const summary = new URL("https://restaurant.example/order/confirmation/465?restaurantId=17&t=synthetic&pageSlug=commander");
  assert.equal(embeddedOrderPaymentHref(payment, summary), "/order/payment/465?restaurantId=17&t=synthetic&pageSlug=commander");
  summary.searchParams.delete("t");
  assert.equal(embeddedOrderPaymentHref(payment, summary), "/order/payment/465?restaurantId=17&pageSlug=commander&t=synthetic");
  payment.searchParams.set("restaurantId", "18");
  assert.equal(embeddedOrderPaymentHref(payment, summary), null);
});

test("the embedded form and checkout events require the expected Verifone origin and frame", () => {
  const origin = "https://cst.test-gsc.vfims.com";
  assert.equal(verifoneIframeOrigin(origin + "/v2/checkout/fixture/view"), origin);
  assert.equal(verifoneIframeOrigin(origin + ".example/v2/checkout/fixture/view"), null);
  assert.equal(verifoneIframeOrigin("https://fixture@cst.test-gsc.vfims.com/v2/checkout/fixture/view"), null);
  const frame = {} as Window;
  const valid = { source: frame, origin, data: { type: "CHECKOUT_COMPLETED" } } as MessageEvent;
  assert.equal(verifoneIframeEvent(valid, frame, origin), "CHECKOUT_COMPLETED");
  assert.equal(verifoneIframeEvent(valid, {} as Window, origin), null);
  assert.equal(verifoneIframeEvent({ ...valid, origin: "https://example.invalid" }, frame, origin), null);
  assert.equal(verifoneIframeEvent({ ...valid, data: { type: "PAID" } }, frame, origin), null);
});

test("a hosted return can resume a pending order but never terminal, uncertain or settled money", () => {
  const saved = { ...order("pending"), paymentMethod: "pay_now", orderType: "delivery" as const };
  assert.equal(guestOrderPayment(saved).canPay, true);
  for (const paymentStatus of ["authorized", "paid", "partially_paid", "refunded"] as const) {
    assert.equal(guestOrderPayment({ ...saved, paymentStatus }).canPay, false);
  }
  for (const orderStatus of ["cancelled", "rejected", "refunded"] as const) {
    assert.equal(guestOrderPayment({ ...saved, orderStatus }).canPay, false);
  }
  assert.equal(guestOrderPayment({ ...saved, lifecycleV2: { kind: "unavailable" } }).canPay, false);
  assert.equal(guestOrderPayment({ ...saved, paymentMethod: "cash" }).canPay, false);
  const cash = { ...saved, paymentMethod: "cash", externalMetadata: { cash_guarantee: { status: "pending" } } };
  assert.equal(guestOrderPayment(cash).canPay, true);
  assert.equal(guestOrderPayment({ ...cash, externalMetadata: { cash_guarantee: { status: "authorized" } } }).canPay, false);
});

test("classifyPaymentReturn only confirms server-owned paid states", () => {
  assert.equal(classifyPaymentReturn("paid"), "confirmed");
  assert.equal(classifyPaymentReturn("authorized"), "confirmed");
  assert.equal(classifyPaymentReturn("unpaid"), "declined");
  assert.equal(classifyPaymentReturn("refunded"), "declined");
  assert.equal(classifyPaymentReturn("pending"), "pending");
  assert.equal(classifyPaymentReturn("unexpected"), "pending");
  assert.equal(classifyPaymentReturn(undefined), "pending");
});

test("waitForPaymentReturn waits for the webhook-owned paid state", async () => {
  const statuses: PaymentStatus[] = ["pending", "pending", "paid"];
  let calls = 0;
  let waits = 0;

  const result = await waitForPaymentReturn(
    async () => order(statuses[calls++] ?? "paid"),
    {
      maxAttempts: 5,
      intervalMs: 0,
      wait: async () => {
        waits += 1;
      },
    },
  );

  assert.equal(result.outcome, "confirmed");
  assert.equal(result.order?.paymentStatus, "paid");
  assert.equal(calls, 3);
  assert.equal(waits, 2);
});

test("waitForPaymentReturn returns a decline without another attempt", async () => {
  let calls = 0;
  const result = await waitForPaymentReturn(
    async () => {
      calls += 1;
      return order("unpaid");
    },
    { maxAttempts: 5, intervalMs: 0, wait: async () => undefined },
  );

  assert.equal(result.outcome, "declined");
  assert.equal(calls, 1);
});

test("waitForPaymentReturn never turns a persistent pending state into success", async () => {
  let calls = 0;
  const result = await waitForPaymentReturn(
    async () => {
      calls += 1;
      return order("pending");
    },
    { maxAttempts: 3, intervalMs: 0, wait: async () => undefined },
  );

  assert.equal(result.outcome, "pending");
  assert.equal(result.order?.paymentStatus, "pending");
  assert.equal(calls, 3);
});

test("buildPaymentFailureURL preserves and encodes the receipt token", () => {
  assert.equal(
    buildPaymentFailureURL("bella italia", "465", "token + value"),
    "/r/bella%20italia/payment/failed?orderId=465&t=token+%2B+value",
  );
  assert.equal(
    buildPaymentFailureURL("19", "465"),
    "/r/19/payment/failed?orderId=465",
  );
});

test("payment polling ignores a paid response arriving after cancellation", async () => {
  const controller = new AbortController();
  const result = await waitForPaymentReturn(async () => {
    controller.abort();
    return order("paid");
  }, { signal: controller.signal });
  assert.equal(result.outcome, "pending");
});

test('a verified cash reservation confirms the order while leaving cash due', async () => {
  const serverOrder = { ...order('unpaid'), externalMetadata: { cash_guarantee: { status: 'authorized', amount_minor: 4250, currency: 'EUR' } } };
  const result = await waitForPaymentReturn(async () => serverOrder, { maxAttempts: 1 });
  assert.equal(result.outcome, 'confirmed');
  assert.equal(result.order?.paymentStatus, 'unpaid');
  assert.equal(classifyPaymentReturn('unpaid', 'pending'), 'declined');
  assert.equal(classifyPaymentReturn('unpaid', 'released'), 'declined');
  assert.equal(classifyPaymentReturn('refunded', 'authorized'), 'declined');
});
