import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'order-lifecycle.spec.ts',
  outputDir: 'test-results/order-lifecycle',
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3144', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npx next dev --port 3144', port: 3144, reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:43227' },
  },
});
