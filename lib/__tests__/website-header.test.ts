import { orderHeaderPresentation, resolvePageHeader } from "../websiteHeader";
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


test("order header is opt-in, presentation-only, and follows shared logo and links", () => {
  const shared = normalizeWebsiteHeader({layout: "center", logo: {image: "/one.png"},
    navigation: {links: [{id: "home", label: "Home", target: {kind: "home"}}]}});
  assert.equal(resolvePageHeader(shared, "order", {}), shared);
  const local = orderHeaderPresentation(normalizeWebsiteHeader({...shared,
    layout: "restaurant", color_style: "style-2", logo: {...shared.logo, size: 140}}));
  const appearance = {order_header: JSON.parse(JSON.stringify(local))};
  assert.equal(resolvePageHeader(shared, "content", appearance), shared);
  assert.equal(resolvePageHeader(shared, "landing", appearance), shared);
  const updated = normalizeWebsiteHeader({...shared, logo: {...shared.logo, image: "/two.png"},
    navigation: {...shared.navigation, links: [{id: "about", label: "About", target: {kind: "page", value: "about"}}]}});
  const actual = resolvePageHeader(updated, "order", appearance);
  assert.equal(actual.layout, "restaurant");
  assert.equal(actual.logo.size, 140);
  assert.equal(actual.logo.image, "/two.png");
  assert.deepEqual(actual.navigation, updated.navigation);
  assert.deepEqual(actual.fulfillment, updated.fulfillment);
  assert.equal(resolvePageHeader(updated, "order", {order_header: null}), updated);
  assert.equal(shared.layout, "center");
  assert.ok(!("navigation" in local));
  assert.ok(!("logo" in local));
  assert.ok(!("fulfillment" in local));
});

test("page overrides cannot replace shared content even with untrusted extra fields", () => {
  const shared = normalizeWebsiteHeader({layout: "left", logo: {image: "/site.png"}});
  const actual = resolvePageHeader(shared, "order", {order_header: {
    ...orderHeaderPresentation(shared), layout: "restaurant",
    logo: {image: "/other.png"}, navigation: {enabled: false},
    fulfillment: {enabled: true}, background: {mode: "image", image: "javascript:alert(1)"},
  }});
  assert.deepEqual(actual.logo, shared.logo);
  assert.deepEqual(actual.navigation, shared.navigation);
  assert.deepEqual(actual.fulfillment, shared.fulfillment);
  assert.equal(actual.background.image, "");
});


test("the chosen information layout stays independent of ordering permissions", async () => {
  const { restaurantInfoLayout } = await import("../websiteHeader");
  for (const layout of ["modern", "classic"] as const) {
    const header = normalizeWebsiteHeader({restaurant: {info_layout: layout}});
    for (const canChoose of [true, false]) {
      assert.equal(restaurantInfoLayout(header.restaurant, canChoose), layout);
      assert.equal(restaurantInfoLayout(normalizeWebsiteHeader(JSON.parse(JSON.stringify(header))).restaurant, canChoose), layout);
    }
  }
  const legacy = normalizeWebsiteHeader({restaurant: {info_layout: "invalid"}});
  assert.equal(restaurantInfoLayout(legacy.restaurant, true), "modern");
  assert.equal(restaurantInfoLayout(legacy.restaurant, false), "classic");
});
