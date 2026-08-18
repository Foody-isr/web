import { fetchReels } from "@/services/api";
import { RestaurantLanding } from "@/components/RestaurantLanding";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";
import { firstTabPath, orderedPageTabs } from "@/lib/nav";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { ChainBranchLanding } from "@/components/ChainBranchLanding";
import { getWebsiteV3LandingContext } from "@/lib/websiteV3PageContext";
import {
  resolveWebsiteV3Seo,
  websiteV3PageMetadata,
} from "@/lib/websiteV3Metadata";
import {
  buildWebsiteAliasTarget,
  canonicalRootRedirect,
  createWebsiteV3PreviewBootstrapPage,
} from "@/lib/websiteV3Api";
import {
  resolveWebsiteRootHomepageDecision,
  selectLandingPage,
} from "@/lib/websiteV3Rendering";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { restaurant, page, pages, isLocalBranch } = await getWebsiteV3LandingContext(
      params.restaurantId,
    );
    if (isLocalBranch) {
      const title = `${restaurant.name} · ${restaurant.chainName || "Foody"}`;
      const description = restaurant.description || restaurant.address || `Commander auprès de ${restaurant.name}.`;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: "website",
          url: `${APP_URL}/r/${params.restaurantId}`,
          images: [{ url: buildRestaurantOgImageUrl(restaurant, APP_URL), width: 1200, height: 630, alt: restaurant.name }],
        },
      };
    }
    const metadataPage = page ?? selectLandingPage(pages);
    if (metadataPage) {
      return websiteV3PageMetadata(
        resolveWebsiteV3Seo({
          restaurant,
          page: metadataPage,
          appUrl: APP_URL,
          routeRestaurantId: params.restaurantId,
        }),
      );
    }
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
export default async function Page({ params, searchParams }: PageProps) {
  let landingContext;
  try {
    landingContext = await getWebsiteV3LandingContext(params.restaurantId);
  } catch {
    notFound();
  }

  const { restaurant, brandRestaurant, pages, isLocalBranch } = landingContext;
  if (isLocalBranch) {
    return <ChainBranchLanding restaurant={restaurant} brandRestaurant={brandRestaurant} />;
  }
  const homepageDecision = resolveWebsiteRootHomepageDecision(
    pages,
    params.restaurantId,
    searchParams ?? {},
  );
  if (homepageDecision?.kind === "redirect") {
    redirect(homepageDecision.target);
  }
  if (homepageDecision?.kind === "render") {
    return (
      <WebsitePageRenderer
        restaurant={restaurant}
        page={homepageDecision.page}
        pages={pages}
        searchParams={searchParams}
      />
    );
  }

  const landingPage = selectLandingPage(pages);
  const canonicalRootAlias = canonicalRootRedirect(
    restaurant.websiteConfig?.landingEnabled,
    restaurant.cateringEnabled,
    restaurant.cateringOnly,
  );
  if (canonicalRootAlias) {
    redirect(
      buildWebsiteAliasTarget(
        params.restaurantId,
        canonicalRootAlias.slice(1),
        searchParams ?? {},
      ),
    );
  }

  const preview = first(searchParams?.preview) === "1";
  if (preview && !landingPage) {
    return (
      <WebsitePageRenderer
        restaurant={restaurant}
        page={createWebsiteV3PreviewBootstrapPage(
          restaurant.id,
          restaurant.name,
        )}
        searchParams={searchParams}
      />
    );
  }
  if (landingPage) {
    return (
      <WebsitePageRenderer
        restaurant={restaurant}
        page={landingPage}
        pages={pages}
        searchParams={searchParams}
      />
    );
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

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
