import { defineConfig } from '@playwright/test';
import entry from './playwright.entry.config';

export default defineConfig({
  ...entry,
  testMatch: 'mobile-category-spacing.spec.ts',
  outputDir: 'test-results/mobile-categories',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
