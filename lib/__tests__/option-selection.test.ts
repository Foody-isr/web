import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionPositions, selectedOptionSnapshots, optionSelectionLabels } from '../option-selection';
import { itemDisplayPriceRange } from '../cart';
import { createOrder } from '../../services/api';
import type { MenuItem } from '../types';

const item: MenuItem = { id: '1', name: 'Cake', groupId: '1', price: 55, optionSets: [
  { id: 2, name: 'Character', sortOrder: 0, selectionRole: 'identity', translations: { name: { fr: 'Caractère' } }, selectionConfig: { source: 'option', source_id: 1, presentation: 'characters', choices: [{ id: 101, count: 1 }, { id: 102, count: 2 }] }, options: [{ id: 201, name: '1', price: 999, isActive: true, sortOrder: 0 }] },
  { id: 1, name: 'Format', sortOrder: 1, options: [{ id: 101, name: 'One', price: 55, isActive: true, sortOrder: 0 }, { id: 102, name: 'Two', price: 110, isActive: true, sortOrder: 1 }] },
] };

test('descriptive variant positions preserve order, repetition and translated labels without pricing', () => {
  const positions = optionPositions(item, [102]);
  assert.deepEqual(positions.map(position => position.key), ['2@1', '2@2']);
  const selections = selectedOptionSnapshots(positions, { '2@1': 201, '2@2': 201 }, {});
  assert.deepEqual(optionSelectionLabels(selections, 'fr'), ['Caractère 1: 1', 'Caractère 2: 1']);
  assert.deepEqual(itemDisplayPriceRange(item), { min: 55, max: 110 });
  assert.equal(optionPositions(item, [101]).length, 1);
  assert.equal(optionPositions(item, [999]).length, 0);
});

test('public order payload keeps variant dimensions separate from modifiers', async () => {
  const originalFetch = globalThis.fetch;
  let submitted: { items: Record<string, unknown>[] } | undefined;
  globalThis.fetch = async (_input, init) => { submitted = JSON.parse(String(init?.body)); return Response.json({ order: { id: 1, items: [] } }); };
  try {
    await createOrder({ restaurantId: '1', orderType: 'pickup', customerPhone: '+972502345678', paymentMethod: 'pay_later', items: [{ itemId: '1', quantity: 1, selectedVariantId: 102, optionSelections: selectedOptionSnapshots(optionPositions(item, [102]), { '2@1': 201, '2@2': 201 }, {}), modifiers: [] }] });
    assert.equal(submitted?.items[0].selected_variant_id, 102);
    assert.deepEqual(submitted?.items[0].option_selections, [{ option_set_id: 2, option_id: 201, selection_index: 1 }, { option_set_id: 2, option_id: 201, selection_index: 2 }]);
    assert.deepEqual(submitted?.items[0].modifiers, []);
  } finally { globalThis.fetch = originalFetch; }
});
