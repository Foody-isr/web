import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "mobile-fulfillment.spec.ts",
  outputDir: "test-results/mobile-fulfillment",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: { baseURL: "http://localhost:3205", serviceWorkers: "block", screenshot: "only-on-failure" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    { command: "node tests/fixtures/address-theme-server.mjs", port: 18081, reuseExistingServer: false },
    { command: "npx next dev -p 3205", port: 3205, timeout: 120_000, reuseExistingServer: false, env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18081" } },
  ],
});
