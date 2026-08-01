import { resolveNavLayout } from "@/lib/navLayout";
import type {
  NavMode,
  MenuResponse,
  Restaurant,
  WebsiteConfig,
  WebsiteSection,
} from "@/lib/types";
import { normalizePageAppearanceOverrides } from "@/lib/websiteV3Api";
import type {
  PageAppearanceOverrides,
  WebsiteV3Page,
} from "@/lib/websiteV3Api";

type WebsitePageType = WebsiteV3Page["type"];
export type PageFooterMode = "inherit" | "full" | "compact" | "hidden";

const PAGE_CONFIG_FIELDS = [
  ["theme_id", "themeId"],
  ["pairing_id", "pairingId"],
  ["brand_color", "brandColor"],
  ["layout_default", "layoutDefault"],
  ["layout_default_mobile", "layoutDefaultMobile"],
  ["hero_logo_bg", "heroLogoBg"],
  ["hero_cover_layout", "heroCoverLayout"],
  ["hero_logo_size", "heroLogoSize"],
  ["hero_name_font", "heroNameFont"],
  ["custom_palette", "customPalette"],
  ["section_colors", "sectionColors"],
  ["category_banner_style", "categoryBannerStyle"],
  ["category_banner_overlay", "categoryBannerOverlay"],
  ["category_banner_fit", "categoryBannerFit"],
  ["category_banner_fit_mobile", "categoryBannerFitMobile"],
  ["typography", "typography"],
  ["order_page_info", "orderPageInfo"],
  ["navbar_style", "navbarStyle"],
  ["navbar_color", "navbarColor"],
  ["navbar_text_color", "navbarTextColor"],
  ["navbar_overlay_text_color", "navbarOverlayTextColor"],
] as const;

/** Layers sparse V3 page styling over the legacy restaurant configuration. */
export function mergeWebsiteConfigWithPageAppearance(
  config: WebsiteConfig | null | undefined,
  appearance: PageAppearanceOverrides | null | undefined,
  pageType: WebsitePageType,
): WebsiteConfig | null {
  if (!config && !appearance) return null;
  const merged = { ...(config ?? {}) } as WebsiteConfig;
  const source = normalizePageAppearanceOverrides(appearance ?? {});
  const target = merged as unknown as Record<string, unknown>;

  for (const [sourceKey, targetKey] of PAGE_CONFIG_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(source, sourceKey) &&
      source[sourceKey] !== undefined &&
      !(sourceKey === "navbar_style" && source[sourceKey] === "inherit")
    ) {
      target[targetKey] = source[sourceKey];
    }
  }

  const desktopMode = navMode(source.navigation_mode);
  const mobileMode = navMode(source.navigation_mode_mobile);
  if (desktopMode || mobileMode) {
    const navLayout = resolveNavLayout(merged);
    const sideKey =
      pageType === "order" || pageType === "catering"
        ? "shopping"
        : "content";
    merged.navLayout = {
      ...navLayout,
      [sideKey]: {
        ...navLayout[sideKey],
        ...(desktopMode ? { desktop: desktopMode } : {}),
        ...(mobileMode ? { mobile: mobileMode } : {}),
      },
    };
  }

  return merged;
}

/** Applies page-local theme and footer presentation to a restaurant render model. */
export function applyWebsiteV3PageAppearance(
  restaurant: Restaurant,
  page: Pick<WebsiteV3Page, "type" | "appearance_overrides">,
): Restaurant {
  const footerMode = resolvePageFooterMode(page.appearance_overrides);
  return {
    ...restaurant,
    coverUrl:
      typeof page.appearance_overrides.cover_url === "string"
        ? page.appearance_overrides.cover_url
        : restaurant.coverUrl,
    backgroundColor:
      typeof page.appearance_overrides.background_color === "string"
        ? page.appearance_overrides.background_color
        : restaurant.backgroundColor,
    coverFocalX:
      typeof page.appearance_overrides.cover_focal_x === "number"
        ? page.appearance_overrides.cover_focal_x
        : restaurant.coverFocalX,
    coverFocalY:
      typeof page.appearance_overrides.cover_focal_y === "number"
        ? page.appearance_overrides.cover_focal_y
        : restaurant.coverFocalY,
    websiteConfig:
      mergeWebsiteConfigWithPageAppearance(
        restaurant.websiteConfig,
        page.appearance_overrides,
        page.type,
      ) ?? undefined,
    websiteSections:
      footerMode === "compact"
        ? compactFooterSections(restaurant.websiteSections)
        : restaurant.websiteSections,
  };
}

/** Resolves the page-local footer mode with a safe inherited fallback. */
export function resolvePageFooterMode(
  appearance: PageAppearanceOverrides | null | undefined,
): PageFooterMode {
  const mode = appearance?.footer_mode;
  return mode === "full" ||
    mode === "compact" ||
    mode === "hidden" ||
    mode === "inherit"
    ? mode
    : "inherit";
}

/** Applies the compact footer layout to canonical page sections when requested. */
export function applyPageFooterModeToSections(
  sections: WebsiteSection[],
  appearance: PageAppearanceOverrides | null | undefined,
): WebsiteSection[] {
  return resolvePageFooterMode(appearance) === "compact"
    ? compactFooterSections(sections) ?? sections
    : sections;
}

/** Applies page-local category artwork to every matching menu-group projection. */
export function applyGroupBannerOverrides(
  menu: MenuResponse,
  appearance: PageAppearanceOverrides | null | undefined,
): MenuResponse {
  const overrides =
    appearance?.group_banners &&
    typeof appearance.group_banners === "object" &&
    !Array.isArray(appearance.group_banners)
      ? (appearance.group_banners as Record<string, unknown>)
      : {};

  const mapGroups = (groups: MenuResponse["menus"][number]["groups"]) =>
    groups.map((group) => {
      const raw = overrides[String(group.id)];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return group;
      const override = raw as Record<string, unknown>;
      return {
        ...group,
        imageUrl:
          typeof override.image_url === "string"
            ? override.image_url
            : group.imageUrl,
        focalX:
          typeof override.focal_x === "number"
            ? override.focal_x
            : group.focalX,
        focalY:
          typeof override.focal_y === "number"
            ? override.focal_y
            : group.focalY,
        bannerDesign:
          override.banner_design &&
          typeof override.banner_design === "object" &&
          !Array.isArray(override.banner_design)
            ? override.banner_design
            : group.bannerDesign,
      };
    });

  return {
    ...menu,
    menus: menu.menus.map((entry) => {
      const groups = mapGroups(entry.groups);
      const byID = new Map(groups.map((group) => [String(group.id), group]));
      return {
        ...entry,
        groups,
        categories: entry.categories.map(
          (category) => byID.get(String(category.id)) ?? category,
        ),
      };
    }),
  };
}

function compactFooterSections(
  sections: WebsiteSection[] | undefined,
): WebsiteSection[] | undefined {
  return sections?.map((section) =>
    section.sectionType === "footer"
      ? { ...section, layout: "minimal" }
      : section,
  );
}

function navMode(value: unknown): NavMode | null {
  return value === "full" || value === "compact" || value === "hidden"
    ? value
    : null;
}
