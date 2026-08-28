import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, estimateFlowAdjustment, estimateSessionFlowAdjustment, resolveCatalogPricing, selectedCatalogPerGuestRate, selectedSessionCatalogPerGuestRate, sessionCatalogPerGuestRate, visibleFlowSteps, visibleSessionFlowSteps } from "@/lib/cateringFlow";
import type { CateringFlowConfigPublic } from "@/services/api";

const config: CateringFlowConfigPublic = {
  version: 1,
  enabled: true,
  steps: [
    { id: "mode", kind: "single_choice", title: "Mode", required: true, options: [{ id: "delivery", label: "Delivery" }, { id: "onsite", label: "On site", price: 10, price_mode: "per_guest_session" }] },
    { id: "staff", kind: "quantity", title: "Staff", required: false, condition: { step_id: "mode", operator: "equals", option_id: "onsite" }, options: [{ id: "server", label: "Server", price: 250, price_mode: "per_unit" }] },
  ],
};

test("guided flow reveals only relevant conditional steps", () => {
  assert.deepEqual(visibleFlowSteps(config, { mode: "delivery" }).map((step) => step.id), ["mode"]);
  assert.deepEqual(visibleFlowSteps(config, { mode: "onsite" }).map((step) => step.id), ["mode", "staff"]);
});

test("guided flow estimates published pricing modes", () => {
  assert.equal(estimateFlowAdjustment(config, { mode: "onsite", staff: { server: 2 } }, [{ id: "a", label: "A", date: "2026-09-01" }, { id: "b", label: "B", date: "2026-09-02" }], 30), 1100);
});

test("guided flow builds relative session dates without UTC drift", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("a single implicit service does not add a customer-facing schedule step", () => {
  const singleService: CateringFlowConfigPublic = {
    version: 1,
    enabled: true,
    steps: [
      { id: "schedule", kind: "schedule", title: "Planning", required: true, schedule: { mode: "single", min_sessions: 0, max_sessions: 1, allow_same_day: false } },
      { id: "guests", kind: "guest_count", title: "Guests", required: true },
    ],
  };
  assert.deepEqual(visibleFlowSteps(singleService, {}).map((step) => step.id), ["guests"]);
});

test("a service mode can replace the catalog rate instead of adding a surcharge", () => {
  const rateConfig: CateringFlowConfigPublic = {
    version: 1,
    enabled: true,
    steps: [{
      id: "mode",
      kind: "single_choice",
      title: "Mode",
      required: true,
      options: [
        { id: "delivery", label: "Delivery", price: 150, price_mode: "per_guest", price_effect: "replace_catalog_per_guest" },
        { id: "onsite", label: "On site", price: 230, price_mode: "per_guest", price_effect: "replace_catalog_per_guest" },
      ],
    }],
  };
  assert.equal(selectedCatalogPerGuestRate(rateConfig, { mode: "onsite" }), 230);
  assert.equal(estimateFlowAdjustment(rateConfig, { mode: "onsite" }, [], 30), 0);
});

test("session questions and rates stay isolated between Friday and Saturday", () => {
  const sessionConfig: CateringFlowConfigPublic = {
    version: 2,
    enabled: true,
    steps: [
      { id: "schedule", kind: "schedule", title: "Sessions", required: true, schedule: { mode: "predefined", min_sessions: 2, max_sessions: 2, allow_same_day: false, slots: [
        { id: "friday", label: "Friday", day_offset: 0, catalog_per_guest_rate: 140 },
        { id: "saturday", label: "Saturday", day_offset: 1, catalog_per_guest_rate: 180 },
      ] } },
      { id: "mode", kind: "single_choice", scope: "session", title: "Mode", required: true, options: [
        { id: "delivery", label: "Delivery", price: 150, price_mode: "per_guest", price_effect: "replace_catalog_per_guest" },
        { id: "onsite", label: "On site", price: 230, price_mode: "per_guest", price_effect: "replace_catalog_per_guest" },
      ] },
      { id: "servers", kind: "quantity", scope: "session", title: "Servers", required: false, options: [{ id: "server", label: "Server", price: 250, price_mode: "per_unit" }] },
    ],
  };
  assert.deepEqual(visibleFlowSteps(sessionConfig, {}).map((step) => step.id), ["schedule"]);
  assert.deepEqual(visibleSessionFlowSteps(sessionConfig, {}, { mode: "delivery" }).map((step) => step.id), ["mode", "servers"]);
  assert.equal(selectedSessionCatalogPerGuestRate(sessionConfig, {}, { mode: "delivery" }), 150);
  assert.equal(selectedSessionCatalogPerGuestRate(sessionConfig, {}, { mode: "onsite" }), 230);
  assert.equal(sessionCatalogPerGuestRate(sessionConfig, { id: "friday", label: "Friday", date: "2026-09-04" }), 140);
  assert.equal(estimateSessionFlowAdjustment(sessionConfig, {}, { mode: "delivery", servers: { server: 2 } }, 30), 500);
});

test("custom sessions use the first matching weekday and time pricing rule", () => {
  const pricingConfig: CateringFlowConfigPublic = {
    version: 2,
    enabled: true,
    steps: [{
      id: "schedule",
      kind: "schedule",
      title: "Sessions",
      required: true,
      schedule: {
        mode: "custom",
        min_sessions: 1,
        max_sessions: 4,
        allow_same_day: true,
        pricing_rules: [
          { id: "sunday_evening", label: "Sunday evening", weekday: 0, start_time_from: "18:00", catalog_per_guest_rate: 230 },
          { id: "sunday", label: "Sunday", weekday: 0, catalog_per_guest_rate: 180 },
        ],
      },
    }],
  };
  assert.equal(sessionCatalogPerGuestRate(pricingConfig, { id: "custom_1", label: "Evening", date: "2026-09-06", startTime: "19:30" }), 230);
  assert.equal(sessionCatalogPerGuestRate(pricingConfig, { id: "custom_2", label: "Morning", date: "2026-09-06", startTime: "09:00" }), 180);
});

test("central pricing combines formula, guests, day and service mode", () => {
  const central: CateringFlowConfigPublic = {
    version: 3,
    enabled: true,
    steps: [{ id: "mode", kind: "single_choice", scope: "session", title: "Mode", required: true, options: [{ id: "delivery", label: "Delivery" }, { id: "onsite", label: "On site" }] }],
    pricing: { rules: [
      { id: "fallback", label: "Fallback", catalog_item_id: 42, catalog_per_guest_rate: 170 },
      { id: "friday_small_onsite", label: "Friday onsite 1–20", catalog_item_id: 42, catalog_per_guest_rate: 270, conditions: [
        { factor: "weekday", operator: "equals", value: "5" },
        { factor: "answer:mode", operator: "equals", value: "onsite" },
        { factor: "guest_count", operator: "between", min_value: "1", max_value: "20" },
      ] },
      { id: "friday_onsite", label: "Friday onsite 21–60", catalog_item_id: 42, catalog_per_guest_rate: 230, conditions: [
        { factor: "weekday", operator: "equals", value: "5" },
        { factor: "answer:mode", operator: "equals", value: "onsite" },
        { factor: "guest_count", operator: "between", min_value: "21", max_value: "60" },
      ] },
    ] },
  };
  const friday = { id: "friday", label: "Friday", date: "2026-09-04", startTime: "19:00" };
  assert.equal(resolveCatalogPricing(central, 42, 15, friday, {}, { mode: "onsite" }).rate, 270);
  assert.equal(resolveCatalogPricing(central, 42, 30, friday, {}, { mode: "onsite" }).rate, 230);
  assert.equal(resolveCatalogPricing(central, 42, 30, friday, {}, { mode: "delivery" }).rate, 170);
});
