import assert from "node:assert/strict";
import test from "node:test";
import {
  CATEGORY_SIDEBAR_AUTO_THRESHOLD,
  isCategorySidebarOnLeft,
  normalizeCategoryNavigation,
  usesCategorySidebar,
} from "../categoryNavigation";

test("normalizes missing and invalid category navigation values", () => {
  assert.deepEqual(normalizeCategoryNavigation(undefined), {
    mode: "auto",
    side: "start",
  });
  assert.deepEqual(
    normalizeCategoryNavigation({ mode: "tiles", side: "top" }),
    {
      mode: "auto",
      side: "start",
    },
  );
});

test("keeps valid category navigation values", () => {
  assert.deepEqual(
    normalizeCategoryNavigation({ mode: "sidebar", side: "end" }),
    { mode: "sidebar", side: "end" },
  );
});

test("auto mode uses the sidebar only for long catalogues", () => {
  assert.equal(
    usesCategorySidebar(
      { mode: "auto", side: "start" },
      CATEGORY_SIDEBAR_AUTO_THRESHOLD - 1,
    ),
    false,
  );
  assert.equal(
    usesCategorySidebar(
      { mode: "auto", side: "start" },
      CATEGORY_SIDEBAR_AUTO_THRESHOLD,
    ),
    true,
  );
  assert.equal(
    usesCategorySidebar({ mode: "horizontal", side: "start" }, 99),
    false,
  );
  assert.equal(
    usesCategorySidebar({ mode: "sidebar", side: "start" }, 1),
    true,
  );
});

test("logical side follows the locale direction", () => {
  assert.equal(isCategorySidebarOnLeft("start", "ltr"), true);
  assert.equal(isCategorySidebarOnLeft("start", "rtl"), false);
  assert.equal(isCategorySidebarOnLeft("end", "ltr"), false);
  assert.equal(isCategorySidebarOnLeft("end", "rtl"), true);
});
