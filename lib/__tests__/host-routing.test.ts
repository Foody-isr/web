import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isFoodyHost,
  isRestaurantSubdomain,
  shouldRedirectRootToMarketing,
} from '../host-routing';

// Regression: a `redirects()` entry for `source: "/"` in next.config.mjs fired
// on every host the deployment serves, and next.config redirects run before
// middleware — so guests on mamietlv.co.il were 308'd to foody-pos.co.il
// before the custom-domain rewrite ever ran.
test('a restaurant custom domain root is never sent to the marketing site', () => {
  for (const host of ['mamietlv.co.il', 'www.mamietlv.co.il', 'mamietlv.co.il:443']) {
    assert.equal(shouldRedirectRootToMarketing(host, '/'), false, host);
  }
});

test('custom domain sub-paths are never sent to the marketing site', () => {
  for (const path of ['/order', '/order/checkout', '/menu', '/contact']) {
    assert.equal(shouldRedirectRootToMarketing('mamietlv.co.il', path), false, path);
  }
});

test('the Foody app root is sent to the marketing site', () => {
  for (const host of [
    'foody-pos.co.il',
    'www.foody-pos.co.il',
    'app.foody-pos.co.il',
    'dev-app.foody-pos.co.il',
  ]) {
    assert.equal(shouldRedirectRootToMarketing(host, '/'), true, host);
  }
});

test('a storefront subdomain root stays on the storefront', () => {
  assert.equal(shouldRedirectRootToMarketing('mamie-tlv.app.foody-pos.co.il', '/'), false);
});

test('only the root path redirects on Foody hosts', () => {
  assert.equal(shouldRedirectRootToMarketing('app.foody-pos.co.il', '/r/1'), false);
  assert.equal(shouldRedirectRootToMarketing('app.foody-pos.co.il', '/order'), false);
});

test('local dev and preview deployments are left alone', () => {
  assert.equal(shouldRedirectRootToMarketing('localhost:3000', '/'), false);
  assert.equal(shouldRedirectRootToMarketing('mamie-tlv.localhost:3000', '/'), false);
  assert.equal(shouldRedirectRootToMarketing('foodyweb-abc123.vercel.app', '/'), false);
});

test('host classification', () => {
  assert.equal(isFoodyHost('app.foody-pos.co.il'), true);
  assert.equal(isFoodyHost('mamietlv.co.il'), false);

  assert.equal(isRestaurantSubdomain('mamie-tlv.app.foody-pos.co.il'), true);
  assert.equal(isRestaurantSubdomain('app.foody-pos.co.il'), false);
  assert.equal(isRestaurantSubdomain('foody-pos.co.il'), false);
  assert.equal(isRestaurantSubdomain('mamie-tlv.localhost:3000'), true);
});
