"use client";

import { BuildingStorefrontIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildChainBranchOrderHref } from "@/lib/chainRouting";
import { useI18n } from "@/lib/i18n";
import { websiteOrderCopy } from "@/lib/websiteOrder";
import { fetchChainOrderEntry, type ChainOrderBranch } from "@/services/api";
import { useCartStore } from "@/store/useCartStore";

/** Offers pickup locations from the public chain directory in the location panel. */
export function WebsitePickupBranches({ chainSlug, restaurantId, onNavigate }: {
  chainSlug: string;
  restaurantId: number;
  onNavigate: () => void;
}) {
  const { locale, t } = useI18n();
  const copy = websiteOrderCopy(locale);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<ChainOrderBranch | null>(null);
  const directory = useQuery({
    queryKey: ["website-pickup-branches", chainSlug],
    queryFn: () => fetchChainOrderEntry(chainSlug, "pickup"),
  });
  const needle = search.trim().toLocaleLowerCase(locale);
  const matches = directory.data?.branches.filter(branch => branch.pickupEnabled && !branch.ordersPaused &&
    branch.restaurantId !== restaurantId && `${branch.name} ${branch.address ?? ""}`.toLocaleLowerCase(locale).includes(needle)) ?? [];

  function navigate(branch: ChainOrderBranch, discardCart: boolean) {
    const cart = useCartStore.getState();
    if (cart.lines.length > 0 && cart.restaurantId !== String(branch.restaurantId)) {
      if (!discardCart) {
        setPending(branch);
        return;
      }
      cart.clear();
    }
    onNavigate();
    router.push(buildChainBranchOrderHref({
      slug: branch.slug,
      restaurantId: branch.restaurantId,
      primaryRestaurantId: directory.data?.chain.primaryRestaurantId,
      orderType: "pickup",
      locale,
    }));
  }

  return (
    <section className="website-pickup-branches" aria-label={copy.changeBranch}>
      <label>{copy.changeBranch}
        <input type="search" value={search} placeholder={copy.searchBranch} onChange={event => { setSearch(event.target.value); setPending(null); }} />
      </label>
      {directory.isPending && <p role="status">{t("loading")}</p>}
      {directory.isError && <p role="alert">{copy.branchError} <button type="button" className="underline" onClick={() => void directory.refetch()}>{copy.retry}</button></p>}
      {directory.isSuccess && matches.length === 0 && <p role="status">{copy.noBranches}</p>}
      {pending ? (
        <div className="website-pickup-branch-confirm" role="group" aria-label={copy.changeBranch}>
          <strong>{pending.name}</strong>
          <p>{copy.branchCartWarning}</p>
          <button type="button" onClick={() => setPending(null)}>{t("cancel")}</button>
          <button type="button" onClick={() => navigate(pending, true)}>{copy.changeBranch}</button>
        </div>
      ) : <ul>
        {matches.map(branch => <li key={branch.restaurantId}>
          <button type="button" onClick={() => navigate(branch, false)}>
            <BuildingStorefrontIcon aria-hidden="true" /><span><strong>{branch.name}</strong>{branch.address && <small>{branch.address}</small>}</span>
          </button>
        </li>)}
      </ul>}
    </section>
  );
}
