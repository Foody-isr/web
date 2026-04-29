import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFont } from "../pickFont";
import type { TypographyPairing } from "../types";

const pairing = {
  id: "x", name: "x", description: "x",
  pairing: {
    displayLatin: { family: "Switzer", weights: [600] },
    bodyLatin:    { family: "Switzer", weights: [400] },
    displayHebrew: { family: "Heebo", weights: [600] },
    bodyHebrew:    { family: "Heebo", weights: [400] },
  },
  scale: {} as any,
} as TypographyPairing;

test("pickFont returns Latin display in LTR", () => {
  assert.equal(pickFont(pairing, "display", "ltr"), "Switzer");
});

test("pickFont returns Hebrew body in RTL", () => {
  assert.equal(pickFont(pairing, "body", "rtl"), "Heebo");
});

test("pickFont returns Latin body in LTR", () => {
  assert.equal(pickFont(pairing, "body", "ltr"), "Switzer");
});

test("pickFont returns Hebrew display in RTL", () => {
  assert.equal(pickFont(pairing, "display", "rtl"), "Heebo");
});
