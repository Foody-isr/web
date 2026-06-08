import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItemPortion } from "../portion";
import type { MenuItem, OptionSetType } from "../types";

function item(partial: Partial<MenuItem>): MenuItem {
  return {
    id: "1",
    name: "Test",
    price: 0,
    groupId: "g1",
    ...partial,
  };
}

function sizeSet(
  options: Array<{ id: number; name: string; portion?: string; sortOrder?: number }>,
): OptionSetType {
  return {
    id: 1,
    name: "Sizes",
    sortOrder: 0,
    options: options.map((o, i) => ({
      id: o.id,
      name: o.name,
      price: 0,
      portion: o.portion,
      isActive: true,
      sortOrder: o.sortOrder ?? i,
    })),
  };
}

test("range from first and last option portions is flagged fromVariants", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Normal", portion: "250g" },
      { id: 2, name: "Grand", portion: "500g" },
    ])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "250g - 500g", fromVariants: true });
});

test("single option shows the single portion (no range)", () => {
  const it = item({
    optionSets: [sizeSet([{ id: 1, name: "Normal", portion: "250g" }])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "250g", fromVariants: true });
});

test("equal first/last portions collapse to a single value", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "A", portion: "250g" },
      { id: 2, name: "B", portion: "250g" },
    ])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "250g", fromVariants: true });
});

test("range respects sort order, not array order", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 2, name: "Grand", portion: "500g", sortOrder: 1 },
      { id: 1, name: "Normal", portion: "250g", sortOrder: 0 },
    ])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "250g - 500g", fromVariants: true });
});

test("falls back to item-level portion (not fromVariants) when no options carry portions", () => {
  const it = item({
    portion: "par personne",
    optionSets: [sizeSet([{ id: 1, name: "Normal" }])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "par personne", fromVariants: false });
});

test("item-level portion used when there are no option sets", () => {
  const it = item({ portion: "par personne" });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "par personne", fromVariants: false });
});

test("empty when nothing is configured", () => {
  assert.deepEqual(deriveItemPortion(item({}), "fr"), { label: "", fromVariants: false });
});

test("options with blank portions are ignored, ends taken from filled ones", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Small", portion: "" },
      { id: 2, name: "Medium", portion: "250g" },
      { id: 3, name: "Large", portion: "500g" },
    ])],
  });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "250g - 500g", fromVariants: true });
});

test("localized option portion overrides the source value", () => {
  const set = sizeSet([
    { id: 1, name: "Normal", portion: "par personne" },
  ]);
  set.options[0].translations = { portion: { en: "per person" } };
  const it = item({ optionSets: [set] });
  assert.deepEqual(deriveItemPortion(it, "en"), { label: "per person", fromVariants: true });
  assert.deepEqual(deriveItemPortion(it, "fr"), { label: "par personne", fromVariants: true });
});
