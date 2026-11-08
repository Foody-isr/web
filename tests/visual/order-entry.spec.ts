import { test, expect } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`service first requires returning to the chooser (${width})`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.route("**/chains/entry-fixture/order-entry?*", route => route.fulfill({
      json: {
        chain: { id: 1, name: "Entry Demo", slug: "entry-fixture" },
        branches: [
          { restaurant_id: 49009, name: "Entry Demo", slug: "49009", pickup_enabled: true },
          { restaurant_id: 49007, name: "West Branch", slug: "49007", address: "7 Test Street", pickup_enabled: true },
        ],
      },
    }));
    await page.goto(`/r/49009${width === 390 ? "" : "/order"}?lang=fr`);
    await page.waitForURL("**/r/49009/order?lang=fr");
    const chooser = page.getByRole("heading", { name: "Comment souhaitez-vous commander ?" });
    const menu = page.locator(".website-order-menu");
    await expect(chooser).toBeVisible();
    await expect(menu).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("choose-mode.png") });
    await page.locator(".website-order-entry").getByRole("button", { name: /Retrait/ }).click();
    const step = page.locator(".website-order-step");
    const details = page.locator(".website-entry-dialog[open]");
    await expect(page).toHaveURL(/fulfillment=pickup/);
    await expect(step).toBeVisible();
    await expect(chooser).toHaveCount(0);
    await expect(details).toHaveCount(0);
    await expect(step.locator(".website-schedule-lists")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("pickup-step.png") });
    await page.goBack();
    await expect(chooser).toBeVisible();
    await page.goForward();
    await step.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(menu).toBeVisible();
    await expect(page).toHaveURL(/service=pickup/);
    const reminder = page.locator(".website-preorder-reminder");
    await expect(reminder).toContainText("10:00");
    await expect(page.locator(".website-service-time > span")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("preorder-menu.png") });
    await reminder.getByRole("button", { name: "Fermer" }).click();
    await expect(reminder).toHaveCount(0);
    await page.locator("button.website-service-time").click();
    const schedule = page.locator(".website-schedule-dialog[open]");
    await expect(schedule).toHaveAttribute("data-panel", "true");
    expect(await schedule.evaluate(element => element.matches(":modal"))).toBe(width === 390);
    await expect(schedule.getByText("10:30 – 11:00", { exact: true })).toBeVisible();
    const saveTime = schedule.getByRole("button", { name: "Enregistrer les modifications" });
    await expect(saveTime).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("schedule-panel.png") });
    await schedule.getByText("10:30 – 11:00", { exact: true }).click();
    await saveTime.click();
    await expect(reminder).toContainText("10:30");
    await page.locator("button.website-service-location").click();
    const branchSearch = details.getByRole("searchbox", { name: "Choisir un autre établissement" });
    await branchSearch.fill("west");
    await expect(details.getByRole("button", { name: /West Branch/ })).toBeVisible();
    await expect(details.getByRole("tab")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goBack();
    await expect(chooser).toBeVisible();
    await page.goForward();
    await expect(menu).toBeVisible();
    await page.getByRole("button", { name: "Retour au choix du mode" }).click();
    await expect(chooser).toBeVisible();
    await page.locator(".website-order-entry").getByRole("button", { name: /Livraison/ }).click();
    await expect(details).toHaveCount(0);
    const address = step.getByRole("textbox", { name: "Adresse de livraison", exact: true });
    await address.fill("Outside Test City");
    await expect(step.getByText(/hors de notre zone/)).toBeVisible();
    await expect(step.getByRole("button", { name: "Confirmer l’adresse" })).toBeDisabled();
    await address.fill("12 Demo Street, Test City");
    await step.getByRole("button", { name: "Confirmer l’adresse" }).click();
    await expect(menu).toBeVisible();
    await expect(page).toHaveURL(/service=delivery/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280) {
      await menu.getByRole("button", { name: "Demo sandwich", exact: true }).click();
      await page.locator('[data-item-part="add"]:visible').click();
      await page.locator(".website-cart-dock button:visible").click();
      await page.locator("button.commerce-fulfillment-row:visible").first().click();
      await expect(details).toBeVisible();
      await expect(details.getByRole("tab")).toHaveCount(0);
      await expect(details.getByRole("heading", { name: "Adresse de livraison" })).toBeVisible();
    }
  });
}

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
   if (!offered) {
    const signIn = dialog.getByRole('button', { name: {fr:'Se connecter', he:'התחברות', en:'Sign in'}[locale], exact: true });
    await expect(signIn).toBeVisible();
    expect((await signIn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(signIn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: `test-results/entry-direct-${locale}.png`, fullPage: true });
    await signIn.click();
    const auth = page.locator('dialog[open]').filter({has: page.locator('input[type=email]')});
    await expect(auth).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(auth).toHaveCount(0);
    await expect(signIn).toBeFocused();
    await expect(dialog.locator('.website-entry-choice')).toHaveCount(0);
    await expect(dialog.locator('.website-view-menu')).toBeEnabled();
   }
  });
 }
}


for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) test(`direct delivery keeps typed details after optional sign-in dismissal (${viewport.width})`, async ({page}) => {
 await page.setViewportSize(viewport);
 await page.route('**/api/customer-auth/**', route=>route.fulfill({status:401,json:{}}));
 await page.goto('/r/49007/order?lang=fr');
 const dialog=page.locator('.website-fulfillment-dialog[open]');
 await dialog.getByRole('tab').nth(1).click();
 const input=dialog.getByRole('textbox', {name:'Adresse de livraison', exact:true});
 await input.fill('12 Demo Street, Test City');
 const signIn=dialog.getByRole('button',{name:'Se connecter',exact:true});
 await expect(signIn).toBeInViewport();
 await signIn.click();
 const auth=page.locator('dialog[open]').filter({has:page.locator('input[type=email]')});
 await expect(auth).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(auth).toHaveCount(0);
 await expect(input).toHaveValue('12 Demo Street, Test City');
 await expect(signIn).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/entry-direct-delivery-${viewport.width}.png`,fullPage:true});
});
