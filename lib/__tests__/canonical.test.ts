import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCanonicalUrl,
  normalizeCustomDomain,
  storefrontPath,
} from '../canonical';

const FOODY = 'https://app.foody-pos.co.il';
const SUBDOMAIN = 'https://mamie-tlv.app.foody-pos.co.il';
const OWN = 'https://mamietlv.co.il';

// The point of the whole exercise: all three addresses must name the
// restaurant's own domain, so Google consolidates onto the domain it pays for
// instead of picking the Foody host.
test('every address canonicalises to the restaurant own domain', () => {
  const cases: Array<[string, string, string]> = [
    // [requestOrigin, public path, expected canonical]
    [OWN, '/order', `${OWN}/order`],
    [SUBDOMAIN, '/order', `${OWN}/order`],
    [FOODY, '/r/mamie-tlv/order', `${OWN}/order`],
  ];
  for (const [requestOrigin, path, want] of cases) {
    const got = buildCanonicalUrl({
      requestOrigin,
      path,
      slug: 'mamie-tlv',
      customDomain: 'mamietlv.co.il',
    });
    assert.equal(got, want, `${requestOrigin}${path}`);
  }
});

test('the storefront home canonicalises to the domain root', () => {
  assert.equal(
    buildCanonicalUrl({
      requestOrigin: FOODY,
      path: '/r/mamie-tlv',
      slug: 'mamie-tlv',
      customDomain: 'mamietlv.co.il',
    }),
    `${OWN}/`
  );
});

// A restaurant without a domain of its own has exactly one address, and it must
// stay indexed under it — pointing its canonical anywhere else would unlist it.
test('a restaurant with no domain stays its own canonical', () => {
  for (const customDomain of [undefined, null, '']) {
    assert.equal(
      buildCanonicalUrl({
        requestOrigin: FOODY,
        path: '/r/sans-domaine/order',
        slug: 'sans-domaine',
        customDomain,
      }),
      `${FOODY}/r/sans-domaine/order`,
      String(customDomain)
    );
  }
});

// A malformed stored value must not become a malformed canonical: dropping it
// falls back to the address being served, which is always valid.
test('an unusable stored domain is ignored rather than emitted', () => {
  for (const bad of ['not a domain', 'localhost', 'mamietlv', '.co.il', 'a..b', '<script>']) {
    assert.equal(normalizeCustomDomain(bad), null, bad);
    assert.equal(
      buildCanonicalUrl({ requestOrigin: OWN, path: '/order', slug: 'mamie-tlv', customDomain: bad }),
      `${OWN}/order`,
      bad
    );
  }
});

test('a stored domain is tidied before use', () => {
  assert.equal(normalizeCustomDomain('  MamieTLV.co.il  '), 'mamietlv.co.il');
  assert.equal(normalizeCustomDomain('https://mamietlv.co.il'), 'mamietlv.co.il');
  assert.equal(normalizeCustomDomain('https://mamietlv.co.il/'), 'mamietlv.co.il');
  assert.equal(normalizeCustomDomain('sub.mamietlv.co.il'), 'sub.mamietlv.co.il');
});

test('only the storefront prefix is stripped, and only its own', () => {
  assert.equal(storefrontPath('/r/mamie-tlv/order', 'mamie-tlv'), '/order');
  assert.equal(storefrontPath('/r/mamie-tlv', 'mamie-tlv'), '/');
  assert.equal(storefrontPath('/order', 'mamie-tlv'), '/order');
  // A different restaurant's prefix, and a slug that merely shares a stem, are
  // left alone rather than half-stripped.
  assert.equal(storefrontPath('/r/autre/order', 'mamie-tlv'), '/r/autre/order');
  assert.equal(storefrontPath('/r/mamie-tlv-2/order', 'mamie-tlv'), '/r/mamie-tlv-2/order');
  assert.equal(storefrontPath('/r/mamie-tlv/order', null), '/r/mamie-tlv/order');
});
