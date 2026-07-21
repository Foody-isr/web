import { fetchRestaurant, fetchReels } from "@/services/api";
import { StoriesExperience } from "@/components/StoriesExperience";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return {
      title: `${restaurant.name} — Stories | Foody`,
      description: `Watch reels and stories from ${restaurant.name}.`,
    };
  } catch {
    return { title: "Stories | Foody" };
  }
}

/**
 * Stories page — a mobile-first, full-screen swipeable feed of the restaurant's
 * short videos (synced from Instagram). Reached from the mobile bottom nav.
 */
export default async function StoriesPage({ params }: PageProps) {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const reels = await fetchReels(String(restaurant.id));
    return (
      <StoriesExperience
        restaurant={{ id: restaurant.id, slug: restaurant.slug || params.restaurantId, name: restaurant.name }}
        reels={reels}
      />
    );
  } catch {
    notFound();
  }
}
