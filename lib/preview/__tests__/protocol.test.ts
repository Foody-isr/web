import { test } from "node:test";
import assert from "node:assert/strict";
import { isPreviewStateMessage, PREVIEW_STATE, type PreviewStateMessage } from "../protocol";

function validMessage(): PreviewStateMessage {
  return {
    type: PREVIEW_STATE,
    state: {
      page: { id: 1, type: "order", slug: "order" },
      siteConfig: { themeId: "editorial-dark" },
      navConfig: null,
      sections: [],
      device: "desktop",
      navState: "top",
    },
  };
}

test("accepts a well-formed preview-state message", () => {
  assert.equal(isPreviewStateMessage(validMessage()), true);
});

test("accepts mobile device with populated sections", () => {
  const m = validMessage();
  m.state.device = "mobile";
  m.state.sections = [
    {
      id: 7, section_type: "hero_banner", page: "order", sort_order: 0,
      is_visible: true, layout: "", content: {}, settings: {},
    },
  ];
  assert.equal(isPreviewStateMessage(m), true);
});

test("rejects the wrong message type (e.g. a legacy channel)", () => {
  assert.equal(isPreviewStateMessage({ type: "foody-theme-preview", state: validMessage().state }), false);
});

test("rejects a missing / non-object state", () => {
  assert.equal(isPreviewStateMessage({ type: PREVIEW_STATE }), false);
  assert.equal(isPreviewStateMessage({ type: PREVIEW_STATE, state: null }), false);
});

test("rejects an invalid device", () => {
  const m = validMessage();
  (m.state as { device: string }).device = "tablet";
  assert.equal(isPreviewStateMessage(m), false);
});

test("rejects a page without slug/type", () => {
  const m = validMessage();
  (m.state as { page: unknown }).page = { id: 1 };
  assert.equal(isPreviewStateMessage(m), false);
});

test("rejects sections that aren't an array", () => {
  const m = validMessage();
  (m.state as { sections: unknown }).sections = { 0: "nope" };
  assert.equal(isPreviewStateMessage(m), false);
});

test("never throws on garbage / foreign postMessage payloads", () => {
  for (const junk of [null, undefined, 42, "str", [], { type: 1 }, Symbol("x")]) {
    assert.equal(isPreviewStateMessage(junk as unknown), false);
  }
});
