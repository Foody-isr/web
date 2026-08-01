import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant } from "../types";
import { buildNavPageItems } from "../siteNav";

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
