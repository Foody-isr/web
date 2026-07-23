/**
 * Bottom-nav ordering helpers, shared by the client `BottomNav` and the
 * server-side base-route redirect so they always agree on tab order and the
 * default landing tab.
 *
 * Only page-backed tabs are ordered here ("menu", "stories", "catering"). The
 * Account/Compte tab is a sheet, not a destination, so it is always rendered
 * last and is not part of `nav_order`.
 *
 * Catering visibility is derived from two signals: `cateringEnabled` (the
 * restaurant has the catering feature) and `cateringOnly` (no classic menu).
 * "Catering-only" is only ever effective when catering is actually enabled, so
 * a stale `cateringOnly` flag on a feature-disabled restaurant never strands the
 * customer on a hidden menu.
 */
export type NavPageTab = "menu" | "stories" | "catering";

const KNOWN_TABS: NavPageTab[] = ["menu", "stories", "catering"];

/**
 * Ordered list of page-backed bottom-nav tabs, honoring the restaurant's
 * configured `nav_order`, whether Stories is enabled, and the catering signals.
 * Unknown/duplicate keys are ignored; available tabs missing from the config are
 * appended in the default order so nothing is ever dropped.
 */
export function orderedPageTabs(
  navOrder: string | undefined,
  storiesEnabled: boolean,
  cateringEnabled = false,
  cateringOnly = false,
): NavPageTab[] {
  const effectiveCateringOnly = cateringEnabled && cateringOnly;

  let available: NavPageTab[];
  if (effectiveCateringOnly) {
    // No classic menu — catering replaces it.
    available = storiesEnabled ? ["catering", "stories"] : ["catering"];
  } else if (cateringEnabled) {
    available = ["menu", "catering", ...(storiesEnabled ? (["stories"] as NavPageTab[]) : [])];
  } else {
    available = storiesEnabled ? ["menu", "stories"] : ["menu"];
  }

  const configured = (navOrder || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is NavPageTab => (KNOWN_TABS as string[]).includes(s));

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
  return ordered.length ? ordered : available;
}

/** Route path for a page tab. */
export function tabPath(slug: string, tab: NavPageTab): string {
  switch (tab) {
    case "stories":
      return `/r/${slug}/stories`;
    case "catering":
      return `/r/${slug}/catering`;
    default:
      return `/r/${slug}/order`;
  }
}

/** Default landing tab path = the first configured page tab. */
export function firstTabPath(
  slug: string,
  navOrder: string | undefined,
  storiesEnabled: boolean,
  cateringEnabled = false,
  cateringOnly = false,
): string {
  const tabs = orderedPageTabs(navOrder, storiesEnabled, cateringEnabled, cateringOnly);
  return tabPath(slug, tabs[0] || "menu");
}
