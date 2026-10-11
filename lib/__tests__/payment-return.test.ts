import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentFailureURL,
  classifyPaymentReturn,
  waitForPaymentReturn,
} from "../payment-return";
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
