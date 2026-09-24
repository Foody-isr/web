import { fetchRestaurant, fetchReels } from "@/services/api";
import { StoriesExperience } from "@/components/StoriesExperience";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import {
  canNavigateToStories,
  systemNavigationFallback,
} from "@/lib/systemNav";
import { canonicalUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    return {
      title: `${restaurant.name} — Stories`,
      description: `Watch reels and stories from ${restaurant.name}.`,
      alternates: {
        canonical: await canonicalUrl(
          `/r/${params.restaurantId}/stories`,
          restaurant.customDomain,
        ),
      },
    };
  } catch {
    return { title: "Stories" };
  }
}

/**
 * Stories page — a mobile-first, full-screen swipeable feed of the restaurant's
 * short videos synced from Instagram.
 */
export default async function StoriesPage(props: PageProps) {
  const params = await props.params;
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

  return <StoriesExperience restaurant={restaurant} reels={reels} />;
}
