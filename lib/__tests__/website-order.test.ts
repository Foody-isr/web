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

test("category navigation pins by default and preserves an explicit non-sticky choice", () => {
  for (const value of [undefined, {}, { sticky_categories: null }, { sticky_categories: "false" }]) {
    assert.equal(normalizeWebsiteOrder(value).stickyCategories, true);
  }
  assert.equal(normalizeWebsiteOrder({ sticky_categories: false }).stickyCategories, false);
  assert.equal(normalizeWebsiteOrder({ sticky_categories: true }).stickyCategories, true);
});

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

test("compact row settings round-trip without changing legacy presentation defaults", () => {
  const settings = {
    layout: "rows", image_position: "right", image_size: "large", image_ratio: "wide",
    card_border: "separator", item_spacing: 0, row_padding: 24, category_shape: "underline",
    description_lines: "all", item_description_style: "paragraph-2", item_description_weight: "regular",
    price_placement: "after_description",
  };
  const design = normalizeWebsiteOrder(normalizePageAppearanceOverrides({ website_order: settings }).website_order);
  assert.equal(design.layout, "rows");
  assert.equal(design.imagePosition, "right");
  assert.equal(design.imageSize, "large");
  assert.equal(design.imageRatio, "wide");
  assert.equal(design.cardBorder, "separator");
  assert.equal(design.itemSpacing, 0);
  assert.equal(design.rowPadding, 24);
  assert.equal(design.categoryShape, "underline");
  assert.equal(design.descriptionLines, "all");
  assert.equal(design.itemDescriptionText.style, "paragraph-2");
  assert.equal(normalizeWebsiteOrder({}).itemSpacing, undefined);
  assert.equal(normalizeWebsiteOrder({}).imageSize, "default");
  assert.equal(normalizeWebsiteOrder({}).descriptionLines, "default");
  assert.equal(normalizeWebsiteOrder({ card_style: "filled" }).pricePlacement, "bottom");
  const invalid = normalizeWebsiteOrder({ item_spacing: "1px;position:fixed", row_padding: true,
    image_size: "999px", image_position: "fixed", description_lines: 900 });
  assert.equal(invalid.itemSpacing, undefined);
  assert.equal(invalid.rowPadding, undefined);
  assert.equal(invalid.imageSize, "default");
  assert.equal(invalid.imagePosition, "auto");
  assert.equal(invalid.descriptionLines, "default");
  assert.equal(normalizeWebsiteOrder({ item_spacing: -10, row_padding: 100 }).itemSpacing, 0);
  assert.equal(normalizeWebsiteOrder({ row_padding: 100 }).rowPadding, 48);
});

test("compact rows render real descriptions, prices, media and search with independent controls", () => {
  const data = menu(1);
  data.items[0] = {...data.items[0], description: "Freshly baked every morning", imageUrl: "/assets/placeholder-item.svg"};
  const html = renderToStaticMarkup(React.createElement(LocaleProvider, null,
    React.createElement(MenuLanguageProvider, null, React.createElement(WebsiteOrderMenu, {
      menus: [data], design: normalizeWebsiteOrder({layout: "rows", image_position: "right", image_size: "medium",
        image_ratio: "wide", card_border: "separator", show_descriptions: true, description_lines: "2",
        item_spacing: 0, row_padding: 20, item_description_style: "paragraph-3", category_shape: "underline"}),
      onSelect: () => undefined,
    }))));
  assert.match(html, /data-layout="rows"/);
  assert.match(html, /--order-item-spacing:0px/);
  assert.match(html, /--order-row-padding:20px/);
  assert.match(html, /data-border="separator"/);
  assert.match(html, /data-image-position="right"/);
  assert.match(html, /data-description-lines="2"/);
  assert.match(html, /Freshly baked every morning/);
  assert.match(html, /aspect-ratio:3 \/ 2/);
  assert.match(html, /order-menu-search/);
  assert.match(html, /data-shape="underline"/);
  assert.match(html, /₪12.00/);
  assert.match(html, /aria-label="Sold bread" disabled=""/);
  assert.doesNotMatch(html, /aria-label="Hidden"|aria-label="Combo only"/);
});

test("category bars share one responsive search field without cart buttons", () => {
  for (const cardStyle of ["filled", "plain"]) {
    for (const sticky of [true, false]) {
      const html = renderToStaticMarkup(
        React.createElement(LocaleProvider, null,
          React.createElement(MenuLanguageProvider, null,
            React.createElement(WebsiteOrderMenu, {
              menus: [menu(1)],
              design: normalizeWebsiteOrder({ card_style: cardStyle, sticky_categories: sticky }),
              restaurant: { id: 1, name: "Atelier Foody", deliveryEnabled: true, pickupEnabled: true, dineInEnabled: false },
              onSelect: () => undefined,
            }),
          ),
        ),
      );
      const navigation = html.slice(html.indexOf('class="website-order-navigation order-menu-chrome"'), html.indexOf('<div id="menu-'));
      assert.match(navigation, /href="#menu-menu-1-group"/);
      assert.match(navigation, /<input type="search"[^>]*aria-label="Search"/);
      assert.match(navigation, /placeholder="Search"/);
      assert.doesNotMatch(navigation, /placeholder="Atelier Foody"/);
      assert.equal((navigation.match(/<input\b/g) ?? []).length, 1);
      assert.equal((navigation.match(/aria-haspopup="menu"/g) ?? []).length, 1);
      assert.match(navigation, /aria-expanded="false"/);
      assert.match(navigation, /order-menu-language-dialog/);
      assert.ok(navigation.indexOf('class="order-menu-search"') < navigation.indexOf('<nav'));
      assert.doesNotMatch(navigation, /data-open|website-order-cart|website-order-search-toggle/);
    }
  }
});

test("mobile language selection stays available when the owner hides menu search", () => {
  const html = renderToStaticMarkup(
    React.createElement(LocaleProvider, null,
      React.createElement(MenuLanguageProvider, null,
        React.createElement(WebsiteOrderMenu, {
          menus: [menu(1)],
          design: normalizeWebsiteOrder({ show_search: false }),
          onSelect: () => undefined,
        }),
      ),
    ),
  );
  assert.doesNotMatch(html, /type="search"/);
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 1);
  assert.match(html, /order-menu-language-dialog/);
  for (const name of ["English", "עברית", "Français"]) assert.ok(html.includes(name));
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

test("menu tabs select one carte while category links always navigate its groups", () => {
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
      assert.equal(/role="tablist"/.test(html), count > 1);
      assert.equal((html.match(/role="tab"/g) ?? []).length, count > 1 ? count : 0);
      assert.doesNotMatch(html, /<h2>Menu 1<\/h2>/);
      assert.equal(/<h[23][^>]*>Visible<\/h[23]>/.test(html), showCategoryTitles);
      assert.doesNotMatch(html, /href="#menu-menu-1"/);
      assert.match(html, /href="#menu-menu-1-group"/);
      assert.doesNotMatch(html, /id="menu-menu-2-group"/);
      assert.match(html, /id="menu-menu-1-group"/);
      assert.match(html, /aria-label="Fresh bread"/);
    }
});

test("menu selection scopes items and groups by entry key and survives hidden categories or stale selection", () => {
  const first = menu(1);
  const second = menu(2);
  first.name = "BASSARI";
  first.items[0].name = "Burger";
  second.name = "HALAVI";
  second.items[0].name = "Pizza";
  const empty = { ...menu(3), items: [] };
  const tour = { ...menu(4), tour: { id: 8 } } as MenuData;
  for (const showCategories of [true, false]) {
    for (const activeEntryKey of [second.entryKey, "deleted-menu"]) {
      const html = renderToStaticMarkup(React.createElement(LocaleProvider, null,
        React.createElement(MenuLanguageProvider, null, React.createElement(WebsiteOrderMenu, {
          menus: [first, second, empty, tour], activeEntryKey,
          design: normalizeWebsiteOrder({ show_categories: showCategories, category_shape: "pill" }),
          onSelect: () => undefined,
        }))));
      assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
      const selected = activeEntryKey === second.entryKey ? second : first;
      assert.match(html, new RegExp(`role="tab"[^>]*id="[^"]*tab-${selected.entryKey}"[^>]*aria-selected="true"`));
      assert.match(html, new RegExp(`aria-label="${selected.items[0].name}"`));
      assert.doesNotMatch(html, new RegExp(`aria-label="${selected === first ? "Pizza" : "Burger"}"`));
      assert.equal(/href="#menu-/.test(html), showCategories);
    }
  }
});

test("the availability filter keeps a native labelled select and a decorative chevron", () => {
  const html = renderToStaticMarkup(React.createElement(LocaleProvider, null,
    React.createElement(MenuLanguageProvider, null, React.createElement(WebsiteOrderMenu, {
      menus: [menu(1)], design: normalizeWebsiteOrder({show_availability_filter: true}), onSelect: () => {},
    }))));
  assert.match(html, /class="website-availability-filter"/);
  assert.match(html, /<select aria-label="Availability filter"/);
  assert.match(html, /<option value="all" selected="">All items/);
  assert.match(html, /<option value="available">Available items/);
  assert.match(html, /<svg aria-hidden="true" viewBox="0 0 20 20"/);
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
  assert.equal(design.itemAspectRatio, "16/9");
  assert.equal(design.itemTitleText.style, "inherit");
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
      // The theme bootstrap contains the complete site palette; this assertion
      // concerns only the menu's own styles overriding its assigned style.
      html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
      /#6d1f13|#dfc65b|#aabbcc|type-itemprice-color|brand-dark/,
    );
  }
});


test("sparse historical menus inherit uploaded typography and filled category pills", () => {
  const design = normalizeWebsiteOrder({card_style: "filled", columns: "3"});
  for (const role of [design.categoryText, design.categoryTitleText, design.itemTitleText, design.itemPriceText]) assert.equal(role.style, "inherit");
  assert.equal(design.categoryShape, "pill");
  assert.equal(normalizeWebsiteOrder({card_style: "filled", category_shape: "plain", category_title_style: "title-3"}).categoryTitleText.style, "title-3");
  assert.equal(normalizeWebsiteOrder({card_style: "filled", category_shape: "plain"}).categoryShape, "plain");
  assert.equal(normalizeWebsiteOrder({card_style: "filled", category_shape: "underline"}).categoryShape, "underline");
});

test("category spacing accepts zero and clamps invalid or excessive settings", () => {
  assert.equal(normalizeWebsiteOrder({category_gap: 0}).categoryGap, 0);
  assert.equal(normalizeWebsiteOrder({category_gap: "32"}).categoryGap, 32);
  assert.equal(normalizeWebsiteOrder({category_gap: "invalid"}).categoryGap, 20);
  assert.equal(normalizeWebsiteOrder({category_spacing: -4}).categorySpacing, 0);
  assert.equal(normalizeWebsiteOrder({category_spacing: 500}).categorySpacing, 160);
});
