import assert from "node:assert/strict";
import { test } from "node:test";
import { revealOrderCategory } from "../useOrderCategoryScroll";

function rail({
  first = false,
  left = 0,
  itemLeft = 8,
  width = 390,
  scrollWidth = 900,
} = {}) {
  const selected = {
    getBoundingClientRect: () => ({
      left: itemLeft,
      right: itemLeft + 100,
      width: 100,
    }),
  };
  const calls: ScrollToOptions[] = [];
  const container = {
    scrollLeft: left,
    scrollWidth,
    clientWidth: width,
    querySelectorAll: () => [first ? selected : {}, selected],
    querySelector: () => selected,
    getBoundingClientRect: () => ({ left: 0, right: width, width }),
    scrollTo: (options: ScrollToOptions) => calls.push(options),
  } as unknown as HTMLElement;
  return { container, calls };
}

test("returning to the first category cancels older animation and resets the rail in LTR and RTL", () => {
  for (const direction of ["ltr", "rtl"] as const) {
    // The first pill can remain fully visible while Safari has an elastic offset.
    for (const left of [-140, 0, 140, 510]) {
      const { container, calls } = rail({ first: true, left, itemLeft: 150 });
      revealOrderCategory(container, direction);
      assert.deepEqual(calls, [{ left: 0, behavior: "instant" }]);
    }
  }
});

test("clipped categories scroll inside the rail's legal range in each writing direction", () => {
  for (const [direction, left, itemLeft, expected] of [
    ["ltr", 100, 400, 355],
    ["ltr", 480, 400, 510],
    ["rtl", -100, -100, -345],
    ["rtl", -480, -100, -510],
  ] as const) {
    const { container, calls } = rail({ left, itemLeft });
    revealOrderCategory(container, direction);
    assert.deepEqual(calls, [{ left: expected, behavior: "instant" }]);
  }
});

test("visible categories stop stale animations without moving a valid offset", () => {
  for (const [direction, left, expected] of [
    ["ltr", 120, 120],
    ["rtl", -120, -120],
    ["ltr", -40, 0],
    ["rtl", 40, 0],
  ] as const) {
    const { container, calls } = rail({ left });
    revealOrderCategory(container, direction);
    assert.deepEqual(calls, [{ left: expected, behavior: "instant" }]);
  }
});

test("a short category rail cannot retain an offset after its contents shrink", () => {
  const { container, calls } = rail({
    left: 180,
    itemLeft: 400,
    scrollWidth: 250,
  });
  revealOrderCategory(container, "ltr");
  assert.deepEqual(calls, [{ left: 0, behavior: "instant" }]);
});
