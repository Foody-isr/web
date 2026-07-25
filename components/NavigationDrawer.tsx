"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useGuestAccount } from "@/store/useGuestAccount";
import { LanguageToggle } from "@/components/LanguageToggle";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { OrderHistorySheet } from "@/components/OrderHistorySheet";
import type { GuestOrder } from "@/services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  /** Currency for the order-history sheet. Defaults to ILS. */
  currency?: string;
  /** Reorder handler — adds a past order to the cart. When omitted (e.g. on the
   *  marketing landing where there's no cart), reorder routes to the menu. */
  onReorder?: (order: GuestOrder) => void;
};

export function NavigationDrawer({ open, onClose, restaurant, currency, onReorder }: Props) {
  const { t, direction } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const slug = restaurant.slug || String(restaurant.id);
  const restaurantId = String(restaurant.id);

  // Single guest identity — the Google account (shared with the top-bar menu,
  // checkout prefill and the AI reorder assistant).
  const account = useGuestAccount((s) => s.account);
  const signOut = useGuestAccount((s) => s.signOut);

  const [historyOpen, setHistoryOpen] = useState(false);

  // Close the order-history sheet whenever the drawer itself closes.
  useEffect(() => {
    if (!open) setHistoryOpen(false);
  }, [open]);

  const isRTL = direction === "rtl";
  const slideFrom = isRTL ? "100%" : "-100%";

  // When the restaurant has opted out of the marketing landing page, the
  // /r/<slug> route redirects to /order anyway — so listing "Home" and "Menu"
  // in the drawer would be circular navigation. Custom pages disappear too
  // (they only made sense alongside a real landing). My Orders + Sign In stay
  // because they're functional, not page-navigation.
  const landingEnabled = restaurant.websiteConfig?.landingEnabled !== false;

  // Custom pages come from the website config and work regardless of the
  // landing toggle — an order-only site can still have About/Contact pages
  // reachable from the hamburger.
  const customPages = (restaurant.websiteConfig?.pages || [])
    .filter((p) => p.showInNav !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Catering nav: shown whenever the feature is on. A catering-only restaurant
  // (effective only when the feature is actually enabled) has no classic menu,
  // so the Menu link is dropped for it.
  const cateringEnabled = restaurant.cateringEnabled === true;
  const effectiveCateringOnly = cateringEnabled && restaurant.cateringOnly === true;

  const pageIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );

  const pageNavLinks = [
    // Home only when there's a real landing page to go to.
    ...(landingEnabled
      ? [
          {
            label: "Home",
            href: `/r/${slug}`,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ),
          },
        ]
      : []),
    // Menu — hidden for catering-only restaurants (no classic menu).
    ...(effectiveCateringOnly
      ? []
      : [
          {
            label: "Menu",
            href: `/r/${slug}/order`,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
          },
        ]),
    // Catering — shown whenever the catering feature is enabled.
    ...(cateringEnabled
      ? [
          {
            label: t("navCatering") || "Catering",
            href: `/r/${slug}/catering`,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2M5 21h14M4 21a8 8 0 0116 0M7 8h.01M12 8h.01M17 8h.01" />
              </svg>
            ),
          },
        ]
      : []),
    {
      label: t("navStories") || "Stories",
      href: `/r/${slug}/stories`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="16" rx="3" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9l5 3-5 3V9z" />
        </svg>
      ),
    },
    ...customPages.map((page) => ({
      label: page.label,
      href: `/r/${slug}/${page.slug}`,
      icon: pageIcon,
    })),
  ];

  const ordersIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );

  const handleReorder = (order: GuestOrder) => {
    setHistoryOpen(false);
    onClose();
    if (onReorder) {
      onReorder(order);
    } else {
      // No cart in this context (e.g. landing) — take the guest to the menu.
      router.push(`/r/${slug}/order`);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Drawer panel */}
            <motion.div
              key="nav-drawer"
              initial={{ x: slideFrom }}
              animate={{ x: 0 }}
              exit={{ x: slideFrom }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={`fixed top-0 ${isRTL ? "right-0" : "left-0"} bottom-0 z-[60] w-[80vw] max-w-[320px] bg-[var(--surface)] flex flex-col shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-6 pb-4">
                  {restaurant.logoUrl ? (
                    <Image
                      src={restaurant.logoUrl}
                      alt={restaurant.name}
                      width={44}
                      height={44}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-white font-bold text-lg">
                      {restaurant.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-[var(--text)] truncate">{restaurant.name}</h2>
                    {account && (
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {account.name || account.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] transition"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="h-px bg-[var(--divider)] mx-5" />

                {/* Auth section — single Google identity, shared with the top bar */}
                <div className="px-5 py-4">
                  {account ? (
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-3 w-full text-sm text-[var(--text-muted)] hover:text-red-500 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t("accountSignOut") || "Sign out"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {t("accountSignInHint") || "Sign in to find your past orders and check out faster."}
                      </p>
                      <GoogleSignIn />
                    </div>
                  )}
                </div>

                <div className="h-px bg-[var(--divider)] mx-5" />

                {/* Nav links */}
                <nav className="flex-1 px-3 py-3">
                  {pageNavLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                          isActive
                            ? "bg-brand/10 text-brand"
                            : "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                        }`}
                      >
                        {link.icon}
                        {link.label}
                      </Link>
                    );
                  })}

                  {/* My Orders — opens the same history sheet as the top bar */}
                  <button
                    onClick={() => setHistoryOpen(true)}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-subtle)] transition text-start"
                  >
                    {ordersIcon}
                    {t("accountMyOrders") || "My Orders"}
                  </button>
                </nav>

                {/* Language toggle at bottom */}
                <div className="px-5 py-4 border-t border-[var(--divider)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Language</span>
                    <LanguageToggle />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <OrderHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        restaurantId={restaurantId}
        currency={currency || "ILS"}
        onReorder={handleReorder}
      />
    </>
  );
}
