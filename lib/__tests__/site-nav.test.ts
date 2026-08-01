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
    },
    {
      key: "catering",
      label: "Traiteur",
      href: "/r/moulin-doree/catering",
    },
  ]);
});
