import { z } from "zod";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/** A published website section returned by the page-centric public API. */
export type WebsiteSection = {
  id: number;
  restaurant_id: number;
  section_type: string;
  page: string;
  page_id?: number;
  sort_order: number;
  is_visible: boolean;
  layout: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  translations?: Record<string, Record<string, string>>;
  created_at: string;
  updated_at: string;
};

/** Sparse per-page visual settings that layer over the restaurant theme. */
export type PageAppearanceOverrides = {
  navbar_style?: "inherit" | "solid" | "transparent" | "overlay";
  navbar_color?: string;
  navbar_text_color?: string;
  navbar_overlay_text_color?: string;
  [key: string]: unknown;
};

const PAGE_NAVBAR_COLOR_KEYS = [
  "navbar_color",
  "navbar_text_color",
  "navbar_overlay_text_color",
] as const;

/** Removes invalid navbar overrides while preserving extensible page tokens. */
export function normalizePageAppearanceOverrides(
  appearance: Record<string, unknown>,
): PageAppearanceOverrides {
  const normalized: Record<string, unknown> = { ...appearance };
  if (!isPageNavbarStyle(normalized.navbar_style)) {
    delete normalized.navbar_style;
  }
  for (const key of PAGE_NAVBAR_COLOR_KEYS) {
    if (typeof normalized[key] !== "string" || !normalized[key].trim()) {
      delete normalized[key];
    }
  }
  return normalized as PageAppearanceOverrides;
}

function isPageNavbarStyle(value: unknown): boolean {
  return value === "inherit" ||
    value === "solid" ||
    value === "transparent" ||
    value === "overlay";
}

type WebsiteV3BasePage = {
  id: number;
  restaurant_id: number;
  slug: string;
  title: string;
  sort_order: number;
  nav_visible: boolean;
  is_default: boolean;
  seo: { title?: string; description?: string; share_image_url?: string };
  appearance_overrides: PageAppearanceOverrides;
  sections: WebsiteSection[];
  created_at: string;
  updated_at: string;
};

/** A validated V3 public website page with settings tied to its page type. */
export type WebsiteV3Page =
  | (WebsiteV3BasePage & { type: "landing"; settings: Record<string, never> })
  | (WebsiteV3BasePage & { type: "content"; settings: Record<string, never> })
  | (WebsiteV3BasePage & { type: "order"; settings: { menu_ids: number[] } })
  | (WebsiteV3BasePage & { type: "catering"; settings: { service_ids: number[] } });

/** Creates a non-persisted landing shell so legacy restaurants can start V3 preview. */
export function createWebsiteV3PreviewBootstrapPage(
  restaurantId: number,
  title: string,
): WebsiteV3Page {
  const timestamp = new Date(0).toISOString();
  return {
    id: -Math.abs(restaurantId),
    restaurant_id: restaurantId,
    type: "landing",
    slug: "home",
    title,
    sort_order: 0,
    nav_visible: true,
    is_default: false,
    seo: {},
    settings: {},
    appearance_overrides: {},
    sections: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

const websiteSectionSchema = z
  .object({
    id: z.number().int(),
    restaurant_id: z.number().int(),
    section_type: z.string(),
    page: z.string(),
    page_id: z.number().int().optional(),
    sort_order: z.number().int(),
    is_visible: z.boolean(),
    layout: z.string(),
    content: z.record(z.unknown()),
    settings: z.record(z.unknown()),
    translations: z.record(z.record(z.string())).optional(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict();

const websiteV3BasePageSchema = z.object({
  id: z.number().int(),
  restaurant_id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  sort_order: z.number().int(),
  nav_visible: z.boolean(),
  is_default: z.boolean(),
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      share_image_url: z.string().optional(),
    })
    .strict(),
  appearance_overrides: z
    .record(z.unknown())
    .transform(normalizePageAppearanceOverrides),
  sections: z.array(websiteSectionSchema),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

const websiteV3PageSchema = z.discriminatedUnion("type", [
  websiteV3BasePageSchema
    .extend({ type: z.literal("landing"), settings: z.object({}).strict() })
    .strict(),
  websiteV3BasePageSchema
    .extend({ type: z.literal("content"), settings: z.object({}).strict() })
    .strict(),
  websiteV3BasePageSchema
    .extend({
      type: z.literal("order"),
      settings: z.object({ menu_ids: z.array(z.number().int()) }).strict(),
    })
    .strict(),
  websiteV3BasePageSchema
    .extend({
      type: z.literal("catering"),
      settings: z.object({ service_ids: z.array(z.number().int()) }).strict(),
    })
    .strict(),
]);

const websiteV3PageResponseSchema = z.object({ page: z.unknown() }).strict();
const websiteV3PagesResponseSchema = z
  .object({ pages: z.array(z.unknown()) })
  .strict();

/** Parses a public page response into the strict V3 page contract. */
export function parseWebsiteV3Page(input: unknown): WebsiteV3Page {
  return websiteV3PageSchema.parse(input) as WebsiteV3Page;
}

/** Fetches a single published page by its restaurant identifier and page slug. */
export async function fetchWebsitePage(
  idOrSlug: string,
  pageSlug: string,
): Promise<WebsiteV3Page | null> {
  return fetchPage(
    `${restaurantPagesEndpoint(idOrSlug)}/${encodeURIComponent(pageSlug)}`,
  );
}

/** Fetches and validates every published typed page for a restaurant. */
export async function fetchWebsitePages(
  idOrSlug: string,
): Promise<WebsiteV3Page[]> {
  const endpoint = restaurantPagesEndpoint(idOrSlug);
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Website V3 pages request failed (${response.status}): ${endpoint}`,
    );
  }

  const data = websiteV3PagesResponseSchema.parse(await response.json());
  return data.pages.map(parseWebsiteV3Page);
}

/** Fetches the published default order or catering page for a restaurant. */
export async function fetchDefaultWebsitePage(
  idOrSlug: string,
  type: "order" | "catering",
): Promise<WebsiteV3Page | null> {
  return resolveCanonicalWebsitePage(await fetchWebsitePages(idOrSlug), type);
}

/** Resolves the published default page for a canonical commerce route. */
export function resolveCanonicalWebsitePage(
  pages: WebsiteV3Page[],
  type: "order" | "catering",
): Extract<WebsiteV3Page, { type: "order" | "catering" }> | null {
  return (
    pages.find(
      (page): page is Extract<WebsiteV3Page, { type: "order" | "catering" }> =>
        page.type === type && page.is_default,
    ) ?? null
  );
}

/** Returns the public alias for a default commerce page, when one exists. */
export function canonicalRedirectForPage(
  page: WebsiteV3Page,
): "/order" | "/catering" | null {
  if (!page.is_default) return null;
  if (page.type === "order") return "/order";
  if (page.type === "catering") return "/catering";
  return null;
}

/** Resolves the canonical alias when a restaurant disables its landing page. */
export function canonicalRootRedirect(
  landingEnabled: boolean | undefined,
  cateringEnabled: boolean | undefined,
  cateringOnly: boolean | undefined,
): "/order" | "/catering" | null {
  if (landingEnabled !== false) return null;
  return cateringEnabled && cateringOnly ? "/catering" : "/order";
}

/** Builds a V3 page URL while preserving every defined query parameter. */
export function buildWebsiteAliasTarget(
  restaurantId: string,
  pageSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query.append(key, value);
    } else if (value) {
      for (const entry of value) {
        query.append(key, entry);
      }
    }
  }

  const target = `/r/${encodeURIComponent(restaurantId)}/${encodeURIComponent(pageSlug)}`;
  return query.size > 0 ? `${target}?${query}` : target;
}

/** Keeps only items explicitly selected by the published page configuration. */
export function filterBySelectedIds<T extends { id: number }>(items: T[], ids: number[]): T[] {
  const selectedIDs = new Set(ids);
  return items.filter((item) => selectedIDs.has(item.id));
}

function restaurantPagesEndpoint(idOrSlug: string): string {
  return `${API_BASE}/api/v1/public/restaurants/${encodeURIComponent(idOrSlug)}/website-pages`;
}

async function fetchPage(endpoint: string): Promise<WebsiteV3Page | null> {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Website V3 page request failed (${response.status}): ${endpoint}`);
  }

  const data = websiteV3PageResponseSchema.parse(await response.json());
  return parseWebsiteV3Page(data.page);
}
