import assert from 'node:assert/strict';
import test from 'node:test';
import { modifierAtPosition, modifierPositionCount } from '../modifier-selection';
import { formatModifierLabel, modifiersDelta } from '../cart';
import type { ModifierSelectionConfig } from '../types';

const config: ModifierSelectionConfig = { source: 'option', source_id: 1, presentation: 'characters', choices: [{ id: 1, count: 1 }, { id: 2, count: 2 }] };
test('format determines positions; unlisted formats hide the group', () => {
  assert.equal(modifierPositionCount(config, [2], {}), 2);
  assert.equal(modifierPositionCount(config, [1], {}), 1);
  assert.equal(modifierPositionCount(config, [3], {}), 0);
  assert.equal(modifierPositionCount({ ...config, source: 'modifier' }, [], { '2': true }), 2);
  assert.equal(modifierPositionCount(null, [], {}), 1);
});
test('the same digit can occupy two independently priced positions', () => {
  const digit = { id: '9', name: '1', action: 'add' as const, priceDelta: 2 };
  const first = modifierAtPosition(digit, 1, 'Caractère 1');
  const second = modifierAtPosition(digit, 2, 'Caractère 2');
  assert.notEqual(first.id, second.id);
  assert.equal(first.catalogModifierId, second.catalogModifierId);
  assert.equal(formatModifierLabel(first, 'fr'), 'Caractère 1: 1');
  assert.equal(formatModifierLabel(second, 'fr'), 'Caractère 2: 1');
  assert.equal(modifiersDelta([first, second]), 4);
});
