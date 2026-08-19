import { fetchRestaurant, fetchTour } from "@/services/api";
import { OrderExperience } from "@/components/OrderExperience";
import { TourUnavailableScreen } from "./TourUnavailableScreen";
import { Restaurant } from "@/lib/types";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

type PageProps = {
  params: { restaurantId: string; tourSlug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const result = await fetchTour(String(restaurant.id), params.tourSlug);
    const title =
      "tour" in result
        ? `${result.tour.name} - ${restaurant.name} | Foody`
        : `${restaurant.name} | Foody`;
    const description = `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    // Same branded restaurant card the order page emits, so a shared tour link
    // previews with the restaurant's logo, not the generic Foody placeholder.
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, APP_URL);
    return {
      title,
      description,
      // The link is meant to be shared with a specific audience, not indexed —
      // the tour is short-lived. noindex does NOT suppress the OG card.
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        type: "website",
        url: `${APP_URL}/r/${params.restaurantId}/tournee/${params.tourSlug}`,
        siteName: "Foody",
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: "Foody" };
  }
}

/**
 * Dedicated page for a single delivery tour.
 *
 * A tour is a one-off delivery round to a city the restaurant does not normally
 * serve, on its own day, off a dedicated carte. Since the pivot it no longer
 * appears anywhere on the normal site — it is reachable ONLY through this link,
 * and the customer who opens it sees ONLY this round's carte, delivery-only.
 *
 * The tour object travels on the single menu entry, so <OrderExperience> lights
 * up its tour path (delivery forced, the tour's window/fee/minimum, the cart
 * bound to the tour) with no tabs, exactly as if the round were the whole site.
 */
export default async function TourPage({ params }: PageProps) {
  let restaurant: Restaurant;
  try {
    restaurant = await fetchRestaurant(params.restaurantId);
  } catch {
    notFound();
  }

  const result = await fetchTour(String(restaurant.id), params.tourSlug);
  if ("reason" in result) {
    return (
      <TourUnavailableScreen
        reason={result.reason}
        restaurantSlug={restaurant.slug || params.restaurantId}
      />
    );
  }

  return (
    <OrderExperience
      menu={result.menu}
      restaurant={restaurant}
      initialOrderType="delivery"
    />
  );
}
