import assert from "node:assert/strict";
import test from "node:test";

import { fulfillmentItemsFromCart } from "@/lib/scheduling";
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
