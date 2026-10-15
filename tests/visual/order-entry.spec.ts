import { test, expect } from "@playwright/test";

for (const [id, label] of [[49001, "pause"], [49002, "rush"]] as const) {
  test(`unavailable order entry keeps the ${label} storefront browsable without a modal`, async ({ page }) => {
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    await expect(page.locator(".website-order-menu")).toBeVisible();
    await expect(page.locator("[data-ordering-unavailable]")).toContainText("n'accepte pas de nouvelles commandes");
    await expect(page.locator(".website-fulfillment-dialog[open]")).toHaveCount(0);
    const location = page.locator(".website-service-location").first();
    await expect(location).toHaveJSProperty("tagName", "DIV");
    await location.click();
    await expect(page.locator(".website-fulfillment-dialog[open]")).toHaveCount(0);
  });
}

for (const [id, label] of [[49003, "future preorder"], [49004, "authorized test access"]] as const) {
  test(`unavailable order entry preserves ${label} service selection`, async ({ page }) => {
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    const modal = page.locator(".website-fulfillment-dialog[open]");
    await expect(modal).toBeVisible();
    await expect(modal.locator(".website-view-menu")).toBeEnabled();
    await expect(page.locator("[data-ordering-unavailable]")).toHaveCount(0);
  });
}
