import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOrderDiscoveryLink,
  orderDiscoverySections,
  resolveRestaurantCardHref,
} from "@/lib/orderDiscovery";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";

const timestamp = "2026-08-31T12:00:00.000Z";

function page(
  type: WebsiteV3Page["type"],
  slug: string,
  isHomepage = false,
): WebsiteV3Page {
  const base = {
    id: type === "landing" ? 1 : 2,
    restaurant_id: 5,
    slug,
    title: slug,
    sort_order: 0,
    nav_visible: true,
    is_homepage: isHomepage,
    is_default: type === "order",
    seo: {},
    appearance_overrides: {},
    sections: type === "landing"
      ? [
          {
            id: 10,
            restaurant_id: 5,
            section_type: "feature_cards",
            page: slug,
            page_id: 1,
            sort_order: 3,
            is_visible: true,
            layout: "default",
            content: { cards: [{ title: "Catering", link: "/catering" }] },
            settings: {},
            created_at: timestamp,
            updated_at: timestamp,
          },
        ]
      : [],
    created_at: timestamp,
    updated_at: timestamp,
  };

  if (type === "landing") return { ...base, type, settings: {} };
  if (type === "content") return { ...base, type, settings: {} };
  if (type === "order") {
    return { ...base, type, settings: { menu_ids: [4] } };
  }
  return {
    ...base,
    type,
    settings: { service_ids: [], selection_mode: "all_active" },
  } as unknown as WebsiteV3Page;
}

test("order discovery reuses the homepage's published feature cards", () => {
  const sections = orderDiscoverySections([
    page("order", "menu"),
    page("landing", "home", true),
  ]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].sectionType, "feature_cards");
  assert.deepEqual(sections[0].content.cards, [
    { title: "Catering", link: "/catering" },
  ]);
});

test("order discovery falls back to the landing when order is the homepage", () => {
  const orderHomepage = {
    ...page("order", "menu"),
    is_homepage: true,
  } as WebsiteV3Page;
  const sections = orderDiscoverySections([
    orderHomepage,
    page("landing", "home", false),
  ]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].sectionType, "feature_cards");
});

test("order discovery recognizes canonical and custom order links", () => {
  assert.equal(isOrderDiscoveryLink("/order", "menu"), true);
  assert.equal(isOrderDiscoveryLink("menu?type=pickup", "menu"), true);
  assert.equal(isOrderDiscoveryLink("/catering", "menu"), false);
  assert.equal(isOrderDiscoveryLink("https://shop.example.com", "menu"), false);
});

test("restaurant card links preserve external targets and scope local pages", () => {
  assert.equal(
    resolveRestaurantCardHref("/catering", "mamie-tlv"),
    "/r/mamie-tlv/catering",
  );
  assert.equal(
    resolveRestaurantCardHref("epicerie", "mamie tlv"),
    "/r/mamie%20tlv/epicerie",
  );
  assert.equal(
    resolveRestaurantCardHref("https://shop.example.com", "mamie-tlv"),
    "https://shop.example.com",
  );
});
