import type { CSSProperties } from "react";
import { resolveNavLayout } from "@/lib/navLayout";
import type {
  NavMode,
  MenuResponse,
  NavbarCtaConfig,
  Restaurant,
  SectionColors,
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
export type CSSVariableStyle = CSSProperties & Record<string, string>;

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
  ["category_banner_style", "categoryBannerStyle"],
  ["category_banner_overlay", "categoryBannerOverlay"],
  ["category_banner_fit", "categoryBannerFit"],
  ["category_banner_fit_mobile", "categoryBannerFitMobile"],
  ["typography", "typography"],
  ["order_page_info", "orderPageInfo"],
  ["order_type_selector", "orderTypeSelector"],
  ["navbar_style", "navbarStyle"],
  ["navbar_color", "navbarColor"],
  ["navbar_text_color", "navbarTextColor"],
  ["navbar_overlay_text_color", "navbarOverlayTextColor"],
  ["hide_navbar_name", "hideNavbarName"],
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

  if (isRecord(source.section_colors)) {
    merged.sectionColors = mergeSectionColors(
      merged.sectionColors,
      source.section_colors,
    );
  }
  if (isRecord(source.navbar_cta)) {
    merged.navbarCta = mergeNavbarCta(merged.navbarCta, source.navbar_cta);
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

/** Maps page-local appearance fields to inherited CSS variables. */
export function pageAppearanceVariables(
  appearance: PageAppearanceOverrides | Record<string, unknown> | null | undefined,
): CSSVariableStyle {
  const source = appearance ?? {};
  const variables = styleVariables(source, [
    ["bg", "--bg-page"],
    ["ink", "--text"],
  ]);
  const accent = nonEmptyString(source.accent);
  if (accent) {
    variables["--brand"] = accent;
    variables["--accent"] = accent;
  }
  const headingFont = nonEmptyString(source.headingFont);
  if (headingFont) variables["--font-display"] = `"${headingFont}"`;
  const bodyFont = nonEmptyString(source.bodyFont);
  if (bodyFont) variables["--font-body"] = `"${bodyFont}"`;

  // Cart drawer roles. The drawer sits on the page surface, so without its own
  // colours it inherits `ink` — and a palette whose ink equals its surface
  // renders the whole cart invisible. These cover every colour the drawer
  // paints (text, surfaces, dividers, accent, both buttons and the quantity
  // stepper) so the owner can style it without repainting the page.
  //
  // Emitted only when set; every consumer falls back to the token it used
  // before, so an existing restaurant renders identically.
  const cartColors = isRecord(source.cart_text_colors)
    ? source.cart_text_colors
    : {};
  Object.assign(
    variables,
    styleVariables(cartColors, [
      ["heading", "--cart-heading"],
      ["primary", "--cart-text"],
      ["secondary", "--cart-muted"],
      ["price", "--cart-price"],
      ["surface", "--cart-surface"],
      ["surfaceMuted", "--cart-surface-muted"],
      ["divider", "--cart-divider"],
      ["accent", "--cart-accent"],
      ["overlay", "--cart-overlay"],
      ["button", "--cart-button-text"],
      ["buttonBg", "--cart-button-bg"],
      ["closeBg", "--cart-close-bg"],
      ["closeText", "--cart-close-text"],
      ["stepperBg", "--cart-stepper-bg"],
      ["stepperText", "--cart-stepper-text"],
      ["stepperBorder", "--cart-stepper-border"],
      ["remove", "--cart-remove"],
    ]),
  );

  const sectionColors = isRecord(source.section_colors)
    ? source.section_colors
    : null;
  const normal = isRecord(sectionColors?.categoryBar)
    ? sectionColors.categoryBar
    : {};
  const sticky = isRecord(sectionColors?.categoryBarSticky)
    ? sectionColors.categoryBarSticky
    : {};
  Object.assign(
    variables,
    styleVariables(normal, [
      ["bg", "--cat-bg"],
      ["text", "--cat-text"],
      ["accent", "--cat-accent"],
      ["divider", "--cat-divider"],
    ]),
    styleVariables(sticky, [
      ["bg", "--cat-sticky-bg"],
      ["text", "--cat-sticky-text"],
      ["accent", "--cat-sticky-accent"],
      ["divider", "--cat-sticky-divider"],
    ]),
  );
  return variables;
}

/** Maps order-page checkout-only text roles without changing menu text colors. */
export function checkoutAppearanceVariables(
  appearance: PageAppearanceOverrides | Record<string, unknown> | null | undefined,
): CSSVariableStyle {
  const variables = pageAppearanceVariables(appearance);
  const colors = isRecord(appearance?.checkout_text_colors)
    ? appearance.checkout_text_colors
    : {};
  Object.assign(
    variables,
    styleVariables(colors, [
      ["heading", "--checkout-heading"],
      ["primary", "--text"],
      ["secondary", "--text-muted"],
      ["secondary", "--text-soft"],
      ["input", "--checkout-input"],
      ["price", "--checkout-price"],
      ["button", "--checkout-button-text"],
    ]),
  );
  return variables;
}

/** Builds a sparse CSS-variable object from non-empty string settings. */
export function styleVariables(
  source: Record<string, unknown> | null | undefined,
  mapping: ReadonlyArray<readonly [string, `--${string}`]>,
): CSSVariableStyle {
  const variables = {} as CSSVariableStyle;
  if (!source) return variables;
  for (const [sourceKey, variable] of mapping) {
    const value = nonEmptyString(source[sourceKey]);
    if (value) variables[variable] = value;
  }
  return variables;
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

function mergeSectionColors(
  base: SectionColors | null | undefined,
  override: Record<string, unknown>,
): SectionColors {
  const merged = { ...(base ?? {}), ...override } as Record<string, unknown>;
  for (const key of [
    "navbar",
    "hero",
    "metadata",
    "categoryBar",
    "categoryBarSticky",
    "catering",
  ]) {
    if (isRecord(override[key])) {
      merged[key] = {
        ...(isRecord(base?.[key as keyof SectionColors])
          ? base?.[key as keyof SectionColors]
          : {}),
        ...override[key],
      };
    }
  }
  return merged as SectionColors;
}

function mergeNavbarCta(
  base: NavbarCtaConfig | null | undefined,
  override: Record<string, unknown>,
): NavbarCtaConfig {
  const merged = { ...(base ?? {}), ...override } as NavbarCtaConfig;
  for (const state of ["transparent", "solid"] as const) {
    if (isRecord(override[state])) {
      merged[state] = {
        ...(base?.[state] ?? {}),
        ...override[state],
      };
    }
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
