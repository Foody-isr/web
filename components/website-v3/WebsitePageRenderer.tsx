import type { Restaurant } from "@/lib/types";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import {
  parseOrderPageSearchParams,
  type WebsitePageSearchParams,
} from "@/lib/websiteV3Rendering";
import {
  fetchCateringCatalog,
  fetchCateringServices,
  fetchChainOrderEntry,
  fetchMenu,
  type ChainOrderEntry,
} from "@/services/api";
import { notFound } from "next/navigation";
import { WebsitePagePreviewBridge } from "./WebsitePagePreviewBridge";
import {
  WebsitePageView,
  type WebsitePagePreparedData,
} from "./WebsitePageView";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import { applyWebsiteV3PageAppearance } from "@/lib/websiteV3Appearance";
import { materializePublishedWebsitePages } from "@/lib/websiteConfig";

export { rendererKind } from "./WebsitePageView";

/** Loads commerce data on the server before dispatching to the shared page view. */
export async function WebsitePageRenderer({
  restaurant,
  page,
  pages,
  searchParams,
  cateringPath,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
  pages?: WebsiteV3Page[];
  searchParams?: WebsitePageSearchParams;
  cateringPath?: { serviceSlug: string; itemSlug?: string };
}) {
  const preview = first(searchParams?.preview) === "1";

  const query = parseOrderPageSearchParams(searchParams);
  const loadMenu = preview || page.type === "order";
  const loadServices = preview || page.type === "catering";
  const shouldLoadBranches =
    (page.type === "landing" || page.type === "content") &&
    page.slug === "boutiques" &&
    restaurant.chainPrimaryRestaurantId === restaurant.id &&
    Boolean(restaurant.chainSlug);
  const [menu, cateringServices, chainEntry] = await Promise.all([
    loadMenu
      ? fetchMenu(String(restaurant.id), query.previewDate)
      : Promise.resolve(null),
    loadServices
      ? fetchCateringServices(String(restaurant.id))
      : Promise.resolve(null),
    shouldLoadBranches
      ? fetchChainOrderEntry(restaurant.chainSlug!).catch(() => null)
      : Promise.resolve<ChainOrderEntry | null>(null),
  ]);
  let cateringSelection: WebsitePagePreparedData["cateringSelection"] = null;
  if (cateringPath) {
    if (page.type !== "catering" || !cateringServices) notFound();
    const selectedService = cateringServices.find((service) => service.slug === cateringPath.serviceSlug);
    if (!selectedService) notFound();
    const catalog = await fetchCateringCatalog(restaurant.id, selectedService.id);
    const selectedItem = cateringPath.itemSlug
      ? catalog.items.find((item) => item.slug === cateringPath.itemSlug)
      : undefined;
    if (cateringPath.itemSlug && !selectedItem) notFound();
    cateringSelection = { service: selectedService, catalog, item: selectedItem };
  }

  const preparedData: WebsitePagePreparedData = {
    menu,
    cateringServices,
    cateringSelection,
    chainEntry,
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

  const renderedRestaurant = applyWebsiteV3PageAppearance(
    pages ? materializePublishedWebsitePages(restaurant, pages) : restaurant,
    page,
  );
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
