import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWebsiteV3PageContext } from "@/lib/websiteV3PageContext";
import { redirectDefaultWebsitePagePermanently } from "@/lib/websiteV3PermanentRedirect";
import {
  resolveWebsiteV3Seo,
  websiteV3PageMetadata,
} from "@/lib/websiteV3Metadata";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string; page: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { restaurant, page } = await getWebsiteV3PageContext(
      params.restaurantId,
      params.page,
    );
    if (!page) return { title: "Foody - Order Food Online" };
    return websiteV3PageMetadata(
      resolveWebsiteV3Seo({
        restaurant,
        page,
        appUrl: APP_URL,
        routeRestaurantId: params.restaurantId,
      }),
    );
  } catch {
    return { title: "Foody - Order Food Online" };
  }
}

export default async function DynamicPage({ params, searchParams }: PageProps) {
  const { restaurant, page, pages } = await getWebsiteV3PageContext(
    params.restaurantId,
    params.page,
  );
  if (!page) notFound();

  redirectDefaultWebsitePagePermanently(page, params.restaurantId, searchParams);

  return (
    <WebsitePageRenderer
      restaurant={restaurant}
      page={page}
      pages={pages}
      searchParams={searchParams}
    />
  );
}
