import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "product-photos.spec.ts",
  outputDir: "test-results/product-photos",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: {
    baseURL: "http://localhost:3197",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    hasTouch: true,
  },
  webServer: {
    command: "npx next dev --port 3197",
    port: 3197,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:43245",
      NODE_OPTIONS: "--no-experimental-strip-types",
    },
  },
});
