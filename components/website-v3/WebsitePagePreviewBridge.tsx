"use client";

import { useEffect, useRef, useState } from "react";
import { RestaurantThemeProvider } from "@/lib/restaurant-theme";
import type { Restaurant } from "@/lib/types";
import {
  WEBSITE_V3_APPLIED,
  WEBSITE_V3_NAVIGATE,
  WEBSITE_V3_READY,
  acceptWebsiteV3StateMessage,
  resolveWebsiteV3PreviewNavigationPageKey,
  resolveWebsiteV3AdminOrigin,
  type DraftStatePayload,
  type WebsiteV3DraftPage,
} from "@/lib/preview/websiteV3Protocol";
import {
  materializeWebsiteV3PreviewRestaurant,
  syntheticWebsiteV3PreviewID,
} from "@/lib/preview/materializeWebsiteV3Preview";
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
import { applyWebsiteV3PageAppearance } from "@/lib/websiteV3Appearance";

type PreviewSnapshot = {
  revision: number;
  contentRevision: number;
  activePageKey: string;
  device: "desktop" | "mobile";
  origin: string;
  restaurant: Restaurant;
  page: WebsiteV3Page;
  pages: WebsiteV3DraftPage[];
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
        restaurant: materializeWebsiteV3PreviewRestaurant(
          restaurant,
          accepted.message.state,
        ),
        page: materializePage(
          page,
          restaurant.id,
          accepted.page,
          accepted.message.state,
        ),
        pages: accepted.message.state.pages ?? [],
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

  useEffect(() => {
    if (!snapshot) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const pageKey = draftPageKeyForHref(
        anchor.href,
        restaurant,
        snapshot.pages,
      );
      if (!pageKey) return;
      event.preventDefault();
      window.parent.postMessage(
        { type: WEBSITE_V3_NAVIGATE, pageKey },
        snapshot.origin,
      );
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [restaurant, snapshot]);

  const renderedRestaurant = snapshot?.restaurant ?? restaurant;
  const renderedPage = snapshot?.page ?? page;
  const pageRestaurant = applyWebsiteV3PageAppearance(
    renderedRestaurant,
    renderedPage,
  );
  return (
    <RestaurantThemeProvider
      config={pageRestaurant.websiteConfig ?? null}
      pageMode="website"
    >
      <WebsitePagePreviewSeo
        restaurant={pageRestaurant}
        page={renderedPage}
      />
      <WebsitePageView
        restaurant={pageRestaurant}
        page={renderedPage}
        preparedData={preparedData}
        searchParams={searchParams}
      />
    </RestaurantThemeProvider>
  );
}

function draftPageKeyForHref(
  href: string,
  restaurant: Restaurant,
  pages: WebsiteV3DraftPage[],
): string | null {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  const restaurantSlug = restaurant.slug || String(restaurant.id);
  const prefix = `/r/${encodeURIComponent(restaurantSlug)}`;
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
    return null;
  }
  const requestedSlug = decodeURIComponent(
    url.pathname.slice(prefix.length).replace(/^\/|\/$/g, ""),
  );
  return resolveWebsiteV3PreviewNavigationPageKey(requestedSlug, pages);
}

function materializePage(
  fallback: WebsiteV3Page,
  restaurantId: number,
  draft: WebsiteV3DraftPage,
  state: DraftStatePayload,
): WebsiteV3Page {
  const id =
    draft.id ?? syntheticWebsiteV3PreviewID(draft.tmp_id ?? draft.slug);
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
    is_homepage: draft.is_homepage ?? fallback.is_homepage,
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
      syntheticWebsiteV3PreviewID(
        section.tmp_id ?? `${section.section_type}-${index}`,
      ),
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
