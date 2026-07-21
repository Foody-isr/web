"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { AccountSheet } from "@/components/AccountSheet";
import { fetchRestaurant } from "@/services/api";
import { orderedPageTabs, tabPath, type NavPageTab } from "@/lib/nav";

export type BottomNavTab = "menu" | "stories" | "orders";

interface BottomNavProps {
  /** Restaurant id-or-slug from the route (used to build links). */
  slug: string;
  active: BottomNavTab;
}

/**
 * Mobile-only bottom navigation for the restaurant experience:
 * Menu · Stories · Compte. Hidden from `md` up (desktop keeps the hamburger
 * drawer + profile menu). The cart is reached via the floating cart dock (which
 * sits just above this bar). Orders + custom pages live inside the Compte sheet.
 * The Stories tab only shows when the restaurant enabled Stories in admin.
 */
export function BottomNav({ slug, active }: BottomNavProps) {
  const { t, direction } = useI18n();
  const [accountOpen, setAccountOpen] = useState(false);

  // Shares the ["restaurant", slug] cache with AccountSheet (single request).
  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", slug],
    queryFn: () => fetchRestaurant(slug),
    staleTime: 5 * 60 * 1000,
  });
  const storiesEnabled = restaurant?.websiteConfig?.storiesEnabled === true;
  const navOrder = restaurant?.websiteConfig?.navOrder;

  // Page tabs rendered in the restaurant's configured order (Account is a sheet,
  // always pinned last, so it is not part of the ordered list).
  const pageTabs = orderedPageTabs(navOrder, storiesEnabled);
  const tabMeta: Record<NavPageTab, { label: string; icon: React.ReactNode }> = {
    menu: { label: t("navMenu"), icon: <MenuIcon /> },
    stories: { label: t("navStories"), icon: <StoriesIcon /> },
  };

  return (
    <>
      <nav
        dir={direction}
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch md:hidden"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--divider)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
          fontFamily: "var(--font-body)",
        }}
        aria-label={t("navPrimary") || "Primary"}
      >
        {pageTabs.map((tab) => (
          <TabLink
            key={tab}
            href={tabPath(slug, tab)}
            label={tabMeta[tab].label}
            isActive={active === tab}
            icon={tabMeta[tab].icon}
          />
        ))}
        <button type="button" onClick={() => setAccountOpen(true)} className={tabClass} style={tabStyle(accountOpen)}>
          <span className="h-5 w-5">
            <AccountIcon />
          </span>
          <span>{t("accountMenuTitle")}</span>
        </button>
      </nav>

      <AccountSheet slug={slug} open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

const tabClass = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors";

function tabStyle(isActive: boolean) {
  return { color: isActive ? "var(--brand)" : "var(--text-muted)" };
}

function TabLink({
  href,
  label,
  isActive,
  icon,
}: {
  href: string;
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className={tabClass} style={tabStyle(isActive)} aria-current={isActive ? "page" : undefined}>
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

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
