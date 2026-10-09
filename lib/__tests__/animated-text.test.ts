import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedTextSection } from "../../components/sections/AnimatedTextSection";
import type { SectionProps } from "../../components/sections/SectionRenderer";
import { animatedTextPhrases, animatedTextInterval, animatedTextLetters } from "../animatedText";
import { localizeContent } from "../sectionLocale";
Object.assign(globalThis, { React });
const content = {
  text: "Apparemment, on nous aime",
  phrases: [
    { text: "un peu" },
    { text: "beaucoup" },
    { text: "passionnément" },
  ],
};
function render(settings = {}, data: Record<string, unknown> = content) {
  return renderToStaticMarkup(
    React.createElement(AnimatedTextSection, {
      section: {
        id: 1,
        sectionType: "animated_text",
        page: "home",
        sortOrder: 0,
        isVisible: true,
        layout: "default",
        content: data,
        settings,
      },
      restaurant: { id: 1 },
    } as SectionProps),
  );
}
test("rotating title renders authored colors, every phrase and one stable accessible alternative", () => {
  const html = render({
    text_color: "#181818",
    rotating_color: "#d7807f",
    text_size: "lg",
    text_alignment: "right",
  });
  assert.match(html, /color:#181818/);
  assert.match(html, /color:#d7807f/);
  assert.match(html, /text-align:right/);
  assert.match(html, /data-editor-field="text"/);
  assert.match(html, /class="sr-only">un peu, beaucoup, passionnément/);
  assert.equal((html.match(/data-active="true"/g) || []).length, 1);
  assert.match(html, /aria-hidden="true"/);
});
test("empty, hidden, single and malformed phrase lists remain safe", () => {
  assert.equal(render({ show_text: false }), "");
  assert.equal(render({}, { text: "", phrases: [] }), "");
  assert.match(render({}, { text: "Fixed only", phrases: null }), /Fixed only/);
  assert.doesNotMatch(
    render({}, { text: "", phrases: [{ text: "Only" }] }),
    /tabindex/,
  );
  assert.deepEqual(
    animatedTextPhrases([
      null,
      3,
      { text: 4 },
      { text: " " },
      { text: "hello" },
    ]),
    ["hello"],
  );
  assert.equal(
    animatedTextPhrases(Array.from({ length: 30 }, () => ({ text: "word" })))
      .length,
    20,
  );
  assert.deepEqual(
    [
      animatedTextInterval("slow"),
      animatedTextInterval("normal"),
      animatedTextInterval("fast"),
      animatedTextInterval(null),
    ],
    [2500, 1000, 600, 1000],
  );
});
test("the fixed prefix and each rotating phrase use the section locale contract", () => {
  const localized = localizeContent(
    content,
    { text: { he: "אוהבים אותנו" }, "phrases.0.text": { he: "קצת" } },
    "he",
  );
  assert.match(render({}, localized), /אוהבים אותנו/);
  assert.match(render({}, localized), /קצת/);
  assert.equal(content.phrases[0].text, "un peu");
});

test("letters preserve combining accents and emoji graphemes", () => { assert.deepEqual(animatedTextLetters("e\u0301👨‍👩‍👧"), ["e\u0301", "👨‍👩‍👧"]); });
