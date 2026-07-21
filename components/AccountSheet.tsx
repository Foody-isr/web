"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useGuestAccount } from "@/store/useGuestAccount";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { LanguageToggle } from "@/components/LanguageToggle";
import { fetchRestaurant } from "@/services/api";

/**
 * Mobile "Compte" bottom sheet opened from the bottom nav. Profile-focused:
 * account (sign in/out), My orders, and language. The restaurant's extra pages
 * (Home + custom pages like "MAMIE Story") live behind a "More" expander so the
 * account view stays clean. Mobile-only (the bottom nav is `md:hidden`).
 */
export function AccountSheet({
  slug,
  open,
  onClose,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, direction } = useI18n();
  const account = useGuestAccount((s) => s.account);
  const signOut = useGuestAccount((s) => s.signOut);
  const [moreOpen, setMoreOpen] = useState(false);

  // Custom pages + landing flag. Fetched lazily when the sheet opens; shares the
  // ["restaurant", slug] cache with BottomNav (single request).
  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", slug],
    queryFn: () => fetchRestaurant(slug),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  if (!open) return null;

  const landingEnabled = restaurant?.websiteConfig?.landingEnabled !== false;
  const pages = (restaurant?.websiteConfig?.pages || [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const hasMore = landingEnabled || pages.length > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center md:hidden"
      dir={direction}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-2xl"
        style={{ background: "var(--surface)", color: "var(--text)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--divider)" }}
        >
          <h2 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {t("accountMenuTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: "var(--text-muted)" }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {/* Account */}
          {account ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{account.name}</div>
                <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {account.email}
                </div>
              </div>
              <button onClick={() => signOut()} className="shrink-0 text-sm font-medium text-rose-600">
                {t("accountSignOut")}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t("accountSignInHint")}
              </p>
              <GoogleSignIn onSignedIn={onClose} />
            </div>
          )}

          <div className="space-y-1 border-t pt-3" style={{ borderColor: "var(--divider)" }}>
            {/* My orders */}
            <SheetRow href={`/r/${slug}/orders`} label={t("accountMyOrders")} onClose={onClose} icon={<OrdersIcon />} />

            {/* More: Home + custom pages, tucked away so account stays clean */}
            {hasMore && (
              <>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium"
                  style={{ color: "var(--text)" }}
                  aria-expanded={moreOpen}
                >
                  <span className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }}>
                    <MoreIcon />
                  </span>
                  <span>{t("more")}</span>
                  <span
                    className={`ms-auto transition-transform ${moreOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    <ChevronIcon />
                  </span>
                </button>
                {moreOpen && (
                  <div className="ps-6">
                    {landingEnabled && (
                      <SheetRow href={`/r/${slug}`} label={t("navHome")} onClose={onClose} icon={<PageIcon />} />
                    )}
                    {pages.map((p) => (
                      <SheetRow
                        key={p.slug}
                        href={`/r/${slug}/${p.slug}`}
                        label={p.label}
                        onClose={onClose}
                        icon={<PageIcon />}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* UI language */}
          <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--divider)" }}>
            <span className="text-sm font-medium">{t("language")}</span>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetRow({
  href,
  label,
  onClose,
  icon,
}: {
  href: string;
  label: string;
  onClose: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors"
      style={{ color: "var(--text)" }}
    >
      <span className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }}>
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-full w-full">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
