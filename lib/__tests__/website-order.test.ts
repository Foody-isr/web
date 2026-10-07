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
  menus[0].items.push({...menus[0].items[0], id: "hidden-state", availabilityState: "hidden"});
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
  assert.deepEqual(design.itemTitleText, { style: "title-4", alignment: "end", caps: true });
  assert.equal(design.promptOnEntry, false);
});

test("one menu navigates groups; multiple menus navigate menu names and retain group headings", () => {
  for (const count of [1, 2]) for (const showCategoryTitles of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(LocaleProvider, null,
      React.createElement(MenuLanguageProvider, null,
        React.createElement(WebsiteOrderMenu, {
          menus: Array.from({length: count}, (_, i) => menu(i + 1)),
          design: normalizeWebsiteOrder({show_category_titles: showCategoryTitles}), onSelect: () => undefined,
        }),
      ),
    ));
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
