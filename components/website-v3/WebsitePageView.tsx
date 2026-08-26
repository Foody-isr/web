import type { ReactNode } from "react";
import type { MenuResponse, Restaurant } from "@/lib/types";
import type {
  CateringCatalogItemPublic,
  CateringCatalogPublic,
  CateringServicePublic,
  ChainOrderEntry,
} from "@/services/api";
import type { WebsiteV3Page } from "@/lib/websiteV3Api";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";
import { CateringPageView } from "./CateringPage";
import { ContentPage } from "./ContentPage";
import { OrderPageView } from "./OrderPage";
import { websiteV3PageFieldHooks } from "@/lib/websiteV3FieldHooks";

export type WebsitePagePreparedData = {
  menu: MenuResponse | null;
  cateringServices: CateringServicePublic[] | null;
  cateringSelection: {
    service: CateringServicePublic;
    catalog: CateringCatalogPublic;
    item?: CateringCatalogItemPublic;
  } | null;
  chainEntry: ChainOrderEntry | null;
};

/** Returns the discriminant used by the universal public renderer. */
export function rendererKind(page: WebsiteV3Page): WebsiteV3Page["type"] {
  return page.type;
}

/** Synchronously renders a canonical page from already prepared server data. */
export function WebsitePageView({
  restaurant,
  page,
  preparedData,
  searchParams,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
  preparedData: WebsitePagePreparedData;
  searchParams?: WebsitePageSearchParams;
}) {
  const previewMode = first(searchParams?.preview) === "1";
  let content: ReactNode;
  switch (page.type) {
    case "landing":
    case "content":
      content = <ContentPage restaurant={restaurant} page={page} chainEntry={preparedData.chainEntry} />;
      break;
    case "order":
      if (!preparedData.menu) {
        throw new Error("Website order page requires prepared menu data");
      }
      content = (
        <OrderPageView
          restaurant={restaurant}
          page={page}
          menu={preparedData.menu}
          searchParams={searchParams}
          previewMode={previewMode}
        />
      );
      break;
    case "catering":
      if (!preparedData.cateringServices) {
        throw new Error(
          "Website catering page requires prepared service data",
        );
      }
      content = (
        <CateringPageView
          restaurant={restaurant}
          page={page}
          services={preparedData.cateringServices}
          initialSelection={preparedData.cateringSelection}
          previewMode={previewMode}
        />
      );
      break;
  }
  return (
    <div
      data-website-v3-page
      data-page-type={page.type}
      data-page-slug={page.slug}
      data-page-title={page.title}
      data-page-default={page.is_default ? "true" : "false"}
      {...websiteV3PageFieldHooks(restaurant, page)}
    >
      {content}
    </div>
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
