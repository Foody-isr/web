import { fetchMenu, fetchRestaurant } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";

type PageProps = {
  params: { restaurantId: string; tableId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

// Table QR links are shared as api.foody-pos.co.il/r/<slug>/t/<code>/<sig>, which
// the API server 307-redirects here. Social crawlers follow that redirect, so
// this landing page is what builds the link preview. Without restaurant-specific
// metadata it falls back to the root layout's generic "Foody" card — emit the
// same branded card (cover/logo + name) the root and /order pages use.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const title = `${restaurant.name} - Menu`;
    const description = `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, APP_URL);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}/table/${params.tableId}`,
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

export default async function Page({ params, searchParams }: PageProps) {
  try {
    // First fetch restaurant to get numeric ID, then fetch menu with that ID
    const restaurant = await fetchRestaurant(params.restaurantId);
    const menu = await fetchMenu(String(restaurant.id));
    
    const sessionId =
      typeof searchParams?.sessionId === "string" ? (searchParams?.sessionId as string) : undefined;
    
    return (
      <OrderExperience
        menu={menu}
        restaurant={restaurant}
        initialOrderType="dine_in"
        tableId={params.tableId}
        sessionId={sessionId}
      />
    );
  } catch (error) {
    notFound();
  }
}
