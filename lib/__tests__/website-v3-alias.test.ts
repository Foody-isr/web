import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWebsiteAliasTarget } from "../websiteV3Api";

test("website v3 alias preserves the complete query string", () => {
  assert.equal(
    buildWebsiteAliasTarget("demo", "commande-midi", {
      type: "delivery",
      item: "42",
      lang: "fr",
    }),
    "/r/demo/commande-midi?type=delivery&item=42&lang=fr",
  );
});

test("website v3 alias preserves repeated query parameters", () => {
  assert.equal(
    buildWebsiteAliasTarget("demo", "traiteur", {
      filter: ["vegetarian", "kosher"],
      preview: undefined,
    }),
    "/r/demo/traiteur?filter=vegetarian&filter=kosher",
  );
});
