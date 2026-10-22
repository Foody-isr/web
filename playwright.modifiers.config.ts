import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/visual', testMatch: 'modifier-positions.spec.ts', workers: 1, reporter: 'list', timeout: 90_000,
  outputDir: 'test-results/modifier-positions',
  use: { baseURL: 'http://localhost:3163', serviceWorkers: 'block', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npx next dev --port 3163', port: 3163, reuseExistingServer: false, timeout: 120000,
    env: { NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:43237' } },
});
