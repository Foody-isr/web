import { fetchRestaurant, fetchReels } from "@/services/api";
import { RestaurantLanding } from "@/components/RestaurantLanding";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";
import { firstTabPath, orderedPageTabs } from "@/lib/nav";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const restaurant = await fetchRestaurant(params.restaurantId);
    const title = `${restaurant.name} - Order Online`;
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

  // When the landing page is skipped, customers land on the restaurant's chosen
  // first bottom-nav tab (default: Menu; e.g. Stories if configured first).
  // Only treat Stories as an available landing target when it is enabled AND has
  // at least one visible reel — never redirect a customer to an empty Stories
  // page. We only pay for the reels lookup when Stories would actually be first.
  const navOrder = restaurant.websiteConfig?.navOrder;
  const storiesEnabled = restaurant.websiteConfig?.storiesEnabled === true;
  // A catering-only restaurant (effective only when catering is actually
  // enabled) has no classic menu, so its default landing tab becomes the
  // catering shop. This flows through firstTabPath so the root target stays
  // config-derived (the seam a future "choose root page" editor plugs into).
  const cateringEnabled = restaurant.cateringEnabled === true;
  const cateringOnly = restaurant.cateringOnly === true;
  let storiesAvailable = false;
  if (storiesEnabled && orderedPageTabs(navOrder, true, cateringEnabled, cateringOnly)[0] === "stories") {
    try {
      const reels = await fetchReels(params.restaurantId);
      storiesAvailable = reels.length > 0;
    } catch {
      storiesAvailable = false;
    }
  }
  const defaultTab = firstTabPath(params.restaurantId, navOrder, storiesAvailable, cateringEnabled, cateringOnly);

  // Explicit opt-out from the marketing landing page. Restaurants without a
  // landing presence redirect straight to their default tab.
  if (restaurant.websiteConfig?.landingEnabled === false) {
    redirect(defaultTab);
  }

  // Fallback: if no visible home-page sections exist (e.g. a brand-new
  // restaurant), also skip the empty landing.
  const visibleHomeSections = (restaurant.websiteSections || []).filter(
    (s) => s.isVisible && (!s.page || s.page === "home")
  );
  if (visibleHomeSections.length === 0) {
    redirect(defaultTab);
  }

  return <RestaurantLanding restaurant={restaurant} />;
}
