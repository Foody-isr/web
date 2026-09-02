import type { WebsiteSection } from "@/lib/types";

export const ORDER_DISCOVERY_SECTION_TYPE = "order_discovery";

export type OrderDiscoveryPlacement = {
  mode: "inside_group" | "between_groups";
  groupId: string | null;
  edge: "before" | "after";
  insertAfterItems: number;
};

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

/** Resolves a persisted placement against the groups currently visible.
 *  Historic sections keep their original behaviour: first group, after six
 *  products. If a configured group disappears, the first visible group is a
 *  deterministic preview/public fallback until the owner chooses another. */
export function orderDiscoveryPlacement(
  section: WebsiteSection,
  visibleGroupIds: readonly string[],
): OrderDiscoveryPlacement {
  const configuredGroupId = stableId(section.settings.placement_group_id);
  const groupId =
    configuredGroupId && visibleGroupIds.includes(configuredGroupId)
      ? configuredGroupId
      : visibleGroupIds[0] ?? null;
  const mode =
    section.settings.placement_mode === "between_groups"
      ? "between_groups"
      : "inside_group";

  return {
    mode,
    groupId,
    edge: section.settings.placement_edge === "before" ? "before" : "after",
    insertAfterItems: orderDiscoveryInsertAfter(section),
  };
}

function stableId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
