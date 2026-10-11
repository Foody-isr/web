import assert from 'node:assert/strict';
import test from 'node:test';
import { apiOriginForHost } from '../api-origin';

test('immutable guest artifact resolves production, development, tenant and custom hosts', () => {
  const fallback = 'http://fixture:8080';
  for (const host of ['dev-app.foody-pos.co.il', 'bella.dev-app.foody-pos.co.il']) assert.equal(apiOriginForHost(host, fallback), 'https://dev-api.foody-pos.co.il');
  for (const host of ['app.foody-pos.co.il', 'bella.app.foody-pos.co.il', 'mamietlv.co.il']) assert.equal(apiOriginForHost(host, fallback), 'https://api.foody-pos.co.il');
  for (const host of [undefined, 'localhost:3100', 'preview.vercel.app']) assert.equal(apiOriginForHost(host, fallback), fallback);
});
