"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Restaurant } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { buildSystemNavItems } from "@/lib/systemNav";
import { useGuestAccount } from "@/store/useGuestAccount";
import { LanguageToggle } from "@/components/LanguageToggle";
import { GoogleSignIn } from "@/components/GoogleSignIn";

type Props = {
  open: boolean;
  onClose: () => void;
  restaurant: Restaurant;
};

export function NavigationDrawer({ open, onClose, restaurant }: Props) {
  const { t, direction } = useI18n();
  const pathname = usePathname();

  // Single guest identity — the Google account (shared with the top-bar menu,
  // checkout prefill and the AI reorder assistant).
  const account = useGuestAccount((s) => s.account);
  const signOut = useGuestAccount((s) => s.signOut);

  const isRTL = direction === "rtl";
  const slideFrom = isRTL ? "100%" : "-100%";

  const pageIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );

  const navLinks = buildSystemNavItems(restaurant, {
    stories: t("navStories") || "Stories",
    orders: t("accountMyOrders") || "My Orders",
  });

  const ordersIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );

  return (
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
                  {navLinks.map((link) => {
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
                        {link.key === "orders" ? ordersIcon : pageIcon}
                        {link.label}
                      </Link>
                    );
                  })}
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
  );
}
