import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'pickup-dialog.spec.ts',
  outputDir: 'test-results/delivery',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3137', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: { command: 'npx next dev --port 3137', port: 3137, reuseExistingServer: false, timeout: 120000, env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:18081' } },
});
