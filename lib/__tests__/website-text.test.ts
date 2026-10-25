import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SquareContentSection } from "../../components/sections/SquareContentSection";
import type { SectionProps } from "../../components/sections/SectionRenderer";
import { LocaleProvider } from "../i18n";

Object.assign(globalThis, { React });

function render(settings = {}, layout = "stacked", sectionType = "text") {
  return renderToStaticMarkup(
    React.createElement(
      LocaleProvider,
      null,
      React.createElement(SquareContentSection, {
        restaurant: {
          id: 1,
          name: "Kitchen",
          slug: "kitchen",
          deliveryEnabled: false,
          pickupEnabled: true,
          dineInEnabled: false,
        },
        section: {
          id: 1,
          sectionType,
          page: "home",
          sortOrder: 0,
          isVisible: true,
          layout,
          settings,
          content: {
            title: "Our pastries",
            body: "Freshly prepared",
            cta_text: "Order",
            cta_link: "/order",
          },
        },
      } as SectionProps),
    ),
  );
}

test("historical text retains automatic height and its stacked/split content widths", () => {
  const stacked = render();
  assert.match(stacked, /max-width:768px/);
  assert.match(stacked, /py-16/);
  assert.doesNotMatch(stacked, /min-height:|<section[^>]* flex items-center/);
  const split = render({}, "split");
  assert.match(split, /max-width:1200px/);
  assert.match(split, /md:grid-cols-2/);
});

test("text height is a minimum so all content stays reachable, with independent spacing", () => {
  for (const [height, pixels] of [
    ["compact", 240],
    ["medium", 400],
    ["tall", 560],
    ["full", 720],
  ]) {
    const markup = render({ height, padding: "none" });
    assert.match(markup, new RegExp(`min-height:${pixels}px`));
    assert.match(markup, /flex items-center/);
    assert.match(markup, /py-0/);
    assert.doesNotMatch(markup, /overflow-hidden/);
    assert.match(markup, /Freshly prepared/);
  }
  assert.match(render({ padding: "compact" }), /py-8/);
  assert.match(render({ padding: "spacious" }), /py-24/);
  assert.doesNotMatch(render({ height: "auto" }), /min-height:/);
});

test("text widths apply to both compositions and invalid historical settings fall back", () => {
  for (const layout of ["stacked", "split"]) {
    for (const [width, size] of [
      ["narrow", "640px"],
      ["medium", "960px"],
      ["wide", "1200px"],
      ["full", "none"],
    ]) {
      const markup = render({ width }, layout);
      assert.match(markup, new RegExp(`max-width:${size}`));
      assert.doesNotMatch(markup, /max-w-3xl/);
      assert.match(markup, /w-full min-w-0/);
    }
  }
  assert.match(
    render({ width: "invalid", height: "invalid" }),
    /max-width:768px/,
  );
  assert.doesNotMatch(render({ height: "invalid" }), /min-height:/);
  const other = render(
    { width: "narrow", height: "tall", padding: "none" },
    "stacked",
    "donation",
  );
  assert.match(other, /max-w-3xl/);
  assert.doesNotMatch(other, /max-width:640px|min-height:560px|py-0/);
});
