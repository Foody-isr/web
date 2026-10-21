import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "../i18n";
import { normalizeWebsiteOrder, websiteOrderCopy } from "../websiteOrder";
import { mapWebsiteConfig } from "../websiteConfig";
import type { BatchFulfillmentConfigResponse, Restaurant } from "../types";
import { WebsiteFulfillmentDialog } from "../../components/website-v3/WebsiteFulfillmentDialog";

Object.assign(globalThis, { React });
const restaurant: Restaurant = {id:1, name:"Demo bakery", address:"31 Main Street", pickupEnabled:true, deliveryEnabled:true, dineInEnabled:false};
function render(overrides: Partial<Restaurant> = {}, batch?: Partial<BatchFulfillmentConfigResponse>, delivery = false, accountAccess = false, preview = false) {
  const client = new QueryClient();
  const key = ["restaurant-header-batch", 1, "pickup"];
  if (batch) client.setQueryData(key, batch);
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, {client},
    React.createElement(LocaleProvider, null, React.createElement(WebsiteFulfillmentDialog, {
      open:true, accountAccess, preview, restaurant:{...restaurant, ...overrides}, design:normalizeWebsiteOrder({}),
      selection:{orderType:delivery ? "delivery" : "pickup"}, onClose(){}, onConfirm(){}, onInfo(){},
    })),
  ));
  client.clear();
  return html;
}

test("account-enabled entry offers sign-in or guest before either service form", () => {
  for (const delivery of [false, true]) {
    const html = render({}, undefined, delivery, true);
    assert.match(html, /data-entry-choice="true"/);
    assert.match(html, /class="customer-entry-sign-in">Sign in/);
    assert.match(html, /Order without an account/);
    assert.match(html, /class="website-entry-guest">Order without an account/);
    assert.doesNotMatch(html, /<input|website-pickup-summary|class="website-view-menu"/);
  }
});

test("one pickup location displays address and directions without search or a pretend selection", () => {
  for (const overrides of [{}, {chainSlug:"only-location", chainBranchCount:1}]) {
    const html = render(overrides);
    assert.match(html, /Pickup at the restaurant/);
    assert.match(html, /Demo bakery/);
    assert.match(html, /31 Main Street/);
    assert.match(html, /https:\/\/maps.google.com\/\?q=31%20Main%20Street/);
    assert.match(html, /Store info/);
    assert.match(html, /Confirm pickup/);
    assert.doesNotMatch(html, /type="radio"|<input|Search by city|nearest store|Select location|website-pickup-change-branch/);
    assert.match(html, /As soon as possible/);
  }
});

test("multiple locations retain a link to the real branch selector in the customer's locale", () => {
  const html = render({chainSlug:"bakery-chain", chainBranchCount:3});
  assert.match(html, /href="\/c\/bakery-chain\/order\?type=pickup&amp;lang=en"/);
  assert.match(html, /Choose another location/);
  assert.doesNotMatch(html, /<input|type="radio"/);
});

test("preorders display only pickup windows, without borrowing delivery dates or promising immediate pickup", () => {
  const html = render({batchFulfillmentEnabled:true}, {enabled:true, fulfillmentDays:[
    {date:"2030-10-11", dayName:"Friday", pickupWindow:{start:"10:00",end:"12:00"}, deliveryWindow:{start:"08:00",end:"15:00"}},
    {date:"2030-10-12", dayName:"Saturday", deliveryWindow:{start:"09:00",end:"14:00"}},
  ]});
  assert.match(html, /Pre-order/);
  assert.match(html, /10:00 – 12:00/);
  assert.doesNotMatch(html, /08:00|15:00|09:00|14:00|As soon as possible/);
});

test("empty and loading pickup calendars stay explicit", () => {
  const noPickup = render({batchFulfillmentEnabled:true}, {enabled:true, fulfillmentDays:[{date:"2030-10-12",dayName:"Saturday",deliveryWindow:{start:"08:00",end:"15:00"}}]});
  assert.match(noPickup, /No pickup times are currently available/);
  assert.match(render({batchFulfillmentEnabled:true}), /Loading/);
  assert.doesNotMatch(noPickup, /As soon as possible/);
});

test("ordinary pickup respects paused, preorder and preparation settings", () => {
  assert.match(render({ordersPaused:true}), /Temporarily Paused/);
  assert.doesNotMatch(render({preordersOnly:true}), /As soon as possible/);
  const prepared = render({schedulingEnabled:true, schedulingLeadTimeMinutes:120});
  assert.match(prepared, /Loading pickup times/);
  assert.match(prepared, /class="website-view-menu" disabled=""/);
  assert.doesNotMatch(prepared, /As soon as possible/);
  assert.doesNotMatch(render({address:undefined}), /maps.google.com/);
});

test("delivery keeps the address form with a compact heading and explicit confirmation", () => {
  const html = render({}, undefined, true);
  assert.match(html, /<h2 id="website-fulfillment-title">Delivery address<\/h2>/);
  assert.match(html, /aria-label="Delivery address"/);
  assert.match(html, /Confirm address/);
  assert.doesNotMatch(html, /website-pickup-summary|Confirm pickup/);
});

test("paused delivery explains the disabled confirmation even without a scheduling selector", () => {
  for (const batchFulfillmentEnabled of [false, true]) {
    const html = render({ ordersPaused: true, batchFulfillmentEnabled }, undefined, true);
    assert.match(html, /Demo bakery is not accepting new orders right now/);
    assert.match(html, /class="website-view-menu" disabled=""/);
  }
});

test("pickup labels are provided in all supported languages", () => {
  assert.equal(websiteOrderCopy("fr").pickupTitle, "Retrait sur place");
  assert.equal(websiteOrderCopy("fr").confirmPickup, "Confirmer le retrait");
  assert.equal(websiteOrderCopy("he").confirmPickup, "אישור האיסוף");
  for (const locale of ["en", "fr", "he"]) assert.ok(websiteOrderCopy(locale).pickupWhen);
});

test("published false skips the invitation without disabling account access", () => {
 for (const delivery of [false, true]) {
  const html = render({ websiteConfig: mapWebsiteConfig({ checkout_config: { offer_sign_in: false } }) }, undefined, delivery, true);
  assert.match(html, /data-entry-choice="false"/);
  assert.match(html, /data-field-checkout-offer-sign-in="false"/);
  assert.doesNotMatch(html, /website-entry-choice|customer-entry-sign-in/);
  assert.match(html, /website-view-menu/);
 }
});

test("isolated preview shows the invitation without a live sign-in action", () => {
 const html = render({}, undefined, false, false, true);
 assert.match(html, /data-entry-choice="true"/);
 assert.match(html, /class="customer-entry-sign-in" disabled=""/);
 assert.match(html, /Order without an account/);
});
