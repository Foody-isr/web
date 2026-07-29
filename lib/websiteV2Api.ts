// Website Builder v2 — client for the page-centric public read.
//
// Standalone from services/api.ts so the v2 render can fetch page settings
// (the per-page commerce connection) without touching the shared config mapper.
// Backed by the already-shipped GET /public/restaurants/:idOrSlug/website-pages.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface WebsitePageSettings {
  commerce?: "none" | "classic" | "catering";
  /** classic: which cartes to show; empty/absent = all web-enabled cartes. */
  menu_ids?: number[];
  /** catering: which services to show; empty/absent = all active services. */
  service_ids?: number[];
}

export interface WebsiteV2Page {
  id: number;
  type: string;
  slug: string;
  title: string;
  settings?: WebsitePageSettings | null;
}

/** Fetch a restaurant's builder pages (with their commerce settings). Returns []
 *  on any error so a render never crashes on this optional lookup. */
export async function fetchWebsitePages(idOrSlug: string): Promise<WebsiteV2Page[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/public/restaurants/${idOrSlug}/website-pages`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.pages ?? []) as WebsiteV2Page[];
  } catch {
    return [];
  }
}

/** The commerce settings for the first page of a given type (order/catering). */
export function pageSettingsForType(
  pages: WebsiteV2Page[],
  type: string,
): WebsitePageSettings {
  return pages.find((p) => p.type === type)?.settings ?? {};
}

/** Keep only entries whose id is in `ids`; empty/absent `ids` = keep all. */
export function filterByIds<T extends { id: number }>(items: T[], ids?: number[]): T[] {
  if (!ids || ids.length === 0) return items;
  const set = new Set(ids);
  return items.filter((it) => set.has(it.id));
}
