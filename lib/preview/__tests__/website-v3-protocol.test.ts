import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WEBSITE_V3_APPLIED,
  WEBSITE_V3_READY,
  WEBSITE_V3_STATE,
  acceptWebsiteV3StateMessage,
  isAllowedWebsiteV3AdminOrigin,
  isWebsiteV3AppliedMessage,
  isWebsiteV3ReadyMessage,
  isWebsiteV3StateMessage,
  resolveWebsiteV3ActivePage,
  type WebsiteV3StateMessage,
} from "../websiteV3Protocol";

function validMessage(): WebsiteV3StateMessage {
  return {
    type: WEBSITE_V3_STATE,
    revision: 4,
    contentRevision: 2,
    restaurantId: 17,
    activePageKey: "page-draft-order",
    device: "desktop",
    state: {
      config: { primaryColor: "#123456" },
      pages: [
        {
          id: 8,
          type: "landing",
          slug: "home",
          title: "Home",
          sort_order: 0,
          nav_visible: true,
          is_default: false,
          settings: {},
          appearance_overrides: {},
        },
        {
          tmp_id: "page-draft-order",
          type: "order",
          slug: "lunch",
          title: "Lunch",
          sort_order: 1,
          nav_visible: true,
          is_default: true,
          settings: { menu_ids: [3] },
          appearance_overrides: {},
        },
      ],
      sections: [
        {
          tmp_id: "section-draft-hero",
          section_type: "hero_banner",
          page: "lunch",
          page_tmp_id: "page-draft-order",
          sort_order: 0,
          is_visible: true,
          layout: "",
          content: {},
          settings: {},
        },
      ],
      deleted_section_ids: [],
      deleted_page_ids: [],
    },
  };
}

const originPolicy = {
  configuredAdminOrigin: "https://admin.foody-pos.co.il",
  currentOrigin: "http://localhost:3000",
};

test("website v3 preview protocol exports the exact wire strings and guards", () => {
  assert.equal(WEBSITE_V3_STATE, "foody.website-v3.state");
  assert.equal(WEBSITE_V3_APPLIED, "foody.website-v3.applied");
  assert.equal(WEBSITE_V3_READY, "foody.website-v3.ready");
  assert.equal(isWebsiteV3StateMessage(validMessage()), true);
  assert.equal(
    isWebsiteV3AppliedMessage({
      type: WEBSITE_V3_APPLIED,
      revision: 4,
      contentRevision: 2,
      activePageKey: "page-draft-order",
      device: "desktop",
    }),
    true,
  );
  assert.equal(isWebsiteV3ReadyMessage({ type: WEBSITE_V3_READY }), true);
});

test("website v3 preview protocol rejects malformed wire messages", () => {
  const invalidRevision = validMessage();
  (invalidRevision as { revision: number }).revision = -1;
  assert.equal(isWebsiteV3StateMessage(invalidRevision), false);

  const invalidDevice = validMessage();
  (invalidDevice as { device: string }).device = "tablet";
  assert.equal(isWebsiteV3StateMessage(invalidDevice), false);

  assert.equal(
    isWebsiteV3AppliedMessage({
      type: WEBSITE_V3_APPLIED,
      revision: 4,
      contentRevision: 2,
      activePageKey: 8,
      device: "desktop",
    }),
    false,
  );
  assert.equal(
    isWebsiteV3ReadyMessage({ type: WEBSITE_V3_READY, revision: 4 }),
    false,
  );
});

test("website v3 preview protocol ignores stale revisions", () => {
  assert.equal(
    acceptWebsiteV3StateMessage({
      data: validMessage(),
      origin: "https://admin.foody-pos.co.il",
      expectedRestaurantId: 17,
      lastAppliedRevision: 4,
      originPolicy,
    }),
    null,
  );
});

test("website v3 preview protocol rejects restaurant mismatches", () => {
  assert.equal(
    acceptWebsiteV3StateMessage({
      data: validMessage(),
      origin: "https://admin.foody-pos.co.il",
      expectedRestaurantId: 99,
      lastAppliedRevision: 3,
      originPolicy,
    }),
    null,
  );
});

test("website v3 preview protocol enforces strict admin origins", () => {
  assert.equal(
    isAllowedWebsiteV3AdminOrigin(
      "https://admin.foody-pos.co.il",
      originPolicy,
    ),
    true,
  );
  assert.equal(
    isAllowedWebsiteV3AdminOrigin("http://localhost:3003", originPolicy),
    true,
  );
  assert.equal(
    isAllowedWebsiteV3AdminOrigin("http://localhost:3000", originPolicy),
    true,
  );
  assert.equal(
    isAllowedWebsiteV3AdminOrigin("https://attacker.example", originPolicy),
    false,
  );
  assert.equal(isAllowedWebsiteV3AdminOrigin("*", originPolicy), false);
  assert.equal(
    isAllowedWebsiteV3AdminOrigin("null", {
      ...originPolicy,
      configuredAdminOrigin: "*",
    }),
    false,
  );
  assert.equal(
    isAllowedWebsiteV3AdminOrigin("https://app.foody-pos.co.il", {
      ...originPolicy,
      currentOrigin: "https://app.foody-pos.co.il",
    }),
    false,
  );
});

test("website v3 preview protocol resolves active pages by id or tmp_id", () => {
  const message = validMessage();
  assert.equal(
    resolveWebsiteV3ActivePage(message.state, "8")?.slug,
    "home",
  );
  assert.equal(
    resolveWebsiteV3ActivePage(message.state, "page-draft-order")?.slug,
    "lunch",
  );
  assert.equal(resolveWebsiteV3ActivePage(message.state, "missing"), null);

  const accepted = acceptWebsiteV3StateMessage({
    data: message,
    origin: "https://admin.foody-pos.co.il",
    expectedRestaurantId: 17,
    lastAppliedRevision: 3,
    originPolicy,
  });
  assert.equal(accepted?.page.tmp_id, "page-draft-order");
});
