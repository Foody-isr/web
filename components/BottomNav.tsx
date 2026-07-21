"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useCartStore } from "@/store/useCartStore";

export type BottomNavTab = "menu" | "stories" | "cart" | "orders";

interface BottomNavProps {
  /** Restaurant id-or-slug from the route (used to build links). */
  slug: string;
  active: BottomNavTab;
  /**
   * When provided (on the menu page), the Cart tab opens the cart drawer in place
   * instead of navigating. Elsewhere the Cart tab links to the menu with the cart
   * auto-opened.
   */
  onCartClick?: () => void;
}

/**
 * Mobile-only bottom navigation for the restaurant experience: Menu · Stories ·
 * Cart · Orders. Hidden from `md` up (desktop keeps the drawer + floating cart).
 */
export function BottomNav({ slug, active, onCartClick }: BottomNavProps) {
  const { t, direction } = useI18n();
  const totalItems = useCartStore((s) => s.lines.reduce((sum, l) => sum + l.quantity, 0));

  const base = `/r/${slug}`;

  return (
    <nav
      dir={direction}
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch md:hidden"
      style={{
        background: "var(--surface, #fff)",
        borderTop: "1px solid var(--divider, rgba(0,0,0,0.08))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
      }}
      aria-label={t("navPrimary") || "Primary"}
    >
      <TabLink href={`${base}/order`} label={t("navMenu") || "Menu"} isActive={active === "menu"} icon={<MenuIcon />} />
      <TabLink
        href={`${base}/stories`}
        label={t("navStories") || "Stories"}
        isActive={active === "stories"}
        icon={<StoriesIcon />}
      />
      <CartTab
        label={t("navCart") || "Cart"}
        isActive={active === "cart"}
        count={totalItems}
        href={`${base}/order?cart=open`}
        onCartClick={onCartClick}
      />
      <TabLink
        href={`${base}/orders`}
        label={t("navOrders") || "Orders"}
        isActive={active === "orders"}
        icon={<OrdersIcon />}
      />
    </nav>
  );
}

const tabClass = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors";

function tabStyle(isActive: boolean) {
  return { color: isActive ? "var(--brand)" : "var(--text-muted, rgba(0,0,0,0.55))" };
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

function CartTab({
  label,
  isActive,
  count,
  href,
  onCartClick,
}: {
  label: string;
  isActive: boolean;
  count: number;
  href: string;
  onCartClick?: () => void;
}) {
  const inner = (
    <>
      <span className="relative h-5 w-5">
        <CartIcon />
        {count > 0 && (
          <span
            className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: "var(--brand)" }}
          >
            {count}
          </span>
        )}
      </span>
      <span>{label}</span>
    </>
  );

  if (onCartClick) {
    return (
      <button type="button" onClick={onCartClick} className={tabClass} style={tabStyle(isActive)}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={tabClass} style={tabStyle(isActive)}>
      {inner}
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

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
      />
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
