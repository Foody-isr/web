import type { Restaurant, WebsiteConfig, WebsiteSection } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";

type HookAttributes = Record<`data-field-${string}`, string>;

/** Exposes stable, semantic values rendered from the canonical Website V3 site and page state. */
export function websiteV3PageFieldHooks(
  restaurant: Restaurant,
  page: WebsiteV3Page,
): HookAttributes {
  const config = restaurant.websiteConfig;
  const orderTypeSelector = record(page.appearance_overrides.order_type_selector);
  const typographyRoles = record(record(page.appearance_overrides.typography).roles);
  const checkoutTextColors = record(page.appearance_overrides.checkout_text_colors);
  return {
    ...siteHooks(config),
    ...hook("page.title", page.title),
    ...hook("page.slug", page.slug),
    ...hook("page.type", page.type),
    ...hook("page.sort_order", page.sort_order),
    ...hook("page.nav_visible", page.nav_visible),
    ...hook("page.is_default", page.is_default),
    ...hook("page.appearance_overrides.bg", page.appearance_overrides.bg ?? ""),
    ...hook("page.appearance_overrides.ink", page.appearance_overrides.ink ?? ""),
    ...hook("page.appearance_overrides.accent", page.appearance_overrides.accent ?? ""),
    ...hook(
      "page.appearance_overrides.headingFont",
      page.appearance_overrides.headingFont ?? "",
    ),
    ...hook(
      "page.appearance_overrides.bodyFont",
      page.appearance_overrides.bodyFont ?? "",
    ),
    ...nestedRecordHooks("page.appearance_overrides.typography.roles", typographyRoles),
    ...recordHooks("page.appearance_overrides.checkout_text_colors", checkoutTextColors),
    ...hook(
      "page.appearance_overrides.navbar_style",
      page.appearance_overrides.navbar_style ?? "",
    ),
    ...hook(
      "page.appearance_overrides.navbar_color",
      page.appearance_overrides.navbar_color ?? "",
    ),
    ...hook(
      "page.appearance_overrides.navbar_text_color",
      page.appearance_overrides.navbar_text_color ?? "",
    ),
    ...hook(
      "page.appearance_overrides.navbar_overlay_text_color",
      page.appearance_overrides.navbar_overlay_text_color ?? "",
    ),
    ...hook("page.appearance_overrides.order_type_selector.shape", orderTypeSelector.shape ?? ""),
    ...hook("page.appearance_overrides.order_type_selector.variant", orderTypeSelector.variant ?? ""),
    ...hook("page.appearance_overrides.order_type_selector.size", orderTypeSelector.size ?? ""),
    ...hook("page.appearance_overrides.order_type_selector.bg", orderTypeSelector.bg ?? ""),
    ...hook("page.appearance_overrides.order_type_selector.text_color", orderTypeSelector.text_color ?? ""),
    ...hook("page.appearance_overrides.order_type_selector.border_color", orderTypeSelector.border_color ?? ""),
    ...hook(
      "page.settings.menu_ids",
      page.type === "order" ? page.settings.menu_ids : [],
    ),
    ...hook(
      "page.settings.service_ids",
      page.type === "catering" ? page.settings.service_ids : [],
    ),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Exposes the exact canonical section values consumed by section renderers. */
export function websiteV3SectionFieldHooks(
  section: WebsiteSection,
): HookAttributes {
  return {
    ...hook("section.is_visible", section.isVisible),
    ...hook("section.sort_order", section.sortOrder),
    ...hook("section.layout", section.layout),
    ...hook("section.page_id", section.page),
    ...recordHooks("section.content", section.content),
    ...recordHooks("section.settings", section.settings),
  };
}

function siteHooks(config?: WebsiteConfig): HookAttributes {
  const navbarCta =
    config?.navbarCta && typeof config.navbarCta === "object"
      ? String((config.navbarCta as Record<string, unknown>).text ?? "")
      : "";
  return {
    ...hook("site.theme_id", config?.themeId ?? ""),
    ...hook("site.pairing_id", config?.pairingId ?? ""),
    ...hook("site.brand_color", config?.brandColor ?? ""),
    ...hook("site.tagline", config?.tagline ?? ""),
    ...hook("site.hero_name_font", config?.heroNameFont ?? ""),
    ...hook("site.typography", config?.typography ?? {}),
    ...hook("site.nav_layout", config?.navLayout ?? {}),
    ...hook("site.compact-navigation.icon", config?.navLayout?.compact_navigation?.icon_color ?? ""),
    ...hook("site.compact-navigation.button-background", config?.navLayout?.compact_navigation?.button_background_color ?? ""),
    ...hook("site.navbar_style", config?.navbarStyle ?? ""),
    ...hook("site.navbar_color", config?.navbarColor ?? ""),
    ...hook(
      "site.navbar_overlay_text_color",
      config?.navbarOverlayTextColor ?? "",
    ),
    ...hook("site.navbar_text_color", config?.navbarTextColor ?? ""),
    ...hook("site.logo_size", config?.logoSize ?? 40),
    ...hook("site.hide_navbar_name", config?.hideNavbarName ?? false),
    ...hook(
      "site.navbar_logo_position",
      config?.navbarLogoPosition ?? "left",
    ),
    ...hook(
      "site.navbar_scrolled_logo_url",
      config?.navbarScrolledLogoUrl ?? "",
    ),
    ...hook("site.hero_logo_size", config?.heroLogoSize ?? 100),
    ...hook("site.hide_hero_logo", config?.hideHeroLogo ?? false),
    ...hook("site.navbar_show_links", config?.navbarShowLinks ?? true),
    ...hook("site.navbar_hamburger", config?.navbarHamburger ?? ""),
    ...hook("site.navbar_cta", navbarCta),
    ...hook("site.favicon_url", config?.faviconURL ?? ""),
    ...hook("site.checkout_config", config?.checkoutConfig ?? {}),
    ...hook("site.order_page_info", config?.orderPageInfo ?? {}),
    ...hook("site.layout_default", config?.layoutDefault ?? ""),
    ...hook(
      "site.layout_default_mobile",
      config?.layoutDefaultMobile ?? "",
    ),
    ...hook(
      "site.category_banner_style",
      config?.categoryBannerStyle ?? "",
    ),
    ...hook(
      "site.category_banner_overlay",
      config?.categoryBannerOverlay ?? "",
    ),
    ...hook("site.category_banner_fit", config?.categoryBannerFit ?? ""),
    ...hook(
      "site.category_banner_fit_mobile",
      config?.categoryBannerFitMobile ?? "",
    ),
  };
}

function recordHooks(
  prefix: string,
  value: Record<string, unknown> | undefined,
): HookAttributes {
  return Object.entries(value ?? {}).reduce<HookAttributes>(
    (attributes, [key, fieldValue]) => ({
      ...attributes,
      ...hook(`${prefix}.${key}`, fieldValue),
    }),
    {},
  );
}

function nestedRecordHooks(
  prefix: string,
  value: Record<string, unknown> | undefined,
): HookAttributes {
  return Object.entries(value ?? {}).reduce<HookAttributes>((attributes, [key, fieldValue]) => {
    const id = `${prefix}.${key}`;
    return {
      ...attributes,
      ...(fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)
        ? nestedRecordHooks(id, fieldValue as Record<string, unknown>)
        : hook(id, fieldValue)),
    };
  }, {});
}

function hook(id: string, value: unknown): HookAttributes {
  return {
    [`data-field-${id
      .replace(/[._]/g, "-")
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`]:
      serialize(value),
  };
}

function serialize(value: unknown): string {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}
