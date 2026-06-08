import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItemPortionLabel } from "../portion";
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

test("range from first and last option portions", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Normal", portion: "250g" },
      { id: 2, name: "Grand", portion: "500g" },
    ])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "250g - 500g");
});

test("single option shows the single portion (no range)", () => {
  const it = item({
    optionSets: [sizeSet([{ id: 1, name: "Normal", portion: "250g" }])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "250g");
});

test("equal first/last portions collapse to a single value", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "A", portion: "250g" },
      { id: 2, name: "B", portion: "250g" },
    ])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "250g");
});

test("range respects sort order, not array order", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 2, name: "Grand", portion: "500g", sortOrder: 1 },
      { id: 1, name: "Normal", portion: "250g", sortOrder: 0 },
    ])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "250g - 500g");
});

test("falls back to item-level portion when no options carry portions", () => {
  const it = item({
    portion: "par personne",
    optionSets: [sizeSet([{ id: 1, name: "Normal" }])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "par personne");
});

test("item-level portion used when there are no option sets", () => {
  const it = item({ portion: "par personne" });
  assert.equal(deriveItemPortionLabel(it, "fr"), "par personne");
});

test("empty when nothing is configured", () => {
  assert.equal(deriveItemPortionLabel(item({}), "fr"), "");
});

test("options with blank portions are ignored, ends taken from filled ones", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Small", portion: "" },
      { id: 2, name: "Medium", portion: "250g" },
      { id: 3, name: "Large", portion: "500g" },
    ])],
  });
  assert.equal(deriveItemPortionLabel(it, "fr"), "250g - 500g");
});

test("localized option portion overrides the source value", () => {
  const set = sizeSet([
    { id: 1, name: "Normal", portion: "par personne" },
  ]);
  set.options[0].translations = { portion: { en: "per person" } };
  const it = item({ optionSets: [set] });
  assert.equal(deriveItemPortionLabel(it, "en"), "per person");
  assert.equal(deriveItemPortionLabel(it, "fr"), "par personne");
});
