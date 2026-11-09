"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useCartStore } from "@/store/useCartStore";
import { loyaltyWebEnabled } from "@/lib/loyalty";
import {
  clearLoyaltyCheckout,
  estimateLoyaltyReward,
  loyaltyCheckoutEnabled,
  loyaltyFingerprint,
  loyaltyPayloadFingerprint,
  readLoyaltyCheckout,
  saveLoyaltyCheckout,
  type LoyaltyCheckoutIntent,
} from "@/lib/loyalty-checkout";
import {
  ApiError,
  cancelLoyaltyCheckout,
  fetchLoyaltyCheckout,
  fetchLoyaltyRewards,
} from "@/services/api";
import type {
  CartLine,
  LoyaltyCustomerReward,
  OrderPayload,
  OrderResponse,
} from "@/lib/types";

interface Input {
  restaurant: number;
  account?: number;
  enabled: boolean;
  compatible: boolean;
  currency: string;
  lines: CartLine[];
  fee: number;
  onRecovered: (order: OrderResponse, requestId?: string) => void;
}

/** Scope selection, exact creation intent and safe recovery to the current buyer. */
export function useLoyaltyCheckout(input: Input) {
  const { t, locale } = useI18n(),
    client = useQueryClient();
  const active =
    loyaltyWebEnabled &&
    loyaltyCheckoutEnabled &&
    input.enabled &&
    !!input.account;
  const context = active
    ? JSON.stringify([
        input.restaurant,
        input.account,
        input.currency,
        input.fee,
        input.compatible,
        input.lines,
      ])
    : "";
  const [selected, setSelected] = useState<{
    reward: LoyaltyCustomerReward;
    context: string;
    account: number;
  } | null>(null);
  const [pending, setPendingState] = useState<LoyaltyCheckoutIntent | null>(
      null,
    ),
    pendingRef = useRef<LoyaltyCheckoutIntent | null>(null);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const submission = useRef<string | null>(null);
  const lock = useRef(false),
    alive = useRef(true);
  const setPending = (value: LoyaltyCheckoutIntent | null) => {
    pendingRef.current = value;
    setPendingState(value);
  };
  const queryKey = [
    "loyalty-checkout-rewards",
    input.restaurant,
    input.account,
  ];
  const rights = useInfiniteQuery({
    queryKey: queryKey,
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      fetchLoyaltyRewards(input.restaurant, input.account!, pageParam, signal),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: active && input.compatible,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    alive.current = true;
    setReady(false);
    setSelected(null);
    setPending(null);
    setStorageError(false);
    setNotice("");
    lock.current = false;
    submission.current = null;
    setBusy(false);
    if (active) {
      try {
        setPending(
          readLoyaltyCheckout(sessionStorage, input.restaurant, input.account!),
        );
      } catch {
        setStorageError(true);
      }
    }
    setReady(true);
    return () => {
      alive.current = false;
      client.removeQueries({
        queryKey: ["loyalty-checkout-rewards", input.restaurant, input.account],
        exact: true,
      });
    };
  }, [active, input.restaurant, input.account, client]);
  const pages = rights.data?.pages,
    first = pages?.[0];
  const coherent =
    !!pages &&
    pages.every(
      (p) =>
        p.membership_id === first?.membership_id &&
        p.program_id === first?.program_id &&
        p.membership_revision === first?.membership_revision,
    );
  const rewards = pages?.flatMap((p) => p.rewards) ?? [];
  const current =
    selected &&
    selected.context === context &&
    selected.account === input.account
      ? rewards.find(
          (r) =>
            r.id === selected.reward.id &&
            r.revision === selected.reward.revision,
        )
      : undefined;
  const estimate =
    current && coherent && !rights.isError && input.compatible
      ? estimateLoyaltyReward(current, input.lines, input.fee, input.currency)
      : null;
  const ownerCurrent = () =>
    useGuestAccount.getState().status === "authenticated" &&
    useGuestAccount.getState().account?.id === input.account;
  const scope = useRef({
    restaurant: input.restaurant,
    account: input.account,
  });
  scope.current = { restaurant: input.restaurant, account: input.account };
  const sameScope = (rid: number, account: number) =>
    alive.current &&
    scope.current.restaurant === rid &&
    scope.current.account === account &&
    useGuestAccount.getState().account?.id === account;
  const refresh = () =>
    client.resetQueries({ queryKey: queryKey, exact: true });
  const acknowledge = (saved: LoyaltyCheckoutIntent) => {
    clearLoyaltyCheckout(sessionStorage, saved);
    if (pendingRef.current?.selection.request_id === saved.selection.request_id)
      setPending(null);
  };
  const recover = async (cancel: boolean) => {
    const saved = pendingRef.current;
    if (!saved || lock.current || !ownerCurrent()) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      let found: OrderResponse | undefined;
      if (cancel) {
        const result = await cancelLoyaltyCheckout(
          saved.restaurant,
          saved.account,
          saved.selection.request_id,
        );
        found = result.order;
        if (!sameScope(saved.restaurant, saved.account)) return;
        if (result.cancelled) {
          acknowledge(saved);
          setSelected(null);
          setNotice("loyaltyCheckoutAbandoned");
          await refresh();
          return;
        }
      } else
        found = await fetchLoyaltyCheckout(
          saved.restaurant,
          saved.account,
          saved.selection.request_id,
        );
      if (found && sameScope(saved.restaurant, saved.account)) {
        try {
          acknowledge(saved);
        } catch {
          setStorageError(true);
        }
        input.onRecovered(found, saved.selection.request_id);
      }
    } catch (error) {
      if (sameScope(saved.restaurant, saved.account)) {
        if (error instanceof ApiError && error.status === 410) {
          try {
            acknowledge(saved);
          } catch {
            setStorageError(true);
          }
          setSelected(null);
          setNotice("loyaltyCheckoutAbandoned");
        } else if (error instanceof ApiError && error.status === 404)
          setNotice("loyaltyCheckoutNotFound");
        else setNotice("loyaltyCheckoutUnknown");
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.message === "loyalty_session_changed")
        )
          void useGuestAccount.getState().hydrateSession();
      }
    } finally {
      if (sameScope(saved.restaurant, saved.account)) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const prepare = async (payload: OrderPayload) => {
    if (!active) {
      if (selected || pendingRef.current)
        throw new Error(t("loyaltyCheckoutReview"));
      return { payload, options: undefined, operationId: undefined };
    }
    if (!ready || storageError || pendingRef.current || lock.current)
      throw new Error(t("loyaltyCheckoutPending"));
    if (!selected)
      return { payload, options: undefined, operationId: undefined };
    if (!estimate || !current || !ownerCurrent())
      throw new Error(t("loyaltyCheckoutReview"));
    const account = input.account!,
      restaurant = input.restaurant;
    lock.current = true;
    setBusy(true);
    const selection = {
      request_id: crypto.randomUUID(),
      reward_id: current.id,
      reward_revision: current.revision,
      expected_reduction_minor: estimate.reductionMinor,
      expected_total_minor: estimate.totalMinor,
    };
    submission.current = selection.request_id;
    let cartFingerprint: string;
    try {
      cartFingerprint = await loyaltyFingerprint(input.lines);
    } catch (error) {
      if (
        submission.current === selection.request_id &&
        sameScope(restaurant, account)
      ) {
        lock.current = false;
        setBusy(false);
        setStorageError(true);
      }
      throw error;
    }

    const options = {
      account,
      beforeSend: async (wire: string) => {
        if (!sameScope(restaurant, account))
          throw new Error(t("loyaltySessionChanged"));
        const saved: LoyaltyCheckoutIntent = {
          version: 1,
          restaurant,
          account,
          selection,
          payload_fingerprint: await loyaltyPayloadFingerprint(wire),
          cart_fingerprint: cartFingerprint,
        };
        if (!sameScope(restaurant, account))
          throw new Error(t("loyaltySessionChanged"));
        try {
          saveLoyaltyCheckout(sessionStorage, saved);
          setPending(saved);
        } catch {
          setStorageError(true);
          throw new Error(t("loyaltyCheckoutStorage"));
        }
      },
    };
    return {
      payload: { ...payload, loyaltyReward: selection },
      options,
      operationId: selection.request_id,
    };
  };
  const complete = async (id: string) => {
    const saved = pendingRef.current;
    if (
      !saved ||
      saved.selection.request_id !== id ||
      submission.current !== id
    )
      return false;
    const sameCart =
      saved.cart_fingerprint ===
      (await loyaltyFingerprint(useCartStore.getState().lines));
    if (!sameScope(saved.restaurant, saved.account)) return false;
    try {
      acknowledge(saved);
    } catch {
      setStorageError(true);
    }
    lock.current = false;
    setBusy(false);
    return sameCart;
  };
  const failed = (id?: string) => {
    if (
      !id ||
      submission.current !== id ||
      !sameScope(input.restaurant, input.account!)
    )
      return;
    submission.current = null;
    lock.current = false;
    setBusy(false);
    if (pendingRef.current) setNotice("loyaltyCheckoutUnknown");
  };
  const select = (reward: LoyaltyCustomerReward | null) => {
    if (lock.current || pendingRef.current) return;
    setSelected(reward ? { reward, context, account: input.account! } : null);
    setNotice("");
  };
  let controls: ReactNode = null;
  if (
    active &&
    (pending ||
      storageError ||
      first?.membership_id ||
      rights.isError ||
      selected)
  )
    controls = (
      <section
        data-loyalty-checkout
        aria-label={t("loyaltyCheckoutTitle")}
        className="space-y-4 border-t border-[var(--divider)] pt-6"
      >
        <h3 className="font-semibold">{t("loyaltyCheckoutTitle")}</h3>
        {notice && (
          <p role="status" className="text-sm leading-6">
            {t(notice)}
          </p>
        )}
        {storageError ? (
          <p role="alert">{t("loyaltyCheckoutStorage")}</p>
        ) : pending ? (
          <div className="space-y-4">
            <p className="text-sm leading-6">{t("loyaltyCheckoutPending")}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="commerce-secondary"
                disabled={busy}
                onClick={() => void recover(false)}
              >
                {t("loyaltyCheckoutCheck")}
              </button>
              <button
                type="button"
                className="commerce-secondary"
                disabled={busy}
                onClick={() => void recover(true)}
              >
                {t("loyaltyCheckoutAbandon")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {!input.compatible && (
              <p className="text-sm leading-6">
                {t("loyaltyCheckoutCompatible")}
              </p>
            )}
            {rights.isError || (!coherent && rights.isSuccess) ? (
              <p role="alert">{t("loyaltyReadError")}</p>
            ) : rights.isPending ? (
              <p role="status">{t("loading")}</p>
            ) : null}
            {selected && !estimate && (
              <p role="alert">{t("loyaltyCheckoutReview")}</p>
            )}
            <fieldset disabled={busy}>
              <legend className="sr-only">{t("loyaltyCheckoutTitle")}</legend>
              <label className="flex min-h-11 items-center gap-3 py-2">
                <input
                  className="size-4 shrink-0 accent-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                  type="radio"
                  name="loyalty-checkout-reward"
                  checked={selected === null}
                  onChange={() => select(null)}
                />
                <span>{t("loyaltyCheckoutNone")}</span>
              </label>
              {coherent &&
                !rights.isError &&
                input.compatible &&
                rewards.map((reward) => {
                  const quote = estimateLoyaltyReward(
                    reward,
                    input.lines,
                    input.fee,
                    input.currency,
                  );
                  if (!quote) return null;
                  const name =
                    reward.rules.reward_type === "fixed"
                      ? t("loyaltyRewardFixed").replace(
                          "{amount}",
                          new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: reward.rules.currency,
                          }).format(reward.rules.reward_amount_minor / 100),
                        )
                      : reward.product
                        ? reward.product.names[locale] +
                          (reward.product.variant_names
                            ? ` · ${reward.product.variant_names[locale]}`
                            : "")
                        : t("loyaltyRewardItem");
                  return (
                    <label
                      key={reward.id}
                      className="flex min-h-11 items-start gap-3 py-3"
                    >
                      <input
                        className="mt-1 size-4 shrink-0 accent-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]"
                        type="radio"
                        name="loyalty-checkout-reward"
                        checked={!!estimate && current?.id === reward.id}
                        onChange={() => select(reward)}
                      />
                      <span className="min-w-0 break-words">{name}</span>
                    </label>
                  );
                })}
            </fieldset>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              {t("loyaltyCheckoutEstimate")}
            </p>
            {coherent &&
              !rights.isError &&
              input.compatible &&
              rewards.every(
                (r) =>
                  !estimateLoyaltyReward(
                    r,
                    input.lines,
                    input.fee,
                    input.currency,
                  ),
              ) && (
                <p className="text-sm leading-6">
                  {t("loyaltyCheckoutNoApplicable")}
                </p>
              )}
            {estimate?.totalMinor === 0 && (
              <p className="text-sm leading-6">{t("loyaltyCheckoutCovered")}</p>
            )}

            {rights.hasNextPage && (
              <button
                type="button"
                className="commerce-secondary"
                disabled={busy || rights.isFetching}
                onClick={() => void rights.fetchNextPage()}
              >
                {t("loyaltyRewardsMore")}
              </button>
            )}
            <button
              type="button"
              className="inline-flex min-h-11 items-center py-2 text-sm underline underline-offset-4"
              disabled={busy || rights.isFetching}
              onClick={() => void refresh()}
            >
              {t("loyaltyRefresh")}
            </button>
          </>
        )}
      </section>
    );
  return {
    discountMinor: estimate?.reductionMinor ?? 0,
    selectedAccount: selected?.account,
    selected: !!selected,
    controls,
    prepare,
    complete,
    failed,
    blocked:
      active &&
      (!ready ||
        storageError ||
        !!pending ||
        busy ||
        (!!selected && !estimate)),
  };
}
