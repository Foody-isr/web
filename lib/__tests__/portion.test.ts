import { test } from "node:test";
import assert from "node:assert/strict";
import { modalPortionLabel } from "../portion";
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

test("follows the selected option's portion when portions are filled", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Normal", portion: "250g" },
      { id: 2, name: "Grand", portion: "500g" },
    ])],
  });
  assert.equal(modalPortionLabel(it, "fr", { 1: 2 }), "500g");
  assert.equal(modalPortionLabel(it, "fr", { 1: 1 }), "250g");
});

test("defaults to the first option when nothing is selected", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "Normal", portion: "250g" },
      { id: 2, name: "Grand", portion: "500g" },
    ])],
  });
  assert.equal(modalPortionLabel(it, "fr", {}), "250g");
});

test("falls back to the option name when its portion is empty (size in the name)", () => {
  // The screenshot case: sizes live in the option NAME, portion field empty.
  const it = item({
    portion: "250g",
    optionSets: [sizeSet([
      { id: 1, name: "250g" },
      { id: 2, name: "500g" },
    ])],
  });
  assert.equal(modalPortionLabel(it, "fr", { 1: 2 }), "500g");
  assert.equal(modalPortionLabel(it, "fr", { 1: 1 }), "250g");
});

test("an unknown selected id falls back to the first option", () => {
  const it = item({
    optionSets: [sizeSet([
      { id: 1, name: "250g" },
      { id: 2, name: "500g" },
    ])],
  });
  assert.equal(modalPortionLabel(it, "fr", { 1: 999 }), "250g");
});

test("a single-option size set is not a choice; uses item-level portion", () => {
  const it = item({
    portion: "par personne",
    optionSets: [sizeSet([{ id: 1, name: "Normal", portion: "250g" }])],
  });
  assert.equal(modalPortionLabel(it, "fr", {}), "par personne");
});

test("item-level portion used when there are no option sets", () => {
  const it = item({ portion: "par personne" });
  assert.equal(modalPortionLabel(it, "fr", {}), "par personne");
});

test("empty when nothing is configured", () => {
  assert.equal(modalPortionLabel(item({}), "fr", {}), "");
});

test("localized option portion overrides the source value", () => {
  const set = sizeSet([
    { id: 1, name: "Normal", portion: "par personne" },
    { id: 2, name: "Grand", portion: "deux personnes" },
  ]);
  set.options[0].translations = { portion: { en: "per person" } };
  const it = item({ optionSets: [set] });
  assert.equal(modalPortionLabel(it, "en", { 1: 1 }), "per person");
  assert.equal(modalPortionLabel(it, "fr", { 1: 1 }), "par personne");
});

test("localized option name overrides the source value when portion is empty", () => {
  const set = sizeSet([
    { id: 1, name: "Small" },
    { id: 2, name: "Large" },
  ]);
  set.options[1].translations = { name: { he: "גדול" } };
  const it = item({ optionSets: [set] });
  assert.equal(modalPortionLabel(it, "he", { 1: 2 }), "גדול");
  assert.equal(modalPortionLabel(it, "en", { 1: 2 }), "Large");
});
