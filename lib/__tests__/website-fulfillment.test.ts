import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebsiteOrderType, websiteFulfillmentRules, requiresPreorderCalendar, websiteOrderingAvailable } from "../websiteFulfillment";

const mamie = { pickupEnabled: false, deliveryEnabled: true, schedulingEnabled: false, batchFulfillmentEnabled: true };

test("paused and rush storefronts do not offer fulfillment selection", () => {
  for (const flags of [{ ordersPaused: true }, { rushMode: true }]) {
    assert.equal(websiteOrderingAvailable({ ...mamie, ...flags }), false);
    assert.equal(websiteOrderingAvailable({ ...mamie, ...flags, orderingTestAccessExpiresAt: new Date(Date.now() + 60_000).toISOString() }), true);
    assert.equal(websiteOrderingAvailable({ ...mamie, ...flags, orderingTestAccessExpiresAt: new Date(Date.now() - 60_000).toISOString() }), false);
  }
});

test("service calendars remain discoverable for future orders and disabled services stay unavailable", () => {
  assert.equal(websiteOrderingAvailable(mamie), true);
  assert.equal(websiteOrderingAvailable({ pickupEnabled: false, deliveryEnabled: false }), false);
});

test("a delivery-only batch fixes mode and timing but permits entering an address", () => {
  const rules = websiteFulfillmentRules(mamie);
  assert.equal(rules.fixedMode, "delivery");
  assert.equal(rules.canChooseMode, false);
  assert.equal(rules.canChooseTime, false);
  assert.equal(rules.canChooseLocation, true);
  assert.equal(rules.canChooseOnMenu, true);
  assert.equal(resolveWebsiteOrderType(mamie, "pickup"), "delivery");
  assert.equal(websiteFulfillmentRules({...mamie, schedulingEnabled:true}).canChooseTime, false);
});

test("restaurants that permit choices retain them; the old menu-only lock stays menu-only", () => {
  const restaurant = {...mamie, pickupEnabled:true, batchFulfillmentEnabled:false, schedulingEnabled:true};
  assert.equal(websiteFulfillmentRules(restaurant).canChooseOnMenu, true);
  assert.equal(resolveWebsiteOrderType(restaurant, "pickup"), "pickup");
  const locked = websiteFulfillmentRules({...restaurant, websiteConfig:{checkoutConfig:{lock_order_type:true}}});
  assert.equal(locked.canChooseOnMenu, false);
  assert.equal(locked.canChooseMode, true);
  assert.equal(locked.canChooseTime, true);
});

test("tour and dine-in contexts cannot be replaced by a storefront mode", () => {
  assert.equal(resolveWebsiteOrderType(mamie, "dine_in"), "dine_in");
  assert.equal(resolveWebsiteOrderType({...mamie, pickupEnabled:true}, "pickup", true), "delivery");
  const tour = websiteFulfillmentRules({...mamie, pickupEnabled:true, schedulingEnabled:true}, true);
  assert.equal(tour.canChooseMode, false);
  assert.equal(tour.canChooseTime, false);
  assert.equal(tour.canChooseOnMenu, false);
});


test("weekly batches expose services on entry while retaining the imposed calendar", () => {
  const rules = websiteFulfillmentRules({...mamie, pickupEnabled: true, schedulingEnabled: true});
  assert.equal(rules.canChooseMode, true);
  assert.equal(rules.canChooseOnMenu, true);
  assert.equal(rules.canChooseTime, false);
});

test("strict weekly preorders retain both services on the menu and at checkout", () => {
  const bella = { pickupEnabled: true, deliveryEnabled: true, schedulingEnabled: false, batchFulfillmentEnabled: true, preordersOnly: true };
  const rules = websiteFulfillmentRules(bella);
  assert.deepEqual(rules.modes, ["pickup", "delivery"]);
  assert.equal(rules.canChooseOnMenu, true);
  assert.equal(rules.canChooseTime, false);
  assert.equal(rules.canChooseMode, true);
  for (const mode of rules.modes) {
    assert.equal(resolveWebsiteOrderType(bella, mode), mode);
    assert.equal(requiresPreorderCalendar(bella, mode), true);
  }
  assert.equal(websiteFulfillmentRules({...bella, batchFulfillmentEnabled: false, schedulingEnabled: true}).canChooseOnMenu, true);
});

test("a sole delivery service permits editing its address; pickup only needs a selector for scheduling", () => {
  const restaurant = {...mamie, batchFulfillmentEnabled: false, schedulingEnabled: true};
  const rules = websiteFulfillmentRules(restaurant);
  assert.equal(rules.canChooseMode, false);
  assert.equal(rules.canChooseTime, true);
  assert.equal(rules.canChooseOnMenu, true);
  assert.equal(websiteFulfillmentRules({...restaurant, schedulingEnabled:false}).canChooseOnMenu, true);
  assert.equal(websiteFulfillmentRules({...restaurant, pickupEnabled:true, deliveryEnabled:false, schedulingEnabled:false}).canChooseOnMenu, false);
  assert.equal(websiteFulfillmentRules({...restaurant, deliveryEnabled:false}).canChooseOnMenu, false);
});

test("strict preorders require a calendar for pickup and delivery, retaining independent table and tour service", () => {
  const strict = { preordersOnly: true };
  assert.equal(requiresPreorderCalendar(strict, "pickup"), true);
  assert.equal(requiresPreorderCalendar(strict, "delivery"), true);
  assert.equal(requiresPreorderCalendar(strict, "dine_in"), false);
  assert.equal(requiresPreorderCalendar(strict, "delivery", true), false);
  assert.equal(requiresPreorderCalendar({}, "pickup"), false);
  assert.equal(requiresPreorderCalendar({ preordersOnly: false }, "delivery"), false);
});


test("a legacy checkout-only selector cannot suppress weekly service and address choices", () => {
  for (const pickupEnabled of [true, false]) {
    const restaurant = {...mamie, pickupEnabled, websiteConfig:{checkoutConfig:{lock_order_type:true}}};
    const rules = websiteFulfillmentRules(restaurant);
    assert.equal(rules.canChooseOnMenu, true);
    assert.equal(rules.canChooseLocation, true);
    assert.equal(rules.canChooseMode, pickupEnabled);
    assert.equal(rules.canChooseTime, false);
    assert.equal(websiteFulfillmentRules(restaurant, true).canChooseOnMenu, false);
  }
  const pickupOnly = {...mamie, pickupEnabled:true, deliveryEnabled:false};
  assert.equal(websiteFulfillmentRules(pickupOnly).canChooseLocation, false);
  assert.equal(websiteFulfillmentRules(pickupOnly).canChooseOnMenu, false);
});
