import { test } from "node:test";
import assert from "node:assert/strict";
import { isStepItemSoldOut, soldOutStepItemIds } from "../availability";
import type { ComboStep, ComboStepItem } from "../../types";

function item(
  menuItemId: number,
  opts: { optionId?: number | null; state?: "available" | "low" | "sold_out" | "hidden" } = {}
): ComboStepItem {
  return {
    id: menuItemId * 10 + (opts.optionId ?? 0),
    menuItemId,
    optionId: opts.optionId ?? null,
    priceDelta: 0,
    menuItem: {
      id: menuItemId,
      name: `Item ${menuItemId}`,
      price: 0,
      availabilityState: opts.state,
    },
  };
}

function step(items: ComboStepItem[]): ComboStep {
  return { id: 1, name: "Salades", minPicks: 1, maxPicks: 1, sortOrder: 0, items };
}

test("a step entry the server marked sold_out is not pickable", () => {
  assert.equal(isStepItemSoldOut(item(1, { state: "sold_out" })), true);
  assert.equal(isStepItemSoldOut(item(1, { state: "available" })), false);
});

test("an entry with no computed state stays pickable", () => {
  assert.equal(isStepItemSoldOut(item(1)), false);
});

test("an item whose only entry is sold out is unpickable in the step", () => {
  const ids = soldOutStepItemIds(step([item(1, { state: "sold_out" }), item(2)]));
  assert.deepEqual([...ids], ["1"]);
});

// A step can expose the same salad in two sizes. Running out of 250g must not
// hide the salad when 500g is still available — only the 250g entry is gone.
test("an item keeps one size in stock stays pickable", () => {
  const ids = soldOutStepItemIds(
    step([
      item(1, { optionId: 7, state: "sold_out" }),
      item(1, { optionId: 8, state: "available" }),
    ])
  );
  assert.deepEqual([...ids], []);
});

test("an item sold out in every size it offers is unpickable", () => {
  const ids = soldOutStepItemIds(
    step([
      item(1, { optionId: 7, state: "sold_out" }),
      item(1, { optionId: 8, state: "sold_out" }),
    ])
  );
  assert.deepEqual([...ids], ["1"]);
});

test("an undefined step yields no sold-out ids", () => {
  assert.deepEqual([...soldOutStepItemIds(undefined)], []);
});
