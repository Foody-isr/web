import { fetchRestaurant, fetchReels } from "@/services/api";
import { StoriesExperience } from "@/components/StoriesExperience";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import {
  canNavigateToStories,
  systemNavigationFallback,
} from "@/lib/systemNav";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return {
      title: `${restaurant.name} — Stories`,
      description: `Watch reels and stories from ${restaurant.name}.`,
    };
  } catch {
    return { title: "Stories" };
  }
}

/**
 * Stories page — a mobile-first, full-screen swipeable feed of the restaurant's
 * short videos (synced from Instagram). Reached from the mobile bottom nav.
 */
export default async function StoriesPage({ params }: PageProps) {
  // Resolve the restaurant first; a fetch failure is a 404. Kept out of the
  // reels try/catch so a redirect (below) is never swallowed into notFound().
  let restaurant;
  try {
    restaurant = await fetchRestaurant(params.restaurantId);
  } catch {
    notFound();
  }

  if (!canNavigateToStories(restaurant)) {
    redirect(systemNavigationFallback(restaurant));
  }

  // A reels fetch failure shouldn't 404 the page — show the empty state.
  let reels = [] as Awaited<ReturnType<typeof fetchReels>>;
  try {
    reels = await fetchReels(String(restaurant.id));
  } catch {
    reels = [];
  }

  return (
    <StoriesExperience
      restaurant={restaurant}
      reels={reels}
    />
  );
}
