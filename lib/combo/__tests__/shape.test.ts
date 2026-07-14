import { test } from "node:test";
import assert from "node:assert/strict";
import { effectivePerItemCap, isFixedComboShape } from "../shape";
import type { ComboMenu, ComboStep, ComboStepItem } from "../../types";

function item(menuItemId: number): ComboStepItem {
  return {
    id: menuItemId * 10,
    menuItemId,
    optionId: null,
    priceDelta: 0,
    menuItem: { id: menuItemId, name: `Item ${menuItemId}`, price: 0 },
  };
}

function step(p: Partial<ComboStep> = {}): ComboStep {
  return { id: 1, name: "Step", minPicks: 1, maxPicks: 1, sortOrder: 0, items: [], ...p };
}

function combo(...steps: ComboStep[]): ComboMenu {
  return { id: 1, name: "Combo", price: 0, isActive: true, sortOrder: 0, steps };
}

// A group-sourced step resolving to exactly N items, "pick N", is only a fixed
// bundle when an item cannot be taken twice. This is the SALADS BOX BIG case:
// 16 salads on the carte, pick 16, up to 2 of the same one — trading one salad
// for a second copy of another is a real choice, so the customer must get the
// step builder, not a preset "one of each" list.
const salads = Array.from({ length: 16 }, (_, i) => item(i + 1));

test("N items / pick N with a per-item cap of 2 is a choice, not a fixed bundle", () => {
  const c = combo(step({ minPicks: 16, maxPicks: 16, items: salads, maxPerItem: 2 }));
  assert.equal(isFixedComboShape(c), false);
});

test("N items / pick N with unlimited repeats is a choice", () => {
  const c = combo(step({ minPicks: 16, maxPicks: 16, items: salads, maxPerItem: 0 }));
  assert.equal(isFixedComboShape(c), false);
});

test("N items / pick N with a per-item cap of 1 is a fixed bundle (one of each)", () => {
  const c = combo(step({ minPicks: 16, maxPicks: 16, items: salads, maxPerItem: 1 }));
  assert.equal(isFixedComboShape(c), true);
});

test("an itemLimits override that permits repeats makes the step a choice", () => {
  const c = combo(
    step({
      minPicks: 16,
      maxPicks: 16,
      items: salads,
      maxPerItem: 1,
      itemLimits: [{ menuItemId: 3, maxQty: 2 }],
    }),
  );
  assert.equal(isFixedComboShape(c), false);
});

test("an itemLimits override of 0 (unlimited) makes the step a choice", () => {
  const c = combo(
    step({
      minPicks: 16,
      maxPicks: 16,
      items: salads,
      maxPerItem: 1,
      itemLimits: [{ menuItemId: 3, maxQty: 0 }],
    }),
  );
  assert.equal(isFixedComboShape(c), false);
});

test("per-size rules leave the customer a size to pick, so the step is a choice", () => {
  const c = combo(
    step({
      minPicks: 16,
      maxPicks: 16,
      items: salads,
      maxPerItem: 1,
      variantRules: [
        { variantLabel: "250g", minPicks: 0, maxPicks: 0 },
        { variantLabel: "500g", minPicks: 0, maxPicks: 4 },
      ],
    }),
  );
  assert.equal(isFixedComboShape(c), false);
});

test("a single item taken N times stays fixed whatever the cap", () => {
  // One item, 3 picks: there is nothing to decide, and the cap is irrelevant —
  // no backfill touches this shape.
  const c = combo(step({ minPicks: 3, maxPicks: 3, items: [item(1)], maxPerItem: 0 }));
  assert.equal(isFixedComboShape(c), true);
});

test("more items than picks is always a choice", () => {
  const c = combo(step({ minPicks: 3, maxPicks: 3, items: salads, maxPerItem: 1 }));
  assert.equal(isFixedComboShape(c), false);
});

test("a min/max range is always a choice", () => {
  const c = combo(step({ minPicks: 1, maxPicks: 16, items: salads, maxPerItem: 1 }));
  assert.equal(isFixedComboShape(c), false);
});

test("a combo is fixed only when every step is forced", () => {
  const forced = step({ id: 1, minPicks: 2, maxPicks: 2, items: [item(1), item(2)], maxPerItem: 1 });
  const choice = step({ id: 2, minPicks: 1, maxPicks: 1, items: [item(3), item(4)] });
  assert.equal(isFixedComboShape(combo(forced)), true);
  assert.equal(isFixedComboShape(combo(forced, choice)), false);
});

test("a combo with no steps is not a fixed bundle", () => {
  assert.equal(isFixedComboShape(combo()), false);
});

test("a step with no resolved items is not a fixed bundle", () => {
  const c = combo(step({ minPicks: 2, maxPicks: 2, items: [], maxPerItem: 1 }));
  assert.equal(isFixedComboShape(c), false);
});

test("effectivePerItemCap: override wins over the step default", () => {
  const s = step({ items: [item(1), item(2)], maxPerItem: 2, itemLimits: [{ menuItemId: 2, maxQty: 1 }] });
  assert.equal(effectivePerItemCap(s, 1), 2);
  assert.equal(effectivePerItemCap(s, 2), 1);
});

test("effectivePerItemCap: no cap anywhere means unlimited", () => {
  assert.equal(effectivePerItemCap(step({ items: [item(1)] }), 1), 0);
});
