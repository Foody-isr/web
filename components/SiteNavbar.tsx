"use client";

import { CSSProperties, useEffect, useState } from "react";
import Link from "next/link";
import {
  NavLayout,
  NavbarCtaConfig,
  NavbarCtaSurfaceStyle,
  Restaurant,
  WebsiteConfig,
} from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { buildNavPageItems } from "@/lib/siteNav";
import { ensureFont } from "@/components/sections/typography";
import { injectFontFace } from "@/lib/themes/curatedFonts";
import { PageType, resolveNavLayout, sideForPageType } from "@/lib/navLayout";

/**
 * SiteNavbar — the ONE top navigation bar, shared by every site page (landing,
 * order, catering, custom pages). Its look is driven entirely by the owner's
 * WebsiteConfig navbar settings (Thème → Navigation in the builder), so a single
 * config styles the whole site consistently. Self-contained: it resolves the
 * config (live or the editor's draft), owns the mobile drawer, and renders.
 *
 * `overHero` = the page opens with a full-bleed hero/banner behind the bar, so
 * the "overlay" style (transparent, solid on hover) can float over it. Pages
 * without a hero pass false and the overlay style degrades to solid — never a
 * transparent bar over readable content.
 */

export type NavbarLinkStyle = "text" | "underline" | "pill" | "bordered";
type ResolvedNavbarStyle = "solid" | "transparent" | "overlay";
type NavbarStyleInput = NonNullable<WebsiteConfig["navbarStyle"]>;

export type NavbarSettings = {
  style: ResolvedNavbarStyle;
  color: string; // solid / custom background
  logoSize: number;
  hideName: boolean;
  logoPosition: "left" | "center" | "right";
  scrolledLogo: string; // solid-state logo (falls back to the main logo)
  textColor: string; // solid-state text ('' = theme text)
  overlayText: string; // transparent-state text ('' = white)
  cta: NavbarCtaConfig | null;
  showLinks: boolean; // inline page links
  hamburger: "mobile" | "always" | "off"; // drawer button visibility
  // Typography (applied inline to the links + restaurant name).
  font: string; // '' = inherit
  fontWeight: number; // 0 = inherit
  fontSize: number; // px for links, 0 = default (14)
  letterSpacing: number; // px, 0 = none
  uppercase: boolean;
  linkStyle: NavbarLinkStyle;
};

export type NavbarSurface = {
  overlayActive: boolean;
  transparent: boolean;
};

type NavbarType = { weight?: number; size?: number; letter_spacing?: number; uppercase?: boolean };

/** Snake-case navbar fields as they arrive in the editor's draft config. */
export type DraftNavbar = {
  navbar_style?: NavbarStyleInput;
  navbar_color?: string;
  logo_size?: number;
  hide_navbar_name?: boolean;
  navbar_logo_position?: NavbarSettings["logoPosition"];
  navbar_scrolled_logo_url?: string;
  navbar_text_color?: string;
  navbar_overlay_text_color?: string;
  navbar_cta?: NavbarSettings["cta"];
  navbar_show_links?: boolean;
  navbar_hamburger?: NavbarSettings["hamburger"];
  navbar_font?: string;
  navbar_type?: NavbarType | null;
  navbar_link_style?: NavbarLinkStyle;
  nav_layout?: NavLayout | null;
};

/**
 * Merge the live config (camelCase) with an optional draft config (snake_case,
 * posted by the editor) so navbar edits preview live. Draft wins; then the saved
 * config; then a sensible default.
 */
export function resolveNavbar(
  config: WebsiteConfig | null | undefined,
  draft: DraftNavbar | null | undefined,
): NavbarSettings {
  const pick = <T,>(snake: T | undefined, camel: T | undefined, fallback: T): T =>
    snake !== undefined && snake !== null ? snake : camel !== undefined && camel !== null ? camel : fallback;
  const type: NavbarType = pick(draft?.navbar_type, config?.navbarType, null) || {};
  const style = pick(draft?.navbar_style, config?.navbarStyle, "solid");
  return {
    style:
      style === "transparent" || style === "overlay" ? style : "solid",
    color: pick(draft?.navbar_color, config?.navbarColor, ""),
    logoSize: pick(draft?.logo_size, config?.logoSize, 40) || 40,
    hideName: pick(draft?.hide_navbar_name, config?.hideNavbarName, false),
    logoPosition: pick(draft?.navbar_logo_position, config?.navbarLogoPosition, "left"),
    scrolledLogo: pick(draft?.navbar_scrolled_logo_url, config?.navbarScrolledLogoUrl, ""),
    textColor: pick(draft?.navbar_text_color, config?.navbarTextColor, ""),
    overlayText: pick(draft?.navbar_overlay_text_color, config?.navbarOverlayTextColor, ""),
    cta: mergeNavbarCtaConfig(config?.navbarCta, draft?.navbar_cta),
    showLinks: pick(draft?.navbar_show_links, config?.navbarShowLinks, true),
    hamburger: pick(draft?.navbar_hamburger, config?.navbarHamburger, "mobile"),
    font: pick(draft?.navbar_font, config?.navbarFont, ""),
    fontWeight: type.weight || 0,
    fontSize: type.size || 0,
    letterSpacing: type.letter_spacing || 0,
    uppercase: type.uppercase === true,
    linkStyle: pick(draft?.navbar_link_style, config?.navbarLinkStyle, "text"),
  };
}

/** Resolves whether navbar interaction can change its visual surface. */
export function resolveNavbarSurface(
  style: ResolvedNavbarStyle,
  overHero: boolean,
  interactionActive: boolean,
): NavbarSurface {
  const overlayActive = style === "overlay" && overHero;
  return {
    overlayActive,
    transparent:
      style === "transparent" || (overlayActive && !interactionActive),
  };
}

const TRANSPARENT_CTA_BG = "rgba(255,255,255,0.18)";
const TRANSPARENT_CTA_BORDER = "rgba(255,255,255,0.4)";

/** Resolves one CTA surface while preserving legacy solid and frosted defaults. */
export function resolveNavbarCtaSurface(
  cta: NavbarCtaConfig | null | undefined,
  transparent: boolean,
): Required<NavbarCtaSurfaceStyle> {
  const state = transparent ? cta?.transparent : cta?.solid;
  const variant = ctaVariant(state?.variant ?? (!transparent ? cta?.variant : undefined));
  const configuredBg = nonEmptyString(
    state?.bg ?? (!transparent ? cta?.bg : undefined),
  );
  const configuredText = nonEmptyString(
    state?.text_color ?? (!transparent ? cta?.text_color : undefined),
  );
  const configuredBorder = nonEmptyString(
    state?.border_color ?? (!transparent ? cta?.border_color : undefined),
  );
  const textColor = configuredText ?? (transparent ? "#ffffff" : variant === "filled" ? "#ffffff" : "var(--brand)");
  const background =
    configuredBg ??
    (variant === "filled"
      ? transparent
        ? TRANSPARENT_CTA_BG
        : "var(--brand)"
      : "transparent");
  const borderColor =
    configuredBorder ??
    (variant === "outline"
      ? textColor
      : transparent && variant === "filled"
        ? TRANSPARENT_CTA_BORDER
        : "transparent");
  return {
    variant,
    bg: background,
    text_color: textColor,
    border_color: borderColor,
  };
}

/** Resolve navbar styling + the navigation-layout matrix from the live theme
 *  config + the editor draft, so the navbar previews live in the builder on
 *  whichever page is shown. */
export function useNavbarSettings(): { nb: NavbarSettings; navLayout: NavLayout } {
  const { config } = useRestaurantTheme();
  const [draft, setDraft] = useState<DraftNavbar | null>(null);
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "foody-draft-state" && e.data.state?.config) {
        setDraft(e.data.state.config as DraftNavbar);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const nb = resolveNavbar(config, draft);
  const navLayout = resolveNavLayout({
    navLayout: draft?.nav_layout ?? config?.navLayout ?? null,
    navbarStyle: draft?.navbar_style ?? config?.navbarStyle ?? nb.style,
    navbarShowLinks: nb.showLinks,
    navbarHamburger: nb.hamburger,
  });
  return { nb, navLayout };
}

/** The resolved navigation-layout side for a page type — used by page shells to
 *  decide whether to mount the mobile bottom bar (still md:hidden). */
export function useNavLayoutSide(pageType: PageType) {
  const { navLayout } = useNavbarSettings();
  return sideForPageType(navLayout, pageType);
}

/** Resolve a navbar CTA link value into an href. */
function ctaHref(link: string | undefined, slug: string, orderUrl: string): string {
  const v = (link || "").trim();
  if (!v || v === "order") return orderUrl;
  if (v === "catering") return `/r/${slug}/catering`;
  if (v.startsWith("http") || v.startsWith("/") || v.startsWith("#")) return v;
  return `/r/${slug}/${v}`; // treat as a page slug
}

export function SiteNavbar({
  restaurant,
  activeKey,
  overHero = false,
  pageType = "content",
  onHamburgerClick,
  hideCta = false,
  rightSlot,
}: {
  restaurant: Restaurant;
  activeKey?: string;
  overHero?: boolean;
  /** Which navigation-layout side to apply. Shopping pages (order, catering,
   *  custom pages flagged shopping) drop the full nav for the shopping modes. */
  pageType?: PageType;
  /** When set, the hamburger calls this instead of opening SiteNavbar's own
   *  drawer — used by the order page to open its cart-aware NavigationDrawer. */
  onHamburgerClick?: () => void;
  /** Suppress the action button (e.g. redundant "Commander" on the order page). */
  hideCta?: boolean;
  /** Extra controls rendered in the bar's right cluster (e.g. the order page's
   *  density toggle + account menu). Receives the resolved text color. */
  rightSlot?: (ctx: { textColor: string; transparent: boolean }) => React.ReactNode;
}) {
  const { t } = useI18n();
  const { nb, navLayout } = useNavbarSettings();
  const side = sideForPageType(navLayout, pageType);
  const desktopMode = side.desktop;
  const mobileMode = side.mobile;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const slug = restaurant.slug || String(restaurant.id);
  const navPageItems = buildNavPageItems(restaurant, {
    home: t("navHome") || "Home",
    menu: t("navMenu") || "Menu",
    catering: t("navCatering") || "Catering",
  });
  const effectiveCateringOnly = restaurant.cateringEnabled === true && restaurant.cateringOnly === true;
  const orderUrl = effectiveCateringOnly ? `/r/${slug}/catering` : `/r/${slug}/order`;
  const cateringLabel = t("navCatering") || "Catering";

  // Navbar typography — load the chosen font (Google via css2 link, uploaded via
  // @font-face) and apply it inline, mirroring RestaurantHero. The theme --font-*
  // vars are route-gated (cleared on content pages), so the navbar must not rely
  // on them; inline styles keep the font consistent across every page.
  const navExtra = nb.font
    ? restaurant.websiteConfig?.typography?.extraFonts?.find((f) => f.family === nb.font)
    : undefined;
  const navFontUrl = navExtra?.url;
  const navFontFormat = navExtra?.format;
  const navFontFaces = navExtra?.faces;
  const navFontWeights = navExtra?.weights;
  useEffect(() => {
    if (!nb.font) return;
    if (navFontUrl || navFontFaces?.length) {
      injectFontFace(nb.font, { url: navFontUrl, format: navFontFormat, faces: navFontFaces });
    } else {
      ensureFont(nb.font, navFontWeights);
    }
  }, [nb.font, navFontUrl, navFontFormat, navFontFaces, navFontWeights]);

  // Shared typography for the name + links (font size applied per-element).
  const navTextStyle: CSSProperties = {
    ...(nb.font ? { fontFamily: `"${nb.font}", inherit` } : undefined),
    ...(nb.fontWeight ? { fontWeight: nb.fontWeight } : undefined),
    ...(nb.letterSpacing ? { letterSpacing: `${nb.letterSpacing}px` } : undefined),
    ...(nb.uppercase ? { textTransform: "uppercase" as const } : undefined),
  };

  // Both devices set to "hidden" ⇒ no top bar at all (the page relies on the
  // bottom bar / an externally-owned drawer). The resolver's safety net already
  // prevents a mobile-hidden + no-bottom-bar stranding, so this is deliberate.
  if (desktopMode === "hidden" && mobileMode === "hidden") return null;

  // "overlay" floats over the hero only when the page actually has one; otherwise
  // it behaves like a normal solid bar so text stays readable. (The legacy
  // navbar_style 'hidden' is treated as a solid background here — composition is
  // now driven by the per-device modes, not the style.)
  const interactionActive = hover || focusWithin;
  const { overlayActive, transparent: transparentNow } = resolveNavbarSurface(
    nb.style,
    overHero,
    interactionActive,
  );
  const solid = !transparentNow;

  const bg = transparentNow ? "transparent" : nb.color || "var(--surface)";
  const text = transparentNow ? nb.overlayText || "#ffffff" : nb.textColor || "var(--text)";
  const showScrolledLogo = overlayActive && solid && !!nb.scrolledLogo;

  const cta = nb.cta || {};
  const ctaEnabled = cta.enabled !== false;
  const ctaLabel = cta.text || (effectiveCateringOnly ? cateringLabel : "Order Now");
  const ctaLink = ctaHref(cta.link, slug, orderUrl);
  const centered = nb.logoPosition === "center";

  const logo = restaurant.logoUrl ? (
    <Link href={`/r/${slug}`} className="relative inline-flex shrink-0 items-center" aria-label={restaurant.name}>
      <span className="relative inline-block" style={{ height: nb.logoSize, minWidth: nb.logoSize }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={restaurant.logoUrl}
          alt={restaurant.name}
          className="h-full w-auto transition-opacity duration-300"
          style={{ height: nb.logoSize, opacity: showScrolledLogo ? 0 : 1 }}
        />
        {nb.scrolledLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nb.scrolledLogo}
            alt={restaurant.name}
            className="absolute left-0 top-0 h-full w-auto transition-opacity duration-300"
            style={{ height: nb.logoSize, opacity: showScrolledLogo ? 1 : 0 }}
          />
        )}
      </span>
      {!nb.hideName && (
        <span className="ms-2.5 text-lg font-bold" style={{ color: text, ...navTextStyle }}>
          {restaurant.name}
        </span>
      )}
    </Link>
  ) : !nb.hideName ? (
    <Link href={`/r/${slug}`} className="text-lg font-bold" style={{ color: text, ...navTextStyle }}>
      {restaurant.name}
    </Link>
  ) : null;

  // The hamburger shows on a device when that device's mode is "compact"; inline
  // links show when the mode is "full". Explicit per-device visibility replaces
  // the old 'always' hack (which leaked a hamburger onto desktop).
  const hamburgerVis = `${mobileMode === "compact" ? "flex" : "hidden"} ${desktopMode === "compact" ? "md:flex" : "md:hidden"}`;
  const linksVis = `${mobileMode === "full" ? "flex" : "hidden"} ${desktopMode === "full" ? "md:flex" : "md:hidden"}`;
  const showHamburger = mobileMode === "compact" || desktopMode === "compact";
  const openDrawer = onHamburgerClick ?? (() => setDrawerOpen(true));
  const hamburger = showHamburger ? (
    <button
      onClick={openDrawer}
      className={`${hamburgerVis} h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5`}
      style={{ color: text }}
      aria-label={t("navPrimary") || "Menu"}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  ) : null;

  // Per-link className + inline style for the chosen link style. Tint classes are
  // written as literals (not interpolated) so Tailwind's JIT emits them.
  const renderLink = (it: { key: string; href: string; label: string }) => {
    const active = activeKey === it.key;
    let cls = "font-medium transition";
    const st: CSSProperties = { color: text, ...navTextStyle, fontSize: nb.fontSize ? `${nb.fontSize}px` : undefined };
    switch (nb.linkStyle) {
      case "underline":
        cls += ` underline-offset-[6px] hover:underline${active ? " underline" : ""}`;
        break;
      case "pill":
        cls += transparentNow
          ? ` rounded-full px-3 py-1.5 hover:bg-white/15${active ? " bg-white/15" : ""}`
          : ` rounded-full px-3 py-1.5 hover:bg-black/[0.06]${active ? " bg-black/[0.06]" : ""}`;
        break;
      case "bordered":
        cls += " rounded-md border px-3 py-1.5 transition hover:opacity-80";
        st.borderColor = active ? text : "transparent";
        break;
      default: // text
        cls += " transition-opacity hover:opacity-70";
        st.opacity = active ? 1 : 0.85;
    }
    if (!st.fontSize) cls += " text-sm"; // default size when none configured
    return (
      <Link key={it.key} href={it.href} className={cls} style={st}>
        {it.label}
      </Link>
    );
  };

  const linksRow = (extra: string) =>
    navPageItems.length > 0 && (mobileMode === "full" || desktopMode === "full") ? (
      // overflow-x-auto + whitespace-nowrap lets many links scroll sideways on a
      // phone when the owner opts into inline links on mobile ("full").
      <div className={`${linksVis} min-w-0 items-center gap-6 overflow-x-auto whitespace-nowrap ${extra}`}>
        {navPageItems.map(renderLink)}
      </div>
    ) : null;

  // Button style: shape (corner radius), size (padding scale), variant (fill).
  const ctaShape =
    cta.shape === "square" ? "rounded-none" : cta.shape === "rounded" ? "rounded-lg" : "rounded-full";
  const ctaSizeCls =
    cta.size === "sm" ? "px-4 py-2 text-xs" : cta.size === "lg" ? "px-6 py-3 text-base" : "px-5 py-2.5 text-sm";
  const ctaSurface = resolveNavbarCtaSurface(cta, transparentNow);
  const showCtaBorder =
    ctaSurface.variant === "outline" ||
    ctaSurface.border_color !== "transparent";
  const ctaStyle: CSSProperties = {
    backgroundColor: ctaSurface.bg,
    color: ctaSurface.text_color,
    border: showCtaBorder
      ? `1px solid ${ctaSurface.border_color}`
      : undefined,
    backdropFilter:
      transparentNow &&
      ctaSurface.variant === "filled" &&
      ctaSurface.bg === TRANSPARENT_CTA_BG
        ? "blur(4px)"
        : undefined,
    outlineColor:
      ctaSurface.border_color === "transparent"
        ? ctaSurface.text_color
        : ctaSurface.border_color,
  };
  if (nb.font) ctaStyle.fontFamily = `"${nb.font}", inherit`;

  const ctaBtn = ctaEnabled && !hideCta ? (
    <Link
      href={ctaLink}
      data-navbar-cta-state={transparentNow ? "transparent" : "solid"}
      className={`shrink-0 ${ctaShape} ${ctaSizeCls} font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none`}
      style={ctaStyle}
    >
      {ctaLabel}
    </Link>
  ) : null;
  // Extra right-cluster controls (order page: density toggle + account menu).
  const rightExtra = rightSlot ? rightSlot({ textColor: text, transparent: transparentNow }) : null;
  const rightCluster = rightExtra || ctaBtn ? (
    <div className="flex items-center gap-2">
      {rightExtra}
      {ctaBtn}
    </div>
  ) : null;

  const positionClass = overlayActive ? "absolute inset-x-0 top-0" : "sticky top-0";
  // Hide the whole bar on the device whose mode is "hidden" (the other device
  // still shows it). Both-hidden already returned null above.
  const barVis = mobileMode === "hidden" ? "hidden md:block" : desktopMode === "hidden" ? "md:hidden" : "";

  return (
    <>
      <nav
        data-navbar-state={transparentNow ? "transparent" : "solid"}
        onMouseEnter={overlayActive ? () => setHover(true) : undefined}
        onMouseLeave={overlayActive ? () => setHover(false) : undefined}
        onFocusCapture={
          overlayActive ? () => setFocusWithin(true) : undefined
        }
        onBlurCapture={
          overlayActive
            ? (event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setFocusWithin(false);
                }
              }
            : undefined
        }
        className={`${barVis} ${positionClass} z-40 transition-colors duration-300 ${
          transparentNow ? "" : "backdrop-blur-md border-b border-black/5"
        }`}
        style={{ backgroundColor: bg }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {centered ? (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3">
                <div className="flex items-center justify-start">{hamburger}</div>
                <div className="flex items-center justify-center">{logo}</div>
                <div className="flex items-center justify-end">{rightCluster}</div>
              </div>
              {linksRow("justify-center pb-3")}
            </>
          ) : nb.logoPosition === "right" ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                {hamburger}
                {linksRow("")}
              </div>
              <div className="flex items-center gap-4">
                {logo}
                {rightCluster}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                {hamburger}
                {logo}
              </div>
              {linksRow("")}
              {rightCluster}
            </div>
          )}
        </div>
      </nav>
      {/* Own the drawer unless the parent handles the hamburger (e.g. the order
          page opens its cart-aware NavigationDrawer via onHamburgerClick). */}
      {!onHamburgerClick && (
        <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} restaurant={restaurant} />
      )}
    </>
  );
}

function mergeNavbarCtaConfig(
  base: NavbarCtaConfig | null | undefined,
  override: NavbarCtaConfig | null | undefined,
): NavbarCtaConfig | null {
  if (!override) return base ?? null;
  return {
    ...(base ?? {}),
    ...override,
    ...(override.transparent
      ? {
          transparent: {
            ...(base?.transparent ?? {}),
            ...override.transparent,
          },
        }
      : {}),
    ...(override.solid
      ? {
          solid: {
            ...(base?.solid ?? {}),
            ...override.solid,
          },
        }
      : {}),
  };
}

function ctaVariant(value: unknown): Required<NavbarCtaSurfaceStyle>["variant"] {
  return value === "outline" || value === "ghost" ? value : "filled";
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
