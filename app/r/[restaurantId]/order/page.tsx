import {
  fetchWebsitePages,
  resolveCanonicalWebsitePage,
} from "@/lib/websiteV3Api";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Renders the published default order page at its canonical public alias. */
export default async function OrderPage({ params, searchParams }: PageProps) {
  const [restaurant, pages] = await Promise.all([
    fetchRestaurant(params.restaurantId),
    fetchWebsitePages(params.restaurantId),
  ]);
  const page = resolveCanonicalWebsitePage(pages, "order");
  if (!page) notFound();

  return (
    <WebsitePageRenderer
      restaurant={restaurant}
      page={page}
      pages={pages}
      searchParams={searchParams}
    />
  );
}
