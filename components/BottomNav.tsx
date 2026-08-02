"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { AccountSheet } from "@/components/AccountSheet";
import {
  type ActiveNavigationSelection,
  buildSystemNavItems,
  withActiveNavigationItem,
} from "@/lib/systemNav";
import type { SiteNavItem } from "@/lib/siteNav";
import type { BottomNavigationStyle, NavigationIcon, Restaurant } from "@/lib/types";

interface BottomNavProps {
  /** Materialized public or preview restaurant used to derive every destination. */
  restaurant: Restaurant;
  /** Explicit page, system, or legacy-route intent to highlight. */
  active?: ActiveNavigationSelection | null;
}

/**
 * Mobile-only bottom navigation for the restaurant experience:
 * Published V3 pages + eligible system links + Compte. Hidden from `md` up
 * (desktop keeps the hamburger drawer + profile menu).
 */
export function BottomNav({ restaurant, active }: BottomNavProps) {
  const { t, direction } = useI18n();
  const [accountOpen, setAccountOpen] = useState(false);
  const [draftStyle, setDraftStyle] = useState<BottomNavigationStyle | null>(null);
  const slug = restaurant.slug || String(restaurant.id);
  const navItems = withActiveNavigationItem(
    buildSystemNavItems(restaurant, {
      home: t("navHome") || "Home",
      menu: t("navMenu") || "Menu",
      catering: t("navCatering") || "Catering",
      stories: t("navStories") || "Stories",
      orders: t("accountMyOrders") || "My Orders",
    }),
    active,
  );
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "foody-draft-state") {
        setDraftStyle(event.data.state?.config?.nav_layout?.bottom_navigation ?? null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const style = draftStyle ?? restaurant.websiteConfig?.navLayout?.bottom_navigation ?? {};
  const entries = useMemo(() => {
    const all = [
      ...navItems.map((item) => ({ kind: "link" as const, key: item.key, item })),
      { kind: "account" as const, key: "account" },
    ];
    const ranks = new Map((style.order ?? []).map((key, index) => [key, index]));
    return all.sort((a, b) => (ranks.get(a.key) ?? 999) - (ranks.get(b.key) ?? 999));
  }, [navItems, style.order]);

  return (
    <>
      <nav
        dir={direction}
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch md:hidden"
        style={{
          background: style.background_color || "var(--surface)",
          borderTop: "1px solid var(--divider)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
          fontFamily: "var(--font-body)",
        }}
        aria-label={t("navPrimary") || "Primary"}
      >
        <div data-bottom-nav-scroll className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex h-full min-w-max items-stretch">
            {entries.map((entry, index) => entry.kind === "account" ? (
              <button key="account" data-bottom-nav-account type="button" onClick={() => setAccountOpen(true)}
                className={tabClass} style={tabStyle(accountOpen, style)}>
                <span className="h-5 w-5"><NavigationGlyph name={style.icons?.account ?? "user"} /></span>
                <span>{t("accountMenuTitle")}</span>
              </button>
            ) : (
              <TabLink key={`${entry.item.key}:${entry.item.href}:${index}`} href={entry.item.href}
                label={entry.item.label} isActive={entry.item.isActive}
                icon={<NavigationGlyph name={style.icons?.[entry.item.key] ?? defaultIcon(entry.item)} />} styleConfig={style} />
            ))}
          </div>
        </div>
      </nav>

      <AccountSheet slug={slug} open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

const tabClass = "m-1 flex min-w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition-colors";

function tabStyle(isActive: boolean, config: BottomNavigationStyle) {
  return {
    color: isActive ? config.active_text_color || "var(--brand)" : config.text_color || "var(--text-muted)",
    backgroundColor: config.button_background_color || "transparent",
  };
}

function TabLink({
  href,
  label,
  isActive,
  icon,
  styleConfig,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
  styleConfig: BottomNavigationStyle;
}) {
  return (
    <Link href={href} className={tabClass} style={tabStyle(isActive, styleConfig)} aria-current={isActive ? "page" : undefined}>
      <span className="h-5 w-5">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

/* ── Icons (inherit `currentColor`) ─────────────────────────────────────── */

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function StoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l5 3-5 3V9z" />
    </svg>
  );
}

function CateringIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2M5 21h14M4 21a8 8 0 0116 0M7 8h.01M12 8h.01M17 8h.01" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h9l3 3v13H6zM14 4v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function defaultIcon(item: SiteNavItem): NavigationIcon {
  if (item.key === "stories") return "play";
  if (item.key === "orders") return "bag";
  if (item.pageType === "landing") return "home";
  if (item.pageType === "order") return "menu";
  if (item.pageType === "catering") return "grid";
  return "page";
}

function NavigationGlyph({ name }: { name: NavigationIcon }) {
  if (name === "menu") return <MenuIcon />;
  if (name === "play") return <StoriesIcon />;
  if (name === "grid") return <CateringIcon />;
  if (name === "user") return <AccountIcon />;
  if (name === "bag") return <OrdersIcon />;
  if (name === "home") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6" /></svg>;
  return <PageIcon />;
}
