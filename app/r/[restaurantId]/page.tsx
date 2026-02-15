import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { checkAvailability } from "@/lib/availability";
import { notFound } from "next/navigation";
import { Metadata } from "next";

type PageProps = {
  params: { restaurantId: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const title = `${restaurant.name} - Order Online | Foody`;
    const description = restaurant.description || `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    
    // Build OG image URL with restaurant info
    const ogImageUrl = new URL("/api/og", APP_URL);
    ogImageUrl.searchParams.set("name", restaurant.name);
    if (restaurant.description) {
      ogImageUrl.searchParams.set("description", restaurant.description);
    }

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}`,
        siteName: "Foody",
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: `${restaurant.name} - Order Online`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl.toString()],
      },
    };
  } catch {
    return {
      title: "Foody - Order Food Online",
      description: "Order your favorite food online with Foody",
    };
  }
}

/**
 * Restaurant page - renders the full ordering experience.
 *
 * Order type (pickup/delivery) can be switched within the UI.
 * Priority for initial type: pickup (if open) > delivery (if open) > pickup (if enabled) > delivery
 */
export default async function Page({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));

    // Determine initial order type based on what's actually available and open
    const pickupEnabled = restaurant.pickupEnabled;
    const deliveryEnabled = restaurant.deliveryEnabled;

    const pickupOpen = pickupEnabled && checkAvailability(
      restaurant.openingHoursConfig,
      "pickup",
      restaurant.timezone || "UTC"
    ).isOpen;

    const deliveryOpen = deliveryEnabled && checkAvailability(
      restaurant.openingHoursConfig,
      "delivery",
      restaurant.timezone || "UTC"
    ).isOpen;

    // Priority: open pickup > open delivery > enabled pickup > enabled delivery > pickup as fallback
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

    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        initialOrderType={initialOrderType}
      />
    );
  } catch (error) {
    notFound();
  }
}
