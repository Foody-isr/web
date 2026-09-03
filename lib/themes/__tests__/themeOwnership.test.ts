import { test } from "node:test";
import assert from "node:assert/strict";
import { createThemeOwnership } from "../themeOwnership";

function tracker() {
  const painted: string[] = [];
  return {
    painted,
    painter: (name: string, depth: number) => ({
      depth,
      paint: () => painted.push(name),
    }),
  };
}

test("the deepest painter owns the document, whatever order they register in", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  own.register(t.painter("site", 1));
  own.register(t.painter("page", 2));

  assert.equal(t.painted.at(-1), "page");
});

// The bug this module exists for: on a client-side navigation React flushes the
// newly mounted page provider first and the layout provider's re-run last, so
// the site palette used to overwrite the page palette.
test("a shallower painter re-registering never steals ownership", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  own.register(t.painter("page", 2));
  own.register(t.painter("site", 1));

  assert.equal(t.painted.at(-1), "page");
});

test("repaint re-runs the owner, not the caller", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  own.register(t.painter("site", 1));
  own.register(t.painter("page", 2));
  t.painted.length = 0;
  own.repaint();

  assert.deepEqual(t.painted, ["page"]);
});

test("unmounting the owner hands the document back to the shallower painter", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  own.register(t.painter("site", 1));
  const unmountPage = own.register(t.painter("page", 2));
  t.painted.length = 0;
  unmountPage();

  assert.deepEqual(t.painted, ["site"]);
});

test("unmounting the last painter clears the document", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  const unmount = own.register(t.painter("site", 1));
  t.painted.length = 0;
  unmount();

  assert.deepEqual(t.painted, ["clear"]);
});

// A navigation that swaps one page provider for another at the same depth:
// React runs the outgoing cleanup before the incoming effect, but guard the
// overlap anyway so the newcomer wins.
test("at equal depth the most recently registered painter wins", () => {
  const t = tracker();
  const own = createThemeOwnership(() => t.painted.push("clear"));

  own.register(t.painter("old-page", 2));
  own.register(t.painter("new-page", 2));

  assert.equal(t.painted.at(-1), "new-page");
});
