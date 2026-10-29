import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparedCheckoutItems, preparedCheckoutCartLines } from '../internal-checkout';

test('prepared basket includes fixed combo modifier deltas without repricing ordinary snapshots', () => {
  const snapshots = [
    { id: 1, menu_item_id: 10, name: 'Main', quantity: 2, price: 3, combo_group: 'meal', combo_name: 'Meal', combo_price: 30, modifiers: [{ name: 'Extra', price_delta: 2 }] },
    { id: 2, menu_item_id: 11, name: 'Drink', quantity: 1, price: 0, combo_group: 'meal', combo_name: 'Meal', combo_price: 30 },
    { id: 3, menu_item_id: 12, name: 'Item', quantity: 1, price: 15, selected_variant_name: 'Large', modifiers: [{ name: 'Included in snapshot', price_delta: 3 }] },
  ];
  const before = structuredClone(snapshots);
  const lines = preparedCheckoutItems(snapshots);
  assert.equal(lines[0].total, 40);
  assert.ok(lines[0].details.includes('Extra'));
  assert.equal(lines[1].total, 15);
  assert.ok(lines[1].details.includes('Large'));
  assert.deepEqual(snapshots, before);
});

test('normal cart rendering keeps saved line prices and only borrows public catalog images', () => {
  const lines = preparedCheckoutCartLines([{id:1, menu_item_id:7, name:'Saved name', quantity:2, price:30, selected_variant_name:'Large'}], [{id:'7',name:'Changed name',price:900,groupId:'public',imageUrl:'/synthetic.png'}]);
  assert.equal(lines[0].item.name, 'Saved name');
  assert.equal(lines[0].item.price, 30);
  assert.equal(lines[0].item.imageUrl, '/synthetic.png');
  assert.equal(lines[0].quantity, 2);
  assert.match(lines[0].note ?? '', /Large/);
});
