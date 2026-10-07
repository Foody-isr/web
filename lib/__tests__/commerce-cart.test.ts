import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../i18n";
import { MenuLanguageProvider } from "../menu-language";
import { CommerceCartItems } from "../../components/CommerceCartItems";
import { CommerceOrderSummary } from "../../components/CommerceOrderSummary";
import type { CartLine } from "../types";

// tsx uses the repository's preserved JSX mode for imported components.
Object.assign(globalThis, { React });
function render(child: React.ReactNode) {
  return renderToStaticMarkup(
    React.createElement(
      LocaleProvider,
      null,
      React.createElement(MenuLanguageProvider, null, child),
    ),
  );
}
const lines: CartLine[] = [
  {
    id: "variant-line",
    item: { id: "1", name: "Salad", price: 8, groupId: "1" },
    quantity: 2,
    selectedVariantName: "Large",
    selectedVariantPrice: 12,
    modifiers: [{ id: "1", name: "Avocado", priceDelta: 3, action: "add" }],
    note: "No onions",
  },
];

test("cart renders absolute variant prices plus modifier deltas and the actual quantity", () => {
  const html = render(
    React.createElement(CommerceCartItems, { lines, currency: "USD" }),
  );
  assert.match(html, /30\.00/);
  assert.match(html, /15\.00/);
  assert.match(html, /Large/);
  assert.match(html, /Avocado/);
  assert.match(html, /No onions/);
  assert.match(html, /Decrease quantity · Salad/);
  assert.match(html, /Remove · Salad/);
});

test("a single item cannot be decremented below one, but has a separate remove action", () => {
  const html = render(
    React.createElement(CommerceCartItems, {
      lines: [{ ...lines[0], quantity: 1 }],
      currency: "USD",
    }),
  );
  assert.match(html, /disabled="" aria-label="Decrease quantity · Salad"/);
  assert.match(html, /aria-label="Remove · Salad"/);
});

test("checkout summary is read only and preserves combo selections", () => {
  const html = render(
    React.createElement(CommerceCartItems, {
      lines: [
        {
          ...lines[0],
          comboId: 7,
          comboName: "Lunch",
          comboSelections: [
            {
              stepId: 1,
              stepName: "Main",
              menuItemId: 1,
              menuItemName: "Salad",
              quantity: 2,
              priceDelta: 0,
            },
          ],
        },
      ],
      currency: "USD",
      compact: true,
      editable: false,
    }),
  );
  assert.match(html, /Lunch/);
  assert.match(html, /2 × Salad/);
  assert.doesNotMatch(html, /<button/);
});

test("totals include VAT in the price, add resolved delivery once and disclose unresolved fees", () => {
  const resolved = render(
    React.createElement(CommerceOrderSummary, {
      subtotal: 100,
      deliveryFee: 18,
      currency: "USD",
      vatRate: 18,
    }),
  );
  assert.match(resolved, /118\.00/);
  assert.match(resolved, /incl. VAT/);
  const pending = render(
    React.createElement(CommerceOrderSummary, {
      subtotal: 100,
      currency: "USD",
      vatRate: 18,
      deliveryPending: true,
    }),
  );
  assert.match(pending, /once your address is confirmed/);
  assert.doesNotMatch(pending, /118\.00/);
});
