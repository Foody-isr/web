import { fetchRestaurant } from "@/services/api";
import { RestaurantLanding } from "@/components/RestaurantLanding";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";

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
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, APP_URL);

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
            url: ogImageUrl,
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
        images: [ogImageUrl],
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

  // Explicit opt-out from the marketing landing page. Restaurants without a
  // landing presence redirect straight to ordering.
  if (restaurant.websiteConfig?.landingEnabled === false) {
    redirect(`/r/${params.restaurantId}/order`);
  }

  // Fallback: if no visible home-page sections exist (e.g. a brand-new
  // restaurant), also skip the empty landing.
  const visibleHomeSections = (restaurant.websiteSections || []).filter(
    (s) => s.isVisible && (!s.page || s.page === "home")
  );
  if (visibleHomeSections.length === 0) {
    redirect(`/r/${params.restaurantId}/order`);
  }

  return <RestaurantLanding restaurant={restaurant} />;
}
