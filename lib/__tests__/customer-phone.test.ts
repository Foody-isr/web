import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customerPhoneCountries, customerPhoneParts, normalizeCustomerPhone } from '../customer-phone';

test('normalizes valid international and Israeli contacts without losing significant zeros', () => {
  for (const [input, expected] of [
    ['050-234-5678', '+972502345678'], ['50 234 5678', '+972502345678'],
    ['972502345678', '+972502345678'], ['00972 50 234 5678', '+972502345678'],
    ['+33 (0)6 12 34 56 78', '+33612345678'], ['+1 202 555 0123', '+12025550123'],
    ['+39 02 3661 8300', '+390236618300'], ['03-123-4567', '+97231234567'],
  ]) assert.equal(normalizeCustomerPhone(input), expected);
  assert.equal(normalizeCustomerPhone('06 12 34 56 78', '+33'), '+33612345678');
});

test('rejects incomplete numbers, invalid numbering plans, extensions and embedded text', () => {
  for (const input of ['', '050', '1234567890', '0501234567', '+999123456789',
    '++972502345678', 'call 0502345678', '0502345678 ext 1',
    '0502345678/0522345678', '+97250234abc5678']) {
    assert.equal(normalizeCustomerPhone(input), null, input);
  }
});


test('defaults to the restaurant country, including countries outside the former shortlist', () => {
  for (const [country, code] of [['FR', '+33'], ['IL', '+972'], ['GB', '+44'], ['CH', '+41'], ['MA', '+212'], ['CA', '+1'], [' fr ', '+33']]) {
    const choices = customerPhoneCountries(country);
    assert.equal(choices[0].code, code);
    assert.equal(new Set(choices.map(choice => choice.code)).size, choices.length);
    assert.ok(choices.some(choice => choice.code === '+48'));
  }
  assert.equal(customerPhoneCountries('CA')[0].country, 'CA');
  for (const country of [undefined, '', 'XX']) assert.equal(customerPhoneCountries(country)[0].code, '+972');
});

test('restores the saved number country and keeps significant national zeros', () => {
  for (const [phone, callingCode, nationalNumber] of [
    ['+33612345678', '+33', '612345678'],
    ['+972502345678', '+972', '502345678'],
    ['+41791234567', '+41', '791234567'],
    ['+390236618300', '+39', '0236618300'],
  ]) {
    const parts = customerPhoneParts(phone, '+44');
    assert.deepEqual(parts, { callingCode, nationalNumber });
    assert.equal(normalizeCustomerPhone(parts!.nationalNumber, parts!.callingCode), phone);
  }
  assert.equal(customerPhoneParts('050', '+33'), null);
});
