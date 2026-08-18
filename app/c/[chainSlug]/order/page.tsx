import { notFound, redirect } from "next/navigation";
import { fetchChainOrderEntry } from "@/services/api";
import { ChainOrderEntryView } from "@/components/ChainOrderEntry";

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
    if (typeof searchParams?.lang === "string") query.set("lang", searchParams.lang);
    redirect(`/r/${encodeURIComponent(branch.slug)}/order?${query.toString()}`);
  }

  return <ChainOrderEntryView initialEntry={entry} initialOrderType={requested} />;
}
