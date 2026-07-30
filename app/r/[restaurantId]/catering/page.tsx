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

/** Redirects the legacy catering URL to the explicit default catering page. */
export default async function CateringPage({ params, searchParams }: PageProps) {
  const page = await fetchDefaultWebsitePage(params.restaurantId, "catering");
  if (!page) notFound();

  redirect(buildWebsiteAliasTarget(params.restaurantId, page.slug, searchParams ?? {}));
}
