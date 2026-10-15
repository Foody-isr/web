import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual', testMatch: 'ordering-test-access.spec.ts',
  outputDir: 'test-results/test-access', workers: 1, timeout: 90000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3118', serviceWorkers: 'block', screenshot: 'only-on-failure', actionTimeout: 15000 },
  webServer: {
    command: 'npx next dev --port 3118 --hostname 127.0.0.1', port: 3118, reuseExistingServer: false, timeout: 120000,
    env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:43220', ORDERING_TEST_PROXY_SECRET: 'synthetic-test-access-secret-for-local-browser-only', VERCEL: '1' },
  },
});
