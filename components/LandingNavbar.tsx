"use client";

import { useState } from "react";
import Link from "next/link";
import { Restaurant, WebsiteConfig } from "@/lib/types";

/**
 * Resolved navbar settings for the landing page. Read from the live camelCase
 * WebsiteConfig OR, in the builder preview, from the snake_case draft config
 * (draft wins so edits preview live). Keep this the single source of truth for
 * navbar shape — see resolveNavbar below.
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
};

/**
 * Merge the live config (camelCase) with an optional draft config (snake_case,
 * posted by the editor) so navbar edits preview live in the builder. Draft keys
 * take precedence; anything absent falls back to the saved config, then a
 * sensible default.
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
  };
}

/** Resolve a navbar CTA link value into an href. */
function ctaHref(link: string | undefined, slug: string, orderUrl: string): string {
  const v = (link || "").trim();
  if (!v || v === "order") return orderUrl;
  if (v === "catering") return `/r/${slug}/catering`;
  if (v.startsWith("http") || v.startsWith("/") || v.startsWith("#")) return v;
  return `/r/${slug}/${v}`; // treat as a page slug
}

type NavLink = { key: string; href: string; label: string };

export function LandingNavbar({
  restaurant,
  nb,
  navPageItems,
  orderUrl,
  effectiveCateringOnly,
  cateringLabel,
  onOpenDrawer,
}: {
  restaurant: Restaurant;
  nb: NavbarSettings;
  navPageItems: NavLink[];
  orderUrl: string;
  effectiveCateringOnly: boolean;
  cateringLabel: string;
  onOpenDrawer: () => void;
}) {
  const [hover, setHover] = useState(false);
  const slug = restaurant.slug || String(restaurant.id);

  // Hidden style: floating hamburger + centered floating logo, no bar.
  if (nb.style === "hidden") {
    return (
      <>
        <button
          onClick={onOpenDrawer}
          className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
          aria-label="Menu"
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
      </>
    );
  }

  const isOverlay = nb.style === "overlay";
  const isTransparentStyle = nb.style === "transparent";
  const isCustom = nb.style === "custom" && !!nb.color;
  // Solid appearance now? Solid/custom are always solid; overlay is solid only
  // while hovered; transparent is never solid.
  const solid = nb.style === "solid" || isCustom || (isOverlay && hover);
  const transparentNow = isTransparentStyle || (isOverlay && !hover);

  const bg = transparentNow ? "transparent" : nb.color || "var(--surface)";
  const text = transparentNow ? nb.overlayText || "#ffffff" : nb.textColor || "var(--text)";
  const showScrolledLogo = solid && !!nb.scrolledLogo;

  const cta = nb.cta || {};
  const ctaEnabled = cta.enabled !== false;
  const ctaLabel = cta.text || (effectiveCateringOnly ? cateringLabel : "Order Now");
  const ctaLink = ctaHref(cta.link, slug, orderUrl);

  // Logo with a crossfade between the transparent-state and solid-state images.
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

  const hamburger = (
    <button
      onClick={onOpenDrawer}
      className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5"
      style={{ color: text }}
      aria-label="Menu"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );

  const links =
    navPageItems.length > 0 ? (
      <div className="hidden items-center gap-6 md:flex">
        {navPageItems.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: text }}
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

  const centered = nb.logoPosition === "center";

  return (
    <nav
      onMouseEnter={isOverlay ? () => setHover(true) : undefined}
      onMouseLeave={isOverlay ? () => setHover(false) : undefined}
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        transparentNow ? "" : "backdrop-blur-md"
      } ${transparentNow ? "" : "border-b border-black/5"}`}
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {centered ? (
          // Center: logo on top, page links centered below (moulindore layout).
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3">
              <div className="flex items-center justify-start">{hamburger}</div>
              <div className="flex items-center justify-center">{logo}</div>
              <div className="flex items-center justify-end">{ctaBtn}</div>
            </div>
            {navPageItems.length > 0 && (
              <div className="hidden justify-center gap-6 pb-3 md:flex">
                {navPageItems.map((it) => (
                  <Link
                    key={it.key}
                    href={it.href}
                    className="text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: text }}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : nb.logoPosition === "right" ? (
          // Right: nav links start, logo + CTA at the end.
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              {hamburger}
              {links}
            </div>
            <div className="flex items-center gap-4">
              {logo}
              {ctaBtn}
            </div>
          </div>
        ) : (
          // Left (default): logo + name start, links, CTA at the end.
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              {hamburger}
              {logo}
            </div>
            {links}
            {ctaBtn}
          </div>
        )}
      </div>
    </nav>
  );
}
