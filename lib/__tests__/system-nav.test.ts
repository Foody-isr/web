import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant, WebsitePage } from "../types";
import {
  buildSystemNavItems,
  canNavigateToStories,
  systemNavigationFallback,
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

  assert.deepEqual(buildSystemNavItems(restaurant, labels), [
    { key: "home", label: "Accueil", href: "/r/moulin-doree" },
    { key: "menu", label: "Commander", href: "/r/moulin-doree/order" },
    { key: "brunch", label: "Brunch", href: "/r/moulin-doree/brunch" },
    { key: "catering", label: "Traiteur", href: "/r/moulin-doree/catering" },
    { key: "orders", label: "My orders", href: "/r/moulin-doree/orders" },
  ]);
});

test("home comes only from the published landing page", () => {
  const items = buildSystemNavItems(restaurantWithPages([]), labels);
  assert.equal(items.some((item) => item.key === "home"), false);

  const withLanding = buildSystemNavItems(
    restaurantWithPages([page("landing", "home", "Accueil", 0)]),
    labels,
  );
  assert.equal(withLanding.filter((item) => item.key === "home").length, 1);
  assert.equal(withLanding.find((item) => item.key === "home")?.label, "Accueil");
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
    ["stories", "menu", "home", "about", "orders"],
  );
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
