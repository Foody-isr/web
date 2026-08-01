import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import {
  createWebsiteV3PreviewBootstrapPage,
  fetchDefaultWebsitePage,
  fetchWebsitePage,
  fetchWebsitePages,
  filterBySelectedIds,
  parseWebsiteV3Page,
  type WebsiteV3Page,
} from "../websiteV3Api";
import {
  rendererKind,
  WebsitePageRenderer,
} from "../../components/website-v3/WebsitePageRenderer";
import {
  canonicalPagePresentation,
  parseOrderPageSearchParams,
  selectLandingPage,
  visibleSectionsInRenderOrder,
} from "../websiteV3Rendering";
import * as WebsiteV3Rendering from "../websiteV3Rendering";
import type { WebsiteSection } from "../types";
import type { Restaurant } from "../types";

const orderPage: WebsiteV3Page = {
  id: 1,
  restaurant_id: 9,
  type: "order",
  slug: "commande-midi",
  title: "Commander",
  sort_order: 1,
  nav_visible: true,
  is_default: true,
  seo: {},
  settings: { menu_ids: [11] },
  appearance_overrides: {},
  sections: [],
  created_at: "2026-07-30T09:15:00Z",
  updated_at: "2026-07-30T10:30:00Z",
};

const timestampedOrderPage = {
  ...orderPage,
  sections: [
    {
      id: 101,
      restaurant_id: 9,
      section_type: "hero_banner",
      page: "commande-midi",
      page_id: 1,
      sort_order: 1,
      is_visible: true,
      layout: "centered",
      content: { title: "Commander" },
      settings: {},
      created_at: "2026-07-30T09:15:00Z",
      updated_at: "2026-07-30T10:30:00Z",
    },
  ],
};

test("website page renderer dispatches every page discriminant", () => {
  const pageFor = (type: WebsiteV3Page["type"]): WebsiteV3Page => {
    if (type === "order") return orderPage;
    if (type === "catering") {
      return { ...orderPage, type, settings: { service_ids: [22] } };
    }
    return { ...orderPage, type, settings: {} };
  };

  assert.equal(rendererKind(pageFor("landing")), "landing");
  assert.equal(rendererKind(pageFor("content")), "content");
  assert.equal(rendererKind(pageFor("order")), "order");
  assert.equal(rendererKind(pageFor("catering")), "catering");
});

test("explicit V3 order pages render even when the legacy restaurant is catering-only", async () => {
  Object.assign(globalThis, { React });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ menus: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const restaurant = {
    id: 24,
    slug: "moulin-doree",
    cateringEnabled: true,
    cateringOnly: true,
    websiteConfig: null,
  } as unknown as Restaurant;

  try {
    await assert.doesNotReject(() =>
      WebsitePageRenderer({ restaurant, page: orderPage }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("landing resolution selects the typed landing regardless of slug", () => {
  const contentHome: WebsiteV3Page = {
    ...orderPage,
    id: 2,
    type: "content",
    slug: "home",
    settings: {},
  };
  const landing: WebsiteV3Page = {
    ...orderPage,
    id: 3,
    type: "landing",
    slug: "bienvenue",
    settings: {},
  };

  assert.equal(selectLandingPage([contentHome, landing]), landing);
  assert.equal(selectLandingPage([contentHome]), null);
});

test("preview bootstrap creates a safe synthetic landing for legacy restaurants", () => {
  const page = createWebsiteV3PreviewBootstrapPage(24, "Moulin Dorée");

  assert.equal(page.id, -24);
  assert.equal(page.type, "landing");
  assert.equal(page.slug, "home");
  assert.equal(page.title, "Moulin Dorée");
  assert.deepEqual(page.sections, []);
});

test("public page parsing ignores invalid navbar overrides without dropping tokens", () => {
  const page = parseWebsiteV3Page({
    ...orderPage,
    appearance_overrides: {
      accent: "#D97706",
      navbar_style: "hidden",
      navbar_color: 42,
      navbar_text_color: null,
      navbar_overlay_text_color: [],
    },
  });

  assert.deepEqual(page.appearance_overrides, { accent: "#D97706" });
});

test("navbar hero eligibility follows the first visible section", () => {
  const leadingHero = (
    WebsiteV3Rendering as Record<string, unknown>
  ).hasLeadingVisibleHero;
  assert.equal(typeof leadingHero, "function");
  if (typeof leadingHero !== "function") return;

  const hasLeadingVisibleHero = leadingHero as (
    sections: WebsiteSection[],
    nativeHeroWhenEmpty?: boolean,
  ) => boolean;
  const hero = section(1, "hero_banner", 0, true);
  const hiddenHero = section(2, "hero_banner", 0, false);
  const text = section(3, "text", 1, true);
  const laterHero = section(4, "hero_banner", 2, true);

  assert.equal(hasLeadingVisibleHero([], true), true, "native order hero");
  assert.equal(hasLeadingVisibleHero([], false), false, "catering has no native hero");
  assert.equal(hasLeadingVisibleHero([hiddenHero, text]), false, "hidden hero");
  assert.equal(hasLeadingVisibleHero([text, laterHero], true), false, "text precedes native hero");
  assert.equal(hasLeadingVisibleHero([text, laterHero]), false, "catering without leading hero");
  assert.equal(hasLeadingVisibleHero([text, laterHero, section(5, "hero_banner", -1, true)]), true, "leading hero");
});

test("canonical presentation preserves page identity, sections, footer, and appearance", () => {
  const page = timestampedOrderPage;

  assert.deepEqual(canonicalPagePresentation(page), {
    pageSlug: "commande-midi",
    pageSections: [
      {
        id: 101,
        sectionType: "hero_banner",
        page: "commande-midi",
        sortOrder: 1,
        isVisible: true,
        layout: "centered",
        content: { title: "Commander" },
        settings: {},
        translations: undefined,
      },
    ],
    showFooter: true,
    appearance: page.appearance_overrides,
  });
});

test("visible sections use renderer order and exclude hidden and footer sections", () => {
  const sections: WebsiteSection[] = [
    {
      id: 101,
      sectionType: "hero_banner",
      page: "home",
      sortOrder: 2,
      isVisible: true,
      layout: "centered",
      content: {},
      settings: {},
    },
    {
      id: 102,
      sectionType: "hero_banner",
      page: "home",
      sortOrder: 0,
      isVisible: false,
      layout: "centered",
      content: {},
      settings: {},
    },
    {
      id: 103,
      sectionType: "feature_cards",
      page: "home",
      sortOrder: 1,
      isVisible: true,
      layout: "grid",
      content: {},
      settings: {},
    },
    {
      id: 104,
      sectionType: "footer",
      page: "home",
      sortOrder: 0,
      isVisible: true,
      layout: "default",
      content: {},
      settings: {},
    },
  ];

  assert.deepEqual(
    visibleSectionsInRenderOrder(sections).map((section) => section.id),
    [103, 101],
  );
});

function section(
  id: number,
  sectionType: string,
  sortOrder: number,
  isVisible: boolean,
): WebsiteSection {
  return {
    id,
    sectionType,
    page: "order",
    sortOrder,
    isVisible,
    layout: "",
    content: {},
    settings: {},
  };
}

test("canonical order query parsing preserves supported values and rejects bad preview dates", () => {
  assert.deepEqual(
    parseOrderPageSearchParams({
      type: ["delivery", "pickup"],
      preview_date: "2026-08-03",
      item: "44",
      lang: "fr",
    }),
    {
      orderType: "delivery",
      previewDate: "2026-08-03",
      item: "44",
      lang: "fr",
    },
  );
  assert.equal(
    parseOrderPageSearchParams({ preview_date: "03-08-2026" }).previewDate,
    undefined,
  );
});

test("website v3 selection keeps an empty published association unavailable", () => {
  const menus = [{ id: 11, name: "Lunch" }];

  assert.deepEqual(filterBySelectedIds(menus, []), []);
  assert.deepEqual(filterBySelectedIds(menus, [11]), menus);
});

test("website v3 page parser enforces page-type settings", () => {
  assert.deepEqual(parseWebsiteV3Page(orderPage), orderPage);

  assert.deepEqual(parseWebsiteV3Page(timestampedOrderPage), timestampedOrderPage);

  assert.throws(() => parseWebsiteV3Page({ ...orderPage, type: "unknown" }));
  assert.throws(() =>
    parseWebsiteV3Page({
      ...orderPage,
      settings: { menu_ids: [11], service_ids: [22] },
    }),
  );
  assert.throws(() =>
    parseWebsiteV3Page({
      ...orderPage,
      type: "catering",
      settings: { service_ids: [22], menu_ids: [11] },
    }),
  );
  assert.throws(() =>
    parseWebsiteV3Page({ ...timestampedOrderPage, updated_at: 1 }),
  );
  assert.throws(() =>
    parseWebsiteV3Page({
      ...timestampedOrderPage,
      sections: [{ ...timestampedOrderPage.sections[0], created_at: 1 }],
    }),
  );
});

test("website v3 page fetch encodes paths and handles HTTP responses", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const responses = [
    new Response(JSON.stringify({ page: orderPage }), { status: 200 }),
    new Response(null, { status: 404 }),
    new Response(null, { status: 500 }),
    new Response(JSON.stringify({ pages: [orderPage] }), { status: 200 }),
  ];

  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error("unexpected fetch call");
    return response;
  };

  try {
    assert.deepEqual(
      await fetchWebsitePage("nine / ten", "commande & midi"),
      orderPage,
    );
    assert.equal(await fetchWebsitePage("nine / ten", "missing"), null);
    await assert.rejects(
      fetchWebsitePage("nine / ten", "broken"),
      /500.*website-pages\/broken/,
    );
    assert.deepEqual(await fetchDefaultWebsitePage("nine / ten", "order"), orderPage);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    {
      url: "/api/v1/public/restaurants/nine%20%2F%20ten/website-pages/commande%20%26%20midi",
      init: { cache: "no-store" },
    },
    {
      url: "/api/v1/public/restaurants/nine%20%2F%20ten/website-pages/missing",
      init: { cache: "no-store" },
    },
    {
      url: "/api/v1/public/restaurants/nine%20%2F%20ten/website-pages/broken",
      init: { cache: "no-store" },
    },
    {
      url: "/api/v1/public/restaurants/nine%20%2F%20ten/website-pages",
      init: { cache: "no-store" },
    },
  ]);
});

test("website v3 page list fetch validates and returns every typed page", async () => {
  const originalFetch = globalThis.fetch;
  const landing: WebsiteV3Page = {
    ...orderPage,
    type: "landing",
    slug: "bienvenue",
    settings: {},
  };
  let request: { url: string; init?: RequestInit } | undefined;

  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify({ pages: [landing, orderPage] }), {
      status: 200,
    });
  };

  try {
    assert.deepEqual(await fetchWebsitePages("nine / ten"), [landing, orderPage]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(request, {
    url: "/api/v1/public/restaurants/nine%20%2F%20ten/website-pages",
    init: { cache: "no-store" },
  });
});
