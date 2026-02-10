import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";

type PageProps = {
  params: { restaurantId: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const title = `Delivery from ${restaurant.name} | Foody`;
    const description = `Order delivery from ${restaurant.name}. ${restaurant.description || "Fast, easy, and delicious!"}`;
    
    const ogImageUrl = new URL("/api/og", APP_URL);
    ogImageUrl.searchParams.set("name", restaurant.name);
    ogImageUrl.searchParams.set("description", `Delivery Order • ${restaurant.description || "Order now!"}`);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}/delivery`,
        siteName: "Foody",
        images: [{ url: ogImageUrl.toString(), width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl.toString()],
      },
    };
  } catch {
    return { title: "Foody - Order Delivery" };
  }
}

export default async function DeliveryPage({ params }: PageProps) {
  try {
    // First fetch restaurant to get numeric ID, then fetch menu with that ID
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));
    
    // Check if delivery is enabled
    if (!restaurant.deliveryEnabled) {
      redirect(`/r/${params.restaurantId}`);
    }

    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        orderType="delivery"
      />
    );
  } catch (error) {
    notFound();
  }
}
