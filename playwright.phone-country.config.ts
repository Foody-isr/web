import { defineConfig, devices } from '@playwright/test';

/** Isolated checkout country/phone checks use synthetic public data only. */
export default defineConfig({
  testDir: './tests/visual', testMatch: 'commerce.spec.ts', grep: /customer phone (validation|country)/,
  outputDir: 'test-results/phone-country', workers: 1, retries: 0, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3197', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'off' },
  webServer: [
    { command: 'node tests/fixtures/address-theme-server.mjs', port: 18086, reuseExistingServer: false, env: { FOODY_FIXTURE_PORT: '18086' } },
    { command: process.env.FOODY_PHONE_PRODUCTION === '1' ? 'npm run start -- -p 3197' : 'npm run dev -- -p 3197', url: 'http://localhost:3197', reuseExistingServer: false, env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:18086' } },
  ],
});
