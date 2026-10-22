import type { MenuItemModifier, ModifierSelectionConfig } from "./types";

/** Resolves a group's visibility or position count from its selected upstream choice. */
export function modifierPositionCount(config: ModifierSelectionConfig | null | undefined, optionIds: number[], selected: Record<string, boolean>): number {
  if (!config?.source) return 1;
  const choice = config.choices.find(c => config.source === "option" ? optionIds.includes(c.id) : selected[String(c.id)]);
  return choice?.count ?? 0;
}

/** Creates independent selection keys while keeping the original catalog ID for the API. */
export function modifierAtPosition(modifier: MenuItemModifier, index: number, label: string): MenuItemModifier {
  return { ...modifier, id: `${modifier.id}@${index}`, catalogModifierId: modifier.id, selectionIndex: index, selectionGroupName: label };
}
