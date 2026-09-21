import assert from "node:assert/strict";
import test from "node:test";

import { formatModifierLabel, formatSelectedVariantName } from "../cart";
import type { CartLine, MenuItemModifier } from "../types";

const modifier: MenuItemModifier = {
  id: "modifier-1",
  name: "Onion",
  action: "remove",
  priceDelta: 0,
  translations: {
    name: { fr: "Oignon", he: "בצל" },
  },
};

test("modifier names and removal prefixes follow the selected language", () => {
  assert.equal(formatModifierLabel(modifier, "fr"), "Sans Oignon");
  assert.equal(formatModifierLabel(modifier, "he"), "בלי בצל");
  assert.equal(formatModifierLabel(modifier, "en"), "No Onion");
});

test("an already-prefixed translated modifier is not prefixed twice", () => {
  assert.equal(
    formatModifierLabel({
      ...modifier,
      translations: { name: { fr: "Sans oignon" } },
    }, "fr"),
    "Sans oignon",
  );
});

test("selected option names are resolved from their translation map", () => {
  const line = {
    selectedVariantId: 12,
    selectedVariantName: "Large",
    item: {
      id: "item-1",
      name: "Pizza",
      price: 32,
      groupId: "group-1",
      optionSets: [{
        id: 3,
        name: "Size",
        sortOrder: 0,
        options: [{
          id: 12,
          name: "Large",
          price: 42,
          isActive: true,
          sortOrder: 0,
          translations: { name: { fr: "Grand", he: "גדול" } },
        }],
      }],
    },
  } as Pick<CartLine, "item" | "selectedVariantId" | "selectedVariantName">;

  assert.equal(formatSelectedVariantName(line, "fr"), "Grand");
  assert.equal(formatSelectedVariantName(line, "he"), "גדול");
  assert.equal(formatSelectedVariantName(line, "en"), "Large");
});

test("legacy option snapshots remain available when the option cannot be found", () => {
  const line = {
    selectedVariantId: 99,
    selectedVariantName: "Archived size",
    item: {
      id: "item-1",
      name: "Pizza",
      price: 32,
      groupId: "group-1",
      optionSets: [],
    },
  } as Pick<CartLine, "item" | "selectedVariantId" | "selectedVariantName">;

  assert.equal(formatSelectedVariantName(line, "fr"), "Archived size");
});
