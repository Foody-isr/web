import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebsiteOrderType, websiteFulfillmentRules } from "../websiteFulfillment";

const mamie = { pickupEnabled: false, deliveryEnabled: true, schedulingEnabled: false, batchFulfillmentEnabled: true };

test("a single-mode batch restaurant imposes both mode and timing regardless of appearance", () => {
  const rules = websiteFulfillmentRules(mamie);
  assert.equal(rules.fixedMode, "delivery");
  assert.equal(rules.canChooseMode, false);
  assert.equal(rules.canChooseTime, false);
  assert.equal(rules.canChooseOnMenu, false);
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
