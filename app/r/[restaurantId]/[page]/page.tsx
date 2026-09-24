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
import { CustomPageClient } from "@/components/CustomPageClient";
import { buildRestaurantOgImageUrl } from "@/lib/og";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string; page: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const RESERVED = new Set([
  "order",
  "orders",
  "table",
  "payment",
  "pickup",
  "delivery",
  "stories",
  "t",
]);

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const path = `/r/${params.restaurantId}/${params.page}`;
  try {
    const { restaurant, page } = await getWebsiteV3PageContext(
      params.restaurantId,
      params.page,
    );
    if (!page) {
      const label =
        (restaurant.websiteConfig?.pages || []).find(
          (candidate) => candidate.slug === params.page,
        )?.label || params.page;
      const title = `${label} - ${restaurant.name} | Foody`;
      const description =
        restaurant.description || `${label} — ${restaurant.name}.`;
      const imageUrl = buildRestaurantOgImageUrl(
        restaurant,
        await requestOrigin(),
      );
      const canonical = await canonicalUrl(path, restaurant.customDomain);
      return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
          title,
          description,
          type: "website",
          url: canonical,
          siteName: "Foody",
          images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }
    const seo = resolveWebsiteV3Seo({
      restaurant,
      page,
      appUrl: await requestOrigin(),
      routeRestaurantId: params.restaurantId,
    });
    return websiteV3PageMetadata({
      ...seo,
      canonicalUrl: await canonicalUrl(path, restaurant.customDomain),
    });
  } catch {
    // The restaurant is unreachable, so its own domain is unknown; the address
    // being served is the right canonical for that host regardless.
    return { alternates: { canonical: await canonicalUrl(path) } };
  }
}

export default async function DynamicPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if (RESERVED.has(params.page)) notFound();
  const preview = first(searchParams?.preview) === "1";
  const { restaurant, page, pages } = await getWebsiteV3PageContext(
    params.restaurantId,
    params.page,
    preview,
  );
  if (!page) {
    const pageSections = (restaurant.websiteSections || []).filter(
      (section) => section.page === params.page,
    );
    const pageMeta = (restaurant.websiteConfig?.pages || []).find(
      (candidate) => candidate.slug === params.page,
    );
    if (!pageMeta && pageSections.length === 0 && !preview) notFound();
    return <CustomPageClient restaurant={restaurant} pageSlug={params.page} />;
  }

  redirectDefaultWebsitePagePermanently(
    page,
    params.restaurantId,
    searchParams,
  );

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
