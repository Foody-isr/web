import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import type { MenuItem } from "../types";

let useCartStore: typeof import("../../store/useCartStore").useCartStore;
before(async () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  } });
  ({ useCartStore } = await import("../../store/useCartStore"));
});

const item: MenuItem = {
  id: "312", name: "Mijoté de boeuf", price: 80, groupId: "meat",
  availabilityState: "low", buildableCount: 1,
};

beforeEach(() => useCartStore.getState().clear());

test("an oversized initial quantity is capped before entering the cart", () => {
  useCartStore.getState().addItem(item, 9);
  assert.equal(useCartStore.getState().lines[0].quantity, 1);
});

test("cart increment cannot exceed the last available portion", () => {
  useCartStore.getState().addItem(item, 1);
  const id = useCartStore.getState().lines[0].id;
  for (let i = 0; i < 9; i++) useCartStore.getState().updateQuantity(id, i + 2);
  assert.equal(useCartStore.getState().lines[0].quantity, 1);
});

test("adding again with different notes or variants shares the item stock", () => {
  useCartStore.getState().addItem(item, 1, "First", undefined, 10);
  useCartStore.getState().addItem(item, 1, "Second", undefined, 11);
  assert.equal(useCartStore.getState().lines.length, 1);
});

test("stock is shared across lines, and removing a line releases its quantity", () => {
  const stocked = { ...item, buildableCount: 3 };
  useCartStore.getState().addItem(stocked, 1);
  useCartStore.getState().addItem(stocked, 1, "No salt");
  const [first, second] = useCartStore.getState().lines;
  useCartStore.getState().updateQuantity(first.id, 9);
  assert.equal(useCartStore.getState().lines[0].quantity, 2);
  useCartStore.getState().removeItem(second.id);
  useCartStore.getState().updateQuantity(first.id, 3);
  assert.equal(useCartStore.getState().lines[0].quantity, 3);
});

test("portions already selected inside a combo count toward the same stock", () => {
  useCartStore.getState().addCombo(7, "Lunch", 80, [{
    stepId: 1, stepName: "Main", menuItemId: 312, menuItemName: item.name,
    quantity: 1, priceDelta: 0,
  }]);
  useCartStore.getState().addItem(item, 1);
  assert.equal(useCartStore.getState().lines.length, 1);
  assert.equal(useCartStore.getState().lines[0].comboId, 7);
});

test("sold-out items cannot be added, unlimited items can still increase", () => {
  useCartStore.getState().addItem({ ...item, buildableCount: 0 }, 1);
  assert.equal(useCartStore.getState().lines.length, 0);
  useCartStore.getState().addItem({ ...item, buildableCount: null }, 20);
  const line = useCartStore.getState().lines[0];
  useCartStore.getState().updateQuantity(line.id, 30);
  assert.equal(useCartStore.getState().lines[0].quantity, 30);
  useCartStore.getState().updateQuantity(line.id, 0);
  assert.equal(useCartStore.getState().lines.length, 0);
});
