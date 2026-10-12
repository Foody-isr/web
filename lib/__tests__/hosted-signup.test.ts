import assert from "node:assert/strict";
import test from "node:test";
import { hostedSignupDestination, waitForHostedSignup } from "../hosted-signup";
import { isOrderRoute } from "../themes/useResolvedTheme";

test("hosted signup verification waits for readiness without initiating payment", async () => {
  let calls = 0;
  let waits = 0;
  const result = await waitForHostedSignup(async () => {
    calls++;
    return calls < 3 ? { completed: false } : { completed: false, ready: true, payment_method_token_id: 7 };
  }, { maxAttempts: 5, wait: async () => { waits++; } });
  assert.equal(result?.ready, true);
  assert.equal(calls, 3);
  assert.equal(waits, 2);
});

test("hosted signup stops on an explicit decline or already-started/completed order", async () => {
  for (const result of [{ completed: false, declined: true }, { completed: false, charge_attempted: true }, { completed: true }]) {
    let calls = 0;
    assert.deepEqual(await waitForHostedSignup(async () => { calls++; return result; }), result);
    assert.equal(calls, 1);
  }
});

test("hosted signup does not turn persistent pending or a network error into readiness", async () => {
  let calls = 0;
  assert.deepEqual(await waitForHostedSignup(async () => { calls++; return { completed: false }; }, {
    maxAttempts: 3, wait: async () => undefined,
  }), { completed: false });
  assert.equal(calls, 3);
  await assert.rejects(waitForHostedSignup(async () => { throw new Error("offline"); }), /offline/);
});

test("hosted signup ignores responses belonging to an abandoned page", async () => {
  const controller = new AbortController();
  const result = await waitForHostedSignup(async () => {
    controller.abort();
    return { completed: false, ready: true };
  }, { signal: controller.signal });
  assert.equal(result, null);
  assert.equal(await waitForHostedSignup(async () => { throw new Error("must not run"); }, { signal: controller.signal }), null);
});

test("signup confirmation destinations retain restaurant, receipt and source-page context", () => {
  for (const orderType of ["pickup", "delivery"] as const) {
    assert.equal(hostedSignupDestination({ restaurantId: "9001", orderId: "99", receipt: "synthetic + receipt", pageSlug: "special menu", orderType }),
      "/order/confirmation/99?restaurantId=9001&t=synthetic+%2B+receipt&pageSlug=special+menu");
  }
  assert.equal(hostedSignupDestination({ restaurantId: "demo restaurant", orderId: "99", receipt: "synthetic", orderType: "dine_in" }),
    "/r/demo%20restaurant/payment/success?orderId=99&t=synthetic");
});

test("payment returns retain restaurant theme on platform and custom-domain routes", () => {
  for (const stage of ["signup", "success", "failed"]) {
    assert.equal(isOrderRoute(`/r/demo/payment/${stage}`), true);
    assert.equal(isOrderRoute(`/payment/${stage}`), true);
  }
  assert.equal(isOrderRoute("/r/demo/about"), false);
  assert.equal(isOrderRoute("/r/demo/payment/settings"), false);
});
