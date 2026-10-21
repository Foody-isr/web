import { test, expect } from "@playwright/test";

for (const [id, label] of [[49001, "pause"], [49002, "rush"]] as const) {
  test(`unavailable order entry keeps the ${label} storefront browsable without a modal`, async ({ page }) => {
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    await expect(page.locator(".website-order-menu")).toBeVisible();
    await expect(page.getByText("Entry Demo n'accepte pas de nouvelles commandes pour le moment.", { exact: true })).toBeHidden();
    await expect(page.locator(".website-fulfillment-dialog[open]")).toHaveCount(0);
    const location = page.locator(".website-service-location").first();
    await expect(location).toContainText("Temporairement en pause");
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
    const guest = modal.locator(".website-entry-guest");
    if (await guest.isVisible()) await guest.click();
    await expect(modal.locator(".website-view-menu")).toBeEnabled();
  });
}

for (const [id, offered] of [[49007, false], [49008, true]] as const) {
 for (const locale of ['fr', 'he', 'en']) {
  test(`published sign-in invitation ${offered ? 'on' : 'off'} (${locale})`, async ({ page }) => {
   await page.setViewportSize({ width: 390, height: 844 });
   await page.route('**/api/customer-auth/**', route => route.fulfill({ status: 401, json: {} }));
   await page.goto(`/r/${id}/order?lang=${locale}`);
   const dialog = page.locator('.website-fulfillment-dialog[open]');
   await expect(dialog).toBeVisible();
   const guest = dialog.locator('.website-entry-guest');
   if (offered) {
    await expect(guest).toBeVisible(); await expect(guest).toBeEnabled();
    expect((await guest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await guest.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await page.screenshot({ path: `test-results/entry-invitation-${locale}.png`, fullPage: true });
    await guest.click();
   } else await expect(guest).toHaveCount(0);
   await expect(dialog.locator('.website-view-menu')).toBeEnabled();
   await expect(dialog.locator('.website-entry-choice')).toHaveCount(0);
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   if (!offered) await page.screenshot({ path: `test-results/entry-direct-${locale}.png`, fullPage: true });
  });
 }
}
