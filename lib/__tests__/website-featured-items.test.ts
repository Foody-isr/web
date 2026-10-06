import assert from "node:assert/strict";
import test from "node:test";
import {
  featuredCarouselOffset,
  featuredEligibleItems,
  featuredItemsDesign,
} from "../websiteFeaturedItems";
import type { MenuData, MenuItem } from "../types";
import { selectFeaturedMenuItems } from "../../components/sections/MenuHighlightsSection";

const item = (
  id: string,
  groupId = "1",
  extra: Partial<MenuItem> = {},
): MenuItem => ({ id, groupId, name: id, price: 4, ...extra });
test("featured items never expose ungrouped, hidden, combo-only or tour items", () => {
  const menu = {
    groups: [{ id: "1" }],
    items: [
      item("1"),
      item("2", "missing"),
      item("3", "1", { comboOnly: true }),
      item("4", "1", { availabilityState: "hidden" }),
      item("5", "1", { availabilityState: "sold_out" }),
    ],
  } as MenuData;
  const tour = { ...menu, items: [item("6")], tour: { id: 1 } } as MenuData;
  assert.deepEqual(
    featuredEligibleItems([menu, menu, tour]).map((item) => item.id),
    ["1", "5"],
  );
});
test("manual order and popularity ranking survive duplicates and disappeared public items", () => {
  const menus = [
    {
      items: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        price: i,
      })),
    },
  ];
  assert.deepEqual(
    selectFeaturedMenuItems(menus, [4, 99, 2, 4], false).map((item) => item.id),
    [4, 2],
  );
  assert.equal(selectFeaturedMenuItems(menus, [], true, 10).length, 10);
  assert.deepEqual(selectFeaturedMenuItems(menus, [], false), []);
});
test("carousel loop remains continuous in both directions including long frames", () => {
  assert.equal(featuredCarouselOffset(999, 3, 1000), 2);
  assert.equal(featuredCarouselOffset(1, -3, 1000), 998);
  assert.equal(featuredCarouselOffset(900, 2200, 1000), 100);
  assert.equal(featuredCarouselOffset(0, 10, 0), 0);
});
test("menu cards and catalogue items have different defaults and bounded persisted settings", () => {
  const cards = featuredItemsDesign({}, true),
    items = featuredItemsDesign();
  assert.equal(cards.columns, 2);
  assert.equal(cards.showImages, false);
  assert.equal(cards.showDescriptions, true);
  assert.equal(items.columns, 3);
  assert.equal(items.showImages, true);
  assert.equal(items.showDescriptions, false);
  const invalid = featuredItemsDesign(
    { columns: 100, column_spacing: -10, scroll_speed: 99, max_items: "bad" },
    true,
  );
  assert.equal(invalid.columns, 2);
  assert.equal(invalid.spacing, 0);
  assert.equal(invalid.speed, 1);
  assert.equal(invalid.maxItems, 10);
  assert.equal(
    featuredItemsDesign({ show_cta_text: false }, true).showSectionButton,
    false,
  );
});
