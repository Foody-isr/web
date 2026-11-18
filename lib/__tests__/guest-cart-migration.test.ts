import assert from "node:assert/strict";
import test from "node:test";
import { migrateGuestCart } from "../../store/useCartStore";
import { fetchMenu } from "../../services/api";

const ordinary = { restaurantId: "1", currency: "ILS", lines: [{ id: "a", quantity: 1 }] };

test("an ordinary persisted cart keeps its lines, currency and restaurant", () => {
  assert.deepEqual(migrateGuestCart(ordinary), ordinary);
});

test("archived sales lines cannot become ordinary orders after an upgrade", () => {
  for (const reference of [{ tourId: 12 }, { tourSlug: "former" }]) {
    assert.deepEqual(migrateGuestCart({ ...ordinary, ...reference }), { ...ordinary, lines: [] });
  }
});

test("a legacy sales menu never supplies guest catalogue items or groups", async (context) => {
  const groups = (id: number) => [{ id, name: "Group", items: [{ id, name: "Dish", price: 20 }] }];
  context.mock.method(globalThis, "fetch", async () => Response.json({
    menus: [
      { id: 1, name: "Published", groups: groups(10) },
      { id: 2, name: "Archived", groups: groups(20), tour: { id: 4 } },
    ],
  }));
  const menu = await fetchMenu("1");
  assert.deepEqual(menu.menus.map(entry => entry.id), [1]);
  assert.deepEqual(menu.categories.map(group => String(group.id)), ["10"]);
  assert.deepEqual(menu.items.map(item => String(item.id)), ["10"]);
});
