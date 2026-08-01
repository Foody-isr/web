import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant } from "../types";
import { buildNavPageItems } from "../siteNav";

function legacyWebsiteConfig(
  pages: NonNullable<Restaurant["websiteConfig"]>["pages"],
  landingEnabled: boolean,
): NonNullable<Restaurant["websiteConfig"]> {
  return {
    themeId: "classic",
    pairingId: "default",
    brandColor: null,
    layoutDefault: "compact",
    heroLayout: "standard",
    showAddress: true,
    showPhone: true,
    showHours: true,
    pages,
    landingEnabled,
  };
}

test("site navigation uses typed V3 pages without duplicating catering", () => {
  const restaurant = {
    id: 24,
    slug: "moulin-doree",
    cateringEnabled: true,
    websiteConfig: {
      pages: [
        {
          slug: "home",
          label: "Accueil",
          sortOrder: 0,
          showInNav: true,
          pageType: "landing",
        },
        {
          slug: "traiteur",
          label: "Traiteur",
          sortOrder: 1,
          showInNav: true,
          pageType: "catering",
          isShopping: true,
          isDefault: true,
        },
        {
          slug: "cachee",
          label: "Cachée",
          sortOrder: 2,
          showInNav: false,
          pageType: "content",
        },
      ],
    },
  } as Restaurant;

  assert.deepEqual(buildNavPageItems(restaurant), [
    {
      key: "home",
      label: "Accueil",
      href: "/r/moulin-doree",
      pageType: "landing",
      orderKey: "home",
    },
    {
      key: "traiteur",
      label: "Traiteur",
      href: "/r/moulin-doree/catering",
      pageType: "catering",
      orderKey: "catering",
    },
  ]);
});

test("site navigation applies landing and catering runtime guards", () => {
  const pages = [
    {
      slug: "home",
      label: "Accueil",
      sortOrder: 0,
      showInNav: true,
      pageType: "landing" as const,
    },
    {
      slug: "commander",
      label: "Commander",
      sortOrder: 1,
      showInNav: true,
      pageType: "order" as const,
      isDefault: true,
    },
    {
      slug: "traiteur",
      label: "Traiteur",
      sortOrder: 2,
      showInNav: true,
      pageType: "catering" as const,
      isDefault: true,
    },
  ];
  const restaurant = (options: {
    cateringEnabled: boolean;
    cateringOnly: boolean;
    landingEnabled: boolean;
  }) => ({
    id: 24,
    slug: "moulin-doree",
    cateringEnabled: options.cateringEnabled,
    cateringOnly: options.cateringOnly,
    websiteConfig: { pages, landingEnabled: options.landingEnabled },
  }) as Restaurant;

  assert.deepEqual(
    buildNavPageItems(restaurant({ cateringEnabled: false, cateringOnly: false, landingEnabled: true })).map((item) => item.key),
    ["home", "commander"],
  );
  assert.deepEqual(
    buildNavPageItems(restaurant({ cateringEnabled: true, cateringOnly: false, landingEnabled: true })).map((item) => item.key),
    ["home", "commander", "traiteur"],
  );
  assert.deepEqual(
    buildNavPageItems(restaurant({ cateringEnabled: true, cateringOnly: true, landingEnabled: true })).map((item) => item.key),
    ["home", "traiteur"],
  );
  assert.deepEqual(
    buildNavPageItems(restaurant({ cateringEnabled: false, cateringOnly: true, landingEnabled: false })).map((item) => item.key),
    ["commander"],
  );
});

test("legacy navigation restores landing and order when pages are empty", () => {
  const legacy = {
    id: 5,
    name: "Mamie",
    slug: "mamie-tlv",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: false,
    cateringOnly: false,
    websiteConfig: legacyWebsiteConfig([], true),
  } as Restaurant;

  assert.deepEqual(
    buildNavPageItems(legacy).map(({ key, href, orderKey }) => ({
      key,
      href,
      orderKey,
    })),
    [
      { key: "home", href: "/r/mamie-tlv", orderKey: "home" },
      { key: "menu", href: "/r/mamie-tlv/order", orderKey: "menu" },
    ],
  );
});

test("legacy custom-only navigation keeps custom pages beside built-ins", () => {
  const legacy = {
    id: 5,
    name: "Mamie",
    slug: "mamie-tlv",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: true,
    cateringOnly: false,
    websiteConfig: legacyWebsiteConfig(
      [
        {
          slug: "a-propos",
          label: "À propos",
          sortOrder: 0,
          showInNav: true,
        },
      ],
      true,
    ),
  } as Restaurant;

  assert.deepEqual(
    buildNavPageItems(legacy).map((item) => [item.key, item.href]),
    [
      ["home", "/r/mamie-tlv"],
      ["menu", "/r/mamie-tlv/order"],
      ["catering", "/r/mamie-tlv/catering"],
      ["a-propos", "/r/mamie-tlv/a-propos"],
    ],
  );
});

test("legacy catering-only navigation omits order and respects landing state", () => {
  const legacy = {
    id: 5,
    name: "Mamie",
    slug: "mamie-tlv",
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: true,
    cateringOnly: true,
    websiteConfig: legacyWebsiteConfig([], false),
  } as Restaurant;

  assert.deepEqual(
    buildNavPageItems(legacy).map((item) => [item.key, item.href]),
    [["catering", "/r/mamie-tlv/catering"]],
  );
});
