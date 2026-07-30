import assert from "node:assert/strict";
import { test } from "node:test";
import type { MenuResponse, WebsiteConfig } from "@/lib/types";
import {
  applyGroupBannerOverrides,
  mergeWebsiteConfigWithPageAppearance,
  resolvePageFooterMode,
} from "@/lib/websiteV3Appearance";

const baseConfig = {
  themeId: "editorial-dark",
  pairingId: "modern-sans",
  brandColor: null,
  layoutDefault: "magazine",
  heroLayout: "standard",
  showAddress: true,
  showPhone: true,
  showHours: true,
} as WebsiteConfig;

test("page appearance overrides legacy visual config without mutating it", () => {
  const appearance = {
    theme_id: "coastal-sand",
    pairing_id: "classic-serif",
    brand_color: "#c2410c",
    layout_default: "compact",
    category_banner_style: "text-block",
    typography: { roles: { itemName: { weight: 700 } } },
  };

  const merged = mergeWebsiteConfigWithPageAppearance(
    baseConfig,
    appearance,
    "order",
  );

  assert.equal(merged?.themeId, "coastal-sand");
  assert.equal(merged?.pairingId, "classic-serif");
  assert.equal(merged?.brandColor, "#c2410c");
  assert.equal(merged?.layoutDefault, "compact");
  assert.equal(merged?.categoryBannerStyle, "text-block");
  assert.deepEqual(merged?.typography, appearance.typography);
  assert.equal(baseConfig.themeId, "editorial-dark");
});

test("page navigation mode only replaces the current page family", () => {
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      navLayout: {
        content: { desktop: "full", mobile: "compact", bottom_bar: false },
        shopping: { desktop: "compact", mobile: "hidden", bottom_bar: true },
      },
    },
    {
      navigation_mode: "hidden",
      navigation_mode_mobile: "compact",
    },
    "content",
  );

  assert.deepEqual(merged?.navLayout?.content, {
    desktop: "hidden",
    mobile: "compact",
    bottom_bar: false,
  });
  assert.deepEqual(merged?.navLayout?.shopping, {
    desktop: "compact",
    mobile: "hidden",
    bottom_bar: true,
  });
});

test("footer mode supports inherited, compact and hidden rendering", () => {
  assert.equal(resolvePageFooterMode({}), "inherit");
  assert.equal(resolvePageFooterMode({ footer_mode: "compact" }), "compact");
  assert.equal(resolvePageFooterMode({ footer_mode: "hidden" }), "hidden");
  assert.equal(resolvePageFooterMode({ footer_mode: "invalid" }), "inherit");
});

test("order page group banners override menu data only for that page", () => {
  const menu: MenuResponse = {
    restaurantId: "24",
    currency: "ILS",
    categories: [],
    items: [],
    menus: [
      {
        entryKey: "menu-4",
        id: 4,
        name: "Carte",
        items: [],
        groups: [{ id: "12", name: "Entrées" }],
        categories: [{ id: "12", name: "Entrées" }],
      },
    ],
  };
  const result = applyGroupBannerOverrides(menu, {
    group_banners: {
      "12": {
        image_url: "https://cdn.example.com/entrees.jpg",
        focal_x: 30,
        focal_y: 70,
        banner_design: { bgColor: "#fef3c7" },
      },
    },
  });

  assert.equal(result.menus[0].groups[0].imageUrl, "https://cdn.example.com/entrees.jpg");
  assert.equal(result.menus[0].groups[0].focalX, 30);
  assert.deepEqual(result.menus[0].categories[0], result.menus[0].groups[0]);
  assert.equal(menu.menus[0].groups[0].imageUrl, undefined);
});
