import type { WebsiteSection } from "@/lib/types";

export const ORDER_DISCOVERY_SECTION_TYPE = "order_discovery";

/** Returns only visible discovery sections explicitly owned by the order page. */
export function orderDiscoverySections(
  pageSections: WebsiteSection[],
): WebsiteSection[] {
  return pageSections
    .filter(
      (section) =>
        section.isVisible &&
        section.sectionType === ORDER_DISCOVERY_SECTION_TYPE,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

/** Clamps the configured in-menu insertion point to a useful item count. */
export function orderDiscoveryInsertAfter(section: WebsiteSection): number {
  const configured = section.settings.insert_after_items;
  if (typeof configured !== "number" || !Number.isFinite(configured)) return 6;
  return Math.min(50, Math.max(1, Math.round(configured)));
}
