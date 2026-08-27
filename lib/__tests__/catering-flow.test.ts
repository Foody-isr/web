import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, estimateFlowAdjustment, selectedCatalogPerGuestRate, visibleFlowSteps } from "@/lib/cateringFlow";
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
