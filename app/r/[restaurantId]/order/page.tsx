import { resolveCanonicalWebsitePage } from "@/lib/websiteV3Api";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { fetchChainOrderEntry } from "@/services/api";
import { notFound } from "next/navigation";
import { ChainOrderEntryView } from "@/components/ChainOrderEntry";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Renders the published default order page at its canonical public alias. */
export default async function OrderPage({ params, searchParams }: PageProps) {
  const { restaurant, pages } = await getWebsiteV3SiteContext(params.restaurantId);
  const page = resolveCanonicalWebsitePage(pages, "order");
  if (!page) notFound();

  const directBranchId = first(searchParams?.branch_id);
  const isGlobalRestaurant =
    restaurant.chainPrimaryRestaurantId === restaurant.id &&
    (restaurant.chainBranchCount ?? 0) > 1 &&
    Boolean(restaurant.chainSlug);
  if (isGlobalRestaurant && directBranchId !== String(restaurant.id)) {
    try {
      const requestedType = first(searchParams?.type) === "delivery" ? "delivery" : "pickup";
      const entry = await fetchChainOrderEntry(restaurant.chainSlug!, requestedType);
      return <ChainOrderEntryView initialEntry={entry} initialOrderType={requestedType} />;
    } catch {
      // The chain rollout switch may still be disabled. Keep the primary
      // restaurant's direct menu usable until the public hub is activated.
    }
  }

  return (
    <WebsitePageRenderer
      restaurant={restaurant}
      page={page}
      pages={pages}
      searchParams={searchParams}
    />
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
