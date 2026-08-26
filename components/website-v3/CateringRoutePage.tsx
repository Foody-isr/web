import { notFound } from "next/navigation";
import { fetchRestaurant } from "@/services/api";
import {
  fetchWebsitePages,
  resolveCanonicalWebsitePage,
} from "@/lib/websiteV3Api";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";
import { WebsitePageRenderer } from "./WebsitePageRenderer";

/** Shared server entry for the catering hub and its deep-linked catalog views. */
export async function CateringRoutePage({
  restaurantId,
  searchParams,
  serviceSlug,
  itemSlug,
}: {
  restaurantId: string;
  searchParams?: WebsitePageSearchParams;
  serviceSlug?: string;
  itemSlug?: string;
}) {
  const [restaurant, pages] = await Promise.all([
    fetchRestaurant(restaurantId),
    fetchWebsitePages(restaurantId),
  ]);
  const page = resolveCanonicalWebsitePage(pages, "catering");
  if (!page) notFound();

  return (
    <WebsitePageRenderer
      restaurant={restaurant}
      page={page}
      pages={pages}
      searchParams={searchParams}
      cateringPath={serviceSlug ? { serviceSlug, itemSlug } : undefined}
    />
  );
}
