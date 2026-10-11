import test from "node:test";
import assert from "node:assert/strict";
import { visibleHeaderLinks } from "../headerNavigation";

test("all links fit without reserving an unnecessary More button", () => {
  assert.equal(visibleHeaderLinks([90, 110, 70], 326, 28, 60), 3);
});
test("overflow preserves a leading group and includes the gaps around More", () => {
  assert.equal(visibleHeaderLinks([90, 110, 70, 140], 316, 28, 60), 2);
  assert.equal(visibleHeaderLinks([90, 110, 70, 140], 315, 28, 60), 1);
});
test("a narrow navigation can put every link into More", () => {
  assert.equal(visibleHeaderLinks([90, 110], 100, 28, 60), 0);
  assert.equal(visibleHeaderLinks([], 0, 28, 60), 0);
});
