import test from "node:test";
import assert from "node:assert/strict";
import { headerTargetHref, normalizeWebsiteHeader } from "../websiteHeader";
import { resolveNavLayout } from "../navLayout";

test("Header uses the explicit homepage and canonical commerce routes", () => {
  const pages = [
    { slug: "welcome", isHomepage: true, pageType: "content" },
    { slug: "about", pageType: "content" },
    { slug: "menu", isDefault: true, pageType: "order" },
  ];
  assert.equal(
    headerTargetHref({ kind: "page", value: "welcome" }, "demo", pages),
    "/r/demo",
  );
  assert.equal(
    headerTargetHref({ kind: "page", value: "menu" }, "demo", pages),
    "/r/demo/order",
  );
  assert.equal(
    headerTargetHref(
      { kind: "page", value: "about", anchor: "hours" },
      "demo",
      pages,
    ),
    "/r/demo/about#hours",
  );
  assert.equal(
    headerTargetHref({ kind: "page", value: "deleted" }, "demo", pages),
    null,
  );
  assert.equal(
    headerTargetHref({ kind: "order", value: "" }, "demo", pages, "/catering"),
    "/r/demo/catering",
  );
});
test("Header cannot render executable targets, and scoped links keep the restaurant", () => {
  assert.equal(
    headerTargetHref({ kind: "url", value: "javascript:alert(1)" }, "demo", []),
    null,
  );
  assert.equal(
    headerTargetHref(
      { kind: "file", value: "data:text/html,boom" },
      "demo",
      [],
    ),
    null,
  );
  assert.equal(
    headerTargetHref({ kind: "url", value: "/about" }, "demo", []),
    "/r/demo/about",
  );
  assert.equal(
    headerTargetHref({ kind: "url", value: "/r/demo/about" }, "demo", []),
    "/r/demo/about",
  );
  assert.equal(
    headerTargetHref({ kind: "phone", value: "+33 1 23 45 67 89" }, "demo", []),
    "tel:+33123456789",
  );
});
test("the new Header survives the legacy layout boundary and live draft normalization", () => {
  const header = normalizeWebsiteHeader({
    layout: "center",
    icons: { cart: false, search: false },
    navigation: { links: [] },
    button: { color: "" },
  });
  const resolved = resolveNavLayout({ navLayout: { header } as never });
  assert.deepEqual(resolved.header, header);
  assert.deepEqual(
    normalizeWebsiteHeader(JSON.parse(JSON.stringify(header))),
    header,
  );
  assert.equal(resolved.header?.button.color, "");
});
