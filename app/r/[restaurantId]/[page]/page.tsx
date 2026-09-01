import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWebsiteV3PageContext } from "@/lib/websiteV3PageContext";
import { redirectDefaultWebsitePagePermanently } from "@/lib/websiteV3PermanentRedirect";
import {
  resolveWebsiteV3Seo,
  websiteV3PageMetadata,
} from "@/lib/websiteV3Metadata";
import { canonicalUrl, requestOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string; page: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const path = `/r/${params.restaurantId}/${params.page}`;
  try {
    const { restaurant, page } = await getWebsiteV3PageContext(
      params.restaurantId,
      params.page,
    );
    if (!page) return { title: "Foody - Order Food Online" };
    const seo = resolveWebsiteV3Seo({
        restaurant,
        page,
        appUrl: requestOrigin(),
        routeRestaurantId: params.restaurantId,
      });
    return websiteV3PageMetadata({
      ...seo,
      canonicalUrl: canonicalUrl(path, restaurant.customDomain),
    });
  } catch {
    // The restaurant is unreachable, so its own domain is unknown; the address
    // being served is the right canonical for that host regardless.
    return { alternates: { canonical: canonicalUrl(path) } };
  }
}

export default async function DynamicPage({ params, searchParams }: PageProps) {
  const preview = first(searchParams?.preview) === "1";
  const { restaurant, page, pages } = await getWebsiteV3PageContext(
    params.restaurantId,
    params.page,
    preview,
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

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
