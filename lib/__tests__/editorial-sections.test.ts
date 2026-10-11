import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  scrollingTextTypography,
  textImageLayout,
  textImageGroups,
  TEXT_IMAGE_LAYOUTS,
} from "../editorialSections";
import { TextAndImageSection } from "../../components/sections/TextAndImageSection";
import { ScrollingTextSection } from "../../components/sections/ScrollingTextSection";
import type { SectionProps } from "../../components/sections/SectionRenderer";
Object.assign(globalThis, { React });

function props(
  settings = {},
  layout = "default",
  content: Record<string, unknown> = {},
): SectionProps {
  return {
    restaurant: {
      id: 1,
      slug: "kitchen",
      name: "Kitchen",
      deliveryEnabled: false,
      pickupEnabled: true,
      dineInEnabled: false,
    },
    section: {
      id: 1,
      page: "home",
      sortOrder: 0,
      sectionType: "text_and_image",
      isVisible: true,
      layout,
      settings,
      content: {
        title: "Our kitchen",
        body: "Freshly prepared",
        image_url: "/burger.png",
        cta_text: "Order",
        cta_link: "/order",
        ...content,
      },
    },
  } as SectionProps;
}

test("all twelve layouts render independent content groups without losing historic flat fields", () => {
  assert.equal(TEXT_IMAGE_LAYOUTS.length, 12);
  for (const layout of TEXT_IMAGE_LAYOUTS) {
    const p = props({}, layout, {
      groups: [
        {
          title: "Our terrace",
          body: "Open daily",
          image_url: "/terrace.png",
          cta_text: "Visit",
          cta_link: "/about",
        },
      ],
    });
    const markup = renderToStaticMarkup(
      React.createElement(TextAndImageSection, p),
    );
    assert.match(markup, new RegExp(`data-layout="${layout}"`));
    assert.match(markup, /Our kitchen/);
    assert.match(markup, /Our terrace/);
    assert.match(markup, /data-editor-field="title"/);
    assert.match(markup, /href="\/r\/kitchen\/order"/);
    assert.equal(
      (markup.match(/bg-\[var\(--site-solid,var\(--brand\)\)\]/g) || []).length,
      2,
      "every group inherits the selected color style's button role",
    );
  }
});

test("historic image-only sections stay full width, retaining saved text for later reuse", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      TextAndImageSection,
      props({ image_only: true }, "image_left"),
    ),
  );
  assert.match(markup, /data-layout="full_width"/);
  assert.match(markup, /480px/);
  assert.doesNotMatch(markup, /website-text-image-copy/);
  assert.match(markup, /data-has-text="false"/);
  assert.equal(textImageLayout("default", {}, {}), "default");
  assert.equal(
    textImageLayout("legacy", {}, { image_position: "left" }),
    "image_left",
  );
  assert.equal(
    textImageGroups({
      title: "Saved",
      groups: [null, "bad", { title: "Good" }],
    }).length,
    2,
  );
});

test("hidden text does not reserve half the media width; image fit and links stay safe", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      TextAndImageSection,
      props(
        {
          show_title: false,
          show_body: false,
          show_cta_text: false,
          image_fit: "contain",
          image_position: "bottom",
        },
        "full_width",
      ),
    ),
  );
  assert.match(markup, /data-has-text="false"/);
  assert.doesNotMatch(markup, /website-text-image-copy/);
  assert.match(markup, /object-fit:contain;object-position:bottom/);
  const unsafe = renderToStaticMarkup(
    React.createElement(
      TextAndImageSection,
      props({}, "background", {
        image_url: "javascript:alert(1)",
        cta_link: "javascript:alert(1)",
      }),
    ),
  );
  assert.doesNotMatch(unsafe, /javascript:/);
  assert.match(unsafe, /aria-disabled="true"/);
});

test("marquee display styling is reproducible outside the starter theme and all explicit overrides win", () => {
  assert.deepEqual(
    scrollingTextTypography({ theme_layout: "youngs-place" }),
    scrollingTextTypography({
      text_size: "xl",
      text_uppercase: true,
      text_font_role: "heading",
    }),
  );
  const explicit = scrollingTextTypography({
    theme_layout: "youngs-place",
    text_size: "sm",
    text_uppercase: false,
    text_weight: "normal",
    text_font_role: "body",
  });
  assert.equal(explicit.fontSize, "clamp(20px, 2vw, 28px)");
  assert.equal(explicit.textTransform, "none");
  assert.equal(explicit.fontWeight, 400);
  assert.match(explicit.fontFamily, /font-body/);
  const markup = renderToStaticMarkup(
    React.createElement(
      ScrollingTextSection,
      props(
        { text_size: "xl", direction: "right", text_color: "#ff0000" },
        "default",
        { text: "Saucy", speed: "slow" },
      ),
    ),
  );
  assert.match(markup, /animation-direction:reverse/);
  assert.match(markup, /30s/);
  assert.match(markup, /color:#ff0000/);
  assert.equal((markup.match(/data-editor-field="text"/g) || []).length, 1);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(
        ScrollingTextSection,
        props({ show_text: false }, "default", { text: "Hidden" }),
      ),
    ),
    "",
  );
});
