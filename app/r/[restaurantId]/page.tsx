import { RestaurantLanding } from "@/components/RestaurantLanding";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";
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
import { canonicalUrl, requestOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { restaurantId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

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
    // Both are built from the address the visitor used, so a restaurant on its
    // own domain keeps the credit for its pages instead of handing it to Foody.
    const url = canonicalUrl(`/r/${params.restaurantId}`, restaurant.customDomain);
    const ogImageUrl = buildRestaurantOgImageUrl(restaurant, requestOrigin());

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        type: "website",
        url,
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
  const preview = first(searchParams?.preview) === "1";
  let landingContext;
  try {
    landingContext = await getWebsiteV3LandingContext(
      params.restaurantId,
      preview,
    );
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

  const defaultTab = restaurant.cateringEnabled === true && restaurant.cateringOnly === true
    ? `/r/${params.restaurantId}/catering`
    : `/r/${params.restaurantId}/order`;

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
