import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_COMBO_QUANTITY,
  clampComboQuantity,
  firstChoiceStepIdx,
  initialBatchSelections,
  batchStepPicks,
  batchComplete,
  batchExtraDelta,
  batchTotalPrice,
  splitComboBatch,
} from "../batch";
import type { ComboMenu, ComboStep, ComboCartSelection } from "../../types";

function step(p: Partial<ComboStep> = {}): ComboStep {
  return { id: 1, name: "Step", minPicks: 1, maxPicks: 1, sortOrder: 0, items: [], ...p };
}

// [3 salads, 1 meat, 1 fish]; meat step is preset single-item.
function combo(): ComboMenu {
  return {
    id: 42, name: "Trio", price: 50, isActive: true, sortOrder: 0,
    steps: [
      step({ id: 10, name: "Salads", minPicks: 3, maxPicks: 3, items: [
        { id: 100, menuItemId: 1, optionId: null, priceDelta: 0, menuItem: { id: 1, name: "Caesar", price: 0 } },
        { id: 101, menuItemId: 2, optionId: null, priceDelta: 2, menuItem: { id: 2, name: "Greek", price: 0 } },
      ]}),
      step({ id: 20, name: "Meat", minPicks: 1, maxPicks: 1, items: [
        { id: 200, menuItemId: 3, optionId: null, priceDelta: 0, menuItem: { id: 3, name: "Beef", price: 0 } },
      ]}),
      step({ id: 30, name: "Fish", minPicks: 1, maxPicks: 1, items: [
        { id: 300, menuItemId: 4, optionId: null, priceDelta: 0, menuItem: { id: 4, name: "Salmon", price: 0 } },
        { id: 301, menuItemId: 5, optionId: null, priceDelta: 0, menuItem: { id: 5, name: "Tuna", price: 0 } },
      ]}),
    ],
  };
}

function sel(stepId: number, menuItemId: number, quantity: number, priceDelta = 0, optionId: number | null = null): ComboCartSelection {
  return { stepId, stepName: "S", menuItemId, menuItemName: "I", optionId, quantity, priceDelta };
}

test("clampComboQuantity clamps to 1..MAX and floors", () => {
  assert.equal(clampComboQuantity(0), 1);
  assert.equal(clampComboQuantity(3), 3);
  assert.equal(clampComboQuantity(99), MAX_COMBO_QUANTITY);
  assert.equal(clampComboQuantity(2.9), 2);
  assert.equal(clampComboQuantity(NaN), 1);
});

test("firstChoiceStepIdx returns first step needing a choice", () => {
  // Salads (multi-item) is index 0 → first choice.
  assert.equal(firstChoiceStepIdx(combo()), 0);
});

test("initialBatchSelections multiplies preset single-item steps by n", () => {
  const s = initialBatchSelections(combo(), 3);
  // Only the Meat step (single item) is preset → 1 pick × 3 = 3.
  assert.equal(s.length, 1);
  assert.equal(s[0].stepId, 20);
  assert.equal(s[0].quantity, 3);
});

test("initialBatchSelections skips a sold-out single-item step", () => {
  const c = combo();
  c.steps[1].items[0].menuItem.availabilityState = "sold_out";
  assert.equal(initialBatchSelections(c, 3).length, 0);
});

test("batchStepPicks sums quantities for a step", () => {
  const s = [sel(10, 1, 5), sel(10, 2, 4), sel(20, 3, 3)];
  assert.equal(batchStepPicks(s, 10), 9);
  assert.equal(batchStepPicks(s, 20), 3);
});

test("batchComplete requires minPicks*n per step", () => {
  const c = combo();
  const n = 3;
  // 9 salads, 3 meat, 2 fish → fish short (needs 3)
  let s = [sel(10, 1, 9), sel(20, 3, 3), sel(30, 4, 2)];
  assert.equal(batchComplete(c, s, n), false);
  s = [sel(10, 1, 9), sel(20, 3, 3), sel(30, 4, 3)];
  assert.equal(batchComplete(c, s, n), true);
});

test("batchExtraDelta sums priceDelta*quantity", () => {
  assert.equal(batchExtraDelta([sel(10, 2, 4, 2), sel(20, 3, 3, 0)]), 8);
});

test("batchTotalPrice = n*base + deltas", () => {
  const c = combo(); // base 50
  const s = [sel(10, 1, 6), sel(10, 2, 3, 2), sel(20, 3, 3), sel(30, 4, 3)];
  // 3*50 + (3 Greek * 2) = 150 + 6 = 156
  assert.equal(batchTotalPrice(c, s, 3), 156);
});

test("splitComboBatch: exact picks split into n equal valid combos", () => {
  const c = combo();
  const aggregated = [sel(10, 1, 5), sel(10, 2, 4, 2), sel(20, 3, 3), sel(30, 4, 2), sel(30, 5, 1)];
  const out = splitComboBatch(c, aggregated, 3);
  assert.equal(out.length, 3);
  for (const perCombo of out) {
    assert.equal(batchStepPicks(perCombo, 10), 3); // 3 salads each
    assert.equal(batchStepPicks(perCombo, 20), 1); // 1 meat each
    assert.equal(batchStepPicks(perCombo, 30), 1); // 1 fish each
  }
  // Totals preserved across the split (Caesar 5, Greek 4, Salmon 2, Tuna 1).
  const tally = (mid: number) => out.flat().filter((x) => x.menuItemId === mid).reduce((a, b) => a + b.quantity, 0);
  assert.equal(tally(1), 5); assert.equal(tally(2), 4);
  assert.equal(tally(4), 2); assert.equal(tally(5), 1);
});

test("splitComboBatch: range step keeps each combo within [min,max]", () => {
  const c: ComboMenu = { id: 1, name: "R", price: 10, isActive: true, sortOrder: 0, steps: [
    step({ id: 10, name: "Sides", minPicks: 2, maxPicks: 4, items: [
      { id: 1, menuItemId: 1, optionId: null, priceDelta: 0, menuItem: { id: 1, name: "A", price: 0 } },
    ]}),
  ]};
  // 7 picks across 3 combos (within [6,12]) → counts 3,2,2.
  const out = splitComboBatch(c, [sel(10, 1, 7)], 3);
  const counts = out.map((pc) => batchStepPicks(pc, 10)).sort();
  assert.deepEqual(counts, [2, 2, 3]);
  for (const ct of counts) { assert.ok(ct >= 2 && ct <= 4); }
});

test("splitComboBatch: preserves optionId on variant-pinned picks", () => {
  const c: ComboMenu = { id: 1, name: "V", price: 10, isActive: true, sortOrder: 0, steps: [
    step({ id: 10, name: "Drink", minPicks: 1, maxPicks: 1, items: [
      { id: 1, menuItemId: 1, optionId: 9, priceDelta: 0, menuItem: { id: 1, name: "Cola", price: 0 } },
    ]}),
  ]};
  const out = splitComboBatch(c, [sel(10, 1, 2, 0, 9)], 2);
  assert.equal(out.length, 2);
  for (const pc of out) { assert.equal(pc[0].optionId, 9); }
});
