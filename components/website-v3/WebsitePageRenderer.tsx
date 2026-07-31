import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  parseOrderPageSearchParams,
  type WebsitePageSearchParams,
} from "@/lib/websiteV3Rendering";
import {
  fetchCateringServices,
  fetchMenu,
} from "@/services/api";
import { WebsitePagePreviewBridge } from "./WebsitePagePreviewBridge";
import {
  WebsitePageView,
  type WebsitePagePreparedData,
} from "./WebsitePageView";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { applyWebsiteV3PageAppearance } from "@/lib/websiteV3Appearance";

export { rendererKind } from "./WebsitePageView";

/** Loads commerce data on the server before dispatching to the shared page view. */
export async function WebsitePageRenderer({
  restaurant,
  page,
  searchParams,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
  searchParams?: WebsitePageSearchParams;
}) {
  const preview = first(searchParams?.preview) === "1";

  const query = parseOrderPageSearchParams(searchParams);
  const loadMenu = preview || page.type === "order";
  const loadServices = preview || page.type === "catering";
  const [menu, cateringServices] = await Promise.all([
    loadMenu
      ? fetchMenu(String(restaurant.id), query.previewDate)
      : Promise.resolve(null),
    loadServices
      ? fetchCateringServices(String(restaurant.id))
      : Promise.resolve(null),
  ]);
  const preparedData: WebsitePagePreparedData = {
    menu,
    cateringServices,
  };

  if (preview) {
    return (
      <WebsitePagePreviewBridge
        restaurant={restaurant}
        page={page}
        preparedData={preparedData}
        searchParams={searchParams}
        configuredAdminOrigin={process.env.NEXT_PUBLIC_ADMIN_ORIGIN}
      />
    );
  }

  const renderedRestaurant = applyWebsiteV3PageAppearance(restaurant, page);
  return (
    <RestaurantThemeProvider
      config={renderedRestaurant.websiteConfig ?? null}
      pageMode="website"
    >
      <WebsitePageView
        restaurant={renderedRestaurant}
        page={page}
        preparedData={preparedData}
        searchParams={searchParams}
      />
    </RestaurantThemeProvider>
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
