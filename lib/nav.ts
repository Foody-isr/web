/**
 * Bottom-nav ordering helpers, shared by the client `BottomNav` and the
 * server-side base-route redirect so they always agree on tab order and the
 * default landing tab.
 *
 * Only page-backed tabs are ordered here ("menu", "stories"). The Account/Compte
 * tab is a sheet, not a destination, so it is always rendered last and is not
 * part of `nav_order`.
 */
export type NavPageTab = "menu" | "stories";

const DEFAULT_ORDER: NavPageTab[] = ["menu", "stories"];

/**
 * Ordered list of page-backed bottom-nav tabs, honoring the restaurant's
 * configured `nav_order` and whether Stories is enabled. Unknown/duplicate keys
 * are ignored; available tabs missing from the config are appended in the
 * default order so nothing is ever dropped.
 */
export function orderedPageTabs(navOrder: string | undefined, storiesEnabled: boolean): NavPageTab[] {
  const available: NavPageTab[] = storiesEnabled ? ["menu", "stories"] : ["menu"];
  const configured = (navOrder || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is NavPageTab => s === "menu" || s === "stories");

  const seen = new Set<NavPageTab>();
  const ordered: NavPageTab[] = [];
  for (const k of configured) {
    if (available.includes(k) && !seen.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  for (const k of available) {
    if (!seen.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  return ordered.length ? ordered : DEFAULT_ORDER.filter((k) => available.includes(k));
}

/** Route path for a page tab. */
export function tabPath(slug: string, tab: NavPageTab): string {
  return tab === "stories" ? `/r/${slug}/stories` : `/r/${slug}/order`;
}

/** Default landing tab path = the first configured page tab. */
export function firstTabPath(slug: string, navOrder: string | undefined, storiesEnabled: boolean): string {
  return tabPath(slug, orderedPageTabs(navOrder, storiesEnabled)[0] || "menu");
}
