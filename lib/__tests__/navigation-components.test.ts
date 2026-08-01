import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
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

test("V3 experiences pass their exact page key to bottom navigation", () => {
  assert.match(
    source("components/OrderExperience.tsx"),
    /<BottomNav[^>]*active=\{pageSlug\}/s,
  );
  assert.match(
    source("components/CateringExperience.tsx"),
    /<BottomNav[^>]*active=\{pageSlug\}/s,
  );
  assert.match(
    source("components/CustomPageClient.tsx"),
    /<BottomNav[^>]*active=\{pageSlug\}/s,
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
