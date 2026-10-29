import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptsInlineEdit, isEditorElement } from "../editorElements";

const section = {
  section_type: "hero_banner",
  content: { headline: "Before" },
};

test("canvas text edits accept only a known field with the current base value", () => {
  assert.equal(
    acceptsInlineEdit(section, {
      field: "headline",
      previousValue: "Before",
      value: "After",
    }),
    true,
  );
  assert.equal(
    acceptsInlineEdit(section, {
      field: "headline",
      previousValue: "Old",
      value: "After",
    }),
    false,
  );
  assert.equal(
    acceptsInlineEdit(section, {
      field: "headline",
      previousValue: "Before",
      value: "x".repeat(10001),
    }),
    false,
  );
});

test("preview messages cannot replace media, settings, prototypes or another section's fields", () => {
  for (const field of [
    "__proto__",
    "content",
    "settings",
    "image_url",
    "body",
    "content.headline",
  ]) {
    assert.equal(
      acceptsInlineEdit(section, { field, previousValue: "", value: "After" }),
      false,
    );
  }
  assert.equal(isEditorElement("hero_banner", "image_url"), true);
  assert.equal(isEditorElement("unknown", "headline"), false);
  assert.equal(isEditorElement("__proto__", "headline"), false);
});

test("campaign inline fields stay bounded to real slide text and retain stale-value protection", () => {
  const campaign = {...section,content:{slides:[{headline:"First",image_url:"/coffee.png"},{headline:"Second"}]}};
  assert.equal(isEditorElement("hero_banner","slides.1.headline"),true);
  assert.equal(acceptsInlineEdit(campaign,{field:"slides.1.headline",previousValue:"Second",value:"Updated"}),true);
  assert.equal(acceptsInlineEdit(campaign,{field:"slides.1.headline",previousValue:"First",value:"Updated"}),false);
  for(const field of ["slides.6.headline","slides.0.__proto__","slides.0.image_url","slides.5.headline","slides.0.cta_link"])
    assert.equal(acceptsInlineEdit(campaign,{field,previousValue:"",value:"Updated"}),false,field);
  assert.equal(isEditorElement("text_and_image","slides.0.headline"),false);
  assert.equal(acceptsInlineEdit({...section,content:{slides:[null,{headline:"Second"}]}},{field:"slides.1.headline",previousValue:"Second",value:"Updated"}),false);
});
