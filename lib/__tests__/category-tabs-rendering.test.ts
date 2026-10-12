import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupTabs } from "../../components/CategoryTabs";
import { LocaleProvider } from "../i18n";
import { MenuLanguageProvider } from "../menu-language";

Object.assign(globalThis, { React });

test("standard category bars keep one search field above the categories in both pinned states", () => {
  for (const stuck of [true, false]) {
    const html = renderToStaticMarkup(
      React.createElement(LocaleProvider, null,
        React.createElement(MenuLanguageProvider, null,
          React.createElement(GroupTabs, {
            groups: [{ id: "burgers", name: "Burgers" }, { id: "drinks", name: "Drinks" }],
            activeId: "burgers",
            onSelect: () => undefined,
            onSearch: () => undefined,
            stuck,
            backHref: "/r/atelier-foody",
            restaurantName: "Atelier Foody",
          }),
        ),
      ),
    );
    assert.equal((html.match(/<input type="search"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 1);
    assert.equal((html.match(/class="category-tab/g) ?? []).length, 2);
    assert.ok(html.indexOf('<input type="search"') < html.indexOf('class="order-menu-categories'));
    assert.match(html, /href="\/r\/atelier-foody" aria-label="Back"/);
    assert.match(html, /aria-current="location"/);
    assert.match(html, /aria-label="Search menu/);
    assert.match(html, /placeholder="Search"/);
    assert.doesNotMatch(html, /placeholder="Atelier Foody"/);
  }
});
