import { defineConfig, devices } from "@playwright/test";

/** Exercises optional providers through a real local BFF with synthetic SDKs/API. */
export default defineConfig({
  testDir: "./tests/visual", testMatch: "commerce.spec.ts", grep: /customer sign-in dialog|customer social sign-in/,
  outputDir: "test-results/social-auth", workers: 1, reporter: "list", timeout: 60_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3207", serviceWorkers: "block", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium" },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    { command: "node tests/fixtures/address-theme-server.mjs", port: 18081, reuseExistingServer: false, env: { SOCIAL_AUTH_FIXTURE: "1" } },
    { command: "npx next dev -p 3207", port: 3207, reuseExistingServer: false, timeout: 120_000, env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18081" } },
  ],
});
