import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteCartPosition } from "../websiteCart";

test("the mini-cart follows the cart icon instead of covering it on tall headers", () => {
  const position = websiteCartPosition(
    { left: 1100, right: 1140, bottom: 180 },
    { width: 1440, height: 900 },
    false,
  );
  assert.equal(position.top, 188);
  assert.equal(position.left, 720);
  assert.equal(position.maxHeight, 688);
});

test("RTL aligns the panel with the left cart icon and keeps both edges on screen", () => {
  assert.equal(
    websiteCartPosition(
      { left: 60, right: 100, bottom: 80 },
      { width: 1024, height: 768 },
      true,
    ).left,
    60,
  );
  assert.equal(
    websiteCartPosition(
      { left: 4, right: 36, bottom: 80 },
      { width: 768, height: 768 },
      false,
    ).left,
    24,
  );
  assert.equal(
    websiteCartPosition(
      { left: 760, right: 792, bottom: 80 },
      { width: 800, height: 768 },
      true,
    ).left,
    356,
  );
});

test("a low cart icon clamps the available height inside the viewport", () => {
  const position = websiteCartPosition(
    { left: 1000, right: 1040, bottom: 890 },
    { width: 1440, height: 900 },
    false,
  );
  assert.equal(position.top, 804);
  assert.equal(position.maxHeight, 72);
});
