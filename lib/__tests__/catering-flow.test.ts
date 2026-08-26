import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, estimateFlowAdjustment, visibleFlowSteps } from "@/lib/cateringFlow";
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
