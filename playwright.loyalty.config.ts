import { defineConfig, devices } from "@playwright/test";

const fixturePort = Number(process.env.FOODY_LOYALTY_FIXTURE_PORT || 18083);

/** Local synthetic API exercises real cookie/BFF boundaries and explicit consent. */
export default defineConfig({
  testDir: "./tests/loyalty",
  outputDir: "test-results/loyalty",
  workers: 1,
  reporter: "list",
  retries: 0,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3131",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/loyalty-server.mjs",
      port: fixturePort,
      env: { FOODY_LOYALTY_FIXTURE_PORT: String(fixturePort) },
      reuseExistingServer: false,
    },
    {
      command:
        process.env.FOODY_LOYALTY_PRODUCTION_PREVIEW === "1"
          ? "npx next start -p 3131"
          : "npx next dev -p 3131",
      port: 3131,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_LOYALTY_WALLET_ENABLED:
          process.env.FOODY_LOYALTY_PREVIEW_ENABLED === "0" ||
          process.env.FOODY_LOYALTY_WALLET_PREVIEW_ENABLED === "0"
            ? "false"
            : "true",
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${fixturePort}`,
        NEXT_PUBLIC_LOYALTY_CHECKOUT_ENABLED:
          process.env.FOODY_LOYALTY_PREVIEW_ENABLED === "0" ||
          process.env.FOODY_LOYALTY_CHECKOUT_PREVIEW_ENABLED === "0"
            ? "false"
            : "true",
        NEXT_PUBLIC_LOYALTY_WEB_ENABLED:
          process.env.FOODY_LOYALTY_PREVIEW_ENABLED === "0" ? "false" : "true",
      },
    },
  ],
});
