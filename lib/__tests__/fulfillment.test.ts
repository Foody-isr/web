import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveLeadMinutes,
  formatLeadDuration,
  itemPreparationMinutes,
  isSlowerThanDefault,
  restaurantLeadMinutes,
} from "@/lib/fulfillment";

// Stands in for useI18n's `t`, which returns the raw key when one is missing.
// Interpolation is manual across this codebase, so the fake mirrors that.
const t = (key: string) =>
  ({
    leadTimeUnitMinutes: "{n} min",
    leadTimeUnitHours: "{n} h",
    leadTimeUnitDays: "{n} jours",
  })[key] ?? key;

test("cart explanations preserve zero, inherited, own and weekday-specific preparation", () => {
  const restaurant = { schedulingLeadTimeMinutes: 180 };
  assert.equal(itemPreparationMinutes({ preparationLeadTimeMinutes: 0 }, restaurant, "2026-10-14"), 0);
  assert.equal(itemPreparationMinutes({ preparationLeadTimeMinutes: null }, restaurant, "2026-10-14"), 180);
  assert.equal(itemPreparationMinutes({ preparationLeadTimeMinutes: 90 }, restaurant, "2026-10-14"), 90);
  const item = { preparationLeadTimeMinutes: 0, preparationSchedule: [{ days: [3], lead_time_minutes: 240 }, { days: [4] }] };
  assert.equal(itemPreparationMinutes(item, restaurant, "2026-10-14"), 240);
  assert.equal(itemPreparationMinutes(item, restaurant, "2026-10-15"), 0);
  assert.equal(itemPreparationMinutes(item, restaurant, "2026-10-16"), null);
  assert.equal(itemPreparationMinutes(item, restaurant), null);
  assert.equal(formatLeadDuration(90, t), "1 h 30 min");
  assert.equal(formatLeadDuration(4321, t), "3 jours 1 min");
  assert.equal(formatLeadDuration(0, t), "0 min");
});

test("restaurantLeadMinutes prefers the precise setting over the legacy day count", () => {
  assert.equal(restaurantLeadMinutes({ schedulingLeadTimeMinutes: 2880, schedulingMinDaysAhead: 1 }), 2880);
});

test("restaurantLeadMinutes falls back to the legacy day count", () => {
  assert.equal(restaurantLeadMinutes({ schedulingMinDaysAhead: 2 }), 2880);
});

test("restaurantLeadMinutes returns 0 when the restaurant promises nothing", () => {
  assert.equal(restaurantLeadMinutes({}), 0);
  assert.equal(restaurantLeadMinutes(null), 0);
});

// The nullable column exists precisely so "inherit" and "same day" stay
// distinct. Collapsing them is how a 0 would silently become the 24h default.
test("effectiveLeadMinutes inherits the restaurant promise when the item has none", () => {
  const restaurant = { schedulingLeadTimeMinutes: 1440 };
  assert.equal(effectiveLeadMinutes({}, restaurant), 1440);
  assert.equal(effectiveLeadMinutes({ preparationLeadTimeMinutes: null }, restaurant), 1440);
});

test("effectiveLeadMinutes treats an explicit 0 as same-day, not as absent", () => {
  assert.equal(effectiveLeadMinutes({ preparationLeadTimeMinutes: 0 }, { schedulingLeadTimeMinutes: 1440 }), 0);
});

test("effectiveLeadMinutes uses the item's own promise when set", () => {
  assert.equal(effectiveLeadMinutes({ preparationLeadTimeMinutes: 2880 }, { schedulingLeadTimeMinutes: 1440 }), 2880);
});

// The badge rule, exactly as decided: only what costs more than the baseline.
// Lovely Patisserie is the reference case — a 24h house default, one 48h cake.
test("isSlowerThanDefault badges only items above the restaurant baseline", () => {
  const restaurant = { schedulingLeadTimeMinutes: 1440 };
  assert.equal(isSlowerThanDefault({ preparationLeadTimeMinutes: 2880 }, restaurant), true, "48h cake is badged");
  assert.equal(isSlowerThanDefault({}, restaurant), false, "an inheriting item is not");
  assert.equal(isSlowerThanDefault({ preparationLeadTimeMinutes: 1440 }, restaurant), false, "matching the baseline is not");
  assert.equal(isSlowerThanDefault({ preparationLeadTimeMinutes: 0 }, restaurant), false, "faster than the baseline is not");
});

test("isSlowerThanDefault badges any delay when the restaurant promises nothing", () => {
  assert.equal(isSlowerThanDefault({ preparationLeadTimeMinutes: 120 }, { schedulingLeadTimeMinutes: 0 }), true);
});

test("formatLeadDuration renders minutes, hours and days by magnitude", () => {
  assert.equal(formatLeadDuration(30, t), "30 min");
  assert.equal(formatLeadDuration(120, t), "2 h");
  assert.equal(formatLeadDuration(1440, t), "24 h");
  assert.equal(formatLeadDuration(2880, t), "48 h");
  assert.equal(formatLeadDuration(4320, t), "3 jours");
  assert.equal(formatLeadDuration(10080, t), "7 jours");
});

// Never promise less notice than the kitchen asked for.
test("formatLeadDuration preserves partial hours and days", () => {
  assert.equal(formatLeadDuration(90, t), "1 h 30 min");
  assert.equal(formatLeadDuration(4321, t), "3 jours 1 min");
});

test("formatLeadDuration clamps negatives to zero", () => {
  assert.equal(formatLeadDuration(-10, t), "0 min");
});
