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
      appearance: {
        surface_color: "#102030",
        text_color: "#fefefe",
        muted_text_color: "#d1d5db",
        border_color: "#334155",
        button_background_color: "#f59e0b",
        button_text_color: "#111827",
        button_border_color: "#fbbf24",
        shape: "soft",
        shadow: "strong",
        font_family: "Playfair Display",
        font_weight: 600,
        label_font_size_desktop: 18,
        label_font_size_mobile: 17,
        description_font_size_desktop: 13,
        description_font_size_mobile: 12,
        letter_spacing: 0.5,
        uppercase: true,
      },
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
    appearance: {
      surfaceColor: "#102030",
      textColor: "#fefefe",
      mutedTextColor: "#d1d5db",
      borderColor: "#334155",
      buttonBackgroundColor: "#f59e0b",
      buttonTextColor: "#111827",
      buttonBorderColor: "#fbbf24",
      shape: "soft",
      shadow: "strong",
      fontFamily: "Playfair Display",
      fontWeight: 600,
      labelFontSizeDesktop: 18,
      labelFontSizeMobile: 17,
      descriptionFontSizeDesktop: 13,
      descriptionFontSizeMobile: 12,
      letterSpacing: 0.5,
      uppercase: true,
    },
  });
});

test("order page navigation rejects invalid styles and clamps numeric appearance", () => {
  const appearance = parseOrderPageInfo({
    bar: {},
    modal: [],
    navigation: {
      desktop_style: "banner",
      mobile_style: "banner",
      discover_enabled: false,
      discover_page_slugs: [],
      appearance: {
        shape: "blob",
        shadow: "neon",
        font_weight: 5000,
        label_font_size_desktop: 80,
        description_font_size_mobile: 2,
        letter_spacing: -20,
      },
    },
  })?.navigation?.appearance;

  assert.equal(appearance?.shape, undefined);
  assert.equal(appearance?.shadow, undefined);
  assert.equal(appearance?.fontWeight, 900);
  assert.equal(appearance?.labelFontSizeDesktop, 24);
  assert.equal(appearance?.descriptionFontSizeMobile, 8);
  assert.equal(appearance?.letterSpacing, -1);
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
