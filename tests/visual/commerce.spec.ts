import { test, expect, type Page, type Route } from "@playwright/test";
import * as pgp from "openpgp";
import { cstPublicKey } from "../../lib/__tests__/fixtures/verifone-cst-key";
import { resolveWebsiteV3AdminOrigin } from "../../lib/preview/websiteV3Protocol";

const item = {
  id: "1",
  name: "Demo sandwich",
  price: 12,
  groupId: "1",
  available: true,
};

for (const [locale, width] of [["fr", 1280], ["fr", 390], ["he", 320]] as const) {
  test.describe(`customer sign-in dialog · ${locale} · ${width}`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    test("keeps Google's light frame aligned, resizes and focuses the email code", async ({ page }, testInfo) => {
      await mockCommerce(page, locale, { dark: true, currency: "ILS" });
      await page.addInitScript(() => {
        window.google = { accounts: { id: {
          initialize() {},
          renderButton(host: HTMLElement, options: { width: number; shape: string; locale: string }) {
            host.dataset.googleOptions = JSON.stringify(options);
            const frame = document.createElement("iframe");
            frame.title = "Synthetic Google button";
            frame.style.cssText = `display:block;border:0;width:${options.width + 20}px;height:44px;margin:-2px -10px`;
            frame.srcdoc = '<html style="color-scheme:light"><body style="margin:2px 10px"><button style="width:100%;height:40px">Google fixture</button></body></html>';
            host.append(frame);
          },
        } } };
      });
      await page.route("**/api/customer-auth/email/code", route => route.fulfill({ status: 202, json: { verification_required: true } }));
      await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
      // A wide RTL page behind a native dialog must not enlarge the auth sheet.
      if (locale === "he") {
        await page.evaluate(() => {
          const wideContent = document.createElement("div");
          wideContent.style.cssText = "width:427px;height:1px";
          document.body.appendChild(wideContent);
        });
        expect(await page.evaluate(() => innerWidth)).toBeGreaterThan(width);
      }
      const previousRootOverflow = await page.evaluate(() => document.documentElement.style.overflow);
      const trigger = page.locator("[data-checkout-sign-in] button");
      await trigger.click();
      const dialog = page.getByRole("dialog");
      const email = dialog.locator('input[type="email"]');
      const google = dialog.locator("[data-google-sign-in]");
      const frame = google.locator("iframe");
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveCSS("color-scheme", "light");
      const options = () => google.locator("[data-google-options]").evaluate(e => JSON.parse((e as HTMLElement).dataset.googleOptions!));
      expect(await options()).toMatchObject({ locale, shape: "rectangular" });
      expect(Math.abs((await options()).width - (await email.boundingBox())!.width)).toBeLessThanOrEqual(1);
      await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
      const bounds = (await dialog.boundingBox())!;
      expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1);
      expect(bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.height).toBeLessThanOrEqual(901);
      if (width >= 500) await expect(email).toBeFocused();
      else await expect(dialog.locator("h2")).toBeFocused();
      await dialog.locator("section").screenshot({ path: testInfo.outputPath("sign-in-dialog.png") });
      await page.setViewportSize({ width: width === 320 ? 390 : 320, height: 900 });
      await expect.poll(async () => Math.abs((await options()).width - (await email.boundingBox())!.width)).toBeLessThanOrEqual(1);
      await expect(frame).toHaveCount(1);
      await email.fill("guest@example.invalid");
      await dialog.locator('button[type="submit"]').click();
      await expect(dialog.locator('input[autocomplete="one-time-code"]')).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe(previousRootOverflow);
    });
  });
}

for (const [provider, signIn, width] of [["sumit", "email", 390], ["verifone", "email", 1280], ["sumit", "google", 1280], ["verifone", "google", 390]] as const) {
  test(`customer account enrollment keeps delivery details, saves a card by consent and reorders in one click · ${provider} · ${signIn}`, async ({ page, baseURL }, testInfo) => {
    await mockCommerce(page, "fr", { autocomplete: true, currency: "ILS" });
    await page.setViewportSize({ width, height: 900 });
    let signedIn = false, cardSaved = false, orders = 0, charges = 0, hostedVisits = 0;
    const account = { id: 41, name: "Account Name", email: "guest@example.invalid" };
    const suggestion = { id: "fixture-address", address: "1 Validation Street", city: "Validation", street: "Validation Street", house_number: "1", lat: 32.08, lng: 34.78, token: "synthetic-delivery-proof" };
    let profile = { name: "Account Name", phone: "", address: "", city: "", floor: "", apt: "", entry_code: "", delivery_notes: "" };
    await page.addInitScript(() => {
      let callback: ((response: { credential: string }) => void) | undefined;
      window.google = { accounts: { id: {
        initialize(options: { callback: typeof callback }) { callback = options.callback; },
        renderButton(element: HTMLElement) {
          const button = document.createElement("button"); button.type = "button"; button.textContent = "Continue with Google";
          button.onclick = () => callback?.({ credential: "synthetic-browser-google-proof" }); element.append(button);
        },
      } } };
    });
    await page.route("**/api/customer-auth/**", route => {
      const path = new URL(route.request().url()).pathname;
      expect(path).not.toContain("/email/code");
      if (path.endsWith("/checkout")) {
        expect(route.request().postDataJSON()).toEqual({ email: account.email, name: "Entered Guest", password: "synthetic-checkout-password" }); signedIn = true;
      }
      if (path.endsWith("/google")) { expect(route.request().postDataJSON()).toEqual({ id_token: "synthetic-browser-google-proof" }); signedIn = true; }
      return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { account } : {} });
    });
    await page.route("**/api/customer-api/me/checkout-profile?**", route => {
      if (route.request().method() === "PUT") {
        const input = route.request().postDataJSON();
        expect(input).toMatchObject({ name: "Entered Guest", phone: "+972500000000", delivery: { address: suggestion.address, city: suggestion.city, floor: "3", apt: "7", entry_code: "001-test", delivery_notes: "Ring once", address_token: suggestion.token } });
        profile = { ...profile, ...input, ...input.delivery };
      }
      return route.fulfill({ json: { profile, address_selection: profile.address ? suggestion : null } });
    });
    await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: {
      enabled: true, hosted_signup_enabled: provider === "verifone", direct_card_enabled: false,
      methods: cardSaved ? [{ id: 7, provider, card_last_four: "1111", expiry_month: 12, expiry_year: 2031, expired: false, available: true }] : [],
    } }));
    await page.route("**/api/customer-api/payment-capabilities?**", route => route.fulfill({ json: { enabled: true, hosted_signup_enabled: provider === "verifone", direct_card_enabled: false } }));
    await page.route("**/api/v1/public/address-autocomplete?**", route => route.fulfill({ json: { suggestions: [suggestion] } }));
    await page.route("**/api/customer-api/orders?**", route => {
      const input = route.request().postDataJSON();
      expect(input).toMatchObject({ customer_name: "Entered Guest", customer_phone: "+972500000000", delivery_address: suggestion.address, delivery_entry_code: "001-test", delivery_floor: "3", delivery_apt: "7" });
      orders++;
      if (orders === 1) {
        expect(input.save_card).toBe(true); expect(input.payment_method_token_id).toBeUndefined();
        return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" }, payment_url: "https://checkout.synthetic.invalid/fixture" } });
      }
      expect(input.save_card).not.toBe(true); expect(input.payment_method_token_id).toBe(7);
      return route.fulfill({ status: 201, json: { order: { id: 100, receipt_token: "synthetic-receipt" } } });
    });
    await page.route("https://checkout.synthetic.invalid/**", route => {
      hostedVisits++; cardSaved = true; if (provider === "sumit") charges++;
      const target = `${baseURL}/r/9001/payment/${provider === "sumit" ? "success" : "signup"}?orderId=99&t=synthetic-receipt`;
      return route.fulfill({ contentType: "text/html", body: `<script>location.replace(${JSON.stringify(target)})</script>` });
    });
    await page.route("**/api/customer-api/orders/99/payment/signup/confirm?**", route => route.fulfill({ json: { completed: false, ready: true, identity_required: false, payment_method_token_id: 7, amount_minor: 2400, currency_code: "ILS" } }));
    await page.route("**/api/customer-api/orders/*/payment/saved-method?**", route => { charges++; return route.fulfill({ json: { completed: true } }); });
    await page.route("**/api/v1/public/orders/*?**", route => route.fulfill({ json: { order: { id: Number(new URL(route.request().url()).pathname.split('/').at(-1)), order_type: "delivery", payment_status: "paid", order_status: "accepted", payment_method: "pay_now", total_amount: 24, currency: "ILS", receipt_token: "synthetic-receipt", items: [] } } }));
    await page.route("**/order/confirmation/*?**", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic paid confirmation</main>" }));
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    const name = page.locator('#checkout-details input[type="text"]').first();
    await name.fill("Entered Guest"); await page.locator('input[type="tel"]').fill("500000000");
    await page.locator("button.commerce-fulfillment-row:visible").first().click();
    const fulfillment = page.locator(".website-fulfillment-dialog[open]");
    await expect(fulfillment).not.toContainText("Facultatif");
    await fulfillment.getByRole("combobox").fill("1 Validation Street");
    await fulfillment.getByRole("option").click(); await fulfillment.locator(".website-view-menu").click();
    await expect(fulfillment).toHaveCount(0);
    await page.locator("#checkout-floor").fill("3"); await page.locator("#checkout-apartment").fill("7");
    await page.locator("#checkout-entry-code").fill("001-test"); await page.locator("#checkout-delivery-notes").fill("Ring once");
    await expect(page.locator("#checkout-floor")).toHaveValue("3");
    const enrollment = page.locator("[data-checkout-account]");
    await expect(enrollment).toBeVisible();
    await enrollment.screenshot({ path: testInfo.outputPath(`create-account-${provider}.png`) });
    if (signIn === "google") await enrollment.getByRole("button", { name: "Continue with Google" }).click();
    else {
      await enrollment.getByRole("button", { name: "Continuer avec l’e-mail" }).click();
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await enrollment.locator('input[type="email"]').fill(account.email);
      await enrollment.locator('input[type="password"]').fill("synthetic-checkout-password");
      expect(signedIn).toBe(false);
      await enrollment.screenshot({ path: testInfo.outputPath(`inline-email-${provider}.png`) });
    }
    if (signIn === "google") {
      await expect(page.locator("[data-checkout-account-ready]")).toBeVisible();
      await expect(page.locator("[data-remember-details]")).toBeChecked();
    }
    await expect(name).toHaveValue("Entered Guest"); await expect(page.locator("#checkout-entry-code")).toHaveValue("001-test");
    await expect(page.locator("#checkout-floor")).toHaveValue("3");
    const cardConsent = page.locator("[data-save-card]");
    await expect(cardConsent).not.toBeChecked(); await cardConsent.check();
    await page.locator(".commerce-confirm-action button").click();
    await expect(page).toHaveURL(/order\/confirmation\/99/, { timeout: 15_000 });
    expect(charges).toBe(1);
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    await expect(page.locator('[data-checkout-payment-card] input[value="7"]')).toBeChecked();
    await expect(page.locator("#checkout-floor")).toHaveValue("3"); await expect(page.locator("#checkout-apartment")).toHaveValue("7");
    await expect(page.locator("#checkout-entry-code")).toHaveValue("001-test");
    await expect(page.locator("button.commerce-fulfillment-row:visible").first()).toContainText("1 Validation Street, Validation");
    await page.locator(".commerce-confirm-action button").click();
    await expect(page).toHaveURL(/order\/confirmation\/100/, { timeout: 15_000 });
    expect(orders).toBe(2); expect(charges).toBe(2); expect(hostedVisits).toBe(1);
  });
}

for (const [locale, width] of [["fr", 1280], ["fr", 390], ["he", 320]] as const) {
  test(`customer inline enrollment validates locally, keeps a failed draft and allows guest checkout · ${locale} · ${width}`, async ({ page }, testInfo) => {
    await mockCommerce(page, locale, { currency: "ILS" });
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://accounts.google.com/**", route => route.abort());
    await page.route("**/api/customer-api/payment-capabilities?**", route => route.fulfill({ json: { enabled: true, hosted_signup_enabled: false, direct_card_enabled: false } }));
    let signups = 0, orders = 0, otps = 0;
    await page.route("**/api/customer-auth/checkout", route => { signups++; return route.fulfill({ status: 503, json: { error: "Synthetic signup unavailable" } }); });
    await page.route("**/otp/send", route => { otps++; return route.abort(); });
    await page.route("**/api/customer-auth/email/code", route => { otps++; return route.abort(); });
    await page.route("**/api/customer-api/orders?**", route => {
      orders++;
      expect(route.request().postDataJSON()).not.toHaveProperty("password");
      expect(route.request().postDataJSON().save_card).not.toBe(true);
      return route.fulfill({ status: 503, json: { error: "Synthetic stop after guest order capture" } });
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await page.locator('#checkout-details input[type="text"]').first().fill("Entered Guest");
    await page.locator('input[type="tel"]').fill("500000000");
    const enrollment = page.locator("[data-checkout-account]");
    await enrollment.locator('button[aria-expanded="false"]').click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const email = enrollment.locator('input[type="email"]');
    const password = enrollment.locator('input[autocomplete="new-password"]');
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("form", "checkout-details");
    await expect(password).toHaveAttribute("form", "checkout-details");
    await expect(enrollment.locator("[data-save-card]")).not.toBeChecked();
    await email.fill("invalid-email"); await password.fill("short");
    const pay = page.locator(".commerce-confirm-action button");
    await pay.click(); expect(signups).toBe(0); expect(orders).toBe(0);
    await email.fill("guest@example.invalid");
    await pay.click(); expect(signups).toBe(0);
    await password.fill("synthetic-checkout-password");
    await enrollment.screenshot({ path: testInfo.outputPath("inline-account.png") });
    await pay.click();
    await expect(enrollment.getByRole("alert")).toBeVisible();
    await expect(password).toHaveValue("synthetic-checkout-password");
    expect(signups).toBe(1); expect(orders).toBe(0); expect(otps).toBe(0);
    await enrollment.getByRole("button", { name: locale === "fr" ? "Continuer sans créer de compte" : "להמשיך ללא יצירת חשבון" }).click();
    await expect(password).toHaveCount(0);
    await pay.click(); await expect.poll(() => orders).toBe(1);
    expect(signups).toBe(1); expect(otps).toBe(0);
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(storage).not.toContain("synthetic-checkout-password");
  });
}

test("customer inline enrollment preserves card consent if provider availability changes", async ({ page }) => {
  await mockCommerce(page, "en", { currency: "ILS" });
  await page.route("https://accounts.google.com/**", route => route.abort());
  await page.route("**/api/customer-api/payment-capabilities?**", route => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/customer-auth/checkout", route => route.fulfill({ json: { account: { id: 41, name: "Entered Guest", email: "guest@example.invalid", email_verified: false } } }));
  await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: { enabled: false, methods: [] } }));
  let orders = 0;
  await page.route("**/api/customer-api/orders?**", route => { orders++; expect(route.request().postDataJSON().save_card).not.toBe(true); return route.fulfill({ status: 503, json: { error: "Synthetic stop after capture" } }); });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await page.locator('#checkout-details input[type="text"]').first().fill("Entered Guest"); await page.locator('input[type="tel"]').fill("500000000");
  const enrollment = page.locator("[data-checkout-account]");
  await enrollment.locator('button[aria-expanded="false"]').click();
  await enrollment.locator('input[type="email"]').fill("guest@example.invalid"); await enrollment.locator('input[type="password"]').fill("synthetic-checkout-password");
  await enrollment.locator("[data-save-card]").check(); await page.locator(".commerce-confirm-action button").click();
  await expect(page.getByRole("alert").filter({ hasText: "Saving this card is unavailable" })).toBeVisible();
  expect(orders).toBe(0);
  await expect(page.locator("[data-save-card]")).toBeChecked();
  await page.locator("[data-save-card]").click();
  await expect(page.locator("[data-save-card]")).toHaveCount(0);
  await page.locator(".commerce-confirm-action button").click();
  await expect.poll(() => orders).toBe(1);
});

for (const testAccess of [true, false]) {
  test(`customer account journey restores a remembered address when switching from pickup · ${testAccess ? "test access" : "paused"}`, async ({ page }) => {
    const options = {
      autocomplete: true, strictCalendar: "batch" as const, ordersPaused: true,
      orderingTestAccessExpiresAt: testAccess ? new Date(Date.now() + 3600_000).toISOString() : undefined,
    };
    await mockCommerce(page, "fr", options);
    const suggestion = { id: "saved-address", address: "1 Validation Street", city: "Validation", street: "Validation Street", house_number: "1", lat: 32.081, lng: 34.781, token: "synthetic-restored-proof" };
    await page.route("**/api/customer-auth/**", route => route.fulfill({ json: { account: { id: 41, name: "Demo Guest", email: "guest@example.invalid" } } }));
    await page.route("**/api/customer-api/me/checkout-profile?**", route => route.fulfill({ json: {
      profile: { name: "Demo Guest", phone: "+972500000000", address: suggestion.address, city: suggestion.city, floor: "3", apt: "7", entry_code: "test-code", delivery_notes: "Ring once" }, address_selection: suggestion,
    } }));
    await page.route("**/batch-fulfillment-config?**", route => route.fulfill({ json: {
      enabled: true, ordering_open: true, current_batch_open_at: "2030-10-01T12:00:00+03:00", current_batch_cutoff: "2030-10-10T18:00:00+03:00",
      fulfillment_days: [{ date: "2030-10-11", day_name: "Friday", pickup_window: { start: "08:00", end: "09:30" }, delivery_window: { start: "10:00", end: "14:00" } }],
    } }));
    let searches = 0;
    await page.route("**/api/v1/public/address-autocomplete?**", route => { searches++; return route.abort(); });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    if (!testAccess) {
      await expect(page.locator("[data-checkout-ordering-unavailable]")).toContainText("Foody Demo n'accepte pas de nouvelles commandes");
      await expect(page.locator("button.commerce-fulfillment-row:visible")).toHaveCount(0);
      await expect(page.locator(".commerce-confirm-action button")).toBeDisabled();
      expect(searches).toBe(0);
      return;
    }
    await page.locator("button.commerce-fulfillment-row:visible").first().click();
    const modal = page.locator(".website-fulfillment-dialog[open]");
    await modal.getByRole("tab", { name: "Livraison", exact: true }).click();
    await expect(modal.getByRole("combobox")).toHaveValue("1 Validation Street, Validation");
    await expect(modal).toContainText("Adresse sélectionnée");
    if (testAccess) {
      await expect(modal.locator(".website-view-menu")).toBeEnabled();
      await modal.locator(".website-view-menu").click();
      await expect(modal).toHaveCount(0);
      await expect(page).toHaveURL(/orderType=delivery/);
      await expect(page.locator("button.commerce-fulfillment-row:visible").first()).toContainText("1 Validation Street, Validation");
      await page.locator("button.commerce-fulfillment-row:visible").first().click();
      options.orderingTestAccessExpiresAt = new Date(Date.now() + 1500).toISOString();
      const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/customer-api/restaurants/9001");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      await expect(modal).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator("[data-checkout-ordering-unavailable]")).toContainText("Foody Demo n'accepte pas de nouvelles commandes");
      await expect(page.locator("button.commerce-fulfillment-row:visible")).toHaveCount(0);
    }
    expect(searches).toBe(0);
  });
}

for (const [locale, provider] of [["fr", "sumit"], ["he", "verifone"]] as const) {
  test(`customer account journey restores delivery and pays once · ${locale} · ${provider}`, async ({ page }, testInfo) => {
    await mockCommerce(page, locale, { autocomplete: true, currency: "ILS" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("https://accounts.google.com/**", route => route.abort());
    let signedIn = false, charges = 0, saves = 0, searches = 0;
    const account = { id: 41, name: "Demo Guest", email: "guest@example.invalid" };
    const suggestion = { id: "saved-address", address: "Ibn Gabirol 69", city: "Tel Aviv", street: "", house_number: "", lat: 32.081, lng: 34.781, token: "synthetic-restored-proof" };
    const profile = { name: "Demo Guest", phone: "+972501234567", address: suggestion.address, city: suggestion.city, floor: "3", apt: "7", entry_code: "test-code", delivery_notes: "Ring once", custom_fields: { delivery: { custom_field_1: "001-building", marketing: "true" }, pickup: { custom_field_1: "Pickup-only" } } };
    await page.route("**/api/customer-auth/**", route => {
      if (route.request().method() === "POST") signedIn = true;
      return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { account } : {} });
    });
    await page.route("**/api/customer-api/me/checkout-profile?**", route => {
      if (route.request().method() === "PUT") {
        saves++;
        expect(route.request().postDataJSON()).toMatchObject({ name: profile.name, phone: profile.phone, delivery: { address: profile.address, floor: "3", apt: "7", entry_code: "test-code", address_token: suggestion.token } });
        if (locale === "he") expect(route.request().postDataJSON().custom_fields).toEqual({ custom_field_1: "001-building" });
      }
      return route.fulfill({ json: { profile, address_selection: suggestion } });
    });
    await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: {
      enabled: true, hosted_signup_enabled: false, methods: [{ id: 7, provider, card_last_four: "1111", expiry_month: 12, expiry_year: 2031, expired: false, available: true }],
    } }));
    await page.route("**/api/v1/public/address-autocomplete?**", route => { searches++; return route.abort(); });
    await page.route("**/api/customer-api/orders?**", route => {
      expect(route.request().postDataJSON()).toMatchObject({ customer_name: profile.name, customer_phone: profile.phone, delivery_address: profile.address, delivery_city: profile.city, delivery_floor: "3", delivery_apt: "7", delivery_entry_code: "test-code", delivery_address_token: suggestion.token, payment_method_token_id: 7 });
      return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
    });
    await page.route("**/api/customer-api/orders/99/payment/saved-method?**", route => { charges++; return route.fulfill({ json: { completed: true } }); });
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    await page.locator(".commerce-fulfillment-row").first().click();
    const fulfillment = page.locator(".website-fulfillment-dialog[open]");
    await fulfillment.getByRole("button", { name: locale === "fr" ? /Me connecter pour commander en 1 clic/ : /מתחברים ומזמינים בלחיצה אחת/ }).click();
    const codeDialog = page.getByRole("dialog").filter({ has: page.locator('input[type="email"]') });
    await expect(codeDialog.locator('input[type="password"]')).toHaveCount(0);
    await codeDialog.getByRole("button", { name: locale === "fr" ? "Utiliser plutôt mon mot de passe" : "כניסה עם הסיסמה שלי" }).click();
    const auth = page.locator("dialog[open]").filter({ has: page.locator('input[type="password"]') });
    await auth.locator('input[type="email"]').fill("guest@example.invalid");
    await auth.locator('input[type="password"]').fill("synthetic password only");
    await auth.locator('button[type="submit"]').click();
    await expect(auth).toHaveCount(0);
    await expect(fulfillment).toBeVisible();
    await expect(fulfillment.getByRole("combobox")).toHaveValue("Ibn Gabirol 69, Tel Aviv");
    await fulfillment.locator(".website-view-menu").click();
    await expect(fulfillment).toHaveCount(0);
    // A subsequent visit restores the same defaults from the account, without
    // relying on the entry dialog's in-memory address selection.
    await page.reload();
    await expect(page.locator('input[type="tel"]')).toHaveValue(profile.phone.replace("+972", ""));
    await expect(page.locator('[data-checkout-payment-card] input[value="7"]')).toBeChecked();
    await expect(page.locator("[data-remember-details]")).toHaveCount(0);
    await expect(page.locator("[data-checkout-preferences]")).toHaveCount(0);
    await expect(page.locator("[data-checkout-contact-summary]")).toBeVisible();
    await expect(page.locator("[data-checkout-contact-summary]")).toContainText(profile.name);
    await expect(page.locator("[data-checkout-contact-summary]")).toContainText(profile.phone);
    await expect(page.locator("[data-checkout-contact-summary]")).toContainText(suggestion.address);
    await expect(page.locator('#checkout-contact-fields input:not([type="checkbox"]):visible')).toHaveCount(0);
    if (locale === "he") {
      await expect(page.getByLabel("Building code", { exact: true })).toHaveValue("001-building");
      await expect(page.getByLabel("Marketing consent", { exact: true })).not.toBeChecked();
    }
    await page.screenshot({ path: testInfo.outputPath(`returning-customer-${locale}.png`), fullPage: true });
    // All details and the card were restored; only the final order/payment click remains.
    await page.locator(".commerce-confirm-action button").click();
    await expect.poll(() => charges).toBe(1);
    expect(saves).toBe(0);
    expect(searches).toBe(0);
  });
}

const compactProfile = {
  name: "Demo Guest", phone: "+972501234567", address: "1 Test Street", city: "Test City",
  floor: "3", apt: "7", entry_code: "001", delivery_notes: "Ring once",
  custom_fields: { delivery: { custom_field_1: "001-building" } },
};

async function mockCompactCustomer(page: Page, locale: string, options: {
  profile?: Partial<typeof compactProfile>;
  missingProof?: boolean;
  requiredBuildingCode?: boolean;
  requiredConsent?: boolean;
  otp?: boolean;
} = {}) {
  await mockCommerce(page, locale, { autocomplete: true, currency: "ILS", splitContactName: true, ...options });
  let profile = { ...compactProfile, ...options.profile };
  const address = { id: "saved-address", address: profile.address, city: profile.city, street: "Test Street", house_number: "1", lat: 32.08, lng: 34.78, token: "synthetic-proof" };
  const events = { saves: 0, orders: [] as Record<string, unknown>[], charges: 0 };
  await page.route("**/api/customer-auth/**", route => route.fulfill({ json: { account: { id: 41, name: profile.name, email: "guest@example.invalid" } } }));
  await page.route("**/api/customer-api/me/checkout-profile?**", route => {
    if (route.request().method() === "PUT") {
      events.saves++;
      const input = route.request().postDataJSON();
      profile = { ...profile, ...input, ...input.delivery, custom_fields: { delivery: input.custom_fields } };
    }
    return route.fulfill({ json: { profile, address_selection: options.missingProof ? null : address } });
  });
  await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: { enabled: true, methods: [{ id: 7, provider: locale === "he" ? "verifone" : "sumit", card_last_four: "1111", expiry_month: 12, expiry_year: 2031, available: true, expired: false }] } }));
  await page.route("**/api/v1/public/address-autocomplete?**", route => route.fulfill({ json: { suggestions: [address] } }));
  await page.route("**/api/customer-api/orders?**", route => {
    events.orders.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
  });
  await page.route("**/api/customer-api/orders/99/payment/saved-method?**", route => { events.charges++; return route.fulfill({ json: { completed: true } }); });
  await page.route("**/api/v1/public/orders/99?**", route => route.fulfill({ json: { order: { id: 99, order_type: "delivery", payment_status: "paid", order_status: "accepted", payment_method: "pay_now", total_amount: 24, currency: "ILS", items: [] } } }));
  await page.route("**/order/confirmation/*?**", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic paid confirmation</main>" }));
  return events;
}

for (const [locale, width] of [["fr", 1280], ["he", 320]] as const) {
  test(`customer compact checkout reviews and edits details before one payment · ${locale}`, async ({ page }, testInfo) => {
    const events = await mockCompactCustomer(page, locale);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    const summary = page.locator("[data-checkout-contact-summary]");
    const edit = page.locator("[data-edit-checkout-details]");
    const fields = page.locator("#checkout-contact-fields");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(compactProfile.name);
    await expect(summary).toContainText(compactProfile.phone);
    await expect(summary).toContainText(compactProfile.address);
    await expect(summary).toContainText(locale === "he" ? "001-building" : "001");
    await expect(edit).toHaveAttribute("aria-expanded", "false");
    await expect(fields.locator('input:not([type="checkbox"]):visible')).toHaveCount(0);
    expect((await page.locator(".commerce-contact").boundingBox())!.height).toBeLessThan(600);
    await page.locator(".commerce-contact").screenshot({ path: testInfo.outputPath(`compact-contact-${locale}.png`), style: ".commerce-confirm-action { visibility: hidden !important; }" });
    await edit.click();
    const name = fields.locator('input[type="text"]').first();
    await expect(name).toBeFocused();
    await name.fill("");
    await page.locator("[data-finish-checkout-details]").click();
    await expect(summary).toHaveCount(0);
    await expect(name).toBeFocused();
    await name.fill(locale === "he" ? "Updated" : "Updated Guest");
    await (locale === "he" ? page.getByLabel("קומה", { exact: true }) : page.locator("#checkout-floor")).fill("9");
    if (locale === "he") await page.getByLabel("Building code", { exact: true }).fill("0002");
    else await page.locator("#checkout-entry-code").fill("0002");
    await page.locator("[data-finish-checkout-details]").click();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Updated Guest");
    await expect(summary).toContainText("0002");
    await expect(edit).toBeFocused();
    await expect(page.locator("[data-remember-details]")).not.toBeChecked();
    expect(events.saves).toBe(0);
    await page.locator(".commerce-confirm-action button").click();
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    expect(events.orders).toHaveLength(1); expect(events.charges).toBe(1); expect(events.saves).toBe(0);
    expect(events.orders[0]).toMatchObject({ customer_name: "Updated Guest", delivery_floor: "9", payment_method_token_id: 7 });
  });
}

for (const missing of ["phone", "custom", "proof"] as const) {
  test(`customer compact checkout keeps missing ${missing} details editable until reviewed`, async ({ page }) => {
    const events = await mockCompactCustomer(page, "he", {
      profile: missing === "phone" ? { phone: "" } : missing === "custom" ? { custom_fields: { delivery: { custom_field_1: "" } } } : {},
      requiredBuildingCode: missing === "custom", missingProof: missing === "proof",
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    const summary = page.locator("[data-checkout-contact-summary]");
    const done = page.locator("[data-finish-checkout-details]");
    await expect(done).toBeVisible();
    await expect(summary).toHaveCount(0);
    if (missing === "phone") {
      await page.locator(".commerce-confirm-action button").click();
      await expect(page.locator('input[type="tel"]')).toBeFocused();
      await page.locator('input[type="tel"]').fill("501234567");
    } else if (missing === "custom") {
      await page.locator(".commerce-confirm-action button").click();
      await expect(page.getByLabel("Building code *", { exact: true })).toBeFocused();
      await page.getByLabel("Building code *", { exact: true }).fill("0002");
    } else {
      await done.click();
      await expect(summary).toHaveCount(0);
      const address = page.locator("#checkout-contact-fields").getByRole("combobox", { name: "כתובת למשלוח" });
      await address.fill("1 Test Street");
      await page.getByRole("listbox").getByRole("option").click();
    }
    expect(events.orders).toHaveLength(0);
    await expect(done).toBeVisible();
    await done.click();
    await expect(summary).toBeVisible();
  });
}

test("customer compact checkout keeps required consent visible and blocks payment until selected", async ({ page }) => {
  const events = await mockCompactCustomer(page, "he", { requiredConsent: true });
  await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
  await expect(page.locator("[data-checkout-contact-summary]")).toBeVisible();
  const consent = page.getByLabel("Marketing consent*", { exact: true });
  await expect(consent).toBeVisible(); await expect(consent).not.toBeChecked();
  await page.locator(".commerce-confirm-action button").click();
  await expect(consent).toBeFocused(); expect(events.orders).toHaveLength(0);
  await consent.check();
  await page.locator(".commerce-confirm-action button").click();
  await expect(page).toHaveURL(/order\/confirmation\/99/);
  expect(events.orders).toHaveLength(1); expect(events.charges).toBe(1);
});

test("customer compact checkout still requires the restaurant's phone verification", async ({ page }) => {
  const events = await mockCompactCustomer(page, "en", { otp: true });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.locator("[data-checkout-contact-summary]")).toBeVisible();
  await page.locator(".commerce-confirm-action button").click();
  const code = page.locator('input[maxlength="6"]');
  await expect(code).toBeVisible(); expect(events.orders).toHaveLength(0);
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(code).toHaveCount(0); expect(events.orders).toHaveLength(0);
  await page.locator(".commerce-confirm-action button").click();
  await expect(page).toHaveURL(/order\/confirmation\/99/);
  expect(events.orders).toHaveLength(1); expect(events.charges).toBe(1);
});

for (const [provider, locale, width, remember] of [["sumit", "fr", 390, false], ["verifone", "he", 320, true]] as const) {
  test(`customer checkout preferences keep temporary details separate from card consent · ${provider}`, async ({ page }, testInfo) => {
    await mockCommerce(page, locale, { autocomplete: true, currency: "ILS" });
    await page.setViewportSize({ width, height: 900 });
    const suggestion = { id: "saved-address", address: "1 Test Street", city: "Test City", street: "Test Street", house_number: "1", lat: 32.08, lng: 34.78, token: "synthetic-proof" };
    let profile = { name: "Demo Guest", phone: "+972501234567", address: suggestion.address, city: suggestion.city, floor: "3", apt: "7", entry_code: "001", delivery_notes: "Ring once", custom_fields: { delivery: { custom_field_1: "building-code" } } };
    let saves = 0, orders = 0, charges = 0, failSave = remember;
    await page.route("**/api/customer-auth/**", route => route.fulfill({ json: { account: { id: 41, name: "Demo Guest", email: "guest@example.invalid" } } }));
    await page.route("**/api/customer-api/me/checkout-profile?**", route => {
      if (route.request().method() === "PUT") {
        const input = route.request().postDataJSON();
        expect(input.delivery).toMatchObject({ address: suggestion.address, floor: "9", address_token: suggestion.token });
        if (locale === "he") expect(input.custom_fields).toEqual({ custom_field_1: "" });
        if (failSave) { failSave = false; return route.fulfill({ status: 503, json: {} }); }
        saves++;
        profile = { ...profile, ...input, ...input.delivery, custom_fields: { delivery: input.custom_fields } };
      }
      return route.fulfill({ json: { profile, address_selection: suggestion } });
    });
    await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: {
      enabled: true, hosted_signup_enabled: provider === "verifone", methods: [{ id: 7, provider, card_last_four: "1111", expiry_month: 12, expiry_year: 2031, expired: false, available: true }],
    } }));
    await page.route("**/api/customer-api/orders?**", route => {
      orders++;
      expect(route.request().postDataJSON()).toMatchObject({ delivery_floor: "9", payment_method_token_id: 7 });
      expect(route.request().postDataJSON().save_card).not.toBe(true);
      return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
    });
    await page.route("**/api/customer-api/orders/99/payment/saved-method?**", route => { charges++; return route.fulfill({ json: { completed: true } }); });
    await page.route("**/api/v1/public/orders/99?**", route => route.fulfill({ json: { order: { id: 99, order_type: "delivery", payment_status: "paid", order_status: "accepted", payment_method: "pay_now", total_amount: 24, currency: "ILS", items: [] } } }));
    await page.route("**/order/confirmation/*?**", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic paid confirmation</main>" }));
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    const panel = page.locator("[data-checkout-payment-card]");
    const floor = locale === "he" ? page.getByLabel("קומה", { exact: true }) : page.locator("#checkout-floor");
    const details = page.locator("[data-remember-details]");
    const card = page.locator("[data-save-card]");
    await expect(floor).toHaveValue("3");
    await expect(panel.locator('input[value="7"]')).toBeChecked();
    await expect(details).toHaveCount(0);
    await expect(page.locator("[data-checkout-preferences]")).toHaveCount(0);
    if (locale === "he") {
      await page.getByLabel("Marketing consent", { exact: true }).check();
      await expect(details).toHaveCount(0);
    }
    await panel.locator('input[value="new"]').check();
    await expect(card).not.toBeChecked();
    await expect(details).toHaveCount(0);
    await expect(page.locator("[data-checkout-preferences] [role=status]")).toBeVisible();
    await card.check();
    await page.locator("[data-edit-checkout-details]").click();
    await floor.fill("9");
    await expect(details).not.toBeChecked();
    await details.check();
    await expect(card).toBeChecked();
    await floor.fill("3");
    await expect(details).toHaveCount(0);
    await floor.fill("9");
    await expect(details).not.toBeChecked();
    if (locale === "he") await page.getByLabel("Building code", { exact: true }).fill("");
    if (remember) await details.check();
    await expect(card).toBeChecked();
    await page.locator("[data-checkout-preferences]").screenshot({ path: testInfo.outputPath(`checkout-preferences-${provider}.png`) });
    expect(await page.locator("[data-checkout-preferences]").evaluate(element => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
    await panel.locator('input[value="7"]').check();
    await expect(card).toHaveCount(0);
    await expect(details).toBeChecked({ checked: remember });
    await page.locator(".commerce-confirm-action button").click();
    if (remember) {
      await expect(page.getByText(/לא הצלחנו לשמור את הפרטים/)).toBeVisible();
      expect(orders).toBe(0); expect(charges).toBe(0);
      await page.locator(".commerce-confirm-action button").click();
    }
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    expect(saves).toBe(remember ? 1 : 0); expect(orders).toBe(1); expect(charges).toBe(1);
    await page.goto("/order/checkout?restaurantId=9001&orderType=delivery");
    await expect(floor).toHaveValue(remember ? "9" : "3");
    await expect(details).toHaveCount(0);
  });
}

test("customer checkout preferences also update contact details when paying at pickup", async ({ page }) => {
  await mockCommerce(page, "en", { currency: "ILS", pickupPrepayment: false });
  const profile = { name: "Demo Guest", phone: "+972501234567", address: "", city: "", floor: "", apt: "", entry_code: "", delivery_notes: "" };
  let saves = 0, orders = 0;
  await page.route("**/api/customer-auth/**", route => route.fulfill({ json: { account: { id: 41, name: profile.name, email: "guest@example.invalid" } } }));
  await page.route("**/api/customer-api/me/checkout-profile?**", route => {
    if (route.request().method() === "PUT") {
      saves++;
      expect(route.request().postDataJSON()).toMatchObject({ phone: "+972501111111", order_type: "pickup" });
      expect(route.request().postDataJSON().delivery).toBeUndefined();
      profile.phone = "+972501111111";
    }
    return route.fulfill({ json: { profile, address_selection: null } });
  });
  await page.route("**/api/customer-api/payment-methods?**", route => route.fulfill({ json: { enabled: true, methods: [] } }));
  await page.route("**/api/customer-api/orders?**", route => {
    orders++;
    expect(route.request().postDataJSON()).toMatchObject({ customer_phone: "+972501111111", payment_required: false });
    expect(route.request().postDataJSON().save_card).not.toBe(true);
    return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
  });
  await page.route("**/order/confirmation/*?**", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic pickup confirmation</main>" }));
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.locator('input[type="tel"]')).toHaveValue("501234567");
  await expect(page.locator("[data-checkout-preferences]")).toHaveCount(0);
  await page.locator("[data-edit-checkout-details]").click();
  await page.locator('input[type="tel"]').fill("501111111");
  await expect(page.locator("[data-remember-details]")).not.toBeChecked();
  await expect(page.locator("[data-save-card]")).toHaveCount(0);
  await expect(page.locator("[data-checkout-payment-card]")).toHaveCount(0);
  await page.locator("[data-remember-details]").check();
  await page.locator(".commerce-confirm-action button").click();
  await expect(page).toHaveURL(/order\/confirmation\/99/);
  expect(saves).toBe(1); expect(orders).toBe(1);
});

for (const scenario of [
  { locale: "en", width: 1280, dark: false },
  { locale: "fr", width: 390, dark: false },
  { locale: "he", width: 320, dark: true },
  // Bella Italia's theme: large site radii must not reshape the payment panel.
  { locale: "fr", width: 1280, themeId: "garden-fresh", pairingId: "modern-sans" },
  { locale: "fr", width: 390, themeId: "garden-fresh", pairingId: "modern-sans" },
  { locale: "he", width: 320, themeId: "garden-fresh", pairingId: "modern-sans" },
]) {
  test(`saved-card panel · ${scenario.locale} · ${scenario.width}${scenario.themeId ? ` · ${scenario.themeId}` : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await mockCommerce(page, scenario.locale, { ...scenario, currency: "ILS" });
    await page.route("**/api/customer-auth/**", (route) => route.fulfill({ json: { account: { id: 41, name: "Demo Guest", email: "test@example.com" } } }));
    await page.route("**/api/customer-api/payment-methods?**", (route) => route.fulfill({ json: {
      enabled: true, identity_required: false, hosted_signup_enabled: true, direct_card_enabled: false,
      methods: [
        { id: 7, provider: "verifone", card_brand: "MASTERCARD", card_last_four: "1111", expiry_month: 12, expiry_year: 2031, expired: false },
        { id: 8, provider: "verifone", card_brand: "VISA", card_last_four: "2222", expiry_month: 1, expiry_year: 2020, expired: true },
      ],
    } }));
    await page.route("**/api/customer-api/payment-methods/7?**", (route) => route.fulfill({ status: 503, json: {} }));
    let charges = 0;
    await page.route("**/api/customer-api/orders?**", (route) => {
      const body = route.request().postDataJSON();
      expect(body.payment_method_token_id).toBe(7);
      expect(body.save_card).not.toBe(true);
      expect(JSON.stringify(body)).not.toContain("000000000");
      return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
    });
    await page.route("**/api/customer-api/orders/99/payment/saved-method?**", (route) => {
      charges++;
      expect(route.request().postDataJSON()).toEqual({ payment_method_token_id: 7 });
      return route.fulfill({ json: { completed: true } });
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    const panel = page.locator("[data-checkout-payment-card]");
    const saved = panel.locator('input[type="radio"][value="7"]');
    await expect(saved).toBeVisible();
    await expect(saved).toBeChecked();
    await panel.locator('input[value="new"]').check();
    await expect(panel.locator('input[value="8"]')).toBeDisabled();
    await expect(panel.locator("[data-save-card]")).not.toBeChecked();
    await expect(panel.locator('fieldset')).toHaveCSS("border-radius", "16px");
    await expect(panel.locator('label:has(input[value="new"])')).toHaveCSS("border-radius", "10px");
    await expect(panel.locator("[data-checkout-preferences] > div")).toHaveCSS("border-radius", "10px");
    await panel.locator("[data-save-card]").check();
    await expect(panel.getByRole("note")).toContainText("Verifone");
    await expect(panel.getByRole("note")).toContainText(/1[.,]00/);
    await expect(panel.locator('[data-card-field]')).toHaveCount(0);
    await panel.screenshot({ path: testInfo.outputPath("payment-new-card.png") });
    await saved.check();
    await expect(panel.locator("[data-save-card]")).toHaveCount(0);
    await expect(page.locator("#saved-card-identity")).toHaveCount(0);
    const selectedCard = panel.locator('fieldset > div > div:has(input[value="7"])');
    await expect(selectedCard).toHaveCSS("border-radius", "10px");
    await expect(panel.locator('label:has(input[value="7"]) > span[aria-hidden="true"]')).toHaveCSS("border-radius", "4px");
    if (scenario.themeId === "garden-fresh") {
      // Verify the real palette/radius tokens are applied, not a neutral fixture.
      await expect(panel).toHaveCSS("--radius-xl", "32px");
      await expect(panel.locator('fieldset')).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(selectedCard).toHaveCSS("background-color", "rgb(234, 243, 229)");
      await expect(panel.locator('fieldset')).toHaveCSS("color", "rgb(31, 58, 32)");
    }
    await panel.locator('input[value="new"]').check();
    await expect(panel.locator("[data-save-card]")).not.toBeChecked();
    await saved.check();
    await expect(page.locator("#saved-card-identity")).toHaveCount(0);
    await panel.screenshot({ path: testInfo.outputPath("payment-saved-card.png") });
    // Bound the new payment panel independently of the existing contact fields.
    const overflow = await panel.evaluate((panel) => [panel, ...Array.from(panel.querySelectorAll("*"))]
      .filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1); })
      .map((element) => ({ tag: element.tagName, className: element.getAttribute("class"), width: element.getBoundingClientRect().width })));
    expect(overflow).toEqual([]);
    await panel.getByRole("button", { name: /Mastercard 1111/ }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(saved).toBeChecked();
    await expect(saved).toBeEnabled();
    expect(charges).toBe(0);
    await page.locator('form input[type="text"]').first().fill("Demo Guest");
    await page.locator('input[type="tel"]').fill("501234567");
    await page.locator(".commerce-confirm-action button").click();
    await expect(page).toHaveURL(/payment\/success\?orderId=99/);
    expect(charges).toBe(1);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("000000000");
  });
}

for (const [locale, pinned] of [["en", false], ["he", false], ["en", true]] as const) {
  test(`direct saved-card capture encrypts before sending · ${locale}${pinned ? " · K1571" : ""}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCommerce(page, locale, { currency: "ILS" });
    await page.route("**/api/customer-auth/**", (route) => route.fulfill({ json: { account: { id: 41, name: "Demo Guest", email: "test@example.com" } } }));
    await page.route("**/api/customer-api/payment-methods?**", (route) => route.fulfill({ json: { enabled: true, identity_required: true, direct_card_enabled: true, methods: [] } }));
    const { publicKey, privateKey } = await pgp.generateKey({ type: "rsa", rsaBits: 2048, userIDs: [{ name: "Synthetic browser test" }], format: "armored" });
    await page.route("**/api/customer-api/payment-methods/capture-key?**", (route) => route.fulfill({ json: { public_key: pinned ? cstPublicKey : btoa(publicKey), public_key_alias: pinned ? "K1571" : "synthetic-key", environment: "sandbox" } }));
    let orders = 0, charges = 0;
    await page.route("**/api/customer-api/orders?**", async (route) => {
      orders++;
      const body = route.request().postDataJSON();
      expect(body.save_card).toBe(true);
      expect(body.direct_card).toBe(true);
      expect(JSON.stringify(body)).not.toContain("4111111111111111");
      expect(body).not.toHaveProperty("encrypted_card");
      return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } });
    });
    await page.route("**/api/customer-api/orders/99/payment/encrypted-card?**", async (route) => {
      charges++;
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(["encrypted_card", "encrypted_identity_card_number", "public_key_alias"]);
      expect(JSON.stringify(body)).not.toContain("4111111111111111");
      const message = await pgp.readMessage({ armoredMessage: atob(body.encrypted_card) });
      if (pinned) {
        expect(message.getEncryptionKeyIDs().map((id) => id.toHex())).toEqual(["3e361202e314c886"]);
      } else {
        const key = await pgp.readPrivateKey({ armoredKey: privateKey });
        const decoded = await pgp.decrypt({ message, decryptionKeys: key });
        expect(JSON.parse(String(decoded.data))).toMatchObject({ cardNumber: "4111111111111111", cvv: "123" });
      }
      return route.fulfill({ json: { completed: true } });
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await page.locator('form input[type="text"]').first().fill("Demo Guest");
    await page.locator('input[type="tel"]').fill("501234567");
    await page.getByRole("checkbox").last().check();
    const fieldset = page.locator("fieldset[aria-describedby='verifone-capture-note']");
    await expect(fieldset).toBeVisible();
    await expect(fieldset).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await fieldset.screenshot({ path: testInfo.outputPath(`card-capture-${locale}.png`) });
    const fields = { cardNumber: "4111111111111111", cardholderName: "Synthetic Test", expiryMonth: "12", expiryYear: String(new Date().getUTCFullYear() + 1), cvv: "123", identity: "000000000" };
    for (const [name, value] of Object.entries(fields)) await page.locator(`[data-card-field="${name}"]`).fill(value);
    await page.locator(".commerce-confirm-action button").click();
    await expect(page).toHaveURL(/payment\/success\?orderId=99/);
    expect(orders).toBe(1); expect(charges).toBe(1);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain(fields.cardNumber);
    expect(storage).not.toContain("encrypted_card");
  });
}

for (const [locale, width] of [["fr", 1280], ["he", 320], ["en", 390]] as const) {
  test(`weight hold checkout shows the reviewed ceiling · ${locale} · ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockCommerce(page, locale, { weighted: true, currency: "ILS", dark: locale === "he" });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    const notice = page.locator("[data-weight-hold-notice]");
    await expect(notice).toHaveCount(1); await expect(notice).toContainText("170.00"); await expect(notice).toContainText("20");
    await expect(page.locator(".commerce-totals")).toContainText("150.00");
    await expect(page.locator(".commerce-confirm-action button")).toContainText("170.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await notice.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`weight-hold-${locale}.png`), fullPage: true });
    expect(await notice.evaluate(e => getComputedStyle(e).getPropertyValue("--surface-subtle"))).not.toBe("");
  });
}

test("weight hold checkout requires a new confirmation when the margin changes", async ({ page }) => {
  const options = { weighted: true, currency: "ILS", weightBuffer: 20 };
  await mockCommerce(page, "fr", options);
  let orders = 0, orderBody: Record<string, unknown> | undefined;
  await page.route("**/api/customer-api/orders?**", route => { orders++; orderBody = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { order: { id: 99, receipt_token: "synthetic-receipt" } } }); });
  await page.route("**/order/confirmation/**", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic confirmation</main>" }));
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.locator("[data-weight-hold-notice]")).toContainText("170.00");
  await page.locator('#checkout-details input[type="text"]').first().fill("Demo Guest"); await page.locator('input[type="tel"]').fill("500000000");
  options.weightBuffer = 30;
  await page.locator(".commerce-confirm-action button").click();
  await expect(page.locator('main [role="alert"]')).toContainText("préautorisation a changé");
  await expect(page.locator("[data-weight-hold-notice]")).toContainText("180.00"); expect(orders).toBe(0);
  await page.locator(".commerce-confirm-action button").click();
  await expect.poll(() => orders).toBe(1); expect(orderBody?.expected_hold_amount_minor).toBe(18000);
});

test("weight hold checkout blocks an unknown policy but pay-later never claims a hold", async ({ page }) => {
  await mockCommerce(page, "fr", { weighted: true, currency: "ILS", weightBuffer: NaN });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.locator("[data-weight-hold-notice]")).toContainText("indisponible"); await expect(page.locator(".commerce-confirm-action button")).toBeDisabled();
  await mockCommerce(page, "fr", { weighted: true, currency: "ILS", pickupPrepayment: false });
  await page.reload(); await expect(page.locator("[data-weight-hold-notice]")).toHaveCount(0);
  await expect(page.locator(".commerce-payment")).toContainText("ne demande pas d’empreinte bancaire");
});

async function mockCommerce(
  page: Page,
  locale: string,
  options: {
    autocomplete?: boolean;
    otp?: boolean;
    stock?: number;
    dark?: boolean;
    pageStyle?: string;
    currency?: string;
    themeId?: string;
    pairingId?: string;
    scheduling?: boolean;
    preparationClock?: "elapsed" | "opening_hours" | "custom_start";
    strictCalendar?: "slots" | "batch";
    pickupEnabled?: boolean;
    pickupPrepayment?: boolean;
    splitContactName?: boolean;
    requiredBuildingCode?: boolean;
    requiredConsent?: boolean;
    lockOrderType?: boolean;
    ordersPaused?: boolean;
    orderingTestAccessExpiresAt?: string;
    weighted?: boolean;
    weightBuffer?: number;
  } = {},
) {
  await page.addInitScript(
    ({ item, locale, currency, weighted }) => {
      localStorage.setItem("foody-locale", locale);
      localStorage.setItem(
        "foody-cart",
        JSON.stringify({
          version: 1,
          state: {
            restaurantId: "9001",
            currency,
            lines: weighted ? [{ id: "demo-line", item, quantity: 1 }, { id: "fixed", item: { id: "2", name: "Fixed-price item", price: 50, groupId: "1", available: true }, quantity: 1 }] : [{ id: "demo-line", item, quantity: 2 }],
          },
        }),
      );
    },
    { item: options.weighted ? { ...item, price: 100, pricingMode: "by_weight", pricePerKg: 100, estimatedWeightGrams: 1000 } : options.strictCalendar ? { ...item, immediateSaleMode: "standalone" } : item, locale, currency: options.currency ?? "EUR", weighted: options.weighted },
  );
  await page.route("**/api/customer-auth/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/customer-api/**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/me/checkout-profile")) {
      const input = route.request().method() === "PUT" ? route.request().postDataJSON() : {};
      return route.fulfill({ json: { profile: { name: "Demo Guest", phone: "", address: "", city: "", floor: "", apt: "", entry_code: "", delivery_notes: "", ...input, ...input.delivery }, address_selection: null } });
    }
    return route.fulfill({ status: 401, json: {} });
  });
  const publicAPI = async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const sourcePage = {
      id: 1,
      restaurant_id: 9001,
      slug: "commander",
      title: "Menu",
      type: "order",
      sort_order: 0,
      nav_visible: true,
      is_default: true,
      seo: {},
      sections: [],
      settings: { menu_ids: [] },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      appearance_overrides: {
        foody_renderer_version: 1,
        website_order: { color_style: options.pageStyle },
      },
    };
    if (path.endsWith('/address-autocomplete/config'))
      return route.fulfill({ json: { available: !!options.autocomplete, enabled: !!options.autocomplete, provider: 'google' } });
    if (path.endsWith('/delivery/cities')) return route.fulfill({ json: { cities: [] } });
    if (path.endsWith('/delivery/check')) return route.fulfill({ json: { deliverable: true, resolved: true, reason: '', delivery_fee: 0, min_order: null } });
    if (path.endsWith("/website-pages"))
      return route.fulfill({
        json: { pages: options.pageStyle ? [sourcePage] : [] },
      });
    if (path.endsWith("/website-pages/commander"))
      return route.fulfill({ json: { page: sourcePage } });
    if (path.endsWith("/menu"))
      return route.fulfill({
        json: {
          currency: options.currency ?? "EUR",
          menus: [
            {
              id: 1,
              name: "Menu",
              groups: [
                {
                  id: 1,
                  name: "Sandwiches",
                  items: [
                    {
                      ...item,
                      ...(options.weighted ? { price: 100, pricing_mode: "by_weight", price_per_kg: 100, estimated_weight_grams: 1000 } : {}),
                      id: 1,
                      group_id: 1,
                      buildable_count: options.stock,
                    },
                    ...(options.weighted ? [{ id: 2, name: "Fixed-price item", price: 50, group_id: 1, is_active: true }] : []),
                  ],
                },
              ],
            },
          ],
        },
      });
    if (path.endsWith("/restaurants/9001") || path.endsWith("/restaurants/demo-restaurant") || path.endsWith("/restaurants/foody-demo"))
      return route.fulfill({
        json: {
          restaurant: {
            id: 9001,
            name: "Foody Demo",
            slug: "foody-demo",
            address: "12 Demo Street",
            currency: options.currency ?? "EUR",
            vat_rate: 18,
            weight_hold_buffer_percent: options.weightBuffer ?? 20,
            preorders_only: !!options.strictCalendar,
            scheduling_enabled: options.scheduling || options.strictCalendar === "slots",
            batch_fulfillment_enabled: options.strictCalendar === "batch",
            orders_paused: options.ordersPaused,
            ordering_test_access_expires_at: options.orderingTestAccessExpiresAt,
            scheduling_max_days_ahead: 7,
            scheduling_lead_time_minutes: options.preparationClock ? 180 : 0,
            scheduling_preparation_time_basis: options.preparationClock,
            scheduling_preparation_start_time: "07:00",
            pickup_enabled: options.pickupEnabled ?? true,
            delivery_enabled: true,
            require_pickup_prepayment: options.pickupPrepayment ?? true,
            otp_mode: options.otp ? "required" : "skip",
            website_config: {
              theme_id:
                options.themeId ??
                (locale === "fr"
                  ? "custom"
                  : options.dark
                    ? "editorial-dark"
                    : "minimal-light"),
              ...(options.pairingId ? { pairing_id: options.pairingId } : {}),
              ...(locale === "fr" && !options.themeId
                ? {
                    custom_palette: {
                      mode: "light",
                      bg: "#fff4eb",
                      surface: "#fff4eb",
                      ink: "#71513d",
                      accent: "#008ecb",
                    },
                    typography: { site: { buttonShape: "rounded" } },
                  }
                : {}),
              ...(options.pageStyle
                ? {
                    theme_id: "custom",
                    custom_palette: {
                      mode: "light",
                      bg: "#ffffff",
                      ink: "#000000",
                      accent: "#e77a40",
                      surface: "#f5f5f5",
                    },
                    typography: {
                      site: {
                        buttonShape: "pill",
                        headingFont: "Dela Gothic One",
                        bodyFont: "Inter",
                      },
                    },
                  }
                : {}),
              checkout_config: {
                lock_order_type: options.lockOrderType,
                ...(options.autocomplete && locale === 'he' ? { delivery: {
                  require_auth: false, address_autocomplete: true,
                  fields: [
                    ...(options.splitContactName ? [{ id: 'customer_first_name', kind: 'builtin', enabled: true, required: true }] : []),
                    { id: 'customer_name', kind: 'builtin', enabled: true, required: true },
                    { id: 'customer_phone', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_city', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_address', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_floor', kind: 'builtin', enabled: true, required: false },
                    { id: 'delivery_apt', kind: 'builtin', enabled: true, required: false },
                    { id: 'custom_field_1', kind: 'custom', type: 'text', label: { he: 'Building code' }, enabled: true, required: options.requiredBuildingCode ?? false },
                    { id: 'marketing', kind: 'custom', type: 'checkbox', label: { he: 'Marketing consent' }, enabled: true, required: options.requiredConsent ?? false },
                  ],
                } } : {}),
                pickup: {
                  require_auth: options.otp ?? false,
                  address_autocomplete: false,
                  fields: [
                    {
                      id: "customer_name",
                      kind: "builtin",
                      enabled: true,
                      required: true,
                      label: { en: "Demo name" },
                    },
                    {
                      id: "customer_phone",
                      kind: "builtin",
                      enabled: true,
                      required: false,
                      label: { en: "Demo phone" },
                    },
                  ],
                },
              },
            },
          },
        },
      });
    if (path.endsWith("/otp/send"))
      return route.fulfill({ json: { message: "Test only", expires_in: 300 } });
    if (path.endsWith("/otp/verify"))
      return route.fulfill({
        json: {
          verified: true,
          proof: "test-only-proof",
          proof_expires_at: new Date(Date.now() + 300_000).toISOString(),
        },
      });
    if (path.includes("trusted"))
      return route.fulfill({ json: { trusted: false } });
    // No real orders, payments or SMS can leave this test browser.
    return route.fulfill({
      status: 404,
      json: { error: "Unmocked test request" },
    });
  };
  await page.route("**/api/v1/public/**", publicAPI);
  await page.route("**/api/customer-api/restaurants/*", publicAPI);
}

for (const scenario of [
  { locale: "fr", width: 390, dark: false },
  { locale: "he", width: 390, dark: true },
  { locale: "en", width: 1280, dark: false },
]) {
  test(`cart and section checkout · ${scenario.locale} · ${scenario.width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await mockCommerce(page, scenario.locale, scenario);
    await page.goto("/order/cart?restaurantId=9001&orderType=pickup");
    await page.addStyleTag({ content: "nextjs-portal { display: none }" });
    await expect(page.locator(".commerce-item")).toHaveCount(1);
    await expect(page.locator(".commerce-totals")).toContainText("24.00");
    await page.locator(".commerce-quantity").last().click();
    await expect(page.locator(".commerce-totals")).toContainText("36.00");
    await expect(
      page.locator(".commerce-fulfillment-row").first(),
    ).toContainText("12 Demo Street");
    if (scenario.locale === "fr")
      await page.screenshot({
        path: testInfo.outputPath("cart-mobile.png"),
        fullPage: false,
      });
    await page.locator(".commerce-cart-action button").click();
    await expect(page).toHaveURL(/\/order\/checkout/);
    await page.locator('form input[type="text"]').first().fill("Demo Guest");
    await expect(page.locator(".commerce-progress")).toHaveCount(0);
    await expect(page.locator(".commerce-payment")).toBeVisible();
    const order = page.locator(
      ".commerce-checkout-summary .commerce-order-details",
    );
    await expect(order).not.toHaveAttribute("open");
    await order.locator("summary").click();
    await expect(order.locator(".commerce-item")).toHaveCount(1);
    await expect(page.locator(".commerce-confirm-action")).toContainText(
      "36.00",
    );
    await expect(page.locator(".commerce-confirm-action button")).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (scenario.locale === "he")
      await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
    if (scenario.locale === "fr") {
      await order.locator("summary").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath("checkout-mobile.png"),
        fullPage: false,
      });
    }
    await expect(page.locator('form input[type="text"]').first()).toHaveValue(
      "Demo Guest",
    );
  });
}

test("phone verification stays inline and changing the number invalidates it", async ({
  page,
}) => {
  await mockCommerce(page, "en", { otp: true });
  let orders = 0;
  await page.route("**/api/customer-api/orders?**", (route) => {
    orders++;
    return route.fulfill({
      status: 400,
      json: { error: "Test order intercepted" },
    });
  });
  await page.route("**/otp/verify", (route) => {
    if (route.request().postDataJSON().code === "111111")
      return route.fulfill({ status: 400, json: { error: "Invalid code" } });
    return route.fallback();
  });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  const name = page.locator('form input[type="text"]').first();
  const phone = page.locator('form input[type="tel"]');
  const action = page.locator(".commerce-confirm-action button");
  await expect(page.locator(".commerce-payment")).toBeVisible();
  await action.click();
  expect(orders).toBe(0); // Required contact fields still use native form validation.
  await name.fill("Demo Guest");
  await phone.fill("0500000000");
  await action.click();
  const code = page.locator('input[maxlength="6"]');
  await expect(code).toBeVisible();
  await expect(name).toBeVisible();
  await expect(page.locator(".commerce-payment")).toBeVisible();
  await code.fill("111111");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.locator(".commerce-phone-verification")).toContainText(
    "Invalid",
  );
  await expect(name).toHaveValue("Demo Guest");
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(code).toHaveCount(0);
  await expect(page.locator(".commerce-contact [role=status]")).toContainText(
    "verified",
  );
  expect(orders).toBe(0); // Verifying a phone never places the order automatically.
  await phone.fill("0500000001");
  await expect(page.locator(".commerce-contact [role=status]")).toHaveCount(0);
  await action.click();
  await expect(code).toBeVisible();
  expect(orders).toBe(0);
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(code).toHaveCount(0);
  await action.click();
  await expect.poll(() => orders).toBe(1);
});

test("cart and checkout retain the menu's dark style on a white site with pill buttons", async ({
  page,
}, testInfo) => {
  await mockCommerce(page, "fr", { pageStyle: "style-5" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/order/cart?restaurantId=9001&orderType=pickup&pageSlug=commander",
  );
  const surface = page.locator(".commerce-surface");
  await expect(surface).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(surface).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(surface).toHaveCSS("font-family", /Inter/);
  await expect(page.locator("h1")).toHaveCSS("font-family", /Dela Gothic One/);
  await expect(page.locator(".commerce-primary")).toHaveCSS(
    "border-radius",
    "8px",
  );
  await expect(page.locator(".commerce-primary")).toHaveCSS(
    "background-color",
    "rgb(231, 122, 64)",
  );
  await page.locator(".commerce-cart-action button").click();
  await expect(page).toHaveURL(/pageSlug=commander/);
  await expect(surface).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(surface).toHaveCSS("font-family", /Inter/);
  await expect(page.locator("h1")).toHaveCSS("font-family", /Dela Gothic One/);
  await expect(page.locator(".commerce-payment")).toBeVisible();
  await expect(page.locator(".commerce-progress")).toHaveCount(0);
  await expect(page.locator(".commerce-confirm-action button")).toHaveCSS(
    "border-radius",
    "8px",
  );
  await expect(page.locator('form input[type="text"]').first()).toHaveCSS(
    "background-color",
    "color(srgb 0.104 0.104 0.104)",
  );
  await page.screenshot({
    path: testInfo.outputPath("checkout-dark-full.png"),
    fullPage: true,
  });
});

test("cart blocks checkout when fresh stock is less than the saved quantity", async ({
  page,
}) => {
  await mockCommerce(page, "en", { stock: 1 });
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup");
  await expect(page.locator(".commerce-cart-action button")).toBeDisabled();
  await expect(page.locator(".commerce-item [role=status]")).toBeVisible();
});

for (const screen of ["cart", "checkout"] as const) {
  test(`${screen} location and clock open their own editors without changing the cart`, async ({ page }) => {
    await mockCommerce(page, "en", { scheduling: true });
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.route("**/scheduling-config?**", route => route.fulfill({ json: {
      enabled: true, immediate_available: true, lead_time_minutes: 0,
      slot_duration_minutes: 30, require_prepayment: false,
      slots_by_date: { [date]: [{ start: "10:00", end: "10:30" }] },
    } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/order/${screen}?restaurantId=9001&orderType=pickup`);
    const cartBefore = await page.evaluate(() => localStorage.getItem("foody-cart"));
    const rows = page.locator(".commerce-fulfillment:visible .commerce-fulfillment-row");
    await rows.first().click();
    await expect(page.locator(".website-fulfillment-dialog[open]")).toBeVisible();
    await expect(page.locator(".website-schedule-dialog[open]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await rows.last().click();
    const schedule = page.locator(".website-schedule-dialog[open]");
    await expect(schedule).toBeVisible();
    await schedule.locator('input[name="website-time"]').last().check();
    await expect(schedule.locator("select").first()).toHaveValue(date);
    await expect(schedule.locator("select").last()).toHaveValue("10:00");
    await schedule.locator(".website-view-menu").click();
    await expect(schedule).toHaveCount(0);
    await expect(rows.last()).toContainText("10:00");
    await expect(page.locator(".commerce-totals")).toContainText("24.00");
    expect(await page.evaluate(() => localStorage.getItem("foody-cart"))).toBe(cartBefore);
  });

  test(`${screen} keeps timing read-only when scheduling is disabled`, async ({ page }) => {
    await mockCommerce(page, "en");
    await page.goto(`/order/${screen}?restaurantId=9001&orderType=pickup`);
    const timing = page.locator(".commerce-fulfillment:visible .commerce-fulfillment-row").last();
    await expect(timing).toContainText("As soon as possible");
    await expect(timing).toHaveJSProperty("tagName", "DIV");
    await timing.click();
    await expect(page.locator(".website-schedule-dialog[open]")).toHaveCount(0);
  });
}

for (const pickupEnabled of [true, false]) {
  test(`weekly preorder service and address stay editable with a fixed calendar · pickup ${pickupEnabled}`, async ({ page }) => {
    await mockCommerce(page, "en", { strictCalendar: "batch", autocomplete: true, pickupEnabled, lockOrderType: true });
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.route("**/batch-fulfillment-config?**", route => route.fulfill({ json: {
      enabled: true, ordering_open: true, require_prepayment: false,
      current_batch_open_at: new Date(Date.now() - 86400000).toISOString(),
      current_batch_cutoff: new Date(Date.now() + 3600000).toISOString(),
      fulfillment_days: [{ date, day_name: "Friday", pickup_window: { start: "10:00", end: "14:00" }, delivery_window: { start: "10:00", end: "14:00" } }],
    } }));
    await page.route("**/api/v1/public/address-autocomplete?**", route => route.fulfill({ json: { suggestions: [{
      id: "weekly-building", address: "Mahane Yosef 26", city: "Tel Aviv", street: "Mahane Yosef", house_number: "26",
      lat: 32.061, lng: 34.766, token: "synthetic-weekly-selection",
    }] } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/order/cart?restaurantId=9001&orderType=${pickupEnabled ? "pickup" : "delivery"}`);
    const cartBefore = await page.evaluate(() => localStorage.getItem("foody-cart"));
    const location = page.locator("button.commerce-fulfillment-row:visible").first();
    await location.click();
    const dialog = page.locator(".website-fulfillment-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab")).toHaveCount(pickupEnabled ? 2 : 0);
    if (pickupEnabled) await dialog.getByRole("tab", { name: "Delivery", exact: true }).click();
    await dialog.getByRole("combobox").fill("Mahane Yosef 26");
    await dialog.getByRole("option").click();
    await expect(dialog.getByRole("combobox")).toHaveValue("Mahane Yosef 26, Tel Aviv");
    await dialog.locator(".website-view-menu").click();
    await expect(dialog).toHaveCount(0);
    await expect(location).toContainText("Mahane Yosef 26, Tel Aviv");
    const timing = page.locator(".commerce-fulfillment:visible .commerce-fulfillment-row").last();
    await expect(timing).toHaveJSProperty("tagName", "DIV");
    await expect(timing).toContainText("10:00");
    await timing.click();
    await expect(page.locator(".website-schedule-dialog[open]")).toHaveCount(0);
    await page.locator(".commerce-cart-overlay[open] .commerce-cart-action button").click();
    await expect(page).toHaveURL(/\/order\/checkout/);
    await expect(location).toContainText("Mahane Yosef 26, Tel Aviv");
    await expect(page.locator(".commerce-fulfillment:visible")).toContainText("10:00 – 14:00");
    await expect(page.getByText("Delivery info", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Your order will be delivered on", { exact: false })).toHaveCount(0);
    await expect(page.locator(".commerce-fulfillment:visible .commerce-fulfillment-row").last()).toHaveJSProperty("tagName", "DIV");
    await location.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveValue("Mahane Yosef 26, Tel Aviv");
    expect(await page.evaluate(() => localStorage.getItem("foody-cart"))).toBe(cartBefore);
  });
}

test("a late phone verification response cannot verify an edited number", async ({
  page,
}) => {
  await mockCommerce(page, "en", { otp: true });
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    page.route("**/otp/verify", async (route) => {
      await new Promise<void>((done) => {
        release = done;
        resolve();
      });
      await route.fulfill({
        json: {
          verified: true,
          proof: "test-old-phone-proof",
          proof_expires_at: new Date(Date.now() + 300000).toISOString(),
        },
      });
    });
  });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await page.locator('form input[type="text"]').first().fill("Demo Guest");
  const phone = page.locator('form input[type="tel"]');
  await phone.fill("0500000000");
  await page.locator(".commerce-confirm-action button").click();
  await page.locator('input[maxlength="6"]').fill("123456");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await ready;
  await phone.fill("0500000001");
  const response = page.waitForResponse((res) =>
    res.url().includes("/otp/verify"),
  );
  release!();
  await response;
  await expect(page.locator(".commerce-confirm-action button")).toBeEnabled();
  await expect(phone).toHaveValue("0500000001");
  await expect(page.locator(".commerce-contact [role=status]")).toHaveCount(0);
  await expect(page.locator(".commerce-confirm-action button")).toContainText(
    "Verify Your Phone",
  );
});


test("default checkout collects phone without SMS and offers cash only for an authorized number", async ({ page }) => {
  await mockCommerce(page, "en");
  let sms = 0;
  let orders = 0;
  const methods: string[] = [];
  await page.route("**/otp/send", (route) => { sms++; return route.abort(); });
  await page.route("**/customers/check-trusted?**", async (route) => {
    const phone = new URL(route.request().url()).searchParams.get("phone");
    await route.fulfill({ json: { trusted: phone === "+972500000000" } });
  });
  await page.route("**/api/customer-api/orders?**", (route) => {
    methods.push(route.request().postDataJSON().payment_method);
    orders++; return route.fulfill({ status: 400, json: { error: "Test intercepted" } });
  });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.getByRole("button", { name: /Cibus/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cash", exact: true })).toHaveCount(0);
  const phone = page.locator('form input[type="tel"]');
  await expect(phone).toHaveAttribute("required", "");
  await page.locator('form input[type="text"]').first().fill("Demo Guest");
  await page.locator(".commerce-confirm-action button").click();
  expect(orders).toBe(0);
  await phone.fill("0500000000");
  const cash = page.getByRole("button", { name: "Cash", exact: true });
  await expect(cash).toBeVisible();
  await cash.click();
  await page.locator(".commerce-confirm-action button").click();
  await expect.poll(() => orders).toBe(1);
  await phone.fill("0500000001");
  await expect(cash).toHaveCount(0);
  await page.locator(".commerce-confirm-action button").click();
  await expect.poll(() => orders).toBe(2);
  expect(methods).toEqual(["cash", "pay_now"]);
  expect(sms).toBe(0);
});

test("item sheet inherits selected dark menu style and compact action corners", async ({ page }, testInfo) => {
  await mockCommerce(page, "fr", { pageStyle: "style-5" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup&pageSlug=commander");
  await page.locator(".commerce-item button").first().click();
  const dialog = page.getByRole("dialog", { name: "Demo sandwich" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(dialog).toHaveCSS("font-family", /Inter/);
  await expect(dialog.locator("h3").last()).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(dialog.locator("h3").last()).toHaveCSS("font-family", /Dela Gothic One/);
  await expect(dialog.locator("button.bg-brand")).toHaveCSS("border-radius", "8px");
  await expect(dialog.locator(".website-item-toolbar button")).toBeVisible();
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.y)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("item-dark-mobile.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("confirmation preview applies the editor draft to the shared themed receipt layout", async ({ page, baseURL }, testInfo) => {
  await mockCommerce(page, "fr", { pageStyle: "style-5" });
  const webOrigin = new URL(baseURL!).origin;
  const adminOrigin = resolveWebsiteV3AdminOrigin({ currentOrigin: webOrigin });
  expect(adminOrigin).toBeTruthy();
  if (new URL(webOrigin).hostname === "localhost") {
    // The mocked parent has no loopback server address for Chromium to classify.
    await page.context().grantPermissions(["local-network-access"], { origin: adminOrigin! });
  }
  const draft = {
    type: "foody-checkout-preview", revision: 1, contentRevision: 1,
    activePageKey: "page-1", device: "mobile", checkoutConfig: null,
    appearanceOverrides: {
      website_order: { color_style: "style-2" },
      order_journey: { confirmation: "style-5" },
    },
  };
  let publishedPageRequests = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname.includes("/website-pages")) publishedPageRequests++;
  });
  // Exercise the trusted parent/iframe handshake used by the real editor.
  await page.route(`${adminOrigin}/commerce-preview-test`, route => route.fulfill({
    contentType: "text/html",
    body: `<html><body style="margin:0"><script>
      addEventListener("message", event => {
        const frame = document.querySelector("iframe");
        if (event.source !== frame.contentWindow || event.origin !== ${JSON.stringify(webOrigin)}) return;
        if (event.data.type === "foody-checkout-preview-ready") frame.contentWindow.postMessage(${JSON.stringify(draft)}, ${JSON.stringify(webOrigin)});
        if (event.data.type === "foody-checkout-preview-applied") document.body.dataset.appliedRevision = event.data.revision;
      });
    </script><iframe title="Confirmation preview" style="border:0;width:100%;height:844px"
      src="${webOrigin}/order/confirmation/preview?restaurantId=9001&preview=1&pageSlug=commander"></iframe></body></html>`,
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${adminOrigin}/commerce-preview-test`);
  await expect(page.locator("body")).toHaveAttribute("data-applied-revision", "1");
  const frame = page.frameLocator('iframe[title="Confirmation preview"]');
  const surface = frame.locator(".confirmation-surface");
  await expect(surface).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(surface).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(surface).toHaveCSS("font-family", /Inter/);
  await expect(surface.locator("h1")).toHaveCSS("font-family", /Dela Gothic One/);
  await expect(surface.locator(".confirmation-order")).toContainText("Article d’exemple");
  await expect(surface.locator(".confirmation-order")).toContainText("Autre article");
  await expect(surface.locator(".confirmation-order")).not.toContainText("Demo sandwich");
  await expect(surface.locator(".commerce-totals")).toContainText("65");
  expect(await surface.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(publishedPageRequests).toBe(0);
  const cartBefore = await surface.evaluate(() => localStorage.getItem("foody-cart"));
  await surface.getByRole("link").first().click();
  await expect(surface).toBeVisible();
  expect(await surface.evaluate(() => localStorage.getItem("foody-cart"))).toBe(cartBefore);
  await page.locator("iframe").evaluate((element, height) => {
    element.style.height = `${height}px`;
  }, await surface.evaluate(element => element.scrollHeight));
  await page.screenshot({ path: testInfo.outputPath("confirmation-dark-mobile.png"), fullPage: true });
  // Reset the confirmation style and verify that it inherits the draft menu style.
  await page.evaluate(({ draft, webOrigin }) => {
    document.querySelector("iframe")!.contentWindow!.postMessage({
      ...draft, revision: 2, appearanceOverrides: {
        website_order: { color_style: "style-1" }, order_journey: { confirmation: "default" },
      },
    }, webOrigin);
  }, { draft, webOrigin });
  await expect(page.locator("body")).toHaveAttribute("data-applied-revision", "2");
  await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
});


test("cash fails closed on lookup failure and ignores an old number's response", async ({ page }) => {
  await mockCommerce(page, "en");
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  await page.route("**/customers/check-trusted?**", async (route) => {
    const phone = new URL(route.request().url()).searchParams.get("phone");
    if (phone === "+972500000000") {
      await new Promise<void>((resolve) => { release = resolve; started!(); });
      return route.fulfill({ json: { trusted: true } });
    }
    return route.fulfill({ status: 500, json: { error: "Lookup unavailable" } });
  });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  const phone = page.locator('form input[type="tel"]');
  await phone.fill("0500000000");
  await ready;
  await phone.fill("0500000001");
  const response = page.waitForResponse((res) => res.url().includes("check-trusted") && res.status() === 200);
  release!();
  await response;
  await expect(page.locator(".commerce-payment .text-red-500")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cash", exact: true })).toHaveCount(0);
});


for (const restaurantRoute of ["9001", "demo-restaurant"]) {
test(`confirmed card returns recover numeric scope and source page · ${restaurantRoute}`, async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("foody-order-page:9001:1234", "commander"));
  await mockCommerce(page, "en");
  let orderLoads = 0;
  await page.route("**/api/v1/public/orders/1234?**", (route) => {
    orderLoads++;
    expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
    expect(route.request().headers()["x-receipt-token"]).toBe("demo-proof");
    return route.fulfill({ json: { order: {
    id: 1234, order_type: "pickup", payment_status: "paid", order_status: "accepted",
    payment_method: "pay_now", total_amount: 24, currency: "EUR", receipt_token: "demo-proof", items: [],
  } } });
  });
  // The destination is server-rendered: intercept it so this test cannot query real order data.
  await page.route("**/order/confirmation/1234?**", (route) => route.fulfill({
    contentType: "text/html", body: "<main>Test confirmation destination</main>",
  }));
  await page.goto(`/r/${restaurantRoute}/payment/success?orderId=1234&t=demo-proof`);
  await expect(page).toHaveURL(/order\/confirmation\/1234/);
  const url = new URL(page.url());
  expect(url.searchParams.get("t")).toBe("demo-proof");
  expect(url.searchParams.get("pageSlug")).toBe("commander");
  expect(url.searchParams.get("restaurantId")).toBe("9001");
  expect(orderLoads).toBeGreaterThan(0);
});

test(`failed card return loads and retries only with numeric restaurant scope · ${restaurantRoute}`, async ({ page }) => {
  await mockCommerce(page, "en", { currency: "ILS" });
  let orderLoads = 0;
  let retries = 0;
  await page.route("**/api/v1/public/orders/1234?**", (route) => {
    orderLoads++;
    expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
    expect(route.request().headers()["x-receipt-token"]).toBe("demo-proof");
    return route.fulfill({ json: { order: {
      id: 1234, order_type: "pickup", payment_status: "pending", order_status: "pending_review",
      payment_method: "pay_now", total_amount: 24, currency: "ILS", items: [],
    } } });
  });
  await page.route("**/api/customer-api/orders/1234/payment/init?**", (route) => {
    retries++;
    expect(new URL(route.request().url()).searchParams.get("restaurant_id")).toBe("9001");
    expect(route.request().headers()["x-receipt-token"]).toBe("demo-proof");
    return route.fulfill({ status: 409, json: { error: "Synthetic pending payment; check the order" } });
  });
  await page.goto(`/r/${restaurantRoute}/payment/failed?orderId=1234&t=demo-proof`);
  await expect(page.getByRole("heading", { name: "Payment Failed" }).last()).toBeVisible();
  await expect(page.getByText("Order #1234", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order Not Found" })).toHaveCount(0);
  expect(orderLoads).toBeGreaterThan(0);
  expect(retries).toBe(0);
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.getByText("Synthetic pending payment; check the order")).toBeVisible();
  expect(retries).toBe(1);
});
}


for (const calendar of ["slots", "batch"] as const) {
  test(`strict preorder checkout keeps ready stock on the ${calendar} calendar`, async ({ page }) => {
    await mockCommerce(page, "en", { strictCalendar: calendar });
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let failCalendar = true;
    await page.route("**/scheduling-config?**", route => failCalendar
      ? route.fulfill({ status: 503, json: { error: "Synthetic calendar failure" } })
      : route.fulfill({ json: {
        enabled: true, immediate_available: true, lead_time_minutes: 0,
        slot_duration_minutes: 30, require_prepayment: false,
        slots_by_date: { [date]: [{ start: "10:00", end: "10:30" }, { start: "11:00", end: "11:30" }] },
      } }));
    await page.route("**/batch-fulfillment-config?**", route => failCalendar
      ? route.fulfill({ status: 503, json: { error: "Synthetic calendar failure" } })
      : route.fulfill({ json: {
        enabled: true, ordering_open: true, immediate_available: true, require_prepayment: false,
        current_batch_open_at: new Date(Date.now() - 86400000).toISOString(),
        current_batch_cutoff: new Date(Date.now() + 3600000).toISOString(),
        fulfillment_days: [{ date, day_name: "Friday", pickup_window: { start: "10:00", end: "14:00" } }],
      } }));
    let payload: Record<string, unknown> | undefined;
    await page.route("**/api/customer-api/orders?**", route => {
      payload = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: "Synthetic stop after payload capture" } });
    });
    // A previously chosen slot must survive a refresh, including when ready
    // stock and an old immediate_available response would otherwise bypass it.
    const selection = calendar === "slots" ? `&isScheduled=true&scheduledFor=${date}&scheduledPickupWindowStart=11:00&scheduledPickupWindowEnd=11:30` : "";
    await page.goto(`/order/checkout?restaurantId=9001&orderType=pickup${selection}`);
    await page.locator('form input[type="text"]').first().fill("Demo Guest");
    await page.locator('input[type="tel"]').fill("501234567");
    await expect(page.getByRole("alert").filter({ hasText: "Unable to load available times." })).toBeVisible();
    await expect(page.locator(".commerce-confirm-action button")).toBeDisabled();
    failCalendar = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator(".commerce-confirm-action button")).toBeEnabled();
    if (calendar === "batch") {
      await expect(page.locator(".commerce-checkout-summary .commerce-fulfillment")).toContainText("10:00 – 14:00");
      await expect(page.getByText("Pickup info", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Your order will be ready for pickup on", { exact: false })).toHaveCount(0);
    }
    await page.locator(".commerce-confirm-action button").click();
    await expect.poll(() => payload).toBeDefined();
    if (calendar === "slots") {
      expect(payload?.is_scheduled).toBe(true);
      expect(payload?.scheduled_for).toBe(date);
      expect(payload?.scheduled_pickup_window_start).toBe("11:00");
    } else {
      // Weekly batches are assigned by the server using the current lot,
      // independently of the guest's scheduling fields.
      expect(payload?.order_type).toBe("pickup");
      expect(payload?.scheduled_for).toBeUndefined();
    }
  });
}


for (const locale of ['fr', 'he']) {
  test(`delivery address autocomplete selection and edits · ${locale}`, async ({ page }, testInfo) => {
    await mockCommerce(page, locale, { autocomplete: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const suggestion = { id: 'synthetic-building', address: 'Ibn Gabirol 69', city: 'Tel Aviv', street: 'Ibn Gabirol', house_number: '69', lat: 32.081, lng: 34.781, token: 'synthetic-selection-proof' };
    let searches = 0;
    await page.route('**/api/v1/public/address-autocomplete?**', route => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON().lang).toBe(locale);
      searches++;
      return route.fulfill({ json: { suggestions: [suggestion] } });
    });
    await page.goto('/order/checkout?restaurantId=9001&orderType=delivery');
    await page.locator('.commerce-fulfillment-row').first().click();
    const address = page.getByRole('dialog').getByRole('combobox');
    await expect(address).toBeVisible();
    await address.fill('Ibn Gabirol 69 Tel Aviv');
    await expect(page.getByRole('listbox').getByRole('option')).toContainText('Ibn Gabirol 69');
    await expect(address).toHaveJSProperty('validationMessage', locale === 'fr' ? 'Sélectionnez l’adresse complète dans les suggestions.' : 'יש לבחור את הכתובת המלאה מתוך ההצעות.');
    await address.press('ArrowDown');
    await address.press('Enter');
    await expect(address).toHaveValue('Ibn Gabirol 69, Tel Aviv');
    await page.getByRole('dialog').locator('.website-view-menu').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.commerce-fulfillment-row').first()).toContainText('Ibn Gabirol 69, Tel Aviv');
    await expect(page.locator('input[value="Tel Aviv"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`delivery-address-${locale}.png`), fullPage: true });
    let orderBody: Record<string, unknown> | undefined;
    await page.route('**/api/customer-api/orders?**', route => {
      orderBody = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: 'synthetic-test-stop' } });
    });
    await page.locator('form input[type="text"]').first().fill('Demo Guest');
    await page.locator('input[type="tel"]').fill('501234567');
    const callsAfterSelection = searches;
    await page.locator('.commerce-fulfillment-row').first().click();
    const dialog = page.getByRole('dialog');
    const modalAddress = dialog.getByRole('combobox');
    await expect(modalAddress).toHaveValue('Ibn Gabirol 69, Tel Aviv');
    await modalAddress.fill('Ibn Gabirol 70 Tel Aviv');
    await expect(modalAddress).not.toHaveJSProperty('validationMessage', '');
    await expect.poll(() => searches).toBeGreaterThan(callsAfterSelection);
    await expect(dialog.locator('.website-view-menu')).toBeDisabled();
    await expect(dialog).toBeVisible();
    expect(orderBody).toBeUndefined();
    await modalAddress.focus();
    await dialog.getByRole('option').click();
    await expect(modalAddress).toHaveValue('Ibn Gabirol 69, Tel Aviv');
    await expect(modalAddress).toHaveJSProperty('validationMessage', '');
    await dialog.locator('.website-view-menu').click();
    await expect(dialog).not.toBeVisible();
    await page.locator('.commerce-confirm-action button').click();
    await expect.poll(() => orderBody).toBeDefined();
    expect(orderBody).toMatchObject({ delivery_address_token: suggestion.token, delivery_address: suggestion.address, delivery_city: suggestion.city, delivery_latitude: suggestion.lat, delivery_longitude: suggestion.lng });
  });
}


for (const scenario of [
  { locale: "en", width: 1280, dark: false },
  { locale: "fr", width: 1280, dark: true, pageStyle: "style-5" },
  { locale: "fr", width: 390, dark: false },
  { locale: "he", width: 320, dark: true },
]) {
  test(`checkout has one summary and themed account access · ${scenario.locale} · ${scenario.width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await mockCommerce(page, scenario.locale, { ...scenario, currency: "ILS" });
    await page.route("https://accounts.google.com/**", (route) =>
      route.abort(),
    );
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    const sidebar = page.locator(".commerce-checkout-summary");
    const contact = page.locator(".commerce-contact");
    await expect(sidebar.locator(".commerce-fulfillment")).toContainText(
      "12 Demo Street",
    );
    await expect(page.locator(".commerce-fulfillment")).toHaveCount(1);
    await expect(page.locator(".commerce-totals")).toHaveCount(1);
    await expect(page.locator(".commerce-order-details")).toHaveCount(1);
    await expect(page.locator(".commerce-items")).toHaveCount(1);
    await expect(
      sidebar.locator(".commerce-confirm-action button"),
    ).toHaveAttribute("form", "checkout-details");
    const contactBox = (await contact.boundingBox())!;
    if (scenario.width >= 768) {
      const sidebarBox = (await sidebar.boundingBox())!;
      expect(sidebarBox.x).toBeGreaterThan(contactBox.x + contactBox.width);
    } else {
      const fulfillmentBox = (await sidebar
        .locator(".commerce-fulfillment")
        .boundingBox())!;
      const totalsBox = (await sidebar
        .locator(".commerce-totals")
        .boundingBox())!;
      const paymentBox = (await page
        .locator(".commerce-payment")
        .boundingBox())!;
      expect(fulfillmentBox.y + fulfillmentBox.height).toBeLessThan(
        contactBox.y,
      );
      expect(totalsBox.y).toBeGreaterThan(paymentBox.y + paymentBox.height);
    }
    await sidebar.locator("summary").click();
    await expect(sidebar.locator(".commerce-item")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("checkout-layout.png"),
      fullPage: true,
    });
    const register = page.locator("[data-checkout-sign-in] button");
    await register.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute(
      "dir",
      scenario.locale === "he" ? "rtl" : "ltr",
    );
    await expect(dialog.locator('input[type="email"]')).toBeVisible();
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    const expectedSurface = await contact.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--surface").trim(),
    );
    expect(
      await dialog.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--surface").trim(),
      ),
    ).toBe(expectedSurface);
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main *, dialog *"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
          );
        })
        .map((element) => ({
          tag: element.tagName,
          classes: element.getAttribute("class"),
          width: element.getBoundingClientRect().width,
        })),
    );
    expect(overflow).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("checkout-account.png"),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(register).toBeFocused();
  });
}

test("checkout account registration verifies email and preserves entered contact details", async ({
  page,
}) => {
  await mockCommerce(page, "en");
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  const account = { id: 41, name: "Account Guest", email: "test@example.com" };
  await page.route("**/api/customer-auth/email/register", (route) =>
    route.fulfill({ json: { verification_required: true } }),
  );
  await page.route("**/api/customer-auth/email/verify", (route) =>
    route.fulfill({ json: { account } }),
  );
  await page.route("**/api/customer-auth/me", (route) =>
    route.fulfill({ json: { account } }),
  );
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  const contactName = page
    .locator('#checkout-details input[type="text"]')
    .first();
  await contactName.fill("Entered Guest");
  await page
    .locator("[data-checkout-sign-in] button")
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Use my password instead" }).click();
  await dialog.getByRole("button", { name: "Create an account", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Account Guest");
  await dialog.getByLabel("Email", { exact: true }).fill("test@example.com");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("synthetic-test-password");
  await dialog
    .getByRole("button", { name: "Send verification code", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("6-digit code");
  await dialog.getByLabel("Verification code", { exact: true }).fill("123456");
  await dialog
    .getByRole("button", { name: "Verify and continue", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(contactName).toHaveValue("Entered Guest");
  await expect(
    page.getByRole("button", { name: "Create an account", exact: true }),
  ).toHaveCount(0);
});

test("checkout summary exposes unavailable-item recovery next to its disabled action", async ({
  page,
}) => {
  await mockCommerce(page, "en", { stock: 1 });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  const summary = page.locator(".commerce-checkout-summary");
  await expect(summary.locator("details")).toHaveAttribute("open", "");
  await expect(
    summary.locator(".commerce-confirm-action button"),
  ).toBeDisabled();
  await summary.locator(".commerce-item button").click();
  await expect(summary.locator(".commerce-totals")).toContainText("12.00");
  await expect(
    summary.locator(".commerce-confirm-action button"),
  ).toBeEnabled();
});

for (const scenario of [{ locale: 'fr', width: 390 }, { locale: 'fr', width: 1280 }, { locale: 'he', width: 390 }]) {
  test(`delivery address autocomplete cart carries selected city to checkout · ${scenario.locale} · ${scenario.width}`, async ({ page }, testInfo) => {
    await mockCommerce(page, scenario.locale, { autocomplete: true, currency: 'ILS' });
    await page.setViewportSize({ width: scenario.width, height: 844 });
    const suggestions = ['Tel-Aviv', 'Netanya'].map((city, index) => ({ id: `synthetic-${index}`, address: 'Dizengoff 52', street: 'Dizengoff', house_number: '52', city, lat: 32.07 + index / 4, lng: 34.77, token: `synthetic-proof-${index}` }));
    await page.route('**/api/v1/public/address-autocomplete?**', route => route.fulfill({ json: { suggestions } }));
    let checkedCity: string | null = null;
    await page.route('**/api/v1/public/delivery/check?**', route => {
      checkedCity = new URL(route.request().url()).searchParams.get('city');
      return route.fulfill({ json: { resolved: true, deliverable: true, delivery_fee: 50, min_order: 20 } });
    });
    await page.goto('/order/cart?restaurantId=9001&orderType=delivery');
    await page.locator('.commerce-fulfillment-row:visible').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').fill('Dizengoff 52');
    await expect(dialog.getByRole('option')).toHaveCount(2);
    await dialog.screenshot({ path: testInfo.outputPath('delivery-city-suggestions.png') });
    await dialog.getByRole('option').filter({ hasText: 'Netanya' }).click();
    await expect(dialog.getByRole('combobox')).toHaveValue('Dizengoff 52, Netanya');
    await dialog.locator('.website-view-menu').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.commerce-fulfillment-row:visible').first()).toContainText('Dizengoff 52, Netanya');
    await page.locator('.commerce-cart-overlay:visible button.commerce-primary').click();
    await expect(page).toHaveURL(/\/order\/checkout\?/);
    await expect(page.locator('.commerce-fulfillment-row').first()).toContainText('Dizengoff 52, Netanya');
    await expect(page.getByRole('combobox', { name: scenario.locale === 'fr' ? 'Adresse de livraison' : 'כתובת למשלוח', exact: true })).toHaveCount(0);
    await expect.poll(() => checkedCity).toBe('Netanya');
    await expect(page.locator('.commerce-summary')).toContainText('₪50.00');
    await page.locator('form input[type="text"]').first().fill('Demo Guest');
    await page.locator('input[type="tel"]').fill('501234567');
    let orderBody: Record<string, unknown> | undefined;
    await page.route('**/api/customer-api/orders?**', route => {
      orderBody = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { error: 'synthetic-test-stop' } });
    });
    await page.screenshot({ path: testInfo.outputPath('selected-address-checkout.png'), fullPage: true });
    await page.locator('.commerce-confirm-action button').click();
    await expect.poll(() => orderBody).toMatchObject({ delivery_address: 'Dizengoff 52', delivery_city: 'Netanya', delivery_address_token: suggestions[1].token });
  });
}

for (const withCoordinates of [true, false]) {
test(`delivery address autocomplete resolves only the selected Google prediction · coordinates ${withCoordinates}`, async ({ page }) => {
  await mockCommerce(page, 'fr', { autocomplete: true, currency: 'ILS' });
  await page.setViewportSize({ width: 390, height: 844 });
  const sessions: string[] = [];
  let resolutions = 0;
  await page.route('**/api/v1/public/address-autocomplete?**', route => {
    const body = route.request().postDataJSON();
    expect(body.session_id).toMatch(/^[0-9a-f-]{36}$/);
    sessions.push(body.session_id);
    return route.fulfill({ json: { suggestions: [{ kind: 'prediction', id: 'google-hagefen', address: 'HaGefen 4', city: 'Netanya, Israel', lookup_token: 'synthetic-prediction-proof', token: '' }] } });
  });
  await page.route('**/api/v1/public/address-autocomplete/resolve?**', route => {
    resolutions++;
    expect(route.request().postDataJSON()).toEqual({ lookup_token: 'synthetic-prediction-proof' });
    return route.fulfill({ json: { suggestion: { id: 'google-hagefen', address: 'HaGefen 4', city: 'Netanya', street: 'HaGefen', house_number: '4', ...(withCoordinates ? { lat: 32.33, lng: 34.85 } : {}), token: 'synthetic-complete-proof' } } });
  });
  await page.goto('/order/checkout?restaurantId=9001&orderType=delivery');
  await page.locator('.commerce-fulfillment-row').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill('HaGefen');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await dialog.getByRole('combobox').fill('HaGefen 4 Netanya');
  await expect.poll(() => sessions.length).toBe(2);
  expect(new Set(sessions).size).toBe(1);
  expect(resolutions).toBe(0);
  await expect(dialog.getByRole('link', { name: 'Google Maps', exact: true })).toBeVisible();
  await dialog.getByRole('option').click();
  await expect(dialog.getByRole('combobox')).toHaveValue('HaGefen 4, Netanya');
  expect(resolutions).toBe(1);
  await dialog.locator('.website-view-menu').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.commerce-fulfillment-row').first()).toContainText('HaGefen 4, Netanya');
});

}

for (const locale of ['fr', 'he']) {
  for (const exhaustedAt of ['search', 'selection']) {
    test(`delivery address autocomplete quota stops Google and asks to contact restaurant · ${locale} · ${exhaustedAt}`, async ({ page }, testInfo) => {
      await mockCommerce(page, locale, { autocomplete: true, currency: 'ILS' });
      await page.setViewportSize({ width: 390, height: 844 });
      let searches = 0;
      let resolutions = 0;
      await page.route('**/api/v1/public/address-autocomplete?**', route => {
        searches++;
        if (exhaustedAt === 'search') return route.fulfill({ status: 503, json: { error: 'address_quota_exhausted' } });
        return route.fulfill({ json: { suggestions: [{ kind: 'prediction', id: 'google-hagefen', address: 'HaGefen 4', city: 'Netanya, Israel', lookup_token: 'synthetic-proof', token: '' }] } });
      });
      await page.route('**/api/v1/public/address-autocomplete/resolve?**', route => {
        resolutions++;
        return route.fulfill({ status: 503, json: { error: 'address_quota_exhausted' } });
      });
      await page.goto('/order/checkout?restaurantId=9001&orderType=delivery');
      await page.locator('.commerce-fulfillment-row').first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox').fill('HaGefen 4 Netanya');
      if (exhaustedAt === 'selection') await dialog.getByRole('option').click();
      await expect(dialog.getByRole('status').filter({ hasText: 'ADR-QUOTA' })).toBeVisible();
      await expect(dialog.getByRole('status').filter({ hasText: 'ADR-QUOTA' })).toContainText(locale === 'fr' ? 'Contactez le restaurant' : 'פנו למסעדה');
      await expect(dialog.getByRole('status')).toHaveCount(1);
      await dialog.getByRole('combobox').fill('HaGefen 5 Netanya');
      await page.waitForTimeout(650);
      expect(searches).toBe(1);
      expect(resolutions).toBe(exhaustedAt === 'selection' ? 1 : 0);
      await expect(dialog.locator('.website-view-menu')).toBeDisabled();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('status').filter({ hasText: 'ADR-QUOTA' })).toBeVisible();
      await dialog.screenshot({ path: testInfo.outputPath('google-address-quota.png') });
    });
  }
}

test('delivery address autocomplete refines a partial street before validating the building', async ({ page }) => {
  await mockCommerce(page, 'fr', { autocomplete: true });
  const street = { kind: 'street', id: 'synthetic-street', address: 'Mahane Yosef', street: 'Mahane Yosef', city: 'Tel-Aviv', house_number: '', lat: 0, lng: 0, token: '' };
  const building = { ...street, kind: undefined, id: 'synthetic-building', address: 'Mahane Yosef 26', house_number: '26', lat: 32.06, lng: 34.77, token: 'synthetic-building-proof' };
  await page.route('**/api/v1/public/address-autocomplete?**', route => {
    const query = route.request().postDataJSON().text as string;
    return route.fulfill({ json: { suggestions: [query.includes('26') ? building : street] } });
  });
  const checks: string[] = [];
  await page.route('**/api/v1/public/delivery/check?**', route => {
    const city = new URL(route.request().url()).searchParams.get('city');
    if (city) checks.push(city);
    return route.fulfill({ json: { resolved: true, deliverable: city === 'Tel-Aviv', delivery_fee: 50 } });
  });
  await page.goto('/order/checkout?restaurantId=9001&orderType=delivery');
  await page.locator('.commerce-fulfillment-row').first().click();
  const dialog = page.getByRole('dialog');
  const address = dialog.getByRole('combobox');
  await address.fill('Mahane Yos');
  await expect(dialog.getByRole('option')).toContainText('Ajoutez le numéro de rue');
  await dialog.getByRole('option').click();
  await expect(address).toHaveValue('Mahane Yosef , Tel-Aviv');
  await expect(address).not.toHaveJSProperty('validationMessage', '');
  await expect(dialog.locator('.website-view-menu')).toBeDisabled();
  await expect(dialog).toBeVisible();
  expect(checks).toHaveLength(0);
  await address.focus();
  await address.press('2');
  await address.press('6');
  await expect(address).toHaveValue('Mahane Yosef 26, Tel-Aviv');
  await dialog.getByRole('option').click();
  await expect(address).toHaveValue('Mahane Yosef 26, Tel-Aviv');
  await dialog.locator('.website-view-menu').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.commerce-fulfillment-row').first()).toContainText('Mahane Yosef 26, Tel-Aviv');
  expect(checks).toContain('Tel-Aviv');
});


async function mockPreparationCart(page: Page, locale = "en", clock: "elapsed" | "opening_hours" | "custom_start" = "opening_hours") {
  await mockCommerce(page, locale, { strictCalendar: "slots", preparationClock: clock });
  const heart = { ...item, name: "Heart", preparationLeadTimeMinutes: 0 };
  const tart = { ...item, id: "2", name: "Lemon tart", preparationLeadTimeMinutes: null };
  await page.addInitScript(({ heart, tart }) => {
    localStorage.setItem("foody-cart", JSON.stringify({ version: 1, state: { restaurantId: "9001", currency: "EUR", lines: [
      // Deliberately stale preparation metadata must not override the fresh catalog.
      { id: "heart", item: { ...heart, preparationLeadTimeMinutes: 180 }, quantity: 1 },
      { id: "tart", item: tart, quantity: 1 },
    ] } }));
  }, { heart, tart });
  await page.route("**/api/v1/public/menu?**", route => route.fulfill({ json: { currency: "EUR", menus: [{ id: 1, groups: [{ id: 1, name: "Cakes", items: [
    { ...heart, id: 1, group_id: 1, preparation_lead_time_minutes: 0 },
    { ...tart, id: 2, group_id: 1, preparation_lead_time_minutes: null },
  ] }] }] } }));
  const date = "2026-10-14";
  const morning = { start: "09:00", end: "09:30" };
  const noon = { start: "12:00", end: "12:30" };
  const response = (hasTart: boolean) => ({ enabled: true, immediate_available: false, lead_time_minutes: hasTart ? 180 : 0,
    constrained_by: hasTart ? { menu_item_id: 2, name: "Lemon tart", lead_time_minutes: 180 } : undefined,
    slot_duration_minutes: 30, require_prepayment: false,
    slots_by_date: { [date]: hasTart ? [noon] : [morning, noon] },
  });
  await page.route("**/scheduling-config?**", route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("from")).toBe("");
    expect(params.get("to")).toBe("");
    return route.fulfill({ json: response((params.get("items") ?? "").includes("2:")) });
  });
  return { date, response };
}

for (const scenario of [{ locale: "en", width: 1280 }, { locale: "fr", width: 390 }, { locale: "he", width: 320 }]) {
  test(`preparation cart removal offers earlier pickup and carries it to checkout · ${scenario.locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    const { date } = await mockPreparationCart(page, scenario.locale);
    await page.goto(`/order/cart?restaurantId=9001&orderType=pickup&isScheduled=true&scheduledFor=${date}&scheduledPickupWindowStart=09:00&scheduledPickupWindowEnd=09:30`);
    const summary = page.locator('[data-preparation-availability]:visible');
    await expect(summary).toContainText("12:00 – 12:30");
    await expect(summary).toContainText("Lemon tart");
    await expect(page.locator('.commerce-item').filter({ hasText: 'Heart' }).locator('[data-item-preparation]')).toHaveText(scenario.locale === 'fr' ? 'Sans délai de préparation' : scenario.locale === 'he' ? 'ללא זמן הכנה' : 'No preparation time');
    await expect(page.locator('.commerce-item').filter({ hasText: 'Lemon tart' }).locator('[data-item-preparation]')).toContainText('3');
    await page.locator('.commerce-item').filter({ hasText: 'Lemon tart' }).locator('.commerce-remove').click();
    await expect(summary).toContainText("09:00 – 09:30");
    // 12:00 is still a valid customer choice, but is no longer advertised as first.
    await expect(page.locator('.commerce-fulfillment:visible .commerce-fulfillment-row').last()).toContainText('12:00 – 12:30');
    await expect(summary).not.toContainText('Lemon tart');
    await summary.locator('button').click();
    await expect(page.locator('.commerce-fulfillment:visible .commerce-fulfillment-row').last()).toContainText('09:00 – 09:30');
    await page.screenshot({ path: testInfo.outputPath('ready-heart-earlier-pickup.png') });
    await page.locator('.commerce-cart-action button').click();
    await expect(page).toHaveURL(/scheduledPickupWindowStart=09%3A00/);
    await expect(page.locator('[data-preparation-availability]:visible')).toContainText('09:00 – 09:30');
    await expect(page.locator('.commerce-fulfillment:visible .commerce-fulfillment-row').last()).toContainText('09:00 – 09:30');
  });
}

test('preparation cart waits for the current contents and ignores a retired response', async ({ page }) => {
  const { date, response } = await mockPreparationCart(page);
  let releaseSlow!: () => void;
  const slow = new Promise<void>(resolve => { releaseSlow = resolve; });
  let delayed = false;
  await page.route('**/scheduling-config?**', async route => {
    const items = new URL(route.request().url()).searchParams.get('items') ?? '';
    if (items.includes('1:2')) { delayed = true; await slow; }
    return route.fulfill({ json: response(items.includes('2:')) });
  });
  await page.goto(`/order/cart?restaurantId=9001&orderType=pickup&isScheduled=true&scheduledFor=${date}&scheduledPickupWindowStart=12:00&scheduledPickupWindowEnd=12:30`);
  await expect(page.locator('.commerce-cart-action button')).toBeEnabled();
  const heart = page.locator('.commerce-item').filter({ hasText: 'Heart' });
  await heart.locator('button').filter({ hasText: '+' }).click();
  await expect.poll(() => delayed).toBe(true);
  await expect(page.locator('.commerce-cart-action button')).toBeDisabled();
  await heart.locator('.commerce-remove').click();
  await expect(page.locator('.commerce-cart-action button')).toBeEnabled();
  releaseSlow();
  await expect(page.locator('[data-preparation-availability]:visible')).toContainText('Lemon tart');
  await expect(page.locator('[data-preparation-availability]:visible')).toContainText('12:00 – 12:30');
});

for (const screen of ['cart', 'checkout'] as const) test(`preparation cart and checkout block empty calendars and failed retries · ${screen}`, async ({ page }) => {
  const { date, response } = await mockPreparationCart(page);
  let state: 'empty' | 'error' | 'ok' = 'empty';
  await page.route('**/scheduling-config?**', route => state === 'error' ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: state === 'empty' ? { ...response(true), slots_by_date: {} } : response(true) }));
  await page.goto(`/order/${screen}?restaurantId=9001&orderType=pickup&isScheduled=true&scheduledFor=${date}&scheduledPickupWindowStart=12:00&scheduledPickupWindowEnd=12:30`);
  const summary = page.locator('[data-preparation-availability]:visible');
  await expect(summary).toContainText('No compatible slot');
  await expect(page.locator('body')).not.toContainText('Try ordering for now');
  await expect(page.locator('.commerce-cart-action:visible button')).toBeDisabled();
  state = 'error';
  // Refocus revalidates even if no cart line changed.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(summary).toContainText('Availability could not be checked');
  await expect(page.locator('.commerce-cart-action:visible button')).toBeDisabled();
  state = 'ok';
  await summary.getByRole('button', { name: 'Retry' }).click();
  await expect(summary).toContainText('12:00 – 12:30');
  await expect(page.locator('.commerce-cart-action:visible button')).toBeEnabled();
});


for (const clock of ["elapsed", "custom_start"] as const) {
  test(`preparation cart explains the configured ${clock} clock and retains a voluntary later slot`, async ({ page }) => {
    const { date, response } = await mockPreparationCart(page, 'en', clock);
    await page.route('**/scheduling-config?**', route => route.fulfill({ json: { ...response(true), slots_by_date: { [date]: [{ start: '12:00', end: '12:30' }, { start: '17:00', end: '17:30' }] } } }));
    await page.goto(`/order/cart?restaurantId=9001&orderType=pickup&isScheduled=true&scheduledFor=${date}&scheduledPickupWindowStart=17:00&scheduledPickupWindowEnd=17:30`);
    const summary = page.locator('[data-preparation-availability]:visible');
    await expect(summary).toContainText('12:00 – 12:30');
    await expect(summary).toContainText(clock === 'elapsed' ? 'continuously' : '07:00');
    await expect(page.locator('.commerce-fulfillment:visible .commerce-fulfillment-row').last()).toContainText('17:00 – 17:30');
    await expect(page.locator('.commerce-cart-action button')).toBeEnabled();
  });
}

for (const width of [390, 1280]) {
  test(`customer note follows selected modifiers and options · ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCommerce(page, 'fr');
    const config = { enabled: true, label: 'Message sur le gâteau', placeholder: 'Indiquez le prénom ou le message', required: true };
    await page.route('**/api/v1/public/menu?**', route => route.fulfill({ json: {
      currency: 'EUR', menus: [{ id: 1, name: 'Menu', groups: [{ id: 1, name: 'Gâteaux', items: [{
        id: 1, name: 'Demo sandwich', price: 12, is_active: true, allow_notes: false,
        modifier_sets: [{ id: 2, name: 'Finition', allow_multiple: true, modifiers: [
          { id: 3, name: 'Personnalisation', price_delta: 3, is_active: true, action: 'add', customer_note: config },
          { id: 4, name: 'Bougies', price_delta: 1, is_active: true, action: 'add' },
        ] }],
        option_sets: [{ id: 5, name: 'Format', options: [
          { id: 6, name: 'Classique', price: 12, is_active: true },
          { id: 7, name: 'Avec plaque', price: 15, is_active: true, customer_note: { ...config, label: 'Texte de la plaque', required: false } },
        ] }],
      }] }] }],
    } }));
    await page.goto('/order/cart?restaurantId=9001&orderType=pickup');
    await page.getByRole('button', { name: /Demo sandwich/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Demo sandwich' });
    const action = dialog.locator('[data-item-part="add"]');
    await expect(dialog.locator('textarea')).toHaveCount(0);
    await dialog.locator('label[data-item-part="option"]').filter({ hasText: 'Bougies' }).click();
    await expect(dialog.locator('textarea')).toHaveCount(0);
    const personalization = dialog.locator('label[data-item-part="option"]').filter({ hasText: 'Personnalisation' });
    await personalization.click();
    // The focused first row must follow the list's rounded clipping edge.
    // Its note is a separate block, so the row's lower edge stays square.
    await expect(personalization).toHaveCSS('outline-style', 'solid');
    await expect(personalization).toHaveCSS('border-top-left-radius', '8px');
    await expect(personalization).toHaveCSS('border-top-right-radius', '8px');
    await expect(personalization).toHaveCSS('border-bottom-left-radius', '0px');
    await personalization.screenshot({ path: testInfo.outputPath(`customer-note-focus-${width}.png`) });
    const note = dialog.getByLabel(/Message sur le gâteau/);
    await expect(note).toHaveAttribute('placeholder', config.placeholder);
    await expect(note).toHaveAttribute('required', '');
    await expect(action).toBeDisabled();
    await note.fill('Joyeux anniversaire Léa שלום');
    await expect(action).toBeEnabled();
    const plaque = dialog.locator('label[data-item-part="option"]').filter({ hasText: 'Avec plaque' });
    // A final row without a note owns the list's lower corners. Revealing its
    // note moves those corners to the block below, without rounding the join.
    await expect(plaque).toHaveCSS('border-bottom-right-radius', '8px');
    await plaque.click();
    await expect(plaque).toHaveCSS('border-bottom-right-radius', '0px');
    await dialog.getByLabel('Texte de la plaque').fill('10 ans');
    await dialog.screenshot({ path: testInfo.outputPath(`customer-note-${width}.png`) });
    await action.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.commerce-items')).toContainText('Joyeux anniversaire Léa שלום');
    await expect(page.locator('.commerce-items')).toContainText('10 ans');
    await expect(page.locator('.commerce-items').getByText('Personnalisation', { exact: true })).toHaveCount(0);
    await expect(page.locator('.commerce-items').getByText('Personnalisation: Joyeux anniversaire Léa שלום', { exact: true })).toHaveCount(1);
    await expect(page.locator('.commerce-items').getByText('Avec plaque', { exact: true })).toHaveCount(0);
    await expect(page.locator('.commerce-items').getByText('Avec plaque: 10 ans', { exact: true })).toHaveCount(1);
    await expect(page.locator('.commerce-items').getByText('Bougies', { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: /Demo sandwich/ }).first().click();
    await expect(note).toHaveValue('Joyeux anniversaire Léa שלום');
    await expect(dialog.getByLabel('Texte de la plaque')).toHaveValue('10 ans');
    await personalization.click();
    await expect(note).toHaveCount(0);
    await dialog.locator('label[data-item-part="option"]').filter({ hasText: 'Classique' }).click();
    await expect(dialog.locator('textarea')).toHaveCount(0);
    await action.click();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('foody-cart')!).state.lines[0]);
    expect(cart.modifiers.map((modifier: { id: string }) => modifier.id)).toEqual(['4']);
    expect(cart.selectedVariantId).toBe(6);
    expect(cart.selectedVariantNote).toBeUndefined();
    expect(cart.modifiers[0].note).toBeUndefined();
  });
}
