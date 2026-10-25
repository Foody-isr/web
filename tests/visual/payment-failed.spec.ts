import { expect, test, type Page } from "@playwright/test";

const returnURL = "/r/synthetic/payment/failed?orderId=99&t=synthetic-receipt";
const phone = "+972-50-000-0000";

type Scenario = { locale: string; width: number; dark: boolean; accent: string };

async function mockFailure(page: Page, scenario: Scenario, withPhone = true) {
  await page.setViewportSize({ width: scenario.width, height: 950 });
  await page.addInitScript(({ locale }) => {
    localStorage.setItem("foody-locale", locale);
    sessionStorage.setItem("foody-order-page:9001:99", "commander");
  }, scenario);
  await page.route("**/api/**", route => route.fulfill({ status: 404, json: {} }));
  const sourcePage = {
    id: 1, restaurant_id: 9001, slug: "commander", title: "Menu", type: "order",
    sort_order: 0, nav_visible: true, is_default: true, seo: {}, sections: [], settings: { menu_ids: [] },
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    appearance_overrides: {
      foody_renderer_version: 1, theme_id: "custom", pairing_id: "modern-sans",
      custom_palette: {
        mode: scenario.dark ? "dark" : "light",
        bg: scenario.dark ? "#151c0e" : "#ffffff",
        surface: scenario.dark ? "#26301c" : "#f5f5f5",
        ink: scenario.dark ? "#ffffff" : "#171717",
        accent: scenario.accent,
      },
    },
  };
  await page.route("**/api/v1/public/restaurants/synthetic", route => route.fulfill({ json: { restaurant: {
    id: 9001, name: "Test restaurant", slug: "synthetic", currency: "ILS",
    ...(withPhone ? { phone } : {}),
    website_config: { theme_id: "minimal-light" },
  } } }));
  await page.route("**/api/v1/public/restaurants/9001/website-pages**", route => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith("/commander") ? { page: sourcePage } : { pages: [sourcePage] },
  }));
  await page.route("**/api/v1/public/orders/99?**", route => {
    expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
    expect(route.request().headers()["x-receipt-token"]).toBe("synthetic-receipt");
    return route.fulfill({ json: { order: {
      id: 99, total_amount: 104, currency: "ILS", order_type: "pickup",
      payment_status: "unpaid", status: "pending_review", items: [],
    } } });
  });
}

for (const scenario of [
  { locale: "fr", width: 1280, dark: true, accent: "#ffffff" },
  { locale: "fr", width: 390, dark: true, accent: "#ffffff" },
  { locale: "en", width: 390, dark: false, accent: "#ffffff" },
  { locale: "he", width: 320, dark: false, accent: "#171717" },
]) {
  test(`failed payment · readable actions and support · ${scenario.locale} · ${scenario.width} · ${scenario.dark ? "dark" : "light"}`, async ({ page }, testInfo) => {
    await mockFailure(page, scenario);
    await page.emulateMedia({ reducedMotion: "reduce" });
    let retries = 0;
    let releaseRetry!: () => void;
    const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
    await page.route("**/api/customer-api/orders/99/payment/init?**", async route => {
      retries++;
      expect(route.request().method()).toBe("POST");
      expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
      expect(route.request().headers()["x-receipt-token"]).toBe("synthetic-receipt");
      await retryGate;
      return route.fulfill({ status: 409, json: { error: "Synthetic retry failure" } });
    });
    await page.goto(returnURL);
    const surface = page.locator("[data-payment-return]");
    await expect(surface.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(surface).toHaveAttribute("dir", scenario.locale === "he" ? "rtl" : "ltr");
    await expect(surface).toHaveCSS("background-color", scenario.dark ? "rgb(21, 28, 14)" : "rgb(255, 255, 255)");
    const retry = surface.locator("button[aria-busy]");
    await expect(retry).toHaveAccessibleName(/\S/);
    await expect(retry).toHaveCSS("border-top-width", "1px");
    await expect(retry).toHaveCSS("background-color", scenario.accent === "#ffffff" ? "rgb(255, 255, 255)" : "rgb(23, 23, 23)");
    await expect(retry).toHaveCSS("color", scenario.accent === "#ffffff" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
    const support = surface.getByRole("link", { name: phone, exact: true });
    await expect(support).toHaveAttribute("href", `tel:${phone}`);
    await expect(support.locator("bdi")).toHaveAttribute("dir", "ltr");
    expect(retries).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("payment-failed.png") });
    await retry.focus();
    await expect(retry).toHaveCSS("outline-style", "solid");
    await retry.click();
    await expect(retry).toHaveAttribute("aria-busy", "true");
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveCSS("opacity", "1");
    await expect(retry).toHaveCSS("color", scenario.accent === "#ffffff" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
    await expect(retry.locator("svg")).toHaveCSS("animation-name", "none");
    await expect.poll(() => retries).toBe(1);
    await page.screenshot({ path: testInfo.outputPath("retry-loading.png") });
    releaseRetry();
    await expect(surface.getByRole("alert")).toHaveText("Synthetic retry failure");
    await expect(retry).toBeEnabled();
    expect(retries).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const language = surface.locator("header button").first();
    await language.click();
    const english = surface.locator("header button").filter({ hasText: "English" }).last();
    await expect(english).toBeInViewport();
    await english.click();
    await expect(surface.getByRole("heading", { level: 1 })).toHaveText("Payment Failed");
    await surface.getByRole("button", { name: "Cancel Order", exact: true }).click();
    const dialog = surface.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test("failed payment · no support phone when the restaurant has none; provider text is decoded once", async ({ page }) => {
  await mockFailure(page, { locale: "en", width: 390, dark: false, accent: "#171717" }, false);
  await page.goto(`${returnURL}&error=${encodeURIComponent("Declined (100%); <b>plain text</b>")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payment Failed");
  await expect(page.getByText("Declined (100%); <b>plain text</b>", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
});

test("failed payment · missing order keeps a readable return action in the restaurant theme", async ({ page }) => {
  await mockFailure(page, { locale: "en", width: 390, dark: true, accent: "#ffffff" });
  await page.route("**/api/v1/public/orders/99?**", route => route.fulfill({ status: 404, json: { error: "Synthetic order unavailable" } }));
  await page.goto(returnURL);
  const surface = page.locator("[data-payment-return]");
  await expect(surface.getByRole("heading", { name: "Order Not Found" })).toBeVisible();
  await expect(surface.getByRole("alert")).toHaveText("Synthetic order unavailable");
  const back = surface.getByRole("link", { name: "Return to Menu" });
  await expect(back).toHaveAttribute("href", "/r/synthetic");
  await expect(back).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(back).toHaveCSS("color", "rgb(0, 0, 0)");
});
