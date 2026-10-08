import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "../i18n";
import { normalizeWebsiteHeader } from "../websiteHeader";
import type { Restaurant } from "../types";
import { WebsiteRestaurantInfo } from "../../components/website-v3/WebsiteRestaurantInfo";
import { WebsiteServiceBar } from "../../components/website-v3/WebsiteServiceBar";

Object.assign(globalThis, { React });
const restaurant: Restaurant = {
  id: 1,
  name: "Demo",
  batchFulfillmentEnabled: false,
  minimumOrderDelivery: 20,
  deliveryEnabled: true,
  pickupEnabled: true,
  dineInEnabled: false,
};
function render(
  info: boolean,
  controls: boolean,
  overrides: Partial<Restaurant> = {},
  layout?: "modern" | "classic",
) {
  const settings = normalizeWebsiteHeader({
    restaurant: { info_enabled: info, show_status: false, info_layout: layout },
  }).restaurant;
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(
        LocaleProvider,
        null,
        React.createElement(
          WebsiteRestaurantInfo,
          {
            restaurant: { ...restaurant, ...overrides },
            settings,
            orderType: "delivery",
            style: { background: "#eee9df", color: "#111111" },
          },
          controls
            ? React.createElement(WebsiteServiceBar, {
                location: "Delivery",
                locationLabel: "Change",
                time: "Tomorrow",
                timeLabel: "Schedule",
                infoLabel: "Information",
                onLocation: overrides.pickupEnabled === false ? undefined : () => {},
                onTime: overrides.batchFulfillmentEnabled ? undefined : () => {},
                onInfo() {},
              })
            : null,
        ),
      ),
    ),
  );
}

test("ordering controls replace the information strip rather than mixing both presentations", () => {
  const html = render(true, true);
  assert.equal(
    (html.match(/class="website-restaurant-info"/g) ?? []).length,
    1,
  );
  assert.match(html, /website-service-controls/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.doesNotMatch(html, /website-restaurant-info-item/);
  assert.doesNotMatch(html, /website-header-fulfillment/);
  assert.match(html, /background:#eee9df;color:#111111/);
});

test("an imposed batch ignores supplied controls and keeps only read-only information", () => {
  const fixed = {
    pickupEnabled: false,
    batchFulfillmentEnabled: true,
    schedulingEnabled: true,
  };
  const html = render(true, true, fixed);
  assert.match(html, /website-restaurant-info-item/);
  assert.doesNotMatch(html, /website-service-controls|<button/);
  assert.equal(render(false, true, fixed), "");
});

test("visibility never switches to the wrong presentation", () => {
  assert.equal(render(false, true), "");
  assert.doesNotMatch(render(false, true), /website-restaurant-info-item/);
  assert.equal(render(true, false), "");
  const locked = render(true, true, {
    websiteConfig: {
      themeId: "custom", pairingId: "default", brandColor: null,
      layoutDefault: "compact", heroLayout: "standard",
      showAddress: true, showPhone: true, showHours: true,
      checkoutConfig: { lock_order_type: true },
    },
  });
  assert.match(locked, /website-restaurant-info-item/);
  assert.doesNotMatch(locked, /website-service-controls|<button/);
});


test("classic can be chosen with multiple modes; modern can be chosen with an imposed batch", () => {
  const classic = render(true, true, {}, "classic");
  assert.match(classic, /website-restaurant-info-item/);
  assert.doesNotMatch(classic, /website-service-controls/);
  const modern = render(true, true, {pickupEnabled: false, batchFulfillmentEnabled: true}, "modern");
  assert.match(modern, /website-service-controls/);
  assert.doesNotMatch(modern, /website-restaurant-info-item/);
  assert.match(modern, /<div class="website-service-time"/);
  assert.match(modern, /<div class="website-service-location"/);
  assert.equal((modern.match(/<button/g) ?? []).length, 1);
  for (const layout of ["modern", "classic"] as const) assert.equal(render(false, true, {}, layout), "");
});
