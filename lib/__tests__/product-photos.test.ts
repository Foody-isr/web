import { test } from "node:test";
import assert from "node:assert/strict";
import { productPhotos } from "../productPhotos";

test("legacy and empty items have no invented detail photos", () => {
  assert.deepEqual(productPhotos({ imageUrl: "cover.jpg" }), ["cover.jpg"]);
  assert.deepEqual(productPhotos({}), []);
});
test("cover and details preserve order while deduplicating and excluding blank values", () => {
  assert.deepEqual(
    productPhotos({
      imageUrl: "cover.jpg",
      imageUrls: ["second.jpg", "", "cover.jpg", "third.jpg"],
    }),
    ["cover.jpg", "second.jpg", "third.jpg"],
  );
});
