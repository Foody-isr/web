"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, fetchLoyaltyRewards } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";
import { useI18n } from "@/lib/i18n";
import type { LoyaltyCustomerReward, Restaurant } from "@/lib/types";

const statusCopy = {
  available: "loyaltyRewardAvailable",
  reserved: "loyaltyRewardReserved",
  redeemed: "loyaltyRewardRedeemed",
  expired: "loyaltyRewardExpired",
  revoked: "loyaltyRewardRevoked",
} as const;
const blockedCopy = {
  membership_closed: "loyaltyClosed",
  negative_balance: "loyaltyRewardDebt",
  currency_changed: "loyaltyReview",
  terms_changed: "loyaltyReview",
  program_paused: "loyaltyRewardPaused",
  product_unavailable: "loyaltyRewardProductUnavailable",
} as const;

/** Show actual issued rights, independently from the membership's remaining progress. */
export function LoyaltyRewardsPanel({
  restaurant,
  account,
  membership,
  program,
}: {
  restaurant: Restaurant;
  account: number;
  membership: string;
  program: string;
}) {
  const { t, locale } = useI18n(),
    client = useQueryClient();
  const key = ["loyalty-rewards", restaurant.id, account, membership, program];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: "",
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchLoyaltyRewards(restaurant.id, account, pageParam, signal),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchOnWindowFocus: false,
  });
  useEffect(
    () => () => {
      client.removeQueries({
        queryKey: ["loyalty-rewards", restaurant.id, account],
        exact: false,
      });
    },
    [client, restaurant.id, account],
  );
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      (query.error.status === 401 ||
        query.error.message === "loyalty_session_changed")
    )
      void useGuestAccount.getState().hydrateSession();
  }, [query.error]);
  const pages = query.data?.pages;
  const coherent = pages?.every(
    (p) =>
      p.membership_id === membership &&
      p.program_id === program &&
      p.membership_revision === pages[0].membership_revision,
  );
  const rewards = pages?.flatMap((p) => p.rewards) ?? [];
  const unique = new Set(rewards.map((r) => r.id)).size === rewards.length;
  const refresh = () => client.resetQueries({ queryKey: key, exact: true });
  return (
    <section
      aria-labelledby="loyalty-rewards-title"
      data-loyalty-rewards
      className="space-y-5 border-t border-[var(--divider)] pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="loyalty-rewards-title" className="text-xl font-semibold">
          {t("loyaltyRewards")}
        </h2>
        <button
          className="inline-flex min-h-11 items-center py-2 text-sm underline underline-offset-4"
          disabled={query.isFetching}
          onClick={() => void refresh()}
        >
          {t("loyaltyRefresh")}
        </button>
      </div>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        {t("loyaltyRewardsHint")}
      </p>
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError ? (
        <p role="alert">{t("loyaltyReadError")}</p>
      ) : !coherent || !unique ? (
        <p role="alert">{t("loyaltyRewardsChanged")}</p>
      ) : rewards.length === 0 ? (
        <p>{t("loyaltyRewardsEmpty")}</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--divider)]">
            {rewards.map((r) => (
              <RewardRow key={r.id} reward={r} timeZone={restaurant.timezone} />
            ))}
          </ul>
          {query.hasNextPage && (
            <button
              className="commerce-secondary"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              {t(query.isFetchingNextPage ? "loading" : "loyaltyRewardsMore")}
            </button>
          )}
          <p className="text-xs leading-6 text-[var(--text-muted)]">
            {t("loyaltyRewardsAsOf").replace(
              "{date}",
              new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: restaurant.timezone,
              }).format(new Date(pages![pages!.length - 1].as_of)),
            )}
          </p>
        </>
      )}
    </section>
  );
}

function RewardRow({
  reward: r,
  timeZone,
}: {
  reward: LoyaltyCustomerReward;
  timeZone?: string;
}) {
  const { t, locale } = useI18n(),
    product = r.product;
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: r.rules.currency,
  }).format(r.rules.reward_amount_minor / 100);
  const title =
    r.rules.reward_type === "fixed"
      ? t("loyaltyRewardFixed").replace("{amount}", amount)
      : product
        ? product.names[locale] +
          (product.variant_names ? ` · ${product.variant_names[locale]}` : "")
        : t("loyaltyRewardItem");
  const reason =
    r.blocked_reason in blockedCopy
      ? blockedCopy[r.blocked_reason as keyof typeof blockedCopy]
      : null;
  return (
    <li className="min-w-0 space-y-3 py-5" data-loyalty-reward={r.id}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <h3 className="min-w-0 break-words font-semibold">{title}</h3>
        <span className="text-sm font-medium">{t(statusCopy[r.status])}</span>
      </div>
      {r.rules.reward_type === "item" && (
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          {t("loyaltyRewardItemDetails")}
        </p>
      )}
      {r.status === "reserved" && (
        <p className="text-sm leading-6">{t("loyaltyRewardPendingPayment")}</p>
      )}
      {reason && <p className="text-sm leading-6">{t(reason)}</p>}
      {r.expires_at && (
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          {t("loyaltyRewardExpires").replace(
            "{date}",
            new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone,
            }).format(new Date(r.expires_at)),
          )}
        </p>
      )}
    </li>
  );
}
