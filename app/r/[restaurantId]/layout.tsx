import { fetchRestaurant } from "@/services/api";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { CurrencyBridge } from "@/components/CurrencyBridge";
import { Restaurant } from "@/lib/types";
import { PwaHead } from "@/components/PwaHead";
import { MobileExperienceSurface } from "@/components/website-v3/MobileExperience";
import { readMobileExperience } from "@/lib/mobileExperience";
import { materializePublishedWebsitePages } from "@/lib/websiteConfig";
import { getWebsiteV3SiteContext } from "@/lib/websiteV3PageContext";
import { isLocalChainWebsite } from "@/lib/chainWebsite";
import { publicPath } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
};

export default async function RestaurantLayout(props: LayoutProps) {
  const params = await props.params;

  const { children } = props;

  let restaurant: Restaurant | null = null;
  let websiteRestaurant: Restaurant | null = null;
  try {
    restaurant = await fetchRestaurant(params.restaurantId);
    websiteRestaurant = restaurant;
    if (isLocalChainWebsite(restaurant) || readMobileExperience(restaurant.websiteConfig?.navLayout?.mobile_experience)?.navigation.enabled) {
      const site = await getWebsiteV3SiteContext(params.restaurantId, false);
      websiteRestaurant = materializePublishedWebsitePages(site.restaurant, site.pages);
    }
  } catch {
    // If restaurant fetch fails, proceed without customization
  }

  const websiteConfig = restaurant?.websiteConfig || null;
  const slug = restaurant?.slug || params.restaurantId;
  const primaryColor = websiteConfig?.brandColor || "#EB5204";
  const mobileConfig = websiteRestaurant?.websiteConfig;
  const mobileExperience = mobileConfig?.navLayout?.mobile_experience;
  const routeRoot = "/r/" + encodeURIComponent(params.restaurantId);
  const cleanPaths = websiteRestaurant && mobileExperience
    ? !(await publicPath(routeRoot)).startsWith("/r/")
    : false;

  return (
    <RestaurantThemeProvider config={websiteConfig}>
      <CurrencyBridge currency={restaurant?.currency} />
      <PwaHead
        slug={slug}
        primaryColor={primaryColor}
        title={restaurant?.name || "Foody"}
        logoUrl={restaurant?.logoUrl}
      />
      {websiteRestaurant && mobileExperience ? (
        <MobileExperienceSurface
          restaurant={{
            id: websiteRestaurant.id,
            slug: websiteRestaurant.slug,
            name: websiteRestaurant.name,
            logoUrl: websiteRestaurant.logoUrl,
            cateringEnabled: websiteRestaurant.cateringEnabled,
            cateringOnly: websiteRestaurant.cateringOnly,
            websiteConfig: {
              navLayout: { mobile_experience: mobileExperience },
              pages: mobileConfig?.pages,
              showOrdersLink: mobileConfig?.showOrdersLink,
            },
          }}
          restaurantKey={params.restaurantId}
          cleanPaths={cleanPaths}
        >
          {children}
        </MobileExperienceSurface>
      ) : children}
    </RestaurantThemeProvider>
  );
}
