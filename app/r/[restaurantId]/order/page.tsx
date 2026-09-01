import { resolveCanonicalWebsitePage } from "@/lib/websiteV3Api";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { fetchChainOrderEntry, fetchMenu, fetchRestaurant } from "@/services/api";
import { notFound } from "next/navigation";
import { ChainOrderEntryView } from "@/components/ChainOrderEntry";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl, buildItemOgImageUrl } from "@/lib/og";
import { buildItemShareText, toLocale } from "@/lib/share";
import { tField } from "@/lib/translations";
import { canonicalUrl, requestOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);

    // Item share link: emit item-specific OG so WhatsApp/social show the item
    // photo + "Look at this {item} at {restaurant}". Falls back to the
    // restaurant-level card when the item can't be resolved (stale link,
    // rotating carte, fetch failure) so the page never errors on a bad param.
    const itemId = searchParams?.item;
    if (itemId) {
      const lang = toLocale(searchParams?.lang);
      try {
        const menu = await fetchMenu(String(restaurant.id));
        const item = menu.items.find((i) => i.id === itemId);
        if (item) {
          const itemName = tField(item, "name", lang, item.name);
          const description = buildItemShareText(lang, itemName, restaurant.name);
          const ogImageUrl = buildItemOgImageUrl({
            itemName,
            itemImageUrl: item.imageUrl,
            restaurant,
            appUrl: requestOrigin(),
          });
          return {
            title: itemName,
            description,
            openGraph: {
              title: itemName,
              description,
              type: "website",
              siteName: "Foody",
              images: [{ url: ogImageUrl, width: 1200, height: 630, alt: itemName }],
            },
            twitter: {
              card: "summary_large_image",
              title: itemName,
              description,
              images: [ogImageUrl],
            },
          };
        }
      } catch {
        // fall through to restaurant-level metadata
      }
    }

    const title = `${restaurant.name} - Menu | Foody`;
    const description = `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    const url = canonicalUrl(`/r/${params.restaurantId}/order`, restaurant.customDomain);
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, requestOrigin());

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        type: "website",
        url,
        siteName: "Foody",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: `${restaurant.name} - Menu`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: "Foody - Order Food Online" };
  }
}

/**
 * Renders the published default order page at its canonical public alias.
 */
export default async function OrderPage({ params, searchParams }: PageProps) {
  const preview = first(searchParams?.preview) === "1";
  const { restaurant, pages } = await getWebsiteV3SiteContext(
    params.restaurantId,
    preview,
  );
  const page = resolveCanonicalWebsitePage(pages, "order");
  if (!page) notFound();

  const directBranchId = first(searchParams?.branch_id);
  const isGlobalRestaurant =
    restaurant.chainPrimaryRestaurantId === restaurant.id &&
    (restaurant.chainBranchCount ?? 0) > 1 &&
    Boolean(restaurant.chainSlug);
  if (isGlobalRestaurant && directBranchId !== String(restaurant.id)) {
    try {
      const requestedType =
        first(searchParams?.type) === "delivery" ? "delivery" : "pickup";
      const entry = await fetchChainOrderEntry(
        restaurant.chainSlug!,
        requestedType,
      );
      return (
        <ChainOrderEntryView
          initialEntry={entry}
          initialOrderType={requestedType}
          initialAppearance={page.appearance_overrides}
          previewRestaurantId={
            preview ? restaurant.id : undefined
          }
        />
      );
    } catch {
      // The chain rollout switch may still be disabled. Keep the primary
      // restaurant's direct menu usable until the public hub is activated.
    }
  }

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
