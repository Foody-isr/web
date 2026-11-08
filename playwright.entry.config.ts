import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.FOODY_ENTRY_API_PORT ?? 18081);
const webPort = Number(process.env.FOODY_ENTRY_WEB_PORT ?? 3194);
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./tests/visual", testMatch: "order-entry.spec.ts",
  outputDir: "test-results/order-entry", workers: 1, retries: 0, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL, channel: process.env.FOODY_ENTRY_BROWSER, serviceWorkers: "block", screenshot: "only-on-failure" },
  webServer: [
    { command: "node tests/fixtures/address-theme-server.mjs", port: apiPort, reuseExistingServer: false, env: { FOODY_FIXTURE_PORT: String(apiPort) } },
    { command: `npx next dev -p ${webPort}`, url: baseURL, reuseExistingServer: false, env: { NODE_OPTIONS: "--no-experimental-strip-types", NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}` } },
  ],
});
