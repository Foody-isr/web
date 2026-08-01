import {
  fetchDefaultWebsitePage,
} from "@/lib/websiteV3Api";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

/** Renders the published default catering page at its canonical public alias. */
export default async function CateringPage({ params, searchParams }: PageProps) {
  const [restaurant, page] = await Promise.all([
    fetchRestaurant(params.restaurantId),
    fetchDefaultWebsitePage(params.restaurantId, "catering"),
  ]);
  if (!page) notFound();

  return (
    <WebsitePageRenderer
      restaurant={restaurant}
      page={page}
      searchParams={searchParams}
    />
  );
}
