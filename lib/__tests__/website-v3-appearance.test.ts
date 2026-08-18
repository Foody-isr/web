import assert from "node:assert/strict";
import { test } from "node:test";
import type { MenuResponse, WebsiteConfig } from "@/lib/types";
import type { PageAppearanceOverrides } from "@/lib/websiteV3Api";
import {
  applyGroupBannerOverrides,
  checkoutAppearanceVariables,
  mergeWebsiteConfigWithPageAppearance,
  pageAppearanceVariables,
  resolvePageFooterMode,
} from "@/lib/websiteV3Appearance";
import { roleTextStyle } from "@/lib/themes/typography";

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
    order_type_selector: { shape: "pill", variant: "outline" },
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
  assert.deepEqual(merged?.orderTypeSelector, appearance.order_type_selector);
  assert.equal(baseConfig.themeId, "editorial-dark");
});

// The builder writes a page-level palette as theme_id "custom" + custom_palette
// inside appearance_overrides, never into the site config. Every /order/* route
// (checkout included) themes from the merge below, so a palette that does not
// survive it renders the site theme instead of the owner's page.
test("a page-level custom palette wins over the site theme", () => {
  const palette = {
    mode: "light",
    bg: "#D7807F",
    surface: "#FAFAFA",
    ink: "#D7807F",
    accent: "#D7807F",
    searchBg: "#FAFAFA",
    categoryInk: "#FAFAFA",
  };

  const merged = mergeWebsiteConfigWithPageAppearance(
    baseConfig,
    { theme_id: "custom", custom_palette: palette },
    "order",
  );

  assert.equal(merged?.themeId, "custom");
  assert.deepEqual(merged?.customPalette, palette);
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

test("page navigation visuals override the global navbar", () => {
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      navbarStyle: "transparent",
      navbarColor: "#111827",
      navbarTextColor: "#FFFFFF",
      navbarOverlayTextColor: "#F8FAFC",
    },
    {
      navigation_mode: "compact",
      navbar_style: "solid",
      navbar_color: "#FAF1D2",
      navbar_text_color: "#253265",
      navbar_overlay_text_color: "#1E293B",
    },
    "order",
  );

  assert.equal(merged?.navbarStyle, "solid");
  assert.equal(merged?.navbarColor, "#FAF1D2");
  assert.equal(merged?.navbarTextColor, "#253265");
  assert.equal(merged?.navbarOverlayTextColor, "#1E293B");
  assert.equal(merged?.navLayout?.shopping.desktop, "compact");
});

test("page navbar overrides preserve explicit false and sparse CTA inheritance", () => {
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      hideNavbarName: true,
      navbarCta: {
        enabled: true,
        text: "Commander",
        link: "/order",
        transparent: {
          variant: "filled",
          bg: "rgba(255,255,255,0.18)",
        },
        solid: {
          variant: "filled",
          bg: "#315fce",
          text_color: "#ffffff",
        },
      },
    },
    {
      hide_navbar_name: false,
      navbar_cta: {
        transparent: {
          variant: "outline",
          text_color: "#f8fafc",
        },
      },
    },
    "content",
  );

  assert.equal(merged?.hideNavbarName, false);
  assert.equal(merged?.navbarCta?.enabled, true);
  assert.equal(merged?.navbarCta?.text, "Commander");
  assert.deepEqual(merged?.navbarCta?.transparent, {
    variant: "outline",
    bg: "rgba(255,255,255,0.18)",
    text_color: "#f8fafc",
  });
  assert.deepEqual(merged?.navbarCta?.solid, {
    variant: "filled",
    bg: "#315fce",
    text_color: "#ffffff",
  });
});

test("page appearance exposes normal and sparse sticky category tokens", () => {
  const variables = pageAppearanceVariables({
    bg: "#f8fafc",
    section_colors: {
      categoryBar: {
        bg: "#ffffff",
        text: "#111827",
        accent: "#315fce",
        divider: "#e5e7eb",
      },
      categoryBarSticky: {
        bg: "#111827",
        accent: "#d6ff3f",
      },
    },
  });

  assert.equal(variables["--bg-page"], "#f8fafc");
  assert.equal(variables["--cat-bg"], "#ffffff");
  assert.equal(variables["--cat-text"], "#111827");
  assert.equal(variables["--cat-accent"], "#315fce");
  assert.equal(variables["--cat-divider"], "#e5e7eb");
  assert.equal(variables["--cat-sticky-bg"], "#111827");
  assert.equal(variables["--cat-sticky-accent"], "#d6ff3f");
  assert.equal(variables["--cat-sticky-text"], undefined);
});

test("checkout text roles stay separate from order page text", () => {
  const appearance = {
    ink: "#101010",
    checkout_text_colors: {
      heading: "#111111",
      primary: "#222222",
      secondary: "#666666",
      input: "#333333",
      price: "#884400",
      button: "#ffffff",
    },
  };

  assert.equal(pageAppearanceVariables(appearance)["--text"], "#101010");
  assert.deepEqual(checkoutAppearanceVariables(appearance), {
    "--text": "#222222",
    "--checkout-heading": "#111111",
    "--text-muted": "#666666",
    "--text-soft": "#666666",
    "--checkout-input": "#333333",
    "--checkout-price": "#884400",
    "--checkout-button-text": "#ffffff",
  });
});

test("menu typography roles expose independent color variables", () => {
  assert.equal(
    roleTextStyle("itemName", "1rem", "display", 600, "none", "var(--text)").color,
    "var(--type-itemname-color, var(--text))",
  );
  assert.equal(
    roleTextStyle("itemPrice", "1rem", "display", 700, undefined, "var(--price)").color,
    "var(--type-itemprice-color, var(--price))",
  );
});

test("inherited page navigation style preserves the global navbar", () => {
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      navbarStyle: "overlay",
      navbarColor: "#253265",
    },
    { navbar_style: "inherit" },
    "content",
  );

  assert.equal(merged?.navbarStyle, "overlay");
  assert.equal(merged?.navbarColor, "#253265");
});

test("empty page navigation colors inherit the global navbar colors", () => {
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      navbarColor: "#253265",
      navbarTextColor: "#F8FAFC",
      navbarOverlayTextColor: "#D1D5DB",
    },
    {
      navbar_color: "",
      navbar_text_color: "",
      navbar_overlay_text_color: "",
    },
    "content",
  );

  assert.equal(merged?.navbarColor, "#253265");
  assert.equal(merged?.navbarTextColor, "#F8FAFC");
  assert.equal(merged?.navbarOverlayTextColor, "#D1D5DB");
});

test("invalid page navigation visuals preserve global values and other tokens", () => {
  const invalidAppearance = {
    navbar_style: "hidden",
    navbar_color: 42,
    navbar_text_color: null,
    navbar_overlay_text_color: [],
  } as unknown as PageAppearanceOverrides;
  const merged = mergeWebsiteConfigWithPageAppearance(
    {
      ...baseConfig,
      navbarStyle: "overlay",
      navbarColor: "#253265",
    },
    invalidAppearance,
    "content",
  );

  assert.equal(merged?.navbarStyle, "overlay");
  assert.equal(merged?.navbarColor, "#253265");
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
