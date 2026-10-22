/** Persisted order line, with prices already resolved by the API. */
export type OrderItemSnapshot = {
  adjustment?: { kind: 'comp' | 'void'; reason: string; at: string } | null;
  seat_number?: number | null;
  id: number;
  menu_item_id: number;
  name: string;
  quantity: number;
  price: number;
  selected_variant_name?: string;
  option_selections?: { group_name: string; name: string; note?: string; note_label?: string }[];
  notes?: string;
  modifiers?: { name: string }[];
  combo_group?: string;
  combo_item_id?: number;
  combo_name?: string;
  combo_price?: number;
};

export type ConfirmationItem = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  total: number;
  details: string[];
};

/** Groups combo snapshots and keeps the API's resolved prices (including modifiers). */
export function confirmationItems(
  items: OrderItemSnapshot[],
): ConfirmationItem[] {
  const result: ConfirmationItem[] = [];
  const combos = new Map<string, ConfirmationItem>();
  for (const item of items) {
    if (item.adjustment?.kind === 'void') continue;
    if (item.combo_group) {
      let combo = combos.get(item.combo_group);
      if (!combo) {
        combo = {
          id: item.combo_group,
          menuItemId: String(item.combo_item_id ?? item.menu_item_id),
          name: item.combo_name || item.name,
          quantity: 1,
          total: item.adjustment ? 0 : item.combo_price ?? 0,
          details: [],
        };
        combos.set(item.combo_group, combo);
        result.push(combo);
      }
      combo.total += item.adjustment ? 0 : item.price * item.quantity;
      combo.details.push(`${item.quantity} × ${item.name}`);
    } else {
      result.push({
        id: String(item.id),
        menuItemId: String(item.menu_item_id),
        name: item.name,
        quantity: item.quantity,
        total: item.adjustment ? 0 : item.price * item.quantity,
        details: [
          item.selected_variant_name,
          ...(item.option_selections?.flatMap(selection => [`${selection.group_name}: ${selection.name}`, ...(selection.note ? [selection.note_label ? `${selection.note_label}: ${selection.note}` : selection.note] : [])]) ?? []),
          item.notes,
          ...(item.modifiers?.map((modifier) => modifier.name) ?? []),
        ].filter((value): value is string => Boolean(value)),
      });
    }
  }
  return result;
}
