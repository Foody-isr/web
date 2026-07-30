import {
  buildWebsiteAliasTarget,
  fetchDefaultWebsitePage,
} from "@/lib/websiteV3Api";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Redirects the legacy order URL to the explicit default order page. */
export default async function OrderPage({ params, searchParams }: PageProps) {
  const page = await fetchDefaultWebsitePage(params.restaurantId, "order");
  if (!page) notFound();

  redirect(buildWebsiteAliasTarget(params.restaurantId, page.slug, searchParams ?? {}));
}
