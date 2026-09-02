import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { GET } from "../../../app/api/website-v3-capabilities/route";
import {
  WEBSITE_V3_PREVIEW_CAPABILITIES,
  WEBSITE_V3_PREVIEW_PROTOCOL,
  WEBSITE_V3_PREVIEW_PROTOCOL_VERSION,
} from "../websiteV3Capabilities";

test("website v3 capability endpoint advertises the complete renderer contract", async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.deepEqual(await response.json(), WEBSITE_V3_PREVIEW_CAPABILITIES);
  assert.equal(WEBSITE_V3_PREVIEW_PROTOCOL, "foody.website-v3");
  assert.equal(WEBSITE_V3_PREVIEW_PROTOCOL_VERSION, 1);
});

test("the deploy contract cannot outlive the website v3 preview renderer", () => {
  const requiredSources = [
    "components/website-v3/WebsitePagePreviewBridge.tsx",
    "components/website-v3/WebsitePageRenderer.tsx",
    "lib/preview/websiteV3Protocol.ts",
  ];

  for (const source of requiredSources) {
    assert.equal(existsSync(resolve(process.cwd(), source)), true, `${source} is required`);
  }

  const bridge = readFileSync(
    resolve(process.cwd(), "components/website-v3/WebsitePagePreviewBridge.tsx"),
    "utf8",
  );
  assert.match(bridge, /WEBSITE_V3_READY/);
  assert.match(bridge, /WEBSITE_V3_APPLIED/);
  assert.match(bridge, /case "order"/);
});
