import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual", testMatch: "campaign-theme.spec.ts", workers: 1,
  reporter: "list", timeout: 60_000, outputDir: "test-results/campaign-theme",
  use: { baseURL: "http://localhost:3196", serviceWorkers: "block", screenshot: "only-on-failure", actionTimeout: 15_000 },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: { command: "npx next start --port 3196", port: 3196, reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:43261" } },
});
