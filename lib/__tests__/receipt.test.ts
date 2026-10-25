import test from "node:test";
import assert from "node:assert/strict";
import {
  receiptGroups,
  receiptCopy,
  receiptStatusKey,
  receiptHref,
} from "../receipt";
import { checkoutAppearanceVariables } from "../websiteV3Appearance";
import { normalizeSiteColors } from "../siteColors";
import type { ReceiptData } from "../../services/api";

const item = (id: number, total: number, extra = {}) => ({
  id,
  name: "Sample",
  quantity: 1,
  unit_price: total,
  total,
  ...extra,
});

test("receipt preserves line order and combo snapshots while excluding voids and retaining comps", () => {
  const data = {
    order: { total_amount: 45 },
    items: [
      item(1, 2, { combo_group: "one", combo_price: 30 }),
      item(2, 10),
      item(3, 3, { combo_group: "one", combo_price: 30 }),
      item(4, 80, { adjustment_kind: "void" }),
      item(5, 0, {
        adjustment_kind: "comp",
        combo_group: "gift",
        combo_price: 25,
      }),
    ],
  } as ReceiptData;
  const groups = receiptGroups(data);
  assert.deepEqual(
    groups.map((group) => group.key),
    ["combo:one", "item:2", "combo:gift"],
  );
  assert.deepEqual(
    groups[0].items.map((item) => item.id),
    [1, 3],
  );
  assert.deepEqual(
    groups.map((group) => group.total),
    [35, 10, 0],
  );
});

test("legacy combos keep their existing fallback without changing the order total", () => {
  const data = {
    order: { total_amount: 42 },
    items: [item(1, 10), item(2, 2, { combo_group: "legacy" })],
  } as ReceiptData;
  assert.equal(receiptGroups(data)[1].total, 32);
  assert.equal(data.order.total_amount, 42);
});

test("receipt copy resolves translations and falls back when cleared", () => {
  assert.equal(
    receiptCopy({ fr: "Merci", en: "Thanks" }, "fr", "Default"),
    "Merci",
  );
  assert.equal(receiptCopy({ fr: "Merci" }, "he", "Default"), "Merci");
  assert.equal(receiptCopy({ fr: "  " }, "fr", "Default"), "Default");
});

test("receipt localizes delivery and payment states, including authorized payments", () => {
  assert.equal(
    receiptStatusKey("out_for_delivery", "delivery"),
    "statusOnTheWay",
  );
  assert.equal(receiptStatusKey("unpaid", "payment"), "paymentUnpaid");
  assert.equal(receiptStatusKey("authorized", "payment"), "paymentAuthorized");
  assert.equal(receiptStatusKey("received", "pickup"), "statusPickedUp");
  assert.equal(receiptStatusKey("rejected", "delivery"), "receiptRejected");
});

test("receipt inherits the menu colour style and can choose a different shared style", () => {
  const palette = {
    color_styles: normalizeSiteColors({
      bg: "#ffffff",
      ink: "#111111",
      accent: "#334455",
    }),
  };
  palette.color_styles.styles[1].background = "#123456";
  palette.color_styles.styles[2].background = "#654321";
  const appearance = {
    website_order: { color_style: "style-2" },
    order_journey: { receipt: "default" },
  };
  assert.equal(
    checkoutAppearanceVariables(appearance, palette, "receipt")["--bg-page"],
    "#123456",
  );
  assert.equal(
    checkoutAppearanceVariables(
      { ...appearance, order_journey: { receipt: "style-3" } },
      palette,
      "receipt",
    )["--bg-page"],
    "#654321",
  );
});

test("receipt links retain only the order page presentation context", () => {
  assert.equal(receiptHref("demo"), "/receipt/demo");
  assert.equal(
    receiptHref("demo", "weekend"),
    "/receipt/demo?pageSlug=weekend",
  );
  assert.equal(
    receiptHref("demo", "page&restaurantId=2"),
    "/receipt/demo?pageSlug=page%26restaurantId%3D2",
  );
});
