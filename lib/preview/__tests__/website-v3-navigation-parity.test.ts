import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant } from "../../types";
import { mapWebsiteConfig } from "../../websiteConfig";
import { buildSystemNavItems } from "../../systemNav";
import {
  materializeWebsiteV3PreviewRestaurant,
} from "../materializeWebsiteV3Preview";
import {
  websiteV3NavigationPages,
  type DraftStatePayload,
} from "../websiteV3Protocol";

const labels = {
  home: "Accueil",
  menu: "Commander",
  catering: "Traiteur",
  stories: "Stories",
  orders: "Mes commandes",
};

test("preview navigation matches the same draft after publication", () => {
  const liveRestaurant = restaurant({
    pages: [
      {
        slug: "a-propos",
        label: "À propos live",
        sort_order: 0,
        show_in_nav: true,
      },
    ],
    show_orders_link: true,
    nav_order: "",
  });
  const draft = previewDraft();

  const beforePublication = buildSystemNavItems(liveRestaurant, labels).map(
    navigationIdentity,
  );
  const previewRestaurant = materializeWebsiteV3PreviewRestaurant(
    liveRestaurant,
    draft,
  );
  const preview = buildSystemNavItems(previewRestaurant, labels).map(
    navigationIdentity,
  );
  const publishedRestaurant: Restaurant = {
    ...liveRestaurant,
    storiesNavigationAvailable: true,
    websiteConfig: mapWebsiteConfig({
      ...draft.config,
      pages: websiteV3NavigationPages(draft),
    }),
  };
  const afterPublication = buildSystemNavItems(
    publishedRestaurant,
    labels,
  ).map(navigationIdentity);

  assert.notDeepEqual(beforePublication, preview);
  assert.deepEqual(preview, [
    ["stories", "/r/mamie-tlv/stories"],
    ["menu", "/r/mamie-tlv/order"],
    ["accueil", "/r/mamie-tlv"],
    ["brunch", "/r/mamie-tlv/brunch"],
  ]);
  assert.deepEqual(afterPublication, preview);
  assert.equal(preview.some(([key]) => key === "cachee"), false);
  assert.equal(preview.some(([key]) => key === "orders"), false);
});

function previewDraft(): DraftStatePayload {
  return {
    config: {
      landing_enabled: true,
      show_orders_link: false,
      nav_order: "stories,menu,accueil,brunch",
      stories_navigation_available: true,
    },
    pages: [
      {
        id: 1,
        type: "landing",
        slug: "accueil",
        title: "Accueil",
        sort_order: 0,
        nav_visible: true,
        is_default: false,
        settings: {},
        appearance_overrides: {},
      },
      {
        id: 2,
        type: "order",
        slug: "menu",
        title: "Commander",
        sort_order: 1,
        nav_visible: true,
        is_default: true,
        settings: { menu_ids: [42] },
        appearance_overrides: {},
      },
      {
        id: 3,
        type: "order",
        slug: "brunch",
        title: "Brunch",
        sort_order: 2,
        nav_visible: true,
        is_default: false,
        settings: { menu_ids: [43] },
        appearance_overrides: {},
      },
      {
        id: 4,
        type: "content",
        slug: "cachee",
        title: "Cachée",
        sort_order: 3,
        nav_visible: false,
        is_default: false,
        settings: {},
        appearance_overrides: {},
      },
    ],
    sections: [],
    deleted_section_ids: [],
    deleted_page_ids: [],
  };
}

function restaurant(rawConfig: Record<string, unknown>): Restaurant {
  return {
    id: 5,
    slug: "mamie-tlv",
    name: "Mamie",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    storiesNavigationAvailable: false,
    websiteConfig: mapWebsiteConfig(rawConfig),
  };
}

function navigationIdentity(item: { key: string; href: string }): [string, string] {
  return [item.key, item.href];
}
