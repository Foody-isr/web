import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderDiscoveryInsertAfter,
  orderDiscoveryPlacement,
  orderDiscoverySections,
} from "@/lib/orderDiscovery";
import { resolveRestaurantWebsiteHref } from "@/lib/restaurantWebsiteLink";
import type { WebsiteSection } from "@/lib/types";

function section(
  id: number,
  sectionType: string,
  options: {
    visible?: boolean;
    sortOrder?: number;
    insertAfter?: unknown;
    settings?: Record<string, unknown>;
  } = {},
): WebsiteSection {
  return {
    id,
    sectionType,
    page: "commander",
    sortOrder: options.sortOrder ?? 0,
    isVisible: options.visible ?? true,
    layout: "default",
    content: {},
    settings: {
      insert_after_items: options.insertAfter,
      ...options.settings,
    },
  };
}

test("order discovery uses only dedicated sections from the order page", () => {
  const sections = orderDiscoverySections([
    section(1, "feature_cards"),
    section(2, "order_discovery", { sortOrder: 5 }),
    section(3, "order_discovery", { visible: false, sortOrder: 1 }),
    section(4, "order_discovery", { sortOrder: 2 }),
  ]);

  assert.deepEqual(sections.map((entry) => entry.id), [4, 2]);
  assert.ok(sections.every((entry) => entry.sectionType === "order_discovery"));
});

test("order discovery resolves category-aware placement with safe fallbacks", () => {
  const legacy = section(1, "order_discovery", { insertAfter: 7 });
  assert.deepEqual(orderDiscoveryPlacement(legacy, ["salads", "fish"]), {
    mode: "inside_group",
    groupId: "salads",
    edge: "after",
    insertAfterItems: 7,
  });

  const between = section(2, "order_discovery", {
    settings: {
      placement_mode: "between_groups",
      placement_group_id: 42,
      placement_edge: "before",
    },
  });
  assert.deepEqual(orderDiscoveryPlacement(between, ["17", "42"]), {
    mode: "between_groups",
    groupId: "42",
    edge: "before",
    insertAfterItems: 6,
  });

  const removedTarget = section(3, "order_discovery", {
    settings: { placement_group_id: "missing" },
  });
  assert.equal(
    orderDiscoveryPlacement(removedTarget, ["fallback"]).groupId,
    "fallback",
  );
  assert.equal(orderDiscoveryPlacement(removedTarget, []).groupId, null);
});

test("order discovery insertion count is configurable and clamped", () => {
  assert.equal(orderDiscoveryInsertAfter(section(1, "order_discovery")), 6);
  assert.equal(
    orderDiscoveryInsertAfter(
      section(1, "order_discovery", { insertAfter: 9.4 }),
    ),
    9,
  );
  assert.equal(
    orderDiscoveryInsertAfter(
      section(1, "order_discovery", { insertAfter: -2 }),
    ),
    1,
  );
  assert.equal(
    orderDiscoveryInsertAfter(
      section(1, "order_discovery", { insertAfter: 200 }),
    ),
    50,
  );
});

test("discovery links preserve external targets and scope local pages", () => {
  assert.equal(
    resolveRestaurantWebsiteHref("/catering", "mamie-tlv"),
    "/r/mamie-tlv/catering",
  );
  assert.equal(
    resolveRestaurantWebsiteHref("epicerie", "mamie tlv"),
    "/r/mamie%20tlv/epicerie",
  );
  assert.equal(
    resolveRestaurantWebsiteHref("https://shop.example.com", "mamie-tlv"),
    "https://shop.example.com",
  );
  assert.equal(resolveRestaurantWebsiteHref("", "mamie-tlv"), null);
});
