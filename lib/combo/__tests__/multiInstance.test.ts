import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_COMBO_QUANTITY,
  clampComboQuantity,
  initialInstanceSelections,
  makeInitialInstances,
  firstChoiceStepIdx,
  instanceComplete,
  copyPreviousInstance,
  instanceExtraDelta,
  instancesTotalPrice,
} from "../multiInstance";
import type { ComboMenu, ComboStep, ComboCartSelection } from "../../types";

function step(partial: Partial<ComboStep> = {}): ComboStep {
  return {
    id: 1,
    name: "Step",
    minPicks: 1,
    maxPicks: 1,
    sortOrder: 0,
    items: [],
    ...partial,
  };
}

// A combo with: a preset step (single item × 2, no choice) and a choice step
// (2 options, pick 1). priceDelta 3 on the chosen option.
function combo(): ComboMenu {
  return {
    id: 42,
    name: "Trio",
    price: 50,
    isActive: true,
    sortOrder: 0,
    steps: [
      step({
        id: 10,
        name: "Bread",
        minPicks: 2,
        maxPicks: 2,
        items: [
          { id: 100, menuItemId: 1, optionId: null, priceDelta: 0, menuItem: { id: 1, name: "Halot", price: 0 } },
        ],
      }),
      step({
        id: 20,
        name: "Drink",
        minPicks: 1,
        maxPicks: 1,
        items: [
          { id: 200, menuItemId: 2, optionId: null, priceDelta: 3, menuItem: { id: 2, name: "Cola", price: 0 } },
          { id: 201, menuItemId: 3, optionId: null, priceDelta: 0, menuItem: { id: 3, name: "Water", price: 0 } },
        ],
      }),
    ],
  };
}

test("clampComboQuantity clamps to 1..MAX", () => {
  assert.equal(clampComboQuantity(0), 1);
  assert.equal(clampComboQuantity(-5), 1);
  assert.equal(clampComboQuantity(3), 3);
  assert.equal(clampComboQuantity(MAX_COMBO_QUANTITY + 5), MAX_COMBO_QUANTITY);
  assert.equal(clampComboQuantity(2.7), 2); // floors
});

test("clampComboQuantity maps non-finite inputs to 1", () => {
  assert.equal(clampComboQuantity(NaN), 1);
  assert.equal(clampComboQuantity(Infinity), 1);
});

test("initialInstanceSelections pre-fills only the no-choice step", () => {
  const sel = initialInstanceSelections(combo());
  assert.equal(sel.length, 1);
  assert.equal(sel[0].stepId, 10);
  assert.equal(sel[0].menuItemId, 1);
  assert.equal(sel[0].quantity, 2);
});

test("initialInstanceSelections skips a sold-out single-item step", () => {
  const c = combo();
  c.steps[0].items[0].menuItem.availabilityState = "sold_out";
  assert.equal(initialInstanceSelections(c).length, 0);
});

test("makeInitialInstances builds N independent pre-filled instances", () => {
  const inst = makeInitialInstances(combo(), 3);
  assert.equal(inst.length, 3);
  assert.equal(inst[0].length, 1);
  // independence: mutating one must not touch another
  inst[0].push({ stepId: 20, stepName: "Drink", menuItemId: 2, menuItemName: "Cola", optionId: null, quantity: 1, priceDelta: 3 });
  assert.equal(inst[1].length, 1);
});

test("firstChoiceStepIdx returns the first step needing a real choice", () => {
  assert.equal(firstChoiceStepIdx(combo()), 1);
});

test("firstChoiceStepIdx returns 0 for an all-preset combo", () => {
  const c: ComboMenu = {
    id: 1,
    name: "AllPreset",
    price: 50,
    isActive: true,
    sortOrder: 0,
    steps: [
      step({
        id: 10,
        name: "Only",
        minPicks: 2,
        maxPicks: 2,
        items: [
          { id: 100, menuItemId: 1, optionId: null, priceDelta: 0, menuItem: { id: 1, name: "Item", price: 0 } },
        ],
      }),
    ],
  };
  assert.equal(firstChoiceStepIdx(c), 0);
});

test("instanceComplete is false until every step meets minPicks", () => {
  const c = combo();
  const sel = initialInstanceSelections(c); // bread done, drink missing
  assert.equal(instanceComplete(c, sel), false);
  sel.push({ stepId: 20, stepName: "Drink", menuItemId: 3, menuItemName: "Water", optionId: null, quantity: 1, priceDelta: 0 });
  assert.equal(instanceComplete(c, sel), true);
});

test("copyPreviousInstance deep-copies index-1 into index", () => {
  const a: ComboCartSelection[] = [{ stepId: 20, stepName: "Drink", menuItemId: 2, menuItemName: "Cola", optionId: null, quantity: 1, priceDelta: 3 }];
  const instances: ComboCartSelection[][] = [a, []];
  const next = copyPreviousInstance(instances, 1);
  assert.deepEqual(next[1], a);
  assert.notEqual(next[1], a); // new array
  assert.notEqual(next[1][0], a[0]); // new element objects
  // index 0 is a no-op (no previous)
  assert.deepEqual(copyPreviousInstance(instances, 0), instances);
});

test("instanceExtraDelta sums priceDelta × quantity", () => {
  const sel: ComboCartSelection[] = [
    { stepId: 20, stepName: "Drink", menuItemId: 2, menuItemName: "Cola", optionId: null, quantity: 2, priceDelta: 3 },
  ];
  assert.equal(instanceExtraDelta(sel), 6);
});

test("instancesTotalPrice = N×base + sum of all deltas", () => {
  const c = combo();
  const inst: ComboCartSelection[][] = [
    [{ stepId: 20, stepName: "Drink", menuItemId: 2, menuItemName: "Cola", optionId: null, quantity: 1, priceDelta: 3 }],
    [{ stepId: 20, stepName: "Drink", menuItemId: 3, menuItemName: "Water", optionId: null, quantity: 1, priceDelta: 0 }],
  ];
  // 2 × 50 + (3 + 0) = 103
  assert.equal(instancesTotalPrice(c, inst), 103);
});
