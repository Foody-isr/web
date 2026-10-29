import type { CartLine, MenuItem } from './types';
import { confirmationItems, type OrderItemSnapshot, type ConfirmationItem } from './order-summary';

/** Persisted prepared-basket lines, including fixed combo modifier price deltas. */
export type PreparedCheckoutItem = Omit<OrderItemSnapshot, 'modifiers'> & {
  modifiers?: { name: string; price_delta?: number }[];
};

/** Keeps combo extras in the reviewed basket total and retains their chosen details. */
export function preparedCheckoutItems(items: PreparedCheckoutItem[]): ConfirmationItem[] {
  const result = confirmationItems(items.map(item => ({
    ...item,
    price: item.price + (item.combo_group ? (item.modifiers ?? []).reduce((sum, modifier) => sum + (modifier.price_delta ?? 0), 0) : 0),
  })));
  const combos = new Map(result.map(line => [line.id, line]));
  for (const item of items) {
    if (!item.combo_group || item.adjustment?.kind === 'void') continue;
    combos.get(item.combo_group)?.details.push(...[
      item.selected_variant_name,
      ...(item.option_selections?.flatMap(selection => [`${selection.group_name}: ${selection.name}`, selection.note]) ?? []),
      ...(item.modifiers ?? []).map(modifier => modifier.name), item.notes,
    ].filter((detail): detail is string => Boolean(detail)));
  }
  return result;
}

/** Adapts saved prices to the normal cart renderer without changing the browser cart. */
export function preparedCheckoutCartLines(items: PreparedCheckoutItem[], catalog: MenuItem[] = []): CartLine[] {
  return preparedCheckoutItems(items).map(line => ({
    id: `prepared-${line.id}`, quantity: line.quantity, note: line.details.join(' · ') || undefined,
    item: {
      id: line.menuItemId, name: line.name, groupId: 'prepared',
      price: line.total / line.quantity,
      imageUrl: catalog.find(item => item.id === line.menuItemId)?.imageUrl,
    },
  }));
}
