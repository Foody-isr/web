import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteItemAppearance } from "../websiteItemAppearance";
import { normalizeWebsiteOrder } from "../websiteOrder";
import { normalizeSiteColors } from "../siteColors";

const palette = {
  color_styles: {
    ...normalizeSiteColors({}),
    styles: normalizeSiteColors({}).styles.map((style) => ({
      ...style,
      ...(style.id === "style-2"
        ? {
            menu: {
              card_background: "#6d1f13",
              card_title: "#ffffff",
              card_price: "#dfc65b",
            },
          }
        : {}),
      ...(style.id === "style-4"
        ? {
            item_detail: {
              background: "#002244",
              title: "#ffffff",
              price: "#ffcc00",
              button_text: "#ffffff",
              selection_accent: "#ffcc00",
            },
          }
        : {}),
    })),
  },
};

test("modal follows the menu style by default and uses its own roles independently of checkout", () => {
  const menu = normalizeWebsiteOrder({ color_style: "style-2" });
  const inherited = websiteItemAppearance(menu, palette) as Record<
    string,
    string
  >;
  assert.equal(inherited["--item-background"], "#6d1f13");
  assert.equal(inherited["--item-price"], "#dfc65b");
  const explicit = websiteItemAppearance(
    { ...menu, itemColorStyle: "style-4" },
    palette,
  ) as Record<string, string>;
  assert.equal(explicit["--item-background"], "#002244");
  assert.equal(explicit["--item-price"], "#ffcc00");
  assert.equal(explicit["--item-button-text"], "#ffffff");
  assert.equal(explicit["--surface-elevated"], explicit["--item-background"]);
  assert.equal(explicit["--brand-rgb"], "255 204 0");
  assert.deepEqual(websiteItemAppearance(menu, palette), inherited);
});

test("bounded presentation choices reject malformed values and leave legacy palette colors inherited", () => {
  const safe = normalizeWebsiteOrder({
    item_layout: "evil",
    item_width: 9999,
    item_radius: "999px",
    item_color_style: "url(evil)",
  });
  assert.equal(safe.itemLayout, "standard");
  assert.equal(safe.itemColorStyle, "default");
  assert.deepEqual(websiteItemAppearance(safe, {}), {
    "--item-width": "600px",
    "--item-radius": "8px",
  });
  const cover = normalizeWebsiteOrder({
    item_layout: "cover",
    item_width: "compact",
    item_radius: "rounded",
    item_aspect_ratio: "16/9",
    item_image_fit: "cover",
  });
  assert.equal(cover.itemLayout, "cover");
  assert.equal(cover.itemAspectRatio, "16/9");
  assert.deepEqual(websiteItemAppearance(cover, {}), {
    "--item-width": "512px",
    "--item-radius": "24px",
  });
});


test("compact default photos preserve every authored aspect ratio, framing and style", () => {
  assert.equal(normalizeWebsiteOrder({}).itemAspectRatio, "16/9");
  for (const ratio of ["1/1", "3/2", "2/3", "4/3", "3/4", "16/9", "9/16"]) {
    const source = { item_aspect_ratio: ratio, item_image_fit: "contain", item_color_style: "style-4",
      item_image_frames: { "7": { desktop: { x: 25, y: 70, zoom: 1.5, fit: "contain" } } } };
    const before = structuredClone(source);
    const design = normalizeWebsiteOrder(source);
    assert.equal(design.itemAspectRatio, ratio);
    assert.equal(design.itemImageFit, "contain");
    assert.equal(design.itemImageFrames["7"].desktop.x, 25);
    assert.equal((websiteItemAppearance(design, palette) as Record<string, string>)["--item-price"], "#ffcc00");
    assert.deepEqual(source, before);
  }
});
