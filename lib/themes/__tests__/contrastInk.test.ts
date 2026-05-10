import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastInk } from "../contrastInk";

test("contrastInk picks black on bright backgrounds", () => {
  assert.equal(contrastInk("#FFFFFF"), "#000000");
  assert.equal(contrastInk("#F1C44A"), "#000000");
});

test("contrastInk picks white on dark backgrounds", () => {
  assert.equal(contrastInk("#000000"), "#FFFFFF");
  assert.equal(contrastInk("#0A0A0C"), "#FFFFFF");
});

test("contrastInk handles short hex", () => {
  assert.equal(contrastInk("#fff"), "#000000");
  assert.equal(contrastInk("#000"), "#FFFFFF");
});
