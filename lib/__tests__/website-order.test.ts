import { ResolvedThemeProvider } from "../themes/useResolvedTheme";
import { normalizeSiteColors } from "../siteColors";
import type { WebsiteConfig } from "../types";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeWebsiteOrder,
  websiteOrderMenus,
  websiteItemAvailable,
} from "../websiteOrder";
import { normalizePageAppearanceOverrides } from "../websiteV3Api";
import type { MenuData } from "../types";
import { useWebsiteOrderStore } from "../../store/useWebsiteOrderStore";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../i18n";
import { MenuLanguageProvider } from "../menu-language";
import { WebsiteOrderMenu } from "../../components/website-v3/WebsiteOrderMenu";

Object.assign(globalThis, { React });

const menu = (id: number): MenuData =>
  ({
    id,
    entryKey: `menu-${id}`,
    name: `Menu ${id}`,
    groups: [{ id: "group", name: "Visible" }],
    items: [
      {
        id: `${id}-fresh`,
        name: "Fresh bread",
        groupId: "group",
        price: 12,
        available: true,
      },
      {
        id: `${id}-sold`,
        name: "Sold bread",
        groupId: "group",
        price: 10,
        availabilityState: "sold_out",
      },
      { id: `${id}-hidden`, name: "Hidden", groupId: "other", price: 10 },
      {
        id: `${id}-combo`,
        name: "Combo only",
        groupId: "group",
        price: 10,
        comboOnly: true,
      },
    ],
  }) as MenuData;

test("the website lists all selected menus and only their public groups", () => {
  const menus = [
    menu(1),
    menu(2),
    { ...menu(3), tour: { id: 8 } },
  ] as MenuData[];
  menus[0].items.push({
    ...menus[0].items[0],
    id: "hidden-state",
    availabilityState: "hidden",
  });
  const before = structuredClone(menus);
  const result = websiteOrderMenus(menus);
  assert.deepEqual(
    result.map((m) => m.id),
    [1, 2],
  );
  assert.deepEqual(
    result.flatMap((m) => m.groups.flatMap((g) => g.items.map((i) => i.id))),
    ["1-fresh", "1-sold", "2-fresh", "2-sold"],
  );
  assert.deepEqual(menus, before);
  assert.equal(websiteOrderMenus(menus, "fresh", true).length, 2);
  assert.equal(websiteOrderMenus(menus, "sold", true).length, 0);
  assert.equal(websiteOrderMenus(menus, "not found").length, 0);
  assert.equal(websiteItemAvailable(menu(1).items[1]), false);
});

test("page-local order controls round-trip through the public page contract", () => {
  const appearance = normalizePageAppearanceOverrides({
    website_order: {
      layout: "grid",
      columns: 3,
      show_descriptions: true,
      show_prices: false,
      item_aspect_ratio: "16/9",
      item_image_fit: "contain",
      category_alignment: "center",
      item_title_style: "title-4",
      item_title_alignment: "end",
      item_title_caps: true,
      prompt_on_entry: false,
    },
  });
  const design = normalizeWebsiteOrder(appearance.website_order);
  assert.equal(design.layout, "grid");
  assert.equal(design.columns, 3);
  assert.equal(design.showDescriptions, true);
  assert.equal(design.showPrices, false);
  assert.equal(design.itemAspectRatio, "16/9");
  assert.equal(design.itemImageFit, "contain");
  assert.equal(design.categoryAlignment, "center");
  assert.deepEqual(design.itemTitleText, {
    style: "title-4",
    alignment: "end",
    caps: true,
    weight: "semibold",
  });
  assert.equal(design.promptOnEntry, false);
});

test("title weights preserve the old default while honoring an explicit regular weight", () => {
  assert.equal(normalizeWebsiteOrder({ item_title_style: "title-4" }).itemTitleText.weight, "semibold");
  const html = renderToStaticMarkup(
    React.createElement(LocaleProvider, null,
      React.createElement(MenuLanguageProvider, null,
        React.createElement(WebsiteOrderMenu, {
          menus: [menu(1)],
          design: normalizeWebsiteOrder({ item_title_style: "title-4", item_title_weight: "regular" }),
          onSelect: () => undefined,
        }),
      ),
    ),
  );
  assert.match(html, /<strong[^>]*font-weight:400/);
});

test("Mamie-style colors and shapes survive the page contract without changing other fields", () => {
  const source = {
    website_order: {
      layout: "list",
      columns: 3,
      content_width: "wide",
      category_shape: "pill",
      sticky_categories: true,
      card_style: "filled",
      card_background: "#6e1f13",
      card_title_color: "#ffffff",
      card_description_color: "#d8b5ad",
      card_price_color: "#dfc65b",
      card_border_color: "#6e1f13",
      card_radius: "rounded",
      image_radius: "rounded",
      item_action: "cutout",
      show_portions: true,
      show_availability_filter: false,
      item_title_style: "inherit",
      prompt_on_entry: false,
    },
    section_colors: {
      categoryBar: {
        bg: "#6e1f13",
        pillBg: "#6e1f13",
        activeBg: "#ffffff",
        activeText: "#6e1f13",
      },
    },
  };
  const before = structuredClone(source);
  const normalized = normalizePageAppearanceOverrides(source);
  const design = normalizeWebsiteOrder(normalized.website_order);
  assert.equal(design.cardBackground, "#6e1f13");
  assert.equal(design.cardTitleColor, "#ffffff");
  assert.equal(design.cardDescriptionColor, "#d8b5ad");
  assert.equal(design.cardPriceColor, "#dfc65b");
  assert.equal(design.imageRadius, "rounded");
  assert.equal(design.categoryShape, "pill");
  assert.equal(design.stickyCategories, true);
  assert.equal(design.showAvailabilityFilter, false);
  assert.equal(design.itemTitleText.style, "inherit");
  assert.equal(design.promptOnEntry, false);
  assert.deepEqual(source, before);
  for (const key of [
    "card_background",
    "card_title_color",
    "card_description_color",
    "card_price_color",
    "card_border_color",
  ]) {
    const invalid = normalizeWebsiteOrder({
      [key]: "red;position:fixed",
      image_radius: "9999px",
      category_shape: "invalid",
    });
    assert.equal(invalid.cardBackground, undefined);
    assert.equal(invalid.cardTitleColor, undefined);
    assert.equal(invalid.cardDescriptionColor, undefined);
    assert.equal(invalid.cardPriceColor, undefined);
    assert.equal(invalid.cardBorderColor, undefined);
    assert.equal(invalid.imageRadius, "square");
    assert.equal(invalid.categoryShape, "plain");
  }
});

test("horizontal cards retain portions, low stock, disabled items and independent media shapes", () => {
  const data = menu(1);
  data.items[0] = {
    ...data.items[0],
    portion: "250g",
    imageUrl: "/assets/placeholder-item.svg",
    availabilityState: "low",
    buildableCount: 2,
  };
  const html = renderToStaticMarkup(
    React.createElement(
      LocaleProvider,
      null,
      React.createElement(
        MenuLanguageProvider,
        null,
        React.createElement(WebsiteOrderMenu, {
          menus: [data],
          design: normalizeWebsiteOrder({
            card_style: "filled",
            card_radius: "soft",
            image_radius: "rounded",
            item_action: "cutout",
            card_background: "#6e1f13",
            card_title_color: "#ffffff",
            card_price_color: "#dfc65b",
            show_availability_filter: false,
          }),
          onSelect: () => undefined,
        }),
      ),
    ),
  );
  assert.match(html, /--order-card-bg:#6e1f13/);
  assert.match(html, /--order-card-title:#ffffff/);
  assert.match(html, /--order-card-price:#dfc65b/);
  assert.match(html, /data-radius="soft" data-card-style="filled"/);
  assert.match(
    html,
    /website-order-item-media" data-radius="rounded" data-action="cutout"/,
  );
  assert.match(html, /website-order-item-portion">250g/);
  assert.match(html, /website-order-item-stock">2 left/);
  assert.match(html, /aria-label="Sold bread" disabled=""/);
  assert.match(html, /aria-current="location"/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /Hidden|Combo only/);
});

test("one menu navigates groups; multiple menus navigate menu names and retain group headings", () => {
  for (const count of [1, 2])
    for (const showCategoryTitles of [true, false]) {
      const html = renderToStaticMarkup(
        React.createElement(
          LocaleProvider,
          null,
          React.createElement(
            MenuLanguageProvider,
            null,
            React.createElement(WebsiteOrderMenu, {
              menus: Array.from({ length: count }, (_, i) => menu(i + 1)),
              design: normalizeWebsiteOrder({
                show_category_titles: showCategoryTitles,
              }),
              onSelect: () => undefined,
            }),
          ),
        ),
      );
      assert.equal(/<h2>Menu 1<\/h2>/.test(html), count > 1);
      assert.equal(/<h3[^>]*>Visible<\/h3>/.test(html), showCategoryTitles);
      assert.equal(/href="#menu-menu-1"/.test(html), count > 1);
      assert.equal(/href="#menu-menu-1-group"/.test(html), count === 1);
      assert.match(html, /id="menu-menu-1-group"/);
      assert.match(html, /aria-label="Fresh bread"/);
    }
});

test("invalid visual values cannot inject CSS or executable media", () => {
  for (const value of [null, [], "wrong"])
    assert.equal(normalizeWebsiteOrder(value).layout, "list");
  const design = normalizeWebsiteOrder({
    columns: -7,
    layout: "unknown",
    background: "red;position:fixed",
    background_image: "javascript:alert(1)",
    item_aspect_ratio: "99/0",
    item_title_style: "url(javascript:bad)",
  });
  assert.equal(design.columns, 1);
  assert.equal(design.background, undefined);
  assert.equal(design.backgroundImage, undefined);
  assert.equal(design.itemAspectRatio, "4/3");
  assert.equal(design.itemTitleText.style, "paragraph-2");
  assert.equal(normalizeWebsiteOrder({ columns: 200 }).columns, 4);
  for (const url of ["//evil.test", "/\\evil.test", "data:image/svg+xml,bad"])
    assert.equal(
      normalizeWebsiteOrder({ background_image: url }).backgroundImage,
      undefined,
    );
});

test("fulfillment selections and delivery addresses stay scoped to their restaurant", () => {
  const store = useWebsiteOrderStore;
  store.setState({ selections: {} });
  store
    .getState()
    .select("1", { orderType: "delivery", address: "Test delivery address" });
  assert.equal(store.getState().selections["2"], undefined);
  store.getState().select("2", { orderType: "pickup" });
  assert.equal(store.getState().selections["1"].orderType, "delivery");
  store.getState().select("1", { orderType: "pickup" });
  assert.equal(store.getState().selections["1"].address, undefined);
  store.setState({ selections: {} });
});

test("starting prices match the historical menu while ranges remain available", () => {
  const data = menu(1);
  data.items[0].optionSets = [
    {
      id: 1,
      name: "Size",
      options: [
        { id: 11, name: "250g", price: 35, sortOrder: 0 },
        { id: 12, name: "500g", price: 70, sortOrder: 1 },
      ],
    },
  ] as NonNullable<(typeof data.items)[0]["optionSets"]>;
  for (const mode of ["starting", "range"]) {
    const html = renderToStaticMarkup(
      React.createElement(
        LocaleProvider,
        null,
        React.createElement(
          MenuLanguageProvider,
          null,
          React.createElement(WebsiteOrderMenu, {
            menus: [data],
            design: normalizeWebsiteOrder({ price_display: mode }),
            onSelect: () => undefined,
          }),
        ),
      ),
    );
    assert.equal(html.includes("₪35.00 – ₪70.00"), mode === "range");
    assert.ok(html.includes("₪35.00"));
  }
});

test("the shared-style renderer ignores legacy card and bar colors while retaining font settings", () => {
  for (const authored of [true, false]) {
    const palette = {
      mode: "light",
      bg: "#ffffff",
      surface: "#6d1f13",
      ink: "#000000",
      accent: "#e77a40",
      color_styles: authored ? normalizeSiteColors({}) : undefined,
    } as NonNullable<WebsiteConfig["customPalette"]>;
    const config = {
      themeId: "custom",
      customPalette: palette,
      sectionColors: { categoryBar: { bg: "#6d1f13" } },
    } as WebsiteConfig;
    const html = renderToStaticMarkup(
      React.createElement(
        LocaleProvider,
        null,
        React.createElement(
          MenuLanguageProvider,
          null,
          React.createElement(
            ResolvedThemeProvider,
            { config, pageMode: "website" } as React.ComponentProps<
              typeof ResolvedThemeProvider
            >,
            React.createElement(WebsiteOrderMenu, {
              menus: [menu(1)],
              design: normalizeWebsiteOrder({
                color_style: "style-5",
                background_kind: "color", background: "#aabbcc",
                card_color_style: authored ? "default" : "style-4",
                card_style: "filled",
                card_background: "#6d1f13",
                card_price_color: "#dfc65b",
                item_title_style: "inherit",
              }),
              onSelect: () => undefined,
            }),
          ),
        ),
      ),
    );
    assert.match(html, /data-shared-colors="true"/);
    assert.match(html, /--site-title:var\(--style-5-title\)/);
    assert.match(html, /--order-card-title:var\(--site-menu-card-title\)/);
    assert.match(html, /background-color:var\(--site-menu-background\)/);
    assert.match(html, /--cat-sticky-bg:var\(--site-menu-bar-background\)/);
    assert.match(html, /--cat-current-search-text:var\(--site-menu-category-text\)/);
    assert.match(html, /var\(--type-itemname-size/);
    assert.doesNotMatch(
      html,
      /#6d1f13|#dfc65b|#aabbcc|type-itemprice-color|brand-dark/,
    );
  }
});
