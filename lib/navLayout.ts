import { NavLayout, NavLayoutSide, NavMode, WebsiteConfig, WebsitePage } from "@/lib/types";
import { isOrderRoute } from "@/lib/themes/useResolvedTheme";

/**
 * The site navigation is described by a small per-(page-type × device) matrix:
 * each of `content` (landing + content pages) and `shopping` (order, catering,
 * custom pages flagged shopping) picks a top-bar `mode` for desktop and mobile
 * plus whether the mobile bottom bar shows. This module resolves that matrix
 * from config (with legacy back-compat) and classifies a route/page as a type.
 *
 *   mode: full    → logo + inline links + CTA
 *         slim    → thin bar with inline links + CTA, without a logo
 *         compact → floating hamburger + CTA with a restrained brand mark
 *         compact_no_logo → floating hamburger + CTA without branding
 *         hidden  → no top bar (rely on the bottom bar / drawer)
 */

export type PageType = "content" | "shopping";

const CONTENT_DEFAULT: NavLayoutSide = { desktop: "full", mobile: "compact", bottom_bar: false };
const SHOPPING_DEFAULT: NavLayoutSide = { desktop: "compact", mobile: "hidden", bottom_bar: true };

/**
 * Public order pages deliberately use one navigation composition across every
 * restaurant. Branding still comes from the restaurant theme, but the shopping
 * task must not become harder because an owner selected a full or slim site
 * navbar. Catering and custom shopping pages continue to use `shopping` from
 * the configurable matrix.
 */
export const ORDER_PAGE_NAV_SIDE: Readonly<NavLayoutSide> = {
  desktop: "compact",
  mobile: "hidden",
  bottom_bar: true,
};

const MODES: NavMode[] = ["full", "slim", "compact", "compact_no_logo", "hidden"];
const asMode = (v: unknown, fallback: NavMode): NavMode =>
  typeof v === "string" && (MODES as string[]).includes(v) ? (v as NavMode) : fallback;

/** Fill in any missing fields of one side and apply the "never strand the user"
 *  guard: on mobile, if the top bar is hidden and the bottom bar is off, fall
 *  back to a compact bar so there is always a way to navigate. (Desktop `hidden`
 *  is allowed — it's an explicit choice and the admin warns about it.) */
function normalizeSide(side: Partial<NavLayoutSide> | undefined, def: NavLayoutSide): NavLayoutSide {
  const desktop = asMode(side?.desktop, def.desktop);
  let mobile = asMode(side?.mobile, def.mobile);
  const bottom_bar = side?.bottom_bar ?? def.bottom_bar;
  if (mobile === "hidden" && !bottom_bar) mobile = "compact";
  return { desktop, mobile, bottom_bar };
}

/** Legacy back-compat: derive a NavLayout from the pre-matrix navbar_* fields so
 *  restaurants that never touched the new matrix keep their exact behavior. */
function legacyContentSide(cfg: Pick<WebsiteConfig, "navbarStyle" | "navbarShowLinks" | "navbarHamburger">): NavLayoutSide {
  // The old navbar_style 'hidden' ("logo flottant seul") maps to a compact bar
  // floating hamburger rather than nothing, so those sites keep usable navigation.
  const legacyHidden = cfg.navbarStyle === "hidden";
  const showLinks = cfg.navbarShowLinks !== false;
  const desktop: NavMode = legacyHidden
    ? "compact"
    : cfg.navbarHamburger === "always"
      ? "compact" // the one legitimate desktop-hamburger case
      : showLinks
        ? "full"
        : "compact";
  const mobile: NavMode = "compact";
  return normalizeSide({ desktop, mobile, bottom_bar: false }, CONTENT_DEFAULT);
}

/** Resolve the full navigation matrix from config. When `nav_layout` is set it
 *  wins (missing fields defaulted); otherwise derive content from the legacy
 *  fields and use the standard shopping defaults. */
export function resolveNavLayout(
  cfg: Pick<WebsiteConfig, "navLayout" | "navbarStyle" | "navbarShowLinks" | "navbarHamburger"> | null | undefined,
): NavLayout {
  const nl = cfg?.navLayout;
  if (nl && (nl.content || nl.shopping)) {
    return {
      content: normalizeSide(nl.content, CONTENT_DEFAULT),
      shopping: normalizeSide(nl.shopping, SHOPPING_DEFAULT),
      bottom_navigation: nl.bottom_navigation,
      compact_navigation: nl.compact_navigation,
    };
  }
  return {
    content: cfg ? legacyContentSide(cfg) : { ...CONTENT_DEFAULT },
    shopping: { ...SHOPPING_DEFAULT },
  };
}

/** Classify the current route (+ optional custom-page meta) as content vs
 *  shopping. Order/catering/stories are shopping by route; a custom page is
 *  shopping only when explicitly flagged. */
export function pageTypeForRoute(pathname: string | null, pageMeta?: WebsitePage | null): PageType {
  if (isOrderRoute(pathname)) return "shopping";
  if (pageMeta?.isShopping) return "shopping";
  return "content";
}

/** The resolved side for a page type. */
export function sideForPageType(layout: NavLayout, pageType: PageType): NavLayoutSide {
  return pageType === "shopping" ? layout.shopping : layout.content;
}
