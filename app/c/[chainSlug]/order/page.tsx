import { notFound, redirect } from "next/navigation";
import { fetchChainOrderEntry } from "@/services/api";
import { ChainOrderEntryView } from "@/components/ChainOrderEntry";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { resolveCanonicalWebsitePage } from "@/lib/websiteV3Api";

export const dynamic = "force-dynamic";

type Props = {
  params: { chainSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ChainOrderPage({ params, searchParams }: Props) {
  const requested = searchParams?.type === "delivery" ? "delivery" : "pickup";
  let entry;
  try {
    entry = await fetchChainOrderEntry(params.chainSlug, requested);
  } catch {
    notFound();
  }

  if (entry.branches.length === 1) {
    const branch = entry.branches[0];
    const query = new URLSearchParams({ type: requested });
    if (typeof searchParams?.lang === "string")
      query.set("lang", searchParams.lang);
    redirect(`/r/${encodeURIComponent(branch.slug)}/order?${query.toString()}`);
  }

  let appearance: Record<string, unknown> | undefined;
  if (entry.chain.primaryRestaurantId) {
    try {
      const context = await getWebsiteV3SiteContext(
        String(entry.chain.primaryRestaurantId),
      );
      appearance = resolveCanonicalWebsitePage(
        context.pages,
        "order",
      )?.appearance_overrides;
    } catch {
      // The chain selector remains usable with its legacy defaults while the
      // primary website is being configured or temporarily unavailable.
    }
  }

  return (
    <ChainOrderEntryView
      initialEntry={entry}
      initialOrderType={requested}
      initialAppearance={appearance}
    />
  );
}
