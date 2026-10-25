import assert from "node:assert/strict";
import test from "node:test";
import { validCustomerSocialFlow } from "../customer-social-flow";

test("social sign-in requires the provider's exact browser state and a fresh flow", () => {
  const flow = { provider: "apple", state: "a".repeat(64), nonce: "b".repeat(64), createdAt: 100_000 };
  assert.equal(validCustomerSocialFlow(flow, "apple", flow.state, 100_001), true);
  assert.equal(validCustomerSocialFlow(flow, "facebook", flow.state, 100_001), false);
  assert.equal(validCustomerSocialFlow(flow, "apple", "c".repeat(64), 100_001), false);
  assert.equal(validCustomerSocialFlow(flow, "apple", flow.state, 700_000), false);
  assert.equal(validCustomerSocialFlow(flow, "apple", flow.state, 99_999), false);
  assert.equal(validCustomerSocialFlow({ ...flow, nonce: "short" }, "apple", flow.state, 100_001), false);
  assert.equal(validCustomerSocialFlow(null, "apple", flow.state), false);
  assert.equal(validCustomerSocialFlow(flow, "apple", null, 100_001), false);
});
