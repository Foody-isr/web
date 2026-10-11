import assert from "node:assert/strict";
import test from "node:test";
import { confirmationItems } from "@/lib/order-summary";
import { ensureCheckoutPhone } from "@/lib/checkout-fields";

test("confirmation uses the resolved snapshot price without charging modifiers twice", () => {
  const [item] = confirmationItems([
    {
      id: 1,
      menu_item_id: 2,
      name: "Burger",
      quantity: 2,
      price: 15,
      selected_variant_name: "Large",
      modifiers: [{ name: "Cheese" }],
    },
  ]);
  assert.equal(item.total, 30);
  assert.deepEqual(item.details, ["Large", "Cheese"]);
});

test("confirmation groups each combo instance and counts its base price once", () => {
  const items = confirmationItems([
    {
      id: 1,
      menu_item_id: 2,
      name: "Burger",
      quantity: 1,
      price: 3,
      combo_group: "a",
      combo_name: "Lunch",
      combo_price: 20,
    },
    {
      id: 2,
      menu_item_id: 3,
      name: "Fries",
      quantity: 2,
      price: 1,
      combo_group: "a",
      combo_price: 20,
    },
    {
      id: 3,
      menu_item_id: 2,
      name: "Burger",
      quantity: 1,
      price: 0,
      combo_group: "b",
      combo_price: 20,
    },
  ]);
  assert.deepEqual(
    items.map((item) => item.total),
    [25, 20],
  );
  assert.deepEqual(items[0].details, ["1 × Burger", "2 × Fries"]);
});

test("contact phone remains visible and required independently of OTP and builder visibility", () => {
  const original = {
    require_auth: false,
    fields: [
      {
        id: "customer_phone",
        kind: "builtin" as const,
        enabled: false,
        required: false,
        visible_when: { field: "other", operator: "not_empty" as const },
      },
    ],
  };
  const form = ensureCheckoutPhone(original)!;
  assert.equal(form.fields[0].enabled, true);
  assert.equal(form.fields[0].required, true);
  assert.equal(form.fields[0].visible_when, undefined);
  assert.equal(original.fields[0].enabled, false);
  assert.equal(
    ensureCheckoutPhone({ require_auth: false, fields: [] })?.fields[0].id,
    "customer_phone",
  );
  assert.equal(ensureCheckoutPhone(null), null);
});
