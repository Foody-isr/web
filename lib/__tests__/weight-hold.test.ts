import assert from "node:assert/strict";
import test from "node:test";
import type { CartLine } from "@/lib/types";
import { weightHoldPreview } from "@/lib/checkout-payment";

const weighted = { quantity: 1, item: { id: "w", price: 100, pricingMode: "by_weight" } } as CartLine;
const fixed = { quantity: 1, item: { id: "f", price: 50 } } as CartLine;

test("weight margin excludes fixed-price items and delivery", () => {
  assert.equal(weightHoldPreview([weighted, fixed], 160, 20), 18000);
  assert.equal(weightHoldPreview([weighted, fixed], 160, 0), 16000);
  assert.equal(weightHoldPreview([{ ...weighted, quantity: 2 }, fixed], 250, 30), 31000);
  assert.equal(weightHoldPreview([weighted], 100, 12.5), 11250);
});

test("unknown/invalid policy never invents a 20 percent ceiling", () => {
  for (const percent of [undefined, NaN, Infinity, -1, 101]) assert.equal(weightHoldPreview([weighted], 100, percent), null);
  assert.equal(weightHoldPreview([fixed], 50, 20), null);
  assert.equal(weightHoldPreview([weighted], NaN, 20), null);
});
