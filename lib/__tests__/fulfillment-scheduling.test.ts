import assert from "node:assert/strict";
import test from "node:test";

import { fulfillmentItemsFromCart, resolveSchedulingSelection } from "@/lib/scheduling";
import type { CartLine } from "@/lib/types";

test("fulfillmentItemsFromCart aggregates regular lines and expanded combo selections", () => {
  const lines = [
    {
      id: "regular",
      item: { id: "10", name: "Cookie", price: 10, groupId: "1" },
      quantity: 2,
    },
    {
      id: "combo",
      item: { id: "20", name: "Box", price: 40, groupId: "1" },
      quantity: 2,
      comboId: 20,
      comboSelections: [],
      comboOrderBatch: [
        [{ stepId: 1, stepName: "Cake", menuItemId: 30, menuItemName: "Cake", quantity: 1, priceDelta: 0 }],
        [
          { stepId: 1, stepName: "Cake", menuItemId: 30, menuItemName: "Cake", quantity: 1, priceDelta: 0 },
          { stepId: 2, stepName: "Cookie", menuItemId: 10, menuItemName: "Cookie", quantity: 2, priceDelta: 0 },
        ],
      ],
    },
  ] satisfies CartLine[];

  const result = fulfillmentItemsFromCart(lines).sort((a, b) => Number(a.itemId) - Number(b.itemId));
  assert.deepEqual(result, [
    { itemId: "10", quantity: 4 },
    { itemId: "20", quantity: 2 },
    { itemId: "30", quantity: 2 },
  ]);
});

test("a slower cart retires an early slot without advancing a customer's later choice", () => {
  const morning = { scheduledFor: "2026-10-14", selectedSlot: { start: "09:00", end: "09:30" } };
  const afternoon = { start: "15:00", end: "15:30" };
  const later = { start: "17:00", end: "17:30" };
  const slots = { "2026-10-14": [afternoon, later] };
  assert.deepEqual(resolveSchedulingSelection(slots, morning), { scheduledFor: morning.scheduledFor, selectedSlot: afternoon });
  const requested = { scheduledFor: morning.scheduledFor, selectedSlot: later };
  assert.deepEqual(resolveSchedulingSelection(slots, requested), requested);
  assert.deepEqual(resolveSchedulingSelection({"2026-10-14": [later, afternoon]}, morning), { scheduledFor: morning.scheduledFor, selectedSlot: afternoon });
  assert.deepEqual(resolveSchedulingSelection({"2026-10-14": [later, afternoon]}, requested), requested);
  assert.equal(resolveSchedulingSelection({}, morning), null);
  assert.equal(resolveSchedulingSelection(slots, { ...morning, scheduledFor: "2026-10-15" }), null);
});
