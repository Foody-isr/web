import assert from "node:assert/strict";
import test from "node:test";

import {
  cartLeadMinutes,
  earliestDateFor,
  effectiveLeadMinutes,
  formatLeadDuration,
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

test("cartLeadMinutes takes the slowest line and names it", () => {
  const restaurant = { schedulingLeadTimeMinutes: 0 };
  const lines = [
    { item: { preparationLeadTimeMinutes: 0 }, name: "coffee" },
    { item: { preparationLeadTimeMinutes: 2880 }, name: "cake" },
    { item: { preparationLeadTimeMinutes: 120 }, name: "tart" },
  ];
  const { minutes, constrainedBy } = cartLeadMinutes(lines, restaurant);
  assert.equal(minutes, 2880);
  assert.equal((constrainedBy as (typeof lines)[number] | null)?.name, "cake");
});

test("cartLeadMinutes applies the restaurant baseline to inheriting lines", () => {
  const { minutes } = cartLeadMinutes([{ item: {} }], { schedulingLeadTimeMinutes: 1440 });
  assert.equal(minutes, 1440);
});

test("cartLeadMinutes on an empty cart owes nothing", () => {
  const { minutes, constrainedBy } = cartLeadMinutes([], { schedulingLeadTimeMinutes: 1440 });
  assert.equal(minutes, 0);
  assert.equal(constrainedBy, null);
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
test("formatLeadDuration rounds up", () => {
  assert.equal(formatLeadDuration(90, t), "2 h");
  assert.equal(formatLeadDuration(4321, t), "4 jours");
});

test("formatLeadDuration clamps negatives to zero", () => {
  assert.equal(formatLeadDuration(-10, t), "0 min");
});

const SLOTS = {
  "2026-08-04": [
    { start: "17:00", end: "17:30" },
    { start: "21:30", end: "22:00" },
  ],
  "2026-08-06": [
    { start: "09:00", end: "09:30" },
    { start: "13:00", end: "13:30" },
  ],
  "2026-08-07": [{ start: "09:00", end: "09:30" }],
};

// The real Lovely Patisserie shape: browsing Monday afternoon, a 48h cake
// cannot be collected Tuesday evening, so the first honest answer is Thursday.
test("earliestDateFor skips dates whose slots all fall inside the preparation window", () => {
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(2880, SLOTS, now), "2026-08-06");
});

test("earliestDateFor returns the first open date when nothing is owed", () => {
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(0, SLOTS, now), "2026-08-04");
});

test("earliestDateFor keeps a date when at least one slot is late enough", () => {
  // 24h from Monday 16:12 lands Tuesday 16:12: the 17:00 slot still qualifies.
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(1440, SLOTS, now), "2026-08-04");
});

test("earliestDateFor drops a date when every slot is too early", () => {
  // 30h from Monday 16:12 lands Tuesday 22:12, past the last Tuesday slot.
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(30 * 60, SLOTS, now), "2026-08-06");
});

test("earliestDateFor returns null when the horizon cannot absorb the delay", () => {
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(60 * 24 * 30, SLOTS, now), null);
});

test("earliestDateFor tolerates a missing or empty slot map", () => {
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(0, null, now), null);
  assert.equal(earliestDateFor(0, {}, now), null);
  assert.equal(earliestDateFor(0, { "2026-08-04": [] }, now), null);
});

// Object key order is insertion order, not chronological, once a map has been
// merged or rebuilt. Sorting is what makes "first" mean "earliest".
test("earliestDateFor answers chronologically regardless of key order", () => {
  const shuffled = {
    "2026-08-07": SLOTS["2026-08-07"],
    "2026-08-04": SLOTS["2026-08-04"],
    "2026-08-06": SLOTS["2026-08-06"],
  };
  const now = new Date("2026-08-03T16:12:00");
  assert.equal(earliestDateFor(0, shuffled, now), "2026-08-04");
});
