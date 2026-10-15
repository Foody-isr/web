import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCheckoutProfileChanges,
  rememberedCheckoutFields,
  restoreCheckoutFields,
} from "../checkout-profile";
import type { CheckoutFormConfig } from "../types";
import type {
  CustomerCheckoutProfile,
  CustomerCheckoutProfileInput,
} from "../../services/api";

const form: CheckoutFormConfig = {
  require_auth: false,
  fields: [
    {
      id: "building-code",
      kind: "custom",
      type: "text",
      enabled: true,
      required: false,
    },
    {
      id: "marketing",
      kind: "custom",
      type: "checkbox",
      enabled: true,
      required: false,
    },
    {
      id: "disabled",
      kind: "custom",
      type: "text",
      enabled: false,
      required: false,
    },
    { id: "customer_name", kind: "builtin", enabled: true, required: true },
    {
      id: "entry",
      kind: "custom",
      type: "select",
      enabled: true,
      required: false,
      options: [{ value: "front" }],
    },
  ],
};

test("remembered custom details exclude consent, disabled and invented fields", () => {
  assert.deepEqual(
    rememberedCheckoutFields(form, {
      "building-code": "001-test",
      marketing: true,
      disabled: "private",
      customer_name: "Name",
      invented: "unknown",
    }),
    { "building-code": "001-test" },
  );
});

test("profile restore preserves explicit edits and ignores obsolete fields and choices", () => {
  assert.deepEqual(
    restoreCheckoutFields(
      form,
      {
        "building-code": "001-test",
        marketing: "true",
        disabled: "old",
        entry: "removed",
        invented: "unknown",
      },
      {},
    ),
    { "building-code": "001-test" },
  );
  assert.deepEqual(
    restoreCheckoutFields(
      form,
      { "building-code": "old", entry: "front" },
      { "building-code": "" },
    ),
    { "building-code": "", entry: "front" },
  );
});

const saved: CustomerCheckoutProfile = {
  name: "Demo Guest",
  phone: "+972 50-123-4567",
  address: "1 Test Street",
  city: "Test City",
  floor: "3",
  apt: "7",
  entry_code: "001",
  delivery_notes: "Ring once",
  custom_fields: {
    delivery: {
      "building-code": "001-test",
      entry: "removed",
      disabled: "old",
      marketing: "true",
    },
    pickup: { "building-code": "pickup" },
  },
};
const current: CustomerCheckoutProfileInput = {
  name: " Demo  Guest ",
  phone: "+972501234567",
  order_type: "delivery",
  delivery: {
    address: saved.address,
    city: saved.city,
    floor: "3",
    apt: "7",
    entry_code: "001",
    delivery_notes: "Ring once",
    address_token: "renewed-proof",
  },
  custom_fields: { "building-code": "001-test", entry: "" },
};

test("unchanged remembered details ignore formatting, fresh proofs and obsolete custom fields", () => {
  assert.equal(hasCheckoutProfileChanges(saved, current, form), false);
  assert.equal(
    hasCheckoutProfileChanges(
      saved,
      {
        ...current,
        delivery: { ...current.delivery!, address_token: "another-proof" },
      },
      form,
    ),
    false,
  );
  assert.equal(
    hasCheckoutProfileChanges(
      saved,
      {
        ...current,
        order_type: "pickup",
        delivery: undefined,
        custom_fields: { "building-code": "pickup" },
      },
      form,
    ),
    false,
  );
});

test("profile comparison detects contact, all delivery details and custom field changes including clears", () => {
  for (const key of ["name", "phone"] as const) {
    assert.equal(
      hasCheckoutProfileChanges(saved, { ...current, [key]: "changed" }, form),
      true,
      key,
    );
  }
  for (const key of [
    "address",
    "city",
    "floor",
    "apt",
    "entry_code",
    "delivery_notes",
  ] as const) {
    assert.equal(
      hasCheckoutProfileChanges(
        saved,
        { ...current, delivery: { ...current.delivery!, [key]: "" } },
        form,
      ),
      true,
      key,
    );
  }
  assert.equal(
    hasCheckoutProfileChanges(
      saved,
      { ...current, custom_fields: { "building-code": "" } },
      form,
    ),
    true,
  );
  assert.equal(hasCheckoutProfileChanges(undefined, current, form), true);
});

test("empty optional answers and order-only checkbox consent do not make a saved profile dirty", () => {
  assert.equal(
    hasCheckoutProfileChanges(
      { ...saved, custom_fields: {} },
      {
        ...current,
        custom_fields: { "building-code": "", entry: "", marketing: "true" },
      },
      form,
    ),
    false,
  );
  assert.equal(
    hasCheckoutProfileChanges(
      saved,
      {
        ...current,
        custom_fields: { ...current.custom_fields, marketing: "false" },
      },
      form,
    ),
    false,
  );
  assert.equal(
    hasCheckoutProfileChanges(
      saved,
      { ...current, delivery: undefined, custom_fields: {} },
      null,
    ),
    false,
  );
});
