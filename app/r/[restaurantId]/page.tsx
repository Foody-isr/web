import { RestaurantLanding } from "@/components/RestaurantLanding";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { buildRestaurantOgImageUrl } from "@/lib/og";
import { WebsitePageRenderer } from "@/components/website-v3/WebsitePageRenderer";
import { PublishedMobileTab } from "@/components/mobile-experience/PublishedMobileTab";
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
import { publicPath } from "@/lib/site-url";
import { readMobileExperience } from "@/lib/mobileExperience";
import { MobileHomeBoundary } from "@/components/website-v3/MobileExperience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  try {
    const { restaurant, page, pages, isLocalBranch } =
      await getWebsiteV3LandingContext(params.restaurantId);
    if (isLocalBranch) {
      const title = `${restaurant.name} · ${restaurant.chainName || "Foody"}`;
      const description =
        restaurant.description ||
        restaurant.address ||
        `Commander auprès de ${restaurant.name}.`;
      return {
        title,
        description,
        alternates: {
          canonical: await canonicalUrl(
            `/r/${params.restaurantId}`,
            restaurant.customDomain,
          ),
        },
        openGraph: {
          title,
          description,
          type: "website",
          url: await canonicalUrl(
            `/r/${params.restaurantId}`,
            restaurant.customDomain,
          ),
          images: [
            {
              url: buildRestaurantOgImageUrl(restaurant, await requestOrigin()),
              width: 1200,
              height: 630,
              alt: restaurant.name,
            },
          ],
        },
      };
    }
    const metadataPage = page ?? selectLandingPage(pages);
    if (metadataPage) {
      const seo = resolveWebsiteV3Seo({
        restaurant,
        page: metadataPage,
        appUrl: await requestOrigin(),
        routeRestaurantId: params.restaurantId,
      });
      return websiteV3PageMetadata({
        ...seo,
        canonicalUrl: await canonicalUrl(
          new URL(seo.canonicalUrl).pathname,
          restaurant.customDomain,
        ),
      });
    }
    const title = `${restaurant.name} - Order Online`;
    const description =
      restaurant.description ||
      `Order from ${restaurant.name} online. Fast, easy, and delicious!`;
    // Both are built from the address the visitor used, so a restaurant on its
    // own domain keeps the credit for its pages instead of handing it to Foody.
    const url = await canonicalUrl(
      `/r/${params.restaurantId}`,
      restaurant.customDomain,
    );
    const ogImageUrl = buildRestaurantOgImageUrl(
      restaurant,
      await requestOrigin(),
    );

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
export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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
  const appHome = !preview && readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)?.home;
  const routeRoot = "/r/" + encodeURIComponent(params.restaurantId);
  const publicRoot = appHome ? (await publicPath(routeRoot)).replace(/\/$/, "") : routeRoot;
  const lang = first(searchParams?.lang);
  const localeQuery = lang === "en" || lang === "fr" || lang === "he" ? "?lang=" + lang : "";
  const commercePath = restaurant.cateringEnabled && restaurant.cateringOnly ? "/catering" : "/order";
  const renderHome = (content?: ReactNode, browserHref?: string) => appHome ? (
    <PublishedMobileTab searchParams={searchParams}>
      <MobileHomeBoundary home={appHome} restaurant={restaurant}
        orderHref={publicRoot + commercePath + localeQuery}
        browserHref={publicRoot === "" && browserHref?.startsWith(routeRoot + "/") ? browserHref.slice(routeRoot.length) : browserHref}>
        {content}
      </MobileHomeBoundary>
    </PublishedMobileTab>
  ) : content;

  if (isLocalBranch) {
    const content = <ChainBranchLanding restaurant={restaurant} brandRestaurant={brandRestaurant} />;
    return appHome ? renderHome(content) : (
      <PublishedMobileTab searchParams={searchParams}>
        {content}
      </PublishedMobileTab>
    );
  }
  const homepageDecision = resolveWebsiteRootHomepageDecision(
    pages,
    params.restaurantId,
    searchParams ?? {},
  );
  if (homepageDecision?.kind === "redirect") {
    if (appHome) return renderHome(undefined, homepageDecision.target);
    redirect(homepageDecision.target);
  }
  if (homepageDecision?.kind === "render") {
    return renderHome(
      <WebsitePageRenderer
        restaurant={restaurant}
        page={homepageDecision.page}
        pages={pages}
        searchParams={searchParams}
        registerMobileTab={!appHome}
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
    const target = buildWebsiteAliasTarget(
        params.restaurantId,
        canonicalRootAlias.slice(1),
        searchParams ?? {},
    );
    if (appHome) return renderHome(undefined, target);
    redirect(target);
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
    return renderHome(
      <WebsitePageRenderer
        restaurant={restaurant}
        page={landingPage}
        pages={pages}
        searchParams={searchParams}
        registerMobileTab={!appHome}
      />
    );
  }

  // Fallback: if no visible home-page sections exist (e.g. a brand-new
  // restaurant), also skip the empty landing.
  const visibleHomeSections = (restaurant.websiteSections || []).filter(
    (s) => s.isVisible && (!s.page || s.page === "home"),
  );
  if (visibleHomeSections.length === 0) {
    const defaultTab = routeRoot + commercePath;
    if (appHome) return renderHome(undefined, defaultTab + localeQuery);
    redirect(defaultTab);
  }

  const content = <RestaurantLanding restaurant={restaurant} />;
  return appHome ? renderHome(content) : (
    <PublishedMobileTab searchParams={searchParams}>
      {content}
    </PublishedMobileTab>
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
