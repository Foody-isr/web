import type { Restaurant, WebsiteSection } from "@/lib/types";
import { mapWebsiteConfig } from "@/lib/websiteConfig";
import {
  websiteV3NavigationPages,
  type DraftStatePayload,
} from "@/lib/preview/websiteV3Protocol";

/** Materializes every restaurant field owned by a trusted Website V3 preview state. */
export function materializeWebsiteV3PreviewRestaurant(
  restaurant: Restaurant,
  state: DraftStatePayload,
): Restaurant {
  const websiteConfig = mapWebsiteConfig({
    ...state.config,
    pages: websiteV3NavigationPages(state),
  });
  const previewStoriesAvailable =
    typeof state.config.stories_navigation_available === "boolean"
      ? state.config.stories_navigation_available
      : restaurant.storiesNavigationAvailable;
  return {
    ...restaurant,
    logoUrl:
      typeof state.config.restaurant_logo_url === "string"
        ? state.config.restaurant_logo_url
        : restaurant.logoUrl,
    storiesNavigationAvailable: previewStoriesAvailable,
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

/** Produces a stable negative identity for preview-only pages and sections. */
export function syntheticWebsiteV3PreviewID(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return -(Math.abs(hash) || 1);
}

function mapDraftSection(
  section: DraftStatePayload["sections"][number],
): WebsiteSection {
  return {
    id:
      section.id ??
      syntheticWebsiteV3PreviewID(section.tmp_id ?? section.section_type),
    sectionType: section.section_type,
    page: section.page,
    sortOrder: section.sort_order,
    isVisible: section.is_visible,
    layout: section.layout,
    content: section.content,
    settings: section.settings,
  };
}
