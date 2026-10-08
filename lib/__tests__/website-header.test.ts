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

test("fulfillment retires saved color overrides while preserving visibility and Header styles", () => {
  for (const enabled of [true, false]) {
    const header = normalizeWebsiteHeader({
      color_style: "style-4",
      fulfillment: { enabled, background: "#ff0000" },
    });
    assert.deepEqual(header.fulfillment, { enabled, background: "" });
    assert.equal(header.color_style, "style-4");
    assert.deepEqual(normalizeWebsiteHeader(header), header);
  }
});


test("Restaurant header round-trips presentation without introducing fulfillment rules", () => {
  const header = normalizeWebsiteHeader({layout:"restaurant", restaurant:{height:"large", show_name:false, info_color_style:"style-2", show_social:false}});
  assert.equal(header.layout, "restaurant");
  assert.equal(header.restaurant.height, "large");
  assert.equal(header.restaurant.show_name, false);
  assert.equal(header.restaurant.info_color_style, "style-2");
  assert.deepEqual(normalizeWebsiteHeader(JSON.parse(JSON.stringify(header))), header);
  assert.equal(normalizeWebsiteHeader({restaurant:{height:"999px", info_color_style:"red"}}).restaurant.info_color_style, "default");
  assert.equal(normalizeWebsiteHeader({restaurant:{height:"999px"}}).restaurant.height, "medium");
});
