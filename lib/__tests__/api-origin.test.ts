import assert from 'node:assert/strict';
import test from 'node:test';
import { apiOriginForHost, allowsDevelopmentOtpBypass } from '../api-origin';

test('immutable guest artifact resolves production, development, tenant and custom hosts', () => {
  const fallback = 'http://fixture:8080';
  for (const host of ['dev-app.foody-pos.co.il', 'bella.dev-app.foody-pos.co.il']) assert.equal(apiOriginForHost(host, fallback), 'https://dev-api.foody-pos.co.il');
  for (const host of ['app.foody-pos.co.il', 'bella.app.foody-pos.co.il', 'mamietlv.co.il']) assert.equal(apiOriginForHost(host, fallback), 'https://api.foody-pos.co.il');
  for (const host of [undefined, 'localhost:3100', 'bella.localhost', '[::1]:3100', '192.168.1.4:3100', 'preview.vercel.app']) assert.equal(apiOriginForHost(host, fallback), fallback);
});

test('a promoted development build never enables the OTP bypass on production hosts', () => {
  for (const host of ['app.foody-pos.co.il', 'bella.app.foody-pos.co.il', 'mamietlv.co.il', 'www.mamietlv.co.il', 'foodyweb-nine.vercel.app', 'dev-app.foody-pos.co.il.evil.example', undefined]) {
    assert.equal(allowsDevelopmentOtpBypass(host, true), false);
  }
  for (const host of ['dev-app.foody-pos.co.il', 'bella.dev-app.foody-pos.co.il', 'DEV-APP.FOODY-POS.CO.IL:443', 'localhost:3141', 'bella.localhost', '127.0.0.1', '[::1]:3141']) {
    assert.equal(allowsDevelopmentOtpBypass(host, true), true);
    assert.equal(allowsDevelopmentOtpBypass(host, false), false);
  }
});
