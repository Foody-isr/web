import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNavbarVisual, NAV_SCROLL_THRESHOLD } from "../state";
import type { NavbarScroll } from "../config";

const scroll = (over: Partial<NavbarScroll> = {}): NavbarScroll => ({
  transparent_at_top: false,
  scrolled_color: "#ffffff",
  hide_on_scroll: false,
  position: "sticky",
  ...over,
});

test("transparent_at_top: transparent at the very top, solid once scrolled past threshold", () => {
  const s = scroll({ transparent_at_top: true });
  const top = resolveNavbarVisual(s, 0, 0, null);
  assert.equal(top.transparent, true);
  assert.equal(top.state, "top");

  const past = resolveNavbarVisual(s, NAV_SCROLL_THRESHOLD + 1, 0, null);
  assert.equal(past.transparent, false);
  assert.equal(past.state, "scrolled");
});

test("without transparent_at_top the bar is always solid", () => {
  const v = resolveNavbarVisual(scroll(), 0, 0, null);
  assert.equal(v.transparent, false);
  assert.equal(v.state, "scrolled");
});

test("hide_on_scroll hides while scrolling DOWN past threshold, shows on scroll UP", () => {
  const s = scroll({ hide_on_scroll: true });
  const down = resolveNavbarVisual(s, 200, 150, null); // scrollY > lastScrollY
  assert.equal(down.hidden, true);

  const up = resolveNavbarVisual(s, 150, 200, null); // scrollY < lastScrollY
  assert.equal(up.hidden, false);

  const nearTop = resolveNavbarVisual(s, 10, 5, null); // within threshold, never hide
  assert.equal(nearTop.hidden, false);
});

test("forced 'scrolled' always paints solid, never hidden", () => {
  const v = resolveNavbarVisual(scroll({ transparent_at_top: true, hide_on_scroll: true }), 500, 400, "scrolled");
  assert.deepEqual(v, { state: "scrolled", transparent: false, hidden: false, hover: false });
});

test("forced 'top' honors transparent_at_top and is never hidden", () => {
  const t = resolveNavbarVisual(scroll({ transparent_at_top: true }), 999, 0, "top");
  assert.equal(t.transparent, true);
  assert.equal(t.state, "top");
  assert.equal(t.hidden, false);

  const solidTop = resolveNavbarVisual(scroll({ transparent_at_top: false }), 0, 0, "top");
  assert.equal(solidTop.transparent, false);
  assert.equal(solidTop.state, "scrolled");
});

test("forced 'hover' sets the hover flag and keeps the top look", () => {
  const v = resolveNavbarVisual(scroll({ transparent_at_top: true }), 0, 0, "hover");
  assert.equal(v.hover, true);
  assert.equal(v.transparent, true);
  assert.equal(v.hidden, false);
});
