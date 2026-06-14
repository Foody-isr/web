"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useGuestAccount } from "@/store/useGuestAccount";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { OrderHistorySheet } from "@/components/OrderHistorySheet";
import { fetchMe, GuestOrder } from "@/services/api";

/**
 * Persistent guest account control for the TopBar. Signed out → a person-icon
 * button opening a sign-in popover (Google). Signed in → avatar + dropdown with
 * "My orders" (reorder) and "Sign out". Shares the global useGuestAccount
 * session, so signing in here also enables AI-assistant reorder, and vice versa.
 */
export function GuestAccountMenu({
  restaurantId,
  currency,
  onReorder,
  buttonClassName,
}: {
  restaurantId: string;
  currency: string;
  onReorder: (order: GuestOrder) => void;
  buttonClassName?: string;
}) {
  const { t, direction } = useI18n();
  const account = useGuestAccount((s) => s.account);
  const token = useGuestAccount((s) => s.token);
  const setAccount = useGuestAccount((s) => s.setAccount);
  const signOut = useGuestAccount((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Refresh the cached account once signed in (picks up phone backfilled from
  // past orders, for checkout autofill).
  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then((a) => a && setAccount(a))
      .catch(() => {});
  }, [token, setAccount]);

  const initials = (account?.name || account?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
        aria-label={t("accountMenuTitle") || "Account"}
      >
        {account?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.picture} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : account ? (
          <span className="w-7 h-7 rounded-full bg-[var(--brand)] text-white text-xs font-bold flex items-center justify-center">
            {initials}
          </span>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute z-[61] mt-2 right-0 rtl:right-auto rtl:left-0 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-2"
            dir={direction}
          >
            {account ? (
              <>
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-slate-900 truncate">{account.name}</div>
                  <div className="text-xs text-slate-500 truncate">{account.email}</div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setHistoryOpen(true);
                  }}
                  className="w-full text-start px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                >
                  {t("accountMyOrders") || "My orders"}
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="w-full text-start px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-rose-600"
                >
                  {t("accountSignOut") || "Sign out"}
                </button>
              </>
            ) : (
              <div className="px-2 py-2 space-y-2.5">
                <p className="text-xs text-slate-500 px-1 leading-relaxed">
                  {t("accountSignInHint") || "Sign in to find your past orders and check out faster."}
                </p>
                <GoogleSignIn onSignedIn={() => setOpen(false)} />
              </div>
            )}
          </div>
        </>
      )}

      <OrderHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        restaurantId={restaurantId}
        currency={currency}
        onReorder={(o) => {
          setHistoryOpen(false);
          onReorder(o);
        }}
      />
    </div>
  );
}
