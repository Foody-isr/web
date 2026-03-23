import { fetchRestaurant } from "@/services/api";
import { RestaurantLanding } from "@/components/RestaurantLanding";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const title = `${restaurant.name} - Order Online | Foody`;
    const description = restaurant.description || `Order from ${restaurant.name} online. Fast, easy, and delicious!`;

    const ogImageUrl = new URL("/api/og", APP_URL);
    ogImageUrl.searchParams.set("name", restaurant.name);
    if (restaurant.description) {
      ogImageUrl.searchParams.set("description", restaurant.description);
    }
    if (restaurant.logoUrl) {
      ogImageUrl.searchParams.set("logo", restaurant.logoUrl);
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
 * Restaurant landing page — marketing homepage with sections, hero, and footer.
 * Clicking "Order Now" navigates to /r/{slug}/order.
 */
export default async function Page({ params }: PageProps) {
  let restaurant;
  try {
    restaurant = await fetchRestaurant(params.restaurantId);
  } catch {
    notFound();
  }

  // If no visible home-page sections exist, skip landing and go straight to ordering
  const visibleHomeSections = (restaurant.websiteSections || []).filter(
    (s) => s.isVisible && (!s.page || s.page === "home")
  );
  if (visibleHomeSections.length === 0) {
    redirect(`/r/${params.restaurantId}/order`);
  }

  return <RestaurantLanding restaurant={restaurant} />;
}
