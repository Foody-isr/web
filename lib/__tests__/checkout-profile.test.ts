import assert from "node:assert/strict";
import test from "node:test";
import { rememberedCheckoutFields, restoreCheckoutFields } from "../checkout-profile";
import type { CheckoutFormConfig } from "../types";

const form: CheckoutFormConfig = { require_auth: false, fields: [
  { id: "building-code", kind: "custom", type: "text", enabled: true, required: false },
  { id: "marketing", kind: "custom", type: "checkbox", enabled: true, required: false },
  { id: "disabled", kind: "custom", type: "text", enabled: false, required: false },
  { id: "customer_name", kind: "builtin", enabled: true, required: true },
  { id: "entry", kind: "custom", type: "select", enabled: true, required: false, options: [{ value: "front" }] },
] };

test("remembered custom details exclude consent, disabled and invented fields", () => {
  assert.deepEqual(rememberedCheckoutFields(form, { "building-code": "001-test", marketing: true, disabled: "private", customer_name: "Name", invented: "unknown" }), { "building-code": "001-test" });
});

test("profile restore preserves explicit edits and ignores obsolete fields and choices", () => {
  assert.deepEqual(restoreCheckoutFields(form, { "building-code": "001-test", marketing: "true", disabled: "old", entry: "removed", invented: "unknown" }, {}), { "building-code": "001-test" });
  assert.deepEqual(restoreCheckoutFields(form, { "building-code": "old", entry: "front" }, { "building-code": "" }), { "building-code": "", entry: "front" });
});
