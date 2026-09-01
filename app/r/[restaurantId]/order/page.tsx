import {
  fetchMenu,
  fetchOrderCategoryNavigation,
  fetchRestaurant,
} from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { checkAvailability } from "@/lib/availability";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl, buildItemOgImageUrl } from "@/lib/og";
import { buildItemShareText, toLocale } from "@/lib/share";
import { tField } from "@/lib/translations";
import { canonicalUrl, requestOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: { type?: string; preview_date?: string; item?: string; lang?: string };
};

// Accepts only a strict YYYY-MM-DD date for the future-week preview override.
function parsePreviewDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

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
 * Order page — the full menu + cart ordering experience (dark Wolt-style).
 * Reached from the landing page "Order Now" button or direct links.
 */
export default async function OrderPage({ params, searchParams }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const previewDate = parsePreviewDate(searchParams?.preview_date);
    const [menuResult, navigationResult] = await Promise.allSettled([
      fetchMenu(String(restaurant.id), previewDate),
      fetchOrderCategoryNavigation(params.restaurantId),
    ]);
    if (menuResult.status === "rejected") throw menuResult.reason;
    const menu = menuResult.value;
    const categoryNavigation = navigationResult.status === "fulfilled"
      ? navigationResult.value
      : undefined;

    const pickupEnabled = restaurant.pickupEnabled;
    const deliveryEnabled = restaurant.deliveryEnabled;

    const pickupOpen = pickupEnabled && checkAvailability(
      restaurant.openingHoursConfig,
      "pickup",
      restaurant.timezone || "UTC",
      restaurant.batchFulfillmentEnabled
    ).isOpen;

    const deliveryOpen = deliveryEnabled && checkAvailability(
      restaurant.openingHoursConfig,
      "delivery",
      restaurant.timezone || "UTC",
      restaurant.batchFulfillmentEnabled
    ).isOpen;

    let initialOrderType: "pickup" | "delivery" = "pickup";
    if (pickupOpen) {
      initialOrderType = "pickup";
    } else if (deliveryOpen) {
      initialOrderType = "delivery";
    } else if (pickupEnabled) {
      initialOrderType = "pickup";
    } else if (deliveryEnabled) {
      initialOrderType = "delivery";
    }

    // Allow ?type= query param to override service type
    const typeParam = searchParams?.type;
    if (typeParam === "pickup" && pickupEnabled) {
      initialOrderType = "pickup";
    } else if (typeParam === "delivery" && deliveryEnabled) {
      initialOrderType = "delivery";
    }

    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        initialOrderType={initialOrderType}
        previewDate={previewDate}
        categoryNavigation={categoryNavigation}
      />
    );
  } catch {
    notFound();
  }
}
