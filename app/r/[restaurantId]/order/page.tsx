import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { checkAvailability } from "@/lib/availability";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: { type?: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return {
      title: `${restaurant.name} - Menu | Foody`,
      description: `Order from ${restaurant.name} online. Fast, easy, and delicious!`,
      openGraph: {
        title: `${restaurant.name} - Menu`,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}/order`,
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
    const menu = await fetchMenu(String(restaurant.id));

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
      />
    );
  } catch {
    notFound();
  }
}
