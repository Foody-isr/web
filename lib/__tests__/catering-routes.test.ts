import assert from "node:assert/strict";
import test from "node:test";
import {
  cateringBasePath,
  cateringItemPath,
  cateringServicePath,
  parseCateringPath,
} from "../cateringRoutes";

test("catering route builders return canonical hub, service and formula paths", () => {
    assert.equal(cateringBasePath("mamie-tlv"), "/r/mamie-tlv/catering");
    assert.equal(cateringServicePath("mamie-tlv", "chabat-hatan"), "/r/mamie-tlv/catering/chabat-hatan");
    assert.equal(cateringItemPath("mamie-tlv", "chabat-hatan", "halavi-event"),
      "/r/mamie-tlv/catering/chabat-hatan/halavi-event",
    );
});

test("catering route parser leaves quote routes alone", () => {
    assert.deepEqual(parseCateringPath("/r/mamie-tlv/catering", "mamie-tlv"), {});
    assert.deepEqual(parseCateringPath("/r/mamie-tlv/catering/chabat-hatan/", "mamie-tlv"), { serviceSlug: "chabat-hatan" });
    assert.deepEqual(parseCateringPath("/r/mamie-tlv/catering/chabat-hatan/halavi-event", "mamie-tlv"), {
      serviceSlug: "chabat-hatan",
      itemSlug: "halavi-event",
    });
    assert.equal(parseCateringPath("/r/mamie-tlv/catering/quote/public-token", "mamie-tlv"), null);
});
