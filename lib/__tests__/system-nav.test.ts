import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import type { Restaurant, WebsitePage } from "../types";
import {
  buildSystemNavItems,
  canNavigateToStories,
  navigationInteractionForItem,
  systemNavigationFallback,
  withActiveNavigationItem,
} from "../systemNav";

const labels = { stories: "Stories", orders: "My orders" };

test("published V3 pages and system links form one canonical navigation list", () => {
  const restaurant = restaurantWithPages([
    page("landing", "accueil", "Accueil", 0),
    page("order", "commander", "Commander", 1, true),
    page("order", "brunch", "Brunch", 2, false),
    page("catering", "traiteur-prive", "Traiteur", 3, true),
    { ...page("content", "cachee", "Cachée", 4), showInNav: false },
  ]);
  restaurant.cateringEnabled = true;

  assert.deepEqual(buildSystemNavItems(restaurant, labels), [
    { key: "accueil", label: "Accueil", href: "/r/moulin-doree", pageType: "landing", orderKey: "home" },
    { key: "commander", label: "Commander", href: "/r/moulin-doree/order", pageType: "order", orderKey: "menu" },
    { key: "brunch", label: "Brunch", href: "/r/moulin-doree/brunch", pageType: "order" },
    { key: "traiteur-prive", label: "Traiteur", href: "/r/moulin-doree/catering", pageType: "catering", orderKey: "catering" },
    { key: "orders", label: "My orders", href: "/r/moulin-doree/orders" },
  ]);
});

test("legacy navigation restores built-ins until typed V3 pages are published", () => {
  const items = buildSystemNavItems(restaurantWithPages([]), labels);
  assert.deepEqual(
    items.map((item) => item.key),
    ["home", "menu", "orders"],
  );

  const withLanding = buildSystemNavItems(
    restaurantWithPages([page("landing", "home", "Accueil", 0)]),
    labels,
  );
  assert.equal(withLanding.filter((item) => item.key === "home").length, 1);
  assert.equal(withLanding.find((item) => item.key === "home")?.label, "Accueil");
});

test("legacy table and tournee order intent activates the restored menu", () => {
  const items = withActiveNavigationItem(
    buildSystemNavItems(restaurantWithPages([]), labels),
    { kind: "order-alias" },
  );

  assert.deepEqual(
    items.filter((item) => item.isActive).map((item) => [item.key, item.href]),
    [["menu", "/r/moulin-doree/order"]],
  );
});

test("stories availability is the API-owned safe boolean", () => {
  const unavailable = restaurantWithPages([]);
  unavailable.websiteConfig = {
    ...unavailable.websiteConfig!,
    storiesEnabled: true,
  };
  assert.equal(canNavigateToStories(unavailable), false);
  assert.equal(
    buildSystemNavItems(unavailable, labels).some((item) => item.key === "stories"),
    false,
  );

  const available = { ...unavailable, storiesNavigationAvailable: true };
  assert.equal(canNavigateToStories(available), true);
  assert.equal(
    buildSystemNavItems(available, labels).some((item) => item.key === "stories"),
    true,
  );
});

test("my orders is visible by default and follows the builder toggle", () => {
  const legacy = restaurantWithPages([]);
  assert.equal(
    buildSystemNavItems(legacy, labels).some((item) => item.key === "orders"),
    true,
  );

  const hidden = restaurantWithPages([]);
  hidden.websiteConfig = { ...hidden.websiteConfig!, showOrdersLink: false };
  assert.equal(
    buildSystemNavItems(hidden, labels).some((item) => item.key === "orders"),
    false,
  );
});

test("configured navigation order applies without dropping V3 pages", () => {
  const restaurant = restaurantWithPages([
    page("landing", "home", "Home", 0),
    page("order", "menu-interne", "Menu", 1, true),
    page("content", "about", "About", 2),
  ]);
  restaurant.storiesNavigationAvailable = true;
  restaurant.websiteConfig = {
    ...restaurant.websiteConfig!,
    navOrder: "stories,menu,stories,unknown",
  };

  assert.deepEqual(
    buildSystemNavItems(restaurant, labels).map((item) => item.key),
    ["stories", "menu-interne", "home", "about", "orders"],
  );
});

test("route collisions are never hidden by client-side deduplication", () => {
  const restaurant = restaurantWithPages([
    page("content", "stories", "Legacy Stories page", 0),
  ]);
  restaurant.storiesNavigationAvailable = true;

  const items = buildSystemNavItems(restaurant, labels);
  assert.equal(
    items.filter((item) => item.href === "/r/moulin-doree/stories").length,
    2,
  );
});

test("drawer interaction opens cart-aware history only when provided", () => {
  const orders = { key: "orders", label: "My orders", href: "/orders" };
  const pageItem = { key: "about", label: "About", href: "/about" };

  assert.equal(navigationInteractionForItem(orders, true), "orders-sheet");
  assert.equal(navigationInteractionForItem(orders, false), "link");
  assert.equal(navigationInteractionForItem(pageItem, true), "link");
});

test("active navigation prefers an exact arbitrary V3 page key", () => {
  const items = [
    { key: "commander", label: "Commander", href: "/order", orderKey: "menu" },
    { key: "brunch-du-dimanche", label: "Brunch", href: "/brunch" },
  ];
  assert.deepEqual(
    withActiveNavigationItem(items, {
      kind: "page",
      key: "brunch-du-dimanche",
    }).map((item) => [item.key, item.isActive]),
    [["commander", false], ["brunch-du-dimanche", true]],
  );
});

test("page intent activates a V3 content slug named menu", () => {
  const items = [
    { key: "commander", label: "Commander", href: "/order", orderKey: "menu" },
    { key: "menu", label: "Notre histoire", href: "/menu" },
  ];
  assert.deepEqual(
    withActiveNavigationItem(items, { kind: "page", key: "menu" }).map((item) => [item.key, item.isActive]),
    [["commander", false], ["menu", true]],
  );
});

test("order alias intent activates default order despite a V3 menu slug", () => {
  const items = [
    { key: "commander", label: "Commander", href: "/order", orderKey: "menu" },
    { key: "menu", label: "Notre histoire", href: "/menu" },
  ];
  assert.deepEqual(
    withActiveNavigationItem(items, { kind: "order-alias" }).map((item) => [item.key, item.isActive]),
    [["commander", true], ["menu", false]],
  );
});

test("collision contract covers every static restaurant route", () => {
  const routeRoot = resolve(process.cwd(), "app/r/[restaurantId]");
  const segments = readdirSync(routeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(segments, [
    "catering",
    "delivery",
    "order",
    "orders",
    "payment",
    "pickup",
    "stories",
    "t",
    "table",
    "tournee",
  ]);
});

test("unavailable Stories redirects to the canonical commerce alias", () => {
  assert.equal(systemNavigationFallback(restaurantWithPages([])), "/r/moulin-doree/order");
  assert.equal(
    systemNavigationFallback({
      ...restaurantWithPages([]),
      cateringEnabled: true,
      cateringOnly: true,
    }),
    "/r/moulin-doree/catering",
  );
});

function page(
  pageType: NonNullable<WebsitePage["pageType"]>,
  slug: string,
  label: string,
  sortOrder: number,
  isDefault?: boolean,
): WebsitePage {
  return { pageType, slug, label, sortOrder, isDefault, showInNav: true };
}

function restaurantWithPages(pages: WebsitePage[]): Restaurant {
  return {
    id: 24,
    slug: "moulin-doree",
    name: "Moulin Dorée",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    websiteConfig: {
      themeId: "editorial-dark",
      pairingId: "modern-sans",
      brandColor: null,
      layoutDefault: "magazine",
      heroLayout: "standard",
      showAddress: true,
      showPhone: true,
      showHours: true,
      pages,
    },
  };
}
