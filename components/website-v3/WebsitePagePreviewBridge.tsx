"use client";

import { useEffect, useRef, useState } from "react";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import type { Restaurant, WebsiteSection } from "@/lib/types";
import {
  WEBSITE_V3_APPLIED,
  WEBSITE_V3_READY,
  acceptWebsiteV3StateMessage,
  resolveWebsiteV3AdminOrigin,
  websiteV3NavigationPages,
  type DraftStatePayload,
  type WebsiteV3DraftPage,
} from "@/lib/preview/websiteV3Protocol";
import { mapWebsiteConfig } from "@/lib/websiteConfig";
import type {
  WebsiteSection as WebsiteV3Section,
  WebsiteV3Page,
} from "@/lib/websiteV3Api";
import type { WebsitePageSearchParams } from "@/lib/websiteV3Rendering";
import {
  WebsitePageView,
  type WebsitePagePreparedData,
} from "./WebsitePageView";
import { WebsitePagePreviewSeo } from "./WebsitePagePreviewSeo";

type PreviewSnapshot = {
  revision: number;
  contentRevision: number;
  activePageKey: string;
  device: "desktop" | "mobile";
  origin: string;
  restaurant: Restaurant;
  page: WebsiteV3Page;
};

/** Applies trusted Website V3 draft messages to the synchronous page view. */
export function WebsitePagePreviewBridge({
  restaurant,
  page,
  preparedData,
  searchParams,
  configuredAdminOrigin,
}: {
  restaurant: Restaurant;
  page: WebsiteV3Page;
  preparedData: WebsitePagePreparedData;
  searchParams?: WebsitePageSearchParams;
  configuredAdminOrigin?: string;
}) {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const lastAcceptedRevision = useRef(-1);
  const lastAcknowledgedRevision = useRef(-1);

  useEffect(() => {
    const originPolicy = {
      configuredAdminOrigin,
      currentOrigin: window.location.origin,
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const accepted = acceptWebsiteV3StateMessage({
        data: event.data,
        origin: event.origin,
        expectedRestaurantId: restaurant.id,
        lastAppliedRevision: lastAcceptedRevision.current,
        originPolicy,
      });
      if (!accepted) return;

      lastAcceptedRevision.current = accepted.message.revision;
      setSnapshot({
        revision: accepted.message.revision,
        contentRevision: accepted.message.contentRevision,
        activePageKey: accepted.message.activePageKey,
        device: accepted.message.device,
        origin: event.origin,
        restaurant: materializeRestaurant(restaurant, accepted.message.state),
        page: materializePage(
          page,
          restaurant.id,
          accepted.page,
          accepted.message.state,
        ),
      });
    };

    window.addEventListener("message", handleMessage);
    const readyOrigin = resolveWebsiteV3AdminOrigin(originPolicy);
    if (window.parent !== window && readyOrigin) {
      window.parent.postMessage({ type: WEBSITE_V3_READY }, readyOrigin);
    }
    return () => window.removeEventListener("message", handleMessage);
  }, [configuredAdminOrigin, page, restaurant]);

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.revision <= lastAcknowledgedRevision.current
    ) {
      return;
    }
    lastAcknowledgedRevision.current = snapshot.revision;
    window.parent.postMessage(
      {
        type: WEBSITE_V3_APPLIED,
        revision: snapshot.revision,
        contentRevision: snapshot.contentRevision,
        activePageKey: snapshot.activePageKey,
        device: snapshot.device,
      },
      snapshot.origin,
    );
  }, [snapshot]);

  const renderedRestaurant = snapshot?.restaurant ?? restaurant;
  const renderedPage = snapshot?.page ?? page;
  return (
    <RestaurantThemeProvider
      config={renderedRestaurant.websiteConfig ?? null}
      pageMode={
        renderedPage.type === "order" || renderedPage.type === "catering"
          ? "commerce"
          : "content"
      }
    >
      <WebsitePagePreviewSeo
        restaurant={renderedRestaurant}
        page={renderedPage}
      />
      <WebsitePageView
        restaurant={renderedRestaurant}
        page={renderedPage}
        preparedData={preparedData}
        searchParams={searchParams}
      />
    </RestaurantThemeProvider>
  );
}

function materializeRestaurant(
  restaurant: Restaurant,
  state: DraftStatePayload,
): Restaurant {
  const websiteConfig = mapWebsiteConfig({
    ...state.config,
    pages: websiteV3NavigationPages(state),
  });
  return {
    ...restaurant,
    logoUrl:
      typeof state.config.preview_restaurant_logo_url === "string"
        ? state.config.preview_restaurant_logo_url
        : restaurant.logoUrl,
    websiteConfig: websiteConfig
      ? { ...restaurant.websiteConfig, ...websiteConfig }
      : restaurant.websiteConfig,
    websiteSections: state.sections
      .filter(
        (section) =>
          section.id === undefined ||
          !state.deleted_section_ids.includes(section.id),
      )
      .map(mapDraftSection),
  };
}

function materializePage(
  fallback: WebsiteV3Page,
  restaurantId: number,
  draft: WebsiteV3DraftPage,
  state: DraftStatePayload,
): WebsiteV3Page {
  const id = draft.id ?? syntheticID(draft.tmp_id ?? draft.slug);
  const sections = state.sections
    .filter(
      (section) =>
        (section.id === undefined ||
          !state.deleted_section_ids.includes(section.id)) &&
        sectionBelongsToPage(section, draft),
    )
    .map((section, index) =>
      mapDraftV3Section(section, index, restaurantId, id, fallback),
    );
  const base = {
    id,
    restaurant_id: restaurantId,
    slug: draft.slug,
    title: draft.title,
    sort_order: draft.sort_order,
    nav_visible: draft.nav_visible ?? true,
    is_default: draft.is_default ?? false,
    seo: mapSeo(draft.seo),
    appearance_overrides: draft.appearance_overrides ?? {},
    sections,
    created_at: fallback.created_at,
    updated_at: fallback.updated_at,
  };

  switch (draft.type) {
    case "landing":
      return { ...base, type: "landing", settings: {} };
    case "content":
      return { ...base, type: "content", settings: {} };
    case "order":
      return {
        ...base,
        type: "order",
        settings: { menu_ids: numericIDs(draft.settings?.menu_ids) },
      };
    case "catering":
      return {
        ...base,
        type: "catering",
        settings: {
          service_ids: numericIDs(draft.settings?.service_ids),
        },
      };
  }
}

function mapDraftSection(
  section: DraftStatePayload["sections"][number],
): WebsiteSection {
  return {
    id: section.id ?? syntheticID(section.tmp_id ?? section.section_type),
    sectionType: section.section_type,
    page: section.page,
    sortOrder: section.sort_order,
    isVisible: section.is_visible,
    layout: section.layout,
    content: section.content,
    settings: section.settings,
  };
}

function mapDraftV3Section(
  section: DraftStatePayload["sections"][number],
  index: number,
  restaurantId: number,
  pageId: number,
  fallback: WebsiteV3Page,
): WebsiteV3Section {
  return {
    id:
      section.id ??
      syntheticID(section.tmp_id ?? `${section.section_type}-${index}`),
    restaurant_id: restaurantId,
    section_type: section.section_type,
    page: section.page,
    page_id: pageId,
    sort_order: section.sort_order,
    is_visible: section.is_visible,
    layout: section.layout,
    content: section.content,
    settings: section.settings,
    created_at: fallback.created_at,
    updated_at: fallback.updated_at,
  };
}

function sectionBelongsToPage(
  section: DraftStatePayload["sections"][number],
  page: WebsiteV3DraftPage,
): boolean {
  if (page.id !== undefined && section.page_id !== undefined) {
    return section.page_id === page.id;
  }
  if (page.tmp_id && section.page_tmp_id) {
    return section.page_tmp_id === page.tmp_id;
  }
  if (section.page_id !== undefined || section.page_tmp_id !== undefined) {
    return false;
  }
  return section.page === page.slug;
}

function numericIDs(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is number =>
          Number.isInteger(entry) && Number(entry) > 0,
      )
    : [];
}

function mapSeo(value?: Record<string, unknown>): WebsiteV3Page["seo"] {
  return {
    ...(typeof value?.title === "string" ? { title: value.title } : {}),
    ...(typeof value?.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value?.share_image_url === "string"
      ? { share_image_url: value.share_image_url }
      : {}),
  };
}

function syntheticID(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return -(Math.abs(hash) || 1);
}
