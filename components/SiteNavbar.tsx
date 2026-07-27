"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Restaurant, WebsiteConfig } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useRestaurantTheme } from "@/lib/restaurant-theme";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { buildNavPageItems } from "@/lib/siteNav";

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

export type NavbarSettings = {
  style: "solid" | "transparent" | "overlay" | "custom" | "hidden";
  color: string; // solid / custom background
  logoSize: number;
  hideName: boolean;
  logoPosition: "left" | "center" | "right";
  scrolledLogo: string; // solid-state logo (falls back to the main logo)
  textColor: string; // solid-state text ('' = theme text)
  overlayText: string; // transparent-state text ('' = white)
  cta: { enabled?: boolean; text?: string; link?: string; bg?: string; text_color?: string } | null;
  showLinks: boolean; // inline page links
  hamburger: "mobile" | "always" | "off"; // drawer button visibility
};

/** Snake-case navbar fields as they arrive in the editor's draft config. */
export type DraftNavbar = {
  navbar_style?: NavbarSettings["style"];
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
  return {
    style: pick(draft?.navbar_style, config?.navbarStyle, "solid"),
    color: pick(draft?.navbar_color, config?.navbarColor, ""),
    logoSize: pick(draft?.logo_size, config?.logoSize, 40) || 40,
    hideName: pick(draft?.hide_navbar_name, config?.hideNavbarName, false),
    logoPosition: pick(draft?.navbar_logo_position, config?.navbarLogoPosition, "left"),
    scrolledLogo: pick(draft?.navbar_scrolled_logo_url, config?.navbarScrolledLogoUrl, ""),
    textColor: pick(draft?.navbar_text_color, config?.navbarTextColor, ""),
    overlayText: pick(draft?.navbar_overlay_text_color, config?.navbarOverlayTextColor, ""),
    cta: pick(draft?.navbar_cta, config?.navbarCta, null),
    showLinks: pick(draft?.navbar_show_links, config?.navbarShowLinks, true),
    hamburger: pick(draft?.navbar_hamburger, config?.navbarHamburger, "mobile"),
  };
}

/** Resolve navbar settings from the live theme config + the editor draft, so the
 *  navbar previews live in the builder on whichever page is shown. */
export function useNavbarSettings(): NavbarSettings {
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
  return resolveNavbar(config, draft);
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
}: {
  restaurant: Restaurant;
  activeKey?: string;
  overHero?: boolean;
}) {
  const { t } = useI18n();
  const nb = useNavbarSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const slug = restaurant.slug || String(restaurant.id);
  const navPageItems = buildNavPageItems(restaurant, t("navCatering") || "Catering");
  const effectiveCateringOnly = restaurant.cateringEnabled === true && restaurant.cateringOnly === true;
  const orderUrl = effectiveCateringOnly ? `/r/${slug}/catering` : `/r/${slug}/order`;
  const cateringLabel = t("navCatering") || "Catering";

  // Hidden style: floating hamburger + centered floating logo, no bar.
  if (nb.style === "hidden") {
    return (
      <>
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
          aria-label={t("navPrimary") || "Menu"}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {restaurant.logoUrl && (
          <div className="pointer-events-none absolute left-0 right-0 top-3 z-40 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="pointer-events-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              style={{ height: nb.logoSize || 60, width: "auto" }}
            />
          </div>
        )}
        <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} restaurant={restaurant} />
      </>
    );
  }

  // "overlay" floats over the hero only when the page actually has one; otherwise
  // it behaves like a normal solid bar so text stays readable.
  const overlayActive = nb.style === "overlay" && overHero;
  const isTransparentStyle = nb.style === "transparent";
  const transparentNow = (overlayActive && !hover) || isTransparentStyle;
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
        <span className="ms-2.5 text-lg font-bold" style={{ color: text }}>
          {restaurant.name}
        </span>
      )}
    </Link>
  ) : !nb.hideName ? (
    <Link href={`/r/${slug}`} className="text-lg font-bold" style={{ color: text }}>
      {restaurant.name}
    </Link>
  ) : null;

  // "mobile" (default) shows the drawer button only on phones; "always" keeps it
  // everywhere; "off" hides it. When links are hidden, keep a way into the menu.
  const hamburgerMode = nb.hamburger === "off" && !nb.showLinks ? "mobile" : nb.hamburger;
  const hamburger =
    hamburgerMode === "off" ? null : (
      <button
        onClick={() => setDrawerOpen(true)}
        className={`${hamburgerMode === "always" ? "flex" : "flex md:hidden"} h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5`}
        style={{ color: text }}
        aria-label={t("navPrimary") || "Menu"}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    );

  const linksRow = (extra: string) =>
    nb.showLinks && navPageItems.length > 0 ? (
      <div className={`hidden items-center gap-6 md:flex ${extra}`}>
        {navPageItems.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: text, opacity: activeKey === it.key ? 1 : 0.85 }}
          >
            {it.label}
          </Link>
        ))}
      </div>
    ) : null;

  const ctaBtn = ctaEnabled ? (
    <Link
      href={ctaLink}
      className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{
        backgroundColor: cta.bg || (transparentNow ? "rgba(255,255,255,0.18)" : "var(--brand)"),
        color: cta.text_color || "#ffffff",
        border: !cta.bg && transparentNow ? "1px solid rgba(255,255,255,0.4)" : undefined,
        backdropFilter: !cta.bg && transparentNow ? "blur(4px)" : undefined,
      }}
    >
      {ctaLabel}
    </Link>
  ) : null;

  const positionClass = overlayActive ? "absolute inset-x-0 top-0" : "sticky top-0";

  return (
    <>
      <nav
        onMouseEnter={overlayActive ? () => setHover(true) : undefined}
        onMouseLeave={overlayActive ? () => setHover(false) : undefined}
        className={`${positionClass} z-40 transition-colors duration-300 ${
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
                <div className="flex items-center justify-end">{ctaBtn}</div>
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
                {ctaBtn}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                {hamburger}
                {logo}
              </div>
              {linksRow("")}
              {ctaBtn}
            </div>
          )}
        </div>
      </nav>
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} restaurant={restaurant} />
    </>
  );
}
