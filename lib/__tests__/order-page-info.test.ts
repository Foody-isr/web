import assert from "node:assert/strict";
import { test } from "node:test";
import type { SiteNavItem } from "../siteNav";
import {
  discoverOrderPageDestinations,
  featuredOrderPageDestination,
  parseOrderPageInfo,
} from "../orderPageInfo";

const destinations: SiteNavItem[] = [
  { key: "menu", label: "Menu", href: "/r/mamie/order", pageType: "order" },
  { key: "traiteur", label: "Traiteur", href: "/r/mamie/catering", pageType: "catering" },
  { key: "histoire", label: "Notre histoire", href: "/r/mamie/histoire", pageType: "content" },
];

test("order page navigation parses the builder snake-case contract", () => {
  const info = parseOrderPageInfo({
    bar: { pickup: ["more"], delivery: [], dine_in: [] },
    modal: ["about"],
    navigation: {
      desktop_style: "buttons",
      mobile_style: "banner",
      featured_page_slug: "traiteur",
      featured_label: "Traiteur & événements",
      featured_description: "Vous organisez un événement ?",
      discover_enabled: true,
      discover_label: "Découvrir",
      discover_page_slugs: ["histoire", "traiteur"],
    },
  });

  assert.deepEqual(info?.navigation, {
    desktopStyle: "buttons",
    mobileStyle: "banner",
    featuredPageSlug: "traiteur",
    featuredLabel: "Traiteur & événements",
    featuredDescription: "Vous organisez un événement ?",
    discoverEnabled: true,
    discoverLabel: "Découvrir",
    discoverPageSlugs: ["histoire", "traiteur"],
  });
});

test("order page navigation resolves only valid non-order destinations", () => {
  const navigation = parseOrderPageInfo({
    bar: {},
    modal: [],
    navigation: {
      desktop_style: "inline",
      mobile_style: "inline",
      featured_page_slug: "traiteur",
      discover_enabled: true,
      discover_page_slugs: ["menu", "histoire", "missing", "traiteur"],
    },
  })?.navigation;

  assert.equal(featuredOrderPageDestination(navigation, destinations)?.key, "traiteur");
  assert.deepEqual(
    discoverOrderPageDestinations(navigation, destinations).map((item) => item.key),
    ["traiteur", "histoire"],
  );
});

test("missing navigation preserves the historical order page layout", () => {
  const info = parseOrderPageInfo({
    bar: { pickup: ["more"] },
    modal: ["about"],
  });

  assert.equal(info?.navigation, undefined);
});
