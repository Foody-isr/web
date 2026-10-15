import { defineConfig, devices } from "@playwright/test";

/** Customer journeys use only synthetic auth, profile, address and payment APIs. */
export default defineConfig({
  testDir: "./tests/visual", testMatch: "commerce.spec.ts",
  grep: /customer sign-in dialog|customer account journey|customer account enrollment|customer checkout preferences|customer compact checkout|saved-card panel|checkout has one summary|delivery address autocomplete|checkout account registration|strict preorder checkout|weekly preorder service/,
  outputDir: "test-results/customer", workers: 1, retries: 0, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3194", serviceWorkers: "block", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: "node tests/fixtures/address-theme-server.mjs", port: 18081, reuseExistingServer: false },
    { command: "npm run start -- -p 3194", url: "http://localhost:3194", reuseExistingServer: false, env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:18081" } },
  ],
});
