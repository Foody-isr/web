import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual", testMatch: "order-entry.spec.ts",
  outputDir: "test-results/order-entry", workers: 1, retries: 0, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3194", serviceWorkers: "block", screenshot: "only-on-failure" },
  webServer: [
    { command: "node tests/fixtures/address-theme-server.mjs", port: 18081, reuseExistingServer: false },
    { command: "npm run start -- -p 3194", url: "http://localhost:3194", reuseExistingServer: false, env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18081" } },
  ],
});
