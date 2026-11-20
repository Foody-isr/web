import { defineConfig, devices } from '@playwright/test';

/** Guest address and hosted-payment return journeys against the synthetic SSR API. */
export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'commerce.spec.ts',
  grep: /delivery address autocomplete|hosted payment browser back/,
  outputDir: 'test-results/address',
  workers: 1,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  use: {
    baseURL: 'http://localhost:3194',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node tests/fixtures/address-theme-server.mjs', port: 18081, reuseExistingServer: false },
    {
      command: 'npm run start -- -p 3194',
      timeout: 120000,
      url: 'http://localhost:3194',
      reuseExistingServer: false,
      env: { NODE_OPTIONS: '--no-experimental-strip-types', NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:18081' },
    },
  ],
});
