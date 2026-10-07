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

test("cart disables increment when all stock is already in the cart", () => {
  const html = render(React.createElement(CommerceCartItems, {
    lines: [{ ...lines[0], quantity: 1, item: { ...lines[0].item, buildableCount: 1 } }],
    currency: "USD",
  }));
  assert.match(html, /disabled="" aria-label="Increase quantity · Salad"/);
});

test("cart increment accounts for other lines of the same item", () => {
  const stocked = { ...lines[0], quantity: 1, item: { ...lines[0].item, buildableCount: 2 } };
  const html = render(React.createElement(CommerceCartItems, {
    lines: [stocked, { ...stocked, id: "other", note: "Different preparation" }],
    currency: "USD",
  }));
  assert.equal((html.match(/disabled="" aria-label="Increase quantity · Salad"/g) ?? []).length, 2);
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

test("fulfillment keeps location and timing independently editable", async () => {
  const { CommerceFulfillment } = await import("../../components/CommerceFulfillment");
  const html = render(React.createElement(CommerceFulfillment, {
    location: "Pickup: Demo Street",
    timing: "Tomorrow · 12:00 – 12:30",
    onLocation() {},
    onTime() {},
  }));
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.match(html, /aria-label="Edit: Pickup: Demo Street"/);
  assert.match(html, /Tomorrow · 12:00 – 12:30/);
});

test("fixed fulfillment details remain read only for tours and table orders", async () => {
  const { CommerceFulfillment } = await import("../../components/CommerceFulfillment");
  const html = render(React.createElement(CommerceFulfillment, {
    location: "Delivery round",
    timing: "Friday · 10:00 – 12:00",
  }));
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /Friday · 10:00 – 12:00/);
});

test("compact service controls retain full address and time in accessible names", async () => {
  const { WebsiteServiceBar } = await import("../../components/website-v3/WebsiteServiceBar");
  const html = render(React.createElement(WebsiteServiceBar, {
    location: "Pickup: A very long demo restaurant address",
    locationLabel: "Change location",
    time: "Tomorrow · 12:00",
    timeLabel: "Schedule order",
    infoLabel: "Store information",
    onLocation() {},
    onTime() {},
    onInfo() {},
  }));
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.match(html, /aria-label="Change location: Pickup: A very long demo restaurant address"/);
  assert.match(html, /aria-label="Schedule order: Tomorrow · 12:00"/);
  assert.match(html, /aria-label="Store information"/);
});

test("confirmation distinguishes a resolved total from an estimated cart", () => {
  const html = render(React.createElement(CommerceOrderSummary, {
    subtotal: 24, currency: "EUR", vatRate: 18, estimated: false,
  }));
  assert.doesNotMatch(html, /Estimated order total/);
  assert.match(html, /Total/);
  assert.match(html, /24\.00/);
});
