import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "cart-overlay.spec.ts",
  outputDir: "test-results/cart-overlay",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: {
    baseURL: "http://localhost:3141",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  webServer: {
    command: "npm run start -- --port 3141",
    port: 3141,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:43219" },
  },
});
