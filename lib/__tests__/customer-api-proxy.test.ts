import assert from "node:assert/strict";
import test from "node:test";

import { resolveCustomerAPIPath } from "../customer-api-proxy";

test("customer proxy accepts only explicit guest API routes", () => {
  assert.equal(resolveCustomerAPIPath("POST", ["orders", "42", "payment", "signup", "confirm"]), "orders/42/payment/signup/confirm");
  assert.equal(resolveCustomerAPIPath("GET", ["orders", "42", "payment", "signup", "confirm"]), null);
  assert.equal(resolveCustomerAPIPath("GET", ["payment-methods", "capture-key"]), "payment-methods/capture-key");
  assert.equal(resolveCustomerAPIPath("POST", ["orders", "42", "payment", "encrypted-card"]), "orders/42/payment/encrypted-card");
  assert.equal(resolveCustomerAPIPath("GET", ["orders", "42", "payment", "encrypted-card"]), null);
  assert.equal(resolveCustomerAPIPath("POST", ["orders"]), "orders");
  assert.equal(
    resolveCustomerAPIPath("POST", ["orders", "42", "payment", "saved-method"]),
    "orders/42/payment/saved-method",
  );
  assert.equal(
    resolveCustomerAPIPath("GET", ["payment-methods"]),
    "payment-methods",
  );
  const quoteToken = `cq_${"a".repeat(32)}`;
  assert.equal(
    resolveCustomerAPIPath("POST", ["catering", "quotes", quoteToken, "deposit"]),
    `catering/quotes/${quoteToken}/deposit`,
  );
});

test("customer proxy rejects method changes, traversal, and admin paths", () => {
  assert.equal(resolveCustomerAPIPath("DELETE", ["orders"]), null);
  assert.equal(
    resolveCustomerAPIPath("GET", ["..", "admin", "restaurants"]),
    null,
  );
  assert.equal(resolveCustomerAPIPath("GET", ["admin", "restaurants"]), null);
  assert.equal(
    resolveCustomerAPIPath("POST", ["orders", "abc", "payment", "init"]),
    null,
  );
  assert.equal(
    resolveCustomerAPIPath("POST", [
      "catering",
      "quotes",
      "cq_%3Fadmin=true",
      "deposit",
    ]),
    null,
  );
});
