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
