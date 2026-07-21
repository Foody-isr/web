"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { AccountSheet } from "@/components/AccountSheet";

export type BottomNavTab = "menu" | "stories" | "orders";

interface BottomNavProps {
  /** Restaurant id-or-slug from the route (used to build links). */
  slug: string;
  active: BottomNavTab;
}

/**
 * Mobile-only bottom navigation for the restaurant experience:
 * Menu · Stories · Orders · Compte. Hidden from `md` up (desktop keeps the
 * hamburger drawer + profile menu). The cart is reached via the floating cart
 * dock (which sits just above this bar), so there is no cart tab here.
 * The Compte tab opens the AccountSheet (account, language, home, custom pages).
 */
export function BottomNav({ slug, active }: BottomNavProps) {
  const { t, direction } = useI18n();
  const base = `/r/${slug}`;
  const [accountOpen, setAccountOpen] = useState(false);

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
        <TabLink href={`${base}/order`} label={t("navMenu")} isActive={active === "menu"} icon={<MenuIcon />} />
        <TabLink href={`${base}/stories`} label={t("navStories")} isActive={active === "stories"} icon={<StoriesIcon />} />
        <TabLink href={`${base}/orders`} label={t("navOrders")} isActive={active === "orders"} icon={<OrdersIcon />} />
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

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
