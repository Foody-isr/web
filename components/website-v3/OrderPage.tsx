import { OrderExperience } from "@/components/OrderExperience";
import { PageAppearanceScope } from "@/components/PageAppearanceScope";
import { checkRestaurantAvailability } from "@/lib/availability";
import type {
  MenuResponse,
  OrderType,
  Restaurant,
} from "@/lib/types";
import {
  filterBySelectedIds,
  type WebsiteV3Page,
} from "@/lib/websiteV3Api";
import {
  canonicalPagePresentation,
  parseOrderPageSearchParams,
  type WebsitePageSearchParams,
} from "@/lib/websiteV3Rendering";
import { applyGroupBannerOverrides } from "@/lib/websiteV3Appearance";
import { normalizeCategoryNavigation } from "@/lib/categoryNavigation";
import { orderDiscoverySections } from "@/lib/orderDiscovery";

type OrderWebsitePage = Extract<WebsiteV3Page, { type: "order" }>;

function initialOrderTypeFor(
  restaurant: Restaurant,
  requestedType?: string,
): OrderType {
  const pickupEnabled = restaurant.pickupEnabled;
  const deliveryEnabled = restaurant.deliveryEnabled;
  const pickupOpen =
    pickupEnabled && checkRestaurantAvailability(restaurant, "pickup").isOpen;
  const deliveryOpen =
    deliveryEnabled &&
    checkRestaurantAvailability(restaurant, "delivery").isOpen;

  let initialOrderType: OrderType = "pickup";
  if (pickupOpen) initialOrderType = "pickup";
  else if (deliveryOpen) initialOrderType = "delivery";
  else if (pickupEnabled) initialOrderType = "pickup";
  else if (deliveryEnabled) initialOrderType = "delivery";

  if (requestedType === "pickup" && pickupEnabled) return "pickup";
  if (requestedType === "delivery" && deliveryEnabled) return "delivery";
  return initialOrderType;
}

/** Renders a prepared public menu through the canonical order-page chrome. */
export function OrderPageView({
  restaurant,
  page,
  pages,
  menu,
  searchParams,
  previewMode = false,
}: {
  restaurant: Restaurant;
  page: OrderWebsitePage;
  pages?: WebsiteV3Page[];
  menu: MenuResponse;
  searchParams?: WebsitePageSearchParams;
  previewMode?: boolean;
}) {
  const query = parseOrderPageSearchParams(searchParams);
  const presentation = canonicalPagePresentation(page);
  const previewDate = query.previewDate;
  const menuWithPageArtwork = applyGroupBannerOverrides(
    menu,
    page.appearance_overrides,
  );
  const scopedMenu = {
    ...menuWithPageArtwork,
    menus: filterBySelectedIds(
      menuWithPageArtwork.menus,
      page.settings.menu_ids,
    ),
  };

  return (
    <PageAppearanceScope appearance={page.appearance_overrides}>
      <OrderExperience
        menu={scopedMenu}
        restaurant={restaurant}
        initialOrderType={initialOrderTypeFor(
          restaurant,
          query.orderType,
        )}
        previewDate={previewDate}
        builderPreview={previewMode}
        pageSlug={presentation.pageSlug}
        pageSections={presentation.pageSections}
        showFooter={presentation.showFooter}
        categoryNavigation={normalizeCategoryNavigation(
          page.appearance_overrides.category_navigation,
        )}
        discoverySections={orderDiscoverySections(pages ?? [])}
      />
    </PageAppearanceScope>
  );
}
