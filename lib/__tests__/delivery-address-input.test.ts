import assert from 'node:assert/strict';
import test from 'node:test';
import { samePostalBuilding, enteredPostalAddress, postalForSelectedStreet } from '../delivery-address-input';

test('takes the typed number only for the selected street and city', () => {
  const selected = { address: 'Example Street', city: 'Netanya' };
  assert.deepEqual(postalForSelectedStreet('Example 6 Netanya', selected, selected.address, 'Netanya'), { address: 'Example 6', city: 'Netanya' });
  assert.equal(postalForSelectedStreet('Other Street 6', selected, selected.address, 'Netanya'), undefined);
  assert.equal(postalForSelectedStreet('Example 6, Other City', selected, selected.address, 'Netanya'), undefined);
  assert.equal(postalForSelectedStreet('Route 66', { address: 'Route 66', city: 'Paris' }, 'Route 66', 'Paris'), undefined);
});

test('prefers the number actually selected and keeps its text when Details returns another building', () => {
  const selected = { address: '6 bis rue Exemple', city: 'Paris' };
  assert.deepEqual(postalForSelectedStreet('Exemple 8', selected, 'rue Exemple', 'Paris', '7'), selected);
  assert.equal(postalForSelectedStreet('Exemple 8', selected, 'rue Exemple', 'Paris', '6 bis'), undefined);
});

test('recognizes a complete typed address while leaving incomplete or ambiguous input in the field', () => {
  assert.deepEqual(enteredPostalAddress('רחוב הדוגמה 9 גבעת שמואל', ['Guivat Shmuel']), { address: 'רחוב הדוגמה 9', city: 'גבעת שמואל' });
  assert.deepEqual(enteredPostalAddress('100 Example St Herzlya', ['הרצליה']), { address: '100 Example St', city: 'Herzlya' });
  assert.equal(enteredPostalAddress('Rue du 8 Mai', ['Paris']), undefined);
  assert.equal(enteredPostalAddress('Example Street', ['Netanya']), undefined);
});

test('matches the chosen building across city spellings and excludes other streets, cities, and numbering', () => {
  const a = { address: 'Sample Street 6', city: 'Herzlya' };
  assert.deepEqual(enteredPostalAddress('Sample 6 Hzrzlya', ['הרצליה']), { address: 'Sample 6', city: 'Hzrzlya' });
  assert.equal(samePostalBuilding(a, { address: '6 Sample', city: 'הרצליה' }), true);
  for (const b of [{ address: 'Sample 6', city: 'Netanya' }, { address: 'Other 6', city: 'Herzliya' }, { address: 'Sample 6A', city: 'Herzliya' }]) {
    assert.equal(samePostalBuilding(a, b), false);
  }
  assert.equal(samePostalBuilding({ address: 'Example 1/2', city: 'A' }, { address: 'Example 12', city: 'A' }), false);
});
