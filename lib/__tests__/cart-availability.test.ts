import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLineAvailability, type ItemAvailability } from "../cart-availability";
import type { CartLine, MenuItem } from "../types";

function menuItem(partial: Partial<MenuItem> = {}): MenuItem {
  return { id: "1", name: "Test", price: 0, groupId: "g1", ...partial };
}

function line(partial: Partial<CartLine> = {}): CartLine {
  return { id: "l1", item: menuItem(), quantity: 1, ...partial };
}

function availMap(entries: Array<[string, ItemAvailability]>): Map<string, ItemAvailability> {
  return new Map(entries);
}

test("available item with enough stock is ok", () => {
  const result = computeLineAvailability(
    line({ quantity: 2 }),
    availMap([["1", { state: "available" }]]),
  );
  assert.deepEqual(result, { status: "ok" });
});

test("sold_out state blocks the line", () => {
  const result = computeLineAvailability(
    line(),
    availMap([["1", { state: "sold_out" }]]),
  );
  assert.deepEqual(result, { status: "sold_out" });
});

test("available === false is treated as sold_out", () => {
  const result = computeLineAvailability(
    line(),
    availMap([["1", { available: false }]]),
  );
  assert.deepEqual(result, { status: "sold_out" });
});

test("buildableCount of 0 blocks the line as sold_out", () => {
  const result = computeLineAvailability(
    line({ quantity: 2 }),
    availMap([["1", { state: "low", buildableCount: 0 }]]),
  );
  assert.deepEqual(result, { status: "sold_out" });
});

test("buildableCount below requested quantity is insufficient with the available count", () => {
  const result = computeLineAvailability(
    line({ quantity: 3 }),
    availMap([["1", { state: "low", buildableCount: 2 }]]),
  );
  assert.deepEqual(result, { status: "insufficient", available: 2 });
});

test("buildableCount at or above requested quantity is ok", () => {
  const result = computeLineAvailability(
    line({ quantity: 3 }),
    availMap([["1", { state: "low", buildableCount: 5 }]]),
  );
  assert.deepEqual(result, { status: "ok" });
});

test("low state with no buildableCount is ok", () => {
  const result = computeLineAvailability(
    line({ quantity: 4 }),
    availMap([["1", { state: "low", buildableCount: null }]]),
  );
  assert.deepEqual(result, { status: "ok" });
});

test("combo lines are not proactively checked (server guard is the safety net)", () => {
  const result = computeLineAvailability(
    line({ comboId: 42, item: menuItem({ id: "combo-42" }) }),
    availMap([["combo-42", { state: "sold_out" }]]),
  );
  assert.deepEqual(result, { status: "ok" });
});

test("item missing from the fresh menu passes through as ok", () => {
  const result = computeLineAvailability(line(), availMap([]));
  assert.deepEqual(result, { status: "ok" });
});

test("combo line sold out via rolled-up combo state", () => {
  const line = { id: "l1", comboId: "77", item: { id: "77" }, quantity: 1 } as any;
  const result = computeLineAvailability(line, availMap([["77", { state: "sold_out" }]]));
  assert.deepEqual(result, { status: "sold_out" });
});

test("combo line ok when combo available, ignoring per-item count", () => {
  const line = { id: "l2", comboId: "77", item: { id: "77" }, quantity: 3 } as any;
  // buildableCount must NOT gate a combo line — components own that via the guard.
  const result = computeLineAvailability(line, availMap([["77", { state: "available", buildableCount: 1 }]]));
  assert.deepEqual(result, { status: "ok" });
});

test("combo line ok when combo absent from menu", () => {
  const line = { id: "l3", comboId: "88", item: { id: "88" }, quantity: 1 } as any;
  const result = computeLineAvailability(line, availMap([]));
  assert.deepEqual(result, { status: "ok" });
});
