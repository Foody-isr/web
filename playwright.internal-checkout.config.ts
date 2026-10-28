import { defineConfig, devices } from '@playwright/test';

/** Prepared checkout browser checks use synthetic API responses and never contact Sumit. */
export default defineConfig({
  testDir: './tests/visual', testMatch: 'internal-checkout.spec.ts', workers: 1,
  outputDir: 'test-results/internal-checkout', reporter: 'list', timeout: 60000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3204', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 3204', port: 3204, reuseExistingServer: false,
    env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:18089' } },
});
