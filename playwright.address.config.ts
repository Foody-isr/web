import { defineConfig, devices } from '@playwright/test';

/** Isolated Google address tests, including a synthetic SSR API with no real keys. */
export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'commerce.spec.ts',
  grep: /delivery address autocomplete/,
  outputDir: 'test-results/address',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3194',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node tests/fixtures/address-theme-server.mjs', port: 18081, reuseExistingServer: false },
    {
      command: 'npm run start -- -p 3194',
      url: 'http://localhost:3194',
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:18081' },
    },
  ],
});
