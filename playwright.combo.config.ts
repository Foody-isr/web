import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual", testMatch: "combo-theme.spec.ts", workers: 1,
  reporter: "list", timeout: 60_000, outputDir: "test-results/combo-theme",
  use: { baseURL: "http://localhost:3167", serviceWorkers: "block", screenshot: "only-on-failure", actionTimeout: 15_000 },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
  webServer: { command: "npx next dev --port 3167", port: 3167, reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:43241" } },
});
