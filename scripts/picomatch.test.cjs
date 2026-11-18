const assert = require('node:assert/strict');
const { realpathSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');

for (const [major, consumers] of [[2, ['anymatch', 'micromatch', 'readdirp']], [4, ['tinyglobby', 'vite']]]) {
  test(`build tools use the reviewed picomatch ${major} parser`, () => {
    const expected = realpathSync(path.join(__dirname, '..', 'vendor', `picomatch-v${major}`, 'index.js'));
    for (const consumer of consumers) {
      const fromConsumer = createRequire(require.resolve(consumer));
      assert.equal(realpathSync(fromConsumer.resolve('picomatch')), expected, consumer);
      if (major === 4) {
        const fromFdir = createRequire(fromConsumer.resolve('fdir'));
        assert.equal(realpathSync(fromFdir.resolve('picomatch')), expected, `${consumer}/fdir`);
      }
    }
  });

  test(`picomatch ${major} keeps filename filtering and compiles a repeated filename prefix once`, () => {
    const match = createRequire(require.resolve(consumers[0]))('picomatch');
    assert.equal(match('src/**/*.{js,ts}')('src/checkout/card.ts'), true);
    assert.equal(match('src/**/*.{js,ts}')('src/checkout/card.css'), false);
    for (const options of [{}, { maxExtglobRecursion: false }]) {
      const pattern = '+(invoice-*)';
      assert.equal(match(pattern, options)('invoice-today'), true);
      assert.equal(match(pattern, options)('menu-today'), false);
      assert.doesNotMatch(match.makeRe(pattern, options).source, /\)[+*]/);
    }
  });
}
