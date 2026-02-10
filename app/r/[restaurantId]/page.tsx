import { fetchRestaurant } from "@/services/api";
import { RestaurantLanding } from "./RestaurantLanding";
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

export default async function Page({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return <RestaurantLanding restaurant={restaurant} />;
  } catch (error) {
    notFound();
  }
}
