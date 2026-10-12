import { expect, test, type Page } from "@playwright/test";

const ready = { completed: false, ready: true, identity_required: false, payment_method_token_id: 7, amount_minor: 10400, currency_code: "ILS" };
const returnURL = "/r/9001/payment/signup?orderId=99&t=synthetic-receipt";

async function mockSignup(page: Page, locale = "fr", dark = false) {
  await page.addInitScript(({ locale }) => {
    localStorage.setItem("foody-locale", locale);
    sessionStorage.setItem("foody-order-page:9001:99", "commander");
  }, { locale });
  // Every API call in this test is synthetic; no provider or customer account
  // is contacted, and the server build uses an unreachable local API origin.
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: {} }));
  const sourcePage = {
    id: 1, restaurant_id: 9001, slug: "commander", title: "Menu", type: "order",
    sort_order: 0, nav_visible: true, is_default: true, seo: {}, sections: [], settings: { menu_ids: [] },
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    appearance_overrides: {
      foody_renderer_version: 1,
      theme_id: dark ? "custom" : "garden-fresh", pairing_id: "modern-sans",
      ...(dark ? { custom_palette: { mode: "dark", bg: "#101c18", surface: "#182a22", ink: "#ecf3ea", accent: "#c7ed76" } } : {}),
    },
  };
  await page.route("**/api/v1/public/restaurants/9001", (route) => route.fulfill({ json: { restaurant: {
    id: 9001, name: "Foody Demo", slug: "foody-demo", currency: "ILS",
    // The return must load the remembered order page, not only this site theme.
    website_config: { theme_id: "minimal-light", pairing_id: "modern-sans" },
  } } }));
  await page.route("**/api/v1/public/restaurants/9001/website-pages**", (route) => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith("/commander") ? { page: sourcePage } : { pages: [sourcePage] },
  }));
}

function approvedOrder() {
  return { order: { id: 99, total_amount: 104, currency: "ILS", order_type: "pickup", payment_status: "paid", status: "pending_review", items: [] } };
}

for (const scenario of [
  { locale: "fr", width: 1280, dark: false },
  { locale: "fr", width: 390, dark: false },
  { locale: "he", width: 320, dark: true },
]) {
  test(`hosted signup · themed return and single payment · ${scenario.locale} · ${scenario.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 950 });
    if (scenario.width === 390) await page.emulateMedia({ reducedMotion: "reduce" });
    await mockSignup(page, scenario.locale, scenario.dark);
    let verificationCalls = 0;
    let releaseVerification!: () => void;
    const verificationGate = new Promise<void>((resolve) => { releaseVerification = resolve; });
    await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", async (route) => {
      verificationCalls++;
      expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
      if (verificationCalls === 1) {
        await verificationGate;
        return route.fulfill({ status: 202, json: { completed: false } });
      }
      return route.fulfill({ json: ready });
    });
    let charges = 0;
    let releaseCharge!: () => void;
    const chargeGate = new Promise<void>((resolve) => { releaseCharge = resolve; });
    await page.route("**/api/customer-api/orders/99/payment/saved-method?**", async (route) => {
      charges++;
      expect(route.request().postDataJSON()).toEqual({ payment_method_token_id: 7 });
      await chargeGate;
      return route.fulfill({ json: { completed: true } });
    });
    await page.route("**/api/v1/public/orders/99?**", (route) => {
      expect(route.request().headers()["x-receipt-token"]).toBe("synthetic-receipt");
      return route.fulfill({ json: approvedOrder() });
    });
    await page.goto(returnURL);
    const surface = page.locator("[data-payment-return]");
    await expect(surface.locator('svg.motion-safe\\:animate-spin')).toBeVisible();
    if (scenario.width === 390) await expect(surface.locator('svg.motion-safe\\:animate-spin')).toHaveCSS("animation-name", "none");
    await expect(surface).toHaveAttribute("dir", scenario.locale === "he" ? "rtl" : "ltr");
    await expect(surface).toHaveCSS("background-color", scenario.dark ? "rgb(16, 28, 24)" : "rgb(245, 250, 241)");
    await page.screenshot({ path: testInfo.outputPath("registration-loading.png") });
    releaseVerification();
    await expect.poll(() => charges).toBe(1);
    expect(verificationCalls).toBe(2);
    await expect(surface.getByRole("link", { name: "Foody Demo" })).toHaveAttribute("href", "/r/foody-demo/commander");
    await expect(page.locator("input")).toHaveCount(0);
    const overflow = await surface.evaluate((element) => [element, ...element.querySelectorAll("*")].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map((node) => node.tagName));
    expect(overflow).toEqual([]);
    await expect.poll(() => charges).toBe(1);
    await expect(surface.locator('svg.motion-safe\\:animate-spin')).toBeVisible();
    await expect(page.locator("#signup-identity")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("payment-processing.png") });
    // Changing languages while the POST is in flight cannot reset the stage or
    // expose a second submit button. The header menu opens inside the viewport.
    await surface.locator("header button").first().click();
    await surface.locator("header button").filter({ hasText: "English" }).click();
    await expect(surface.getByRole("heading", { level: 1 })).toHaveText("Processing your payment");
    await expect(surface.locator('button[type="submit"]')).toHaveCount(0);
    expect(charges).toBe(1);
    expect(verificationCalls).toBe(2);
    releaseCharge();
    await expect(page).toHaveURL(/\/order\/confirmation\/99\?restaurantId=9001&t=synthetic-receipt&pageSlug=commander/);
    expect(charges).toBe(1);
  });
}

test("hosted signup · ambiguous charge offers read-only reconciliation, not another debit", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: ready }));
  let charges = 0;
  await page.route("**/api/customer-api/orders/99/payment/saved-method?**", (route) => {
    charges++;
    return route.abort("failed");
  });
  let readable = false;
  await page.route("**/api/v1/public/orders/99?**", (route) => readable
    ? route.fulfill({ json: approvedOrder() }) : route.fulfill({ status: 503, json: {} }));
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  expect(charges).toBe(1);
  readable = true;
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page).toHaveURL(/\/order\/confirmation\/99\?/);
  expect(charges).toBe(1);
});

test("hosted signup · declined registration never exposes order payment", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: { completed: false, declined: true } }));
  let charges = 0;
  page.on("request", (request) => { if (request.url().includes("/payment/saved-method")) charges++; });
  await page.goto(returnURL);
  await expect(page.getByRole("heading", { name: "Card registration declined" })).toBeVisible();
  await expect(page.locator("#signup-identity")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to payment" })).toHaveAttribute("href", "/r/9001/payment/failed?orderId=99&t=synthetic-receipt");
  expect(charges).toBe(0);
});

test("hosted signup · reloading an uncertain debit never submits it again", async ({ page }) => {
  await mockSignup(page, "en");
  let charges = 0;
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) =>
    route.fulfill({ json: charges ? { completed: false, charge_attempted: true } : ready }));
  await page.route("**/api/customer-api/orders/99/payment/saved-method?**", (route) => {
    charges++;
    return route.abort("failed");
  });
  await page.route("**/api/v1/public/orders/99?**", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
  expect(charges).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
  expect(charges).toBe(1);
});

test("hosted signup · definitive token decline opens failure, not confirmation", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: ready }));
  let charges = 0;
  await page.route("**/api/customer-api/orders/99/payment/saved-method?**", (route) => {
    charges++;
    return route.fulfill({ json: { completed: false, declined: true } });
  });
  await page.goto(returnURL);
  await expect(page).toHaveURL(/\/r\/9001\/payment\/failed\?orderId=99&t=synthetic-receipt/);
  expect(charges).toBe(1);
});

test("hosted signup · older API without explicit no-ID capability cannot auto-charge", async ({ page }) => {
  await mockSignup(page, "en");
  const { identity_required: _identity, ...legacyReady } = ready;
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: legacyReady }));
  let charges = 0;
  page.on("request", (request) => { if (request.url().includes("/payment/saved-method")) charges++; });
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check registration" })).toBeVisible();
  expect(charges).toBe(0);
});

test("hosted signup · already-paid return with failed readback cannot request payment again", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: { completed: true } }));
  await page.route("**/api/v1/public/orders/99?**", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  await expect(page.getByText("No order payment was requested.", { exact: false })).toHaveCount(0);
});

test("hosted signup · inconsistent readback stays pending instead of manufacturing success", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: { completed: true } }));
  await page.route("**/api/v1/public/orders/99?**", (route) => route.fulfill({ json: {
    order: { ...approvedOrder().order, payment_status: "pending" },
  } }));
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/payment\/signup\?/);
  await expect(page.locator('button[type="submit"]')).toHaveCount(0);
});

test("hosted signup · pending registration has a bounded wait and a verification-only retry", async ({ page }) => {
  await mockSignup(page, "en");
  let confirms = 0, charges = 0;
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => {
    confirms++;
    return route.fulfill({ status: 202, json: { completed: false } });
  });
  page.on("request", (request) => { if (request.url().includes("/payment/saved-method")) charges++; });
  await page.goto(returnURL);
  await expect(page.getByRole("button", { name: "Check registration" })).toBeVisible({ timeout: 12_000 });
  expect(confirms).toBe(6);
  await expect(page.locator("#signup-identity")).toHaveCount(0);
  await page.getByRole("button", { name: "Check registration" }).click();
  await expect.poll(() => confirms).toBeGreaterThan(6);
  expect(charges).toBe(0);
});

test("hosted signup · already-paid dine-in return preserves the table payment route", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: { completed: true } }));
  await page.route("**/api/v1/public/orders/99?**", (route) => route.fulfill({ json: {
    order: { ...approvedOrder().order, order_type: "dine_in" },
  } }));
  await page.goto(returnURL);
  await expect(page).toHaveURL(/\/r\/9001\/payment\/success\?orderId=99&t=synthetic-receipt&pageSlug=commander/);
});

test("hosted signup · confirmation waits for the API-owned payment status", async ({ page }) => {
  await mockSignup(page, "en");
  await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", (route) => route.fulfill({ json: ready }));
  let charges = 0, reads = 0;
  await page.route("**/api/customer-api/orders/99/payment/saved-method?**", (route) => {
    charges++;
    return route.fulfill({ json: { completed: true } });
  });
  await page.route("**/api/v1/public/orders/99?**", (route) => {
    reads++;
    return route.fulfill({ json: { order: { ...approvedOrder().order, payment_status: reads < 3 ? "pending" : "authorized" } } });
  });
  await page.goto(returnURL);
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Processing your payment" })).toBeVisible();
  await expect(page).toHaveURL(/\/payment\/signup\?/);
  await expect(page).toHaveURL(/\/order\/confirmation\/99\?/);
  expect(reads).toBe(3);
  expect(charges).toBe(1);
});
