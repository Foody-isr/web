import { test } from "node:test";
import assert from "node:assert/strict";
import { entranceFrames, hoverFrames, websiteMotion } from "../websiteMotion";

test("motion is opt-in, bounded, and safely handles imported settings", () => {
  assert.equal(websiteMotion(null).enabled, false);
  const motion = websiteMotion({enabled:true, entrance:"invalid", duration_ms:Infinity, delay_ms:-1, parallax_amount:999, mobile:false});
  assert.equal(motion.entrance, "fade"); assert.equal(motion.duration, 1250); assert.equal(motion.delay, 0); assert.equal(motion.parallaxAmount, 200); assert.equal(motion.mobile, false);
});
test("reference motion uses zoom, full-width reveals and diminishing horizontal wobble", () => {
  assert.equal(entranceFrames("zoom")[0].transform, "scale(.3)");
  assert.equal(entranceFrames("from_right")[0].transform, "translateX(100%)");
  assert.deepEqual(hoverFrames("wobble").map((frame) => frame.transform), [0,8,-6,4,-2,1,0].map((x) => `translateX(${x}px)`));
  assert.equal(hoverFrames("push")[1].transform, "scale(.8)");
});

test("mobile scroll overrides can target copy independently of desktop media", () => {
 const motion = websiteMotion({parallax:"down", parallax_amount:100, parallax_target:"media", mobile_parallax:"up", mobile_parallax_amount:200, mobile_parallax_target:"text",parallax_mobile:true});
 assert.equal(motion.parallaxAmount,100); assert.equal(motion.mobileParallaxAmount,200); assert.equal(motion.mobileParallax,"up"); assert.equal(motion.mobileParallaxTarget,"text");
});
