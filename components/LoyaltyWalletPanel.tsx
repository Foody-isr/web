"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { loyaltyWebEnabled } from "@/lib/loyalty";
import { loyaltyWalletEnabled } from "@/lib/loyalty-wallet";
import { useGuestAccount } from "@/store/useGuestAccount";
import {
  ApiError,
  createGoogleLoyaltyWallet,
  fetchLoyaltyWallet,
  revokeLoyaltyWallet,
} from "@/services/api";
import type { LoyaltyMembership, LoyaltyWalletCard } from "@/lib/types";

const ownerChanged = (error: unknown) =>
  error instanceof ApiError &&
  (error.status === 401 || error.message === "wallet_session_changed");

/** Explain a native file-navigation failure without exposing a backend response. */
export function LoyaltyWalletNotice() {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get("wallet_result"));
  }, []);
  if (!loyaltyWebEnabled || !loyaltyWalletEnabled || !code) return null;
  return (
    <div
      role="alert"
      data-wallet-notice
      className="mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 border-s-2 border-[var(--brand)] ps-4 text-sm leading-6"
    >
      <p>
        {t(
          code === "wallet_session_changed" ||
            code === "wallet_sign_in_required"
            ? "walletSessionChanged"
            : code === "wallet_changed"
              ? "walletReview"
              : "walletFailure",
        )}
      </p>
      <button
        type="button"
        className="min-h-11 underline underline-offset-4"
        onClick={() => {
          const u = new URL(window.location.href);
          u.searchParams.delete("wallet_result");
          window.history.replaceState(
            window.history.state,
            "",
            u.pathname + u.search + u.hash,
          );
          setCode(null);
        }}
      >
        {t("walletDismiss")}
      </button>
    </div>
  );
}

/** Available provider actions are scoped to the displayed membership and account. */
export function LoyaltyWalletPanel(props: {
  restaurant: number;
  account: number;
  membership: LoyaltyMembership;
  refreshMembership: () => Promise<unknown>;
}) {
  if (!loyaltyWebEnabled || !loyaltyWalletEnabled) return null;
  return <WalletContent {...props} />;
}
function WalletContent({
  restaurant,
  account,
  membership,
  refreshMembership,
}: {
  restaurant: number;
  account: number;
  membership: LoyaltyMembership;
  refreshMembership: () => Promise<unknown>;
}) {
  const { t, locale } = useI18n(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<LoyaltyWalletCard | null>(null),
    [error, setError] = useState<string | null>(null),
    [appleHint, setAppleHint] = useState(false);
  const alive = useRef(true),
    locked = useRef(false),
    confirmationTrigger = useRef<HTMLButtonElement | null>(null),
    operation = useRef<AbortController | null>(null);
  const current = () =>
    alive.current &&
    useGuestAccount.getState().status === "authenticated" &&
    useGuestAccount.getState().account?.id === account;
  const key = [
    "loyalty-wallet",
    restaurant,
    account,
    membership.id,
    membership.program_id,
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchLoyaltyWallet(restaurant, account, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const coherent =
    query.data?.membership_id === membership.id &&
    query.data.program_id === membership.program_id;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current?.abort();
      client.removeQueries({
        queryKey: ["loyalty-wallet", restaurant, account],
        exact: false,
      });
    };
  }, [client, restaurant, account]);
  useEffect(() => {
    if (ownerChanged(query.error))
      void useGuestAccount.getState().hydrateSession();
  }, [query.error]);
  useEffect(() => {
    if (
      query.isSuccess &&
      confirm &&
      !query.data.cards.some((card) => card.id === confirm.id)
    )
      setConfirm(null);
  }, [query.isSuccess, query.data, confirm]);
  const handleFailure = (failure: unknown) => {
    if (!current()) return;
    setError(
      ownerChanged(failure)
        ? "walletSessionChanged"
        : failure instanceof ApiError && failure.status === 409
          ? "walletReview"
          : "walletFailure",
    );
    if (ownerChanged(failure)) void useGuestAccount.getState().hydrateSession();
  };
  const start = () => {
    if (locked.current || !current() || !coherent || query.isError) return null;
    locked.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    operation.current = controller;
    return controller;
  };
  const finish = () => {
    if (current()) {
      locked.current = false;
      setBusy(false);
    }
  };
  const addGoogle = async () => {
    const controller = start();
    if (!controller) return;
    try {
      const link = await createGoogleLoyaltyWallet(
        restaurant,
        account,
        { membership_id: membership.id, program_id: membership.program_id },
        controller.signal,
      );
      if (!current()) return;
      // Check the current cookie again after preparation; an old tab cannot open
      // the previous account's Google card after a session switch.
      const fresh = await fetchLoyaltyWallet(
        restaurant,
        account,
        controller.signal,
      );
      if (!current()) return;
      if (
        fresh.membership_id !== membership.id ||
        fresh.program_id !== membership.program_id ||
        !fresh.google
      )
        throw new ApiError("wallet_changed", 409);
      window.location.assign(link);
    } catch (failure) {
      handleFailure(failure);
    } finally {
      finish();
    }
  };
  const revoke = async () => {
    const card = confirm;
    if (!card) return;
    const controller = start();
    if (!controller) return;
    try {
      await revokeLoyaltyWallet(restaurant, account, card, controller.signal);
      if (!current()) return;
      setConfirm(null);
      await query.refetch();
    } catch (failure) {
      handleFailure(failure);
    } finally {
      finish();
    }
  };
  if (query.error instanceof ApiError && query.error.status === 404)
    return null;
  if (
    coherent &&
    query.data &&
    !query.data.apple &&
    !query.data.google &&
    !query.data.cards.length
  )
    return null;
  const ready = coherent && !query.isError && !busy && !query.isFetching;
  const enabled = membership.status === "active";
  return (
    <section
      data-loyalty-wallet
      aria-labelledby="loyalty-wallet-title"
      className="space-y-5 border-t border-[var(--divider)] py-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="loyalty-wallet-title" className="text-xl font-semibold">
          {t("walletTitle")}
        </h2>
        <button
          type="button"
          className="min-h-11 text-sm underline underline-offset-4 disabled:opacity-50"
          disabled={busy || query.isFetching}
          onClick={() => {
            setError(null);
            void Promise.all([query.refetch(), refreshMembership()]);
          }}
        >
          {t("loyaltyRefresh")}
        </button>
      </div>
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError || !coherent ? (
        <p role="alert">{t("walletReadError")}</p>
      ) : (
        <>
          {(query.data!.apple || query.data!.google) && enabled && (
            <>
              <p className="max-w-prose leading-7">{t("walletIntro")}</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {query.data!.apple && (
                  <form
                    action="/api/loyalty-wallet/apple"
                    method="POST"
                    data-wallet-apple
                    onSubmit={(event) => {
                      if (!ready || !current() || locked.current) {
                        event.preventDefault();
                        return;
                      }
                      setAppleHint(true);
                      setError(null);
                    }}
                  >
                    <input
                      type="hidden"
                      name="restaurant_id"
                      value={restaurant}
                    />
                    <input
                      type="hidden"
                      name="expected_account"
                      value={account}
                    />
                    <input
                      type="hidden"
                      name="membership_id"
                      value={membership.id}
                    />
                    <input
                      type="hidden"
                      name="program_id"
                      value={membership.program_id}
                    />
                    <input
                      type="hidden"
                      name="return_path"
                      value={
                        typeof window !== "undefined" &&
                        window.location.pathname.startsWith("/r/")
                          ? `/r/${restaurant}/account/loyalty`
                          : "/account/loyalty"
                      }
                    />
                    <button
                      type="submit"
                      disabled={!ready}
                      className="min-h-14 px-1 font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                    >
                      {t("walletAddApple")}
                    </button>
                  </form>
                )}
                {query.data!.google && (
                  <button
                    type="button"
                    data-wallet-google
                    disabled={!ready}
                    onClick={() => void addGoogle()}
                    aria-label={t("walletAddGoogle")}
                    className="inline-flex min-h-14 items-center rounded-xl bg-white p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                  >
                    {/* Official vendor SVG, with its proportions and localization intact. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/wallet/google-${locale}.svg`}
                      alt=""
                      className="h-14 w-auto max-w-full"
                    />
                  </button>
                )}
              </div>
              <p className="max-w-prose text-sm leading-6 text-[var(--text-muted)]">
                {t("walletPrivacy")}
              </p>
              {query.data!.apple && (
                <p className="max-w-prose text-sm leading-6 text-[var(--text-muted)]">
                  {t("walletAppleDevice")}
                </p>
              )}
            </>
          )}
          {!!query.data!.cards.length && (
            <div className="divide-y divide-[var(--divider)]">
              {query.data!.cards.map((card) => (
                <div
                  key={card.id}
                  data-wallet-card
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <p>
                    <span className="font-medium">
                      {card.platform === "apple"
                        ? "Apple Wallet"
                        : "Google Wallet"}
                    </span>
                    <span className="block text-sm text-[var(--text-muted)]">
                      {t(
                        !enabled
                          ? "walletInactive"
                          : card.pending
                            ? "walletPending"
                            : "walletPrepared",
                      )}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={(event) => {
                      confirmationTrigger.current = event.currentTarget;
                      setConfirm(card);
                      setError(null);
                    }}
                    className="min-h-11 text-sm underline underline-offset-4 disabled:opacity-50"
                  >
                    {t("walletRevoke")}
                  </button>
                </div>
              ))}
              <p className="pt-3 text-sm leading-6 text-[var(--text-muted)]">
                {t("walletPreparedHint")}
              </p>
            </div>
          )}
        </>
      )}
      {confirm && (
        <div
          data-wallet-confirm
          className="max-w-prose space-y-3 border-s-2 border-[var(--brand)] ps-4"
        >
          <p className="font-medium">
            {t("walletRevokeTitle").replace(
              "{platform}",
              confirm.platform === "apple" ? "Apple Wallet" : "Google Wallet",
            )}
          </p>
          <p className="text-sm leading-6">{t("walletRevokeHint")}</p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={!ready}
              className="min-h-11 font-semibold underline underline-offset-4 disabled:opacity-50"
              onClick={() => void revoke()}
            >
              {t("walletConfirmRevoke")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 underline underline-offset-4"
              onClick={() => {
                setConfirm(null);
                confirmationTrigger.current?.focus();
              }}
            >
              {t("walletCancel")}
            </button>
          </div>
        </div>
      )}
      {busy && (
        <p role="status" className="text-sm">
          {t("walletWorking")}
        </p>
      )}
      {appleHint && !error && (
        <p role="status" className="text-sm">
          {t("walletAppleHint")}
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-prose text-sm leading-6">
          {t(error)}
        </p>
      )}
    </section>
  );
}
