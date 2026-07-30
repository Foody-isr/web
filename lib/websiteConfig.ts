import { parseOrderPageInfo } from "@/lib/orderPageInfo";
import type { WebsiteConfig } from "@/lib/types";

/** Maps the server's snake_case website config into the public render contract. */
export function mapWebsiteConfig(raw: unknown): WebsiteConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const config = raw as Record<string, any>;
  return {
    themeId: config.theme_id || "editorial-dark",
    pairingId: config.pairing_id || "modern-sans",
    brandColor: config.brand_color || null,
    layoutDefault: config.layout_default || "magazine",
    layoutDefaultMobile: config.layout_default_mobile || null,
    heroLayout: config.hero_layout || "standard",
    welcomeText: config.welcome_text || undefined,
    tagline: config.tagline || undefined,
    socialLinks: config.social_links || undefined,
    showAddress: config.show_address ?? true,
    showPhone: config.show_phone ?? true,
    showHours: config.show_hours ?? true,
    faviconURL: config.favicon_url || undefined,
    heroCtaText: config.hero_cta_text || undefined,
    midCtaEnabled: config.mid_cta_enabled ?? true,
    midCtaTitle: config.mid_cta_title || undefined,
    midCtaBody: config.mid_cta_body || undefined,
    midCtaBtnText: config.mid_cta_btn_text || undefined,
    footerText: config.footer_text || undefined,
    navbarStyle: config.navbar_style || undefined,
    navbarColor: config.navbar_color || undefined,
    logoSize: config.logo_size > 0 ? config.logo_size : undefined,
    hideNavbarName: config.hide_navbar_name ?? false,
    navbarLogoPosition: config.navbar_logo_position || undefined,
    navbarScrolledLogoUrl: config.navbar_scrolled_logo_url || undefined,
    navbarTextColor: config.navbar_text_color || undefined,
    navbarOverlayTextColor: config.navbar_overlay_text_color || undefined,
    navbarCta: config.navbar_cta || undefined,
    navbarShowLinks: config.navbar_show_links,
    navbarHamburger: config.navbar_hamburger || undefined,
    navbarFont: config.navbar_font || undefined,
    navbarType: config.navbar_type || undefined,
    navbarLinkStyle: config.navbar_link_style || undefined,
    navLayout: config.nav_layout || undefined,
    hideHeroLogo: config.hide_hero_logo ?? false,
    heroLogoBg: config.hero_logo_bg === "black" ? "black" : "white",
    heroCoverLayout:
      config.hero_cover_layout === "logo" ||
      config.hero_cover_layout === "bare"
        ? config.hero_cover_layout
        : "card",
    heroLogoSize:
      config.hero_logo_size > 0 ? config.hero_logo_size : undefined,
    customPalette: config.custom_palette || undefined,
    sectionColors: config.section_colors || null,
    heroNameFont: config.hero_name_font || undefined,
    categoryBannerStyle: config.category_banner_style || undefined,
    categoryBannerOverlay: config.category_banner_overlay ?? undefined,
    categoryBannerFit: config.category_banner_fit || undefined,
    categoryBannerFitMobile:
      config.category_banner_fit_mobile || undefined,
    typography: config.typography ?? null,
    pages: Array.isArray(config.pages)
      ? config.pages
          .map((page: any) => ({
            slug: String(page.slug),
            label: String(page.label ?? page.title ?? page.slug),
            sortOrder: page.sort_order ?? page.sortOrder ?? 0,
            showInNav:
              page.show_in_nav ?? page.nav_visible ?? page.showInNav ?? true,
            isShopping:
              page.is_shopping ??
              page.isShopping ??
              (page.type === "order" || page.type === "catering"),
          }))
          .sort(
            (
              left: NonNullable<WebsiteConfig["pages"]>[number],
              right: NonNullable<WebsiteConfig["pages"]>[number],
            ) => left.sortOrder - right.sortOrder,
          )
      : null,
    landingEnabled: config.landing_enabled ?? true,
    storiesEnabled: config.stories_enabled ?? false,
    navOrder: typeof config.nav_order === "string" ? config.nav_order : "",
    checkoutConfig: config.checkout_config ?? null,
    orderPageInfo: parseOrderPageInfo(config.order_page_info),
  };
}
