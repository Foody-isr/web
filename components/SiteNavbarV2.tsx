"use client";

// Website Builder v2 — SiteNavbarV2.
//
// The v2 navbar: renders one device's bar from a structured NavbarDeviceConfig
// (the new `navbar_v2` blob), independent of the legacy SiteNavbar which is
// driven by the flat navbar_* fields. During the transition, callers render
// this when navbar_v2 is present and fall back to <SiteNavbar> otherwise.
//
// Features: composition presets, transparent→solid scroll animation with a
// dual-logo swap, per-state link colors, action buttons, and a mobile drawer.
// All animation decisions live in the pure resolveNavbarVisual resolver
// (lib/navbar/state.ts); this component only maps the resolved visual to styles.
//
// NOTE: built and type-checked, not yet runtime-verified end-to-end (depends on
// the v2 server endpoints on the unpushed feature branch). Expect a visual
// polish pass once the whole stack runs together.

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { NavbarDeviceConfig } from "@/lib/navbar/config";
import {
  resolveNavbarVisual,
  type ForcedNavState,
  type NavbarVisual,
} from "@/lib/navbar/state";
import { rafThrottle } from "@/lib/preview-mode";

export interface NavLinkV2 {
  label: string;
  href: string;
}

export interface SiteNavbarV2Props {
  config: NavbarDeviceConfig | null;
  device: "desktop" | "mobile";
  links: NavLinkV2[];
  brandName?: string;
  /** Forced state from the editor preview; undefined = follow live scroll. */
  forcedState?: ForcedNavState;
  className?: string;
}

const HEIGHTS: Record<string, string> = {
  thin: "3rem",
  medium: "4.25rem",
  tall: "5.5rem",
};

const DEFAULT_SCROLL = {
  transparent_at_top: false,
  scrolled_color: "#ffffff",
  hide_on_scroll: false,
  position: "sticky" as const,
};

function useScrollVisual(
  config: NavbarDeviceConfig | null,
  forced: ForcedNavState,
): NavbarVisual {
  const [scrollY, setScrollY] = useState(0);
  const lastY = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || forced != null) return;
    const onScroll = rafThrottle(() => {
      lastY.current = scrollY;
      setScrollY(window.scrollY);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollY, forced]);

  return useMemo(
    () => resolveNavbarVisual(config?.scroll ?? DEFAULT_SCROLL, scrollY, lastY.current, forced ?? null),
    [config?.scroll, scrollY, forced],
  );
}

export function SiteNavbarV2({
  config,
  device,
  links,
  brandName,
  forcedState,
  className,
}: SiteNavbarV2Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visual = useScrollVisual(config, forcedState ?? null);

  if (!config) return null;

  const { background, scroll, logo, links: linkStyle, composition } = config;
  const position = scroll.position || "sticky";

  const barBg = visual.transparent
    ? "transparent"
    : scroll.scrolled_color || background.color || "#ffffff";
  const linkColor = visual.transparent
    ? linkStyle.color || "#ffffff"
    : linkStyle.scrolled_color || linkStyle.color || "#1a1a1a";
  const logoSrc =
    visual.transparent && logo.transparent_url ? logo.transparent_url : logo.default_url;

  const barStyle: CSSProperties = {
    position: position === "static" ? "relative" : (position as "sticky" | "fixed"),
    top: position === "static" ? undefined : 0,
    background: barBg,
    minHeight: HEIGHTS[background.height] || HEIGHTS.medium,
    boxShadow: !visual.transparent && background.shadow ? "0 2px 12px rgba(0,0,0,0.08)" : undefined,
    borderBottom: !visual.transparent && background.border ? "1px solid rgba(0,0,0,0.08)" : undefined,
    backdropFilter: !visual.transparent && background.blur ? "saturate(180%) blur(12px)" : undefined,
    borderRadius: background.corners === "rounded" ? "0 0 1rem 1rem" : undefined,
    transform: visual.hidden ? "translateY(-110%)" : "translateY(0)",
    transition: "transform 0.3s ease, background 0.3s ease",
    color: linkColor,
    zIndex: 50,
    fontFamily: linkStyle.font || undefined,
  };

  const logoImg = logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoSrc}
      alt={brandName || "logo"}
      style={{
        height: logo.size ? `${logo.size}px` : "40px",
        width: "auto",
        marginBottom: logo.overhang ? "-1.5rem" : undefined,
        position: logo.overhang ? "relative" : undefined,
        zIndex: 1,
      }}
    />
  ) : (
    <span style={{ fontWeight: 700, fontSize: "1.15rem", color: linkColor }}>{brandName}</span>
  );

  const linkList = (
    <ul className="flex items-center gap-6 list-none m-0 p-0" style={{ color: linkColor }}>
      {links.map((l) => (
        <li key={l.href}>
          <a
            href={l.href}
            className="text-sm font-semibold no-underline transition-opacity hover:opacity-70"
            style={{ color: linkColor }}
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );

  const actionBtns = (
    <div className="flex items-center gap-2">
      {config.actions.map((a, i) => {
        const primary = a.style !== "ghost";
        return (
          <a
            key={`${a.type}-${i}`}
            href={a.link || "#"}
            className="rounded-full px-4 py-2 text-sm font-bold no-underline transition-colors"
            style={
              primary
                ? { background: "var(--brand, #e06c5a)", color: "#fff" }
                : { border: `1px solid ${linkColor}`, color: linkColor }
            }
          >
            {a.label || a.type}
          </a>
        );
      })}
    </div>
  );

  // Mobile: logo + hamburger + drawer, regardless of composition.
  if (device === "mobile") {
    return (
      <header className={className} style={barStyle}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="cursor-pointer border-0 bg-transparent text-2xl leading-none"
            style={{ color: linkColor }}
          >
            ☰
          </button>
          {logoImg}
          {actionBtns}
        </div>
        {menuOpen && (
          <nav className="px-4 pb-4" style={{ background: barBg === "transparent" ? "#fff" : barBg }}>
            {linkList}
          </nav>
        )}
      </header>
    );
  }

  // Desktop composition presets.
  if (composition === "logo_center_links_below") {
    return (
      <header className={className} style={barStyle}>
        <div className="flex items-center justify-between px-6 pt-3">
          <div className="flex-1" />
          <div className="flex flex-col items-center">{logoImg}</div>
          <div className="flex flex-1 justify-end">{actionBtns}</div>
        </div>
        <div className="flex justify-center pb-2">{linkList}</div>
      </header>
    );
  }

  if (composition === "inline_center") {
    return (
      <header className={className} style={barStyle}>
        <div className="flex items-center justify-center gap-8 px-6 py-3">
          {logoImg}
          {linkList}
          {actionBtns}
        </div>
      </header>
    );
  }

  // Default: logo_left.
  return (
    <header className={className} style={barStyle}>
      <div className="flex items-center justify-between px-6 py-3">
        {logoImg}
        <div className="flex items-center gap-8">
          {linkList}
          {actionBtns}
        </div>
      </div>
    </header>
  );
}
