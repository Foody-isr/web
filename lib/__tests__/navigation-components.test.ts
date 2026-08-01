import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function componentInvocation(path: string, component: string): string {
  const contents = source(path);
  const start = contents.indexOf(`<${component}`);
  assert.notEqual(start, -1, `${component} invocation missing from ${path}`);
  const end = contents.indexOf("/>", start);
  assert.notEqual(end, -1, `${component} invocation is not self-closing in ${path}`);
  return contents.slice(start, end + 2);
}

test("bottom navigation scrolls arbitrary pages while Account stays pinned", () => {
  const bottomNav = source("components/BottomNav.tsx");
  assert.match(bottomNav, /data-bottom-nav-scroll/);
  assert.match(bottomNav, /overflow-x-auto/);
  assert.match(bottomNav, /min-w-\[72px\]/);
  assert.match(bottomNav, /data-bottom-nav-account/);
  assert.ok(
    bottomNav.indexOf("data-bottom-nav-account") >
      bottomNav.indexOf("data-bottom-nav-scroll"),
  );
});

test("bottom navigation consumes the injected restaurant without refetching live state", () => {
  const bottomNav = source("components/BottomNav.tsx");
  assert.match(bottomNav, /restaurant: Restaurant/);
  assert.doesNotMatch(bottomNav, /useQuery/);
  assert.doesNotMatch(bottomNav, /fetchRestaurant/);

  for (const path of [
    "components/OrderExperience.tsx",
    "components/CateringExperience.tsx",
    "components/CustomPageClient.tsx",
    "components/StoriesExperience.tsx",
    "app/r/[restaurantId]/orders/OrderHistoryContent.tsx",
  ]) {
    assert.match(
      source(path),
      /<BottomNav[^>]*restaurant=\{restaurant\}/s,
      `${path} must inject its materialized restaurant into BottomNav`,
    );
  }
});

test("V3 experiences preserve their exact page key in bottom navigation", () => {
  assert.match(
    source("components/OrderExperience.tsx"),
    /<BottomNav[^>]*kind: "page"[^>]*key: pageSlug[^>]*kind: "order-alias"/s,
  );
  assert.match(
    componentInvocation("components/website-v3/OrderPage.tsx", "OrderExperience"),
    /pageSlug=\{presentation\.pageSlug\}/,
  );
  assert.match(
    source("components/CateringExperience.tsx"),
    /<BottomNav[^>]*kind: "page"[^>]*key: pageSlug/s,
  );
  assert.match(
    source("components/CustomPageClient.tsx"),
    /<BottomNav[^>]*active=\{\{ kind: "page", key: pageSlug \}\}/s,
  );
});

test("legacy table and tournee order experiences use the menu fallback", () => {
  assert.doesNotMatch(
    componentInvocation("app/r/[restaurantId]/table/[tableId]/page.tsx", "OrderExperience"),
    /pageSlug=/,
  );
  assert.doesNotMatch(
    componentInvocation("app/r/[restaurantId]/tournee/[tourSlug]/page.tsx", "OrderExperience"),
    /pageSlug=/,
  );
  assert.match(
    source("components/OrderExperience.tsx"),
    /<BottomNav[^>]*kind: "order-alias"/s,
  );
});

test("system routes pass an explicit system activation intent", () => {
  assert.match(
    source("components/StoriesExperience.tsx"),
    /<BottomNav[^>]*active=\{\{ kind: "system", key: "stories" \}\}/s,
  );
  assert.match(
    source("app/r/[restaurantId]/orders/OrderHistoryContent.tsx"),
    /<BottomNav[^>]*active=\{\{ kind: "system", key: "orders" \}\}/s,
  );
});

test("bottom navigation exposes the active page to assistive technology", () => {
  assert.match(
    source("components/BottomNav.tsx"),
    /aria-current=\{isActive \? "page" : undefined\}/,
  );
});

test("order drawer keeps the cart-aware reorder context", () => {
  const drawer = source("components/NavigationDrawer.tsx");
  const order = source("components/OrderExperience.tsx");
  assert.match(drawer, /currency\?: string/);
  assert.match(drawer, /onReorder\?: \(order: GuestOrder\) => void/);
  assert.match(drawer, /<OrderHistorySheet/);
  assert.match(order, /currency=\{menu\.currency\}/);
  assert.match(order, /onReorder=\{handleReorderToCart\}/);
});
