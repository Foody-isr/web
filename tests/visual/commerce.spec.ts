import { test, expect, type Page } from "@playwright/test";
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
    await expect(panel.locator('input[value="8"]')).toBeDisabled();
    await expect(panel.locator('input[type="checkbox"]')).not.toBeChecked();
    await expect(panel.locator('fieldset')).toHaveCSS("border-radius", "16px");
    await expect(panel.locator('label:has(input[value="new"])')).toHaveCSS("border-radius", "10px");
    await expect(panel.locator('label:has(input[type="checkbox"])')).toHaveCSS("border-radius", "10px");
    await panel.locator('input[type="checkbox"]').check();
    await expect(panel.getByRole("note")).toContainText("Verifone");
    await expect(panel.getByRole("note")).toContainText(/1[.,]00/);
    await expect(panel.locator('[data-card-field]')).toHaveCount(0);
    await panel.screenshot({ path: testInfo.outputPath("payment-new-card.png") });
    await saved.check();
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(0);
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
    await expect(panel.locator('input[type="checkbox"]')).not.toBeChecked();
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
    strictCalendar?: "slots" | "batch";
    pickupEnabled?: boolean;
    lockOrderType?: boolean;
  } = {},
) {
  await page.addInitScript(
    ({ item, locale, currency }) => {
      localStorage.setItem("foody-locale", locale);
      localStorage.setItem(
        "foody-cart",
        JSON.stringify({
          version: 1,
          state: {
            restaurantId: "9001",
            currency,
            lines: [{ id: "demo-line", item, quantity: 2 }],
          },
        }),
      );
    },
    { item: options.strictCalendar ? { ...item, immediateSaleMode: "standalone" } : item, locale, currency: options.currency ?? "EUR" },
  );
  await page.route("**/api/customer-auth/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/customer-api/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/v1/public/**", async (route) => {
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
      return route.fulfill({ json: { available: !!options.autocomplete, enabled: !!options.autocomplete, provider: 'geoapify' } });
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
                      id: 1,
                      group_id: 1,
                      buildable_count: options.stock,
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    if (path.endsWith("/restaurants/9001") || path.endsWith("/restaurants/demo-restaurant"))
      return route.fulfill({
        json: {
          restaurant: {
            id: 9001,
            name: "Foody Demo",
            slug: "foody-demo",
            address: "12 Demo Street",
            currency: options.currency ?? "EUR",
            vat_rate: 18,
            preorders_only: !!options.strictCalendar,
            scheduling_enabled: options.scheduling || options.strictCalendar === "slots",
            batch_fulfillment_enabled: options.strictCalendar === "batch",
            scheduling_max_days_ahead: 7,
            pickup_enabled: options.pickupEnabled ?? true,
            delivery_enabled: true,
            require_pickup_prepayment: true,
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
                    { id: 'customer_name', kind: 'builtin', enabled: true, required: true },
                    { id: 'customer_phone', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_city', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_address', kind: 'builtin', enabled: true, required: true },
                    { id: 'delivery_floor', kind: 'builtin', enabled: true, required: false },
                    { id: 'delivery_apt', kind: 'builtin', enabled: true, required: false },
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
  });
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
    await page.locator(".commerce-cart-action:visible button").click();
    await expect(page).toHaveURL(/\/order\/checkout/);
    await expect(location).toContainText("Mahane Yosef 26, Tel Aviv");
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
    if (calendar === "batch") await expect(page.getByText("Your order will be ready for pickup on", { exact: false })).toBeVisible();
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
    const address = page.getByRole('combobox', { name: locale === 'fr' ? 'Adresse de livraison' : 'כתובת למשלוח', exact: true });
    await expect(address).toBeVisible();
    await address.fill('Ibn Gabirol 69 Tel Aviv');
    await expect(page.getByRole('listbox').getByRole('option')).toContainText('Ibn Gabirol 69');
    await expect(address).toHaveJSProperty('validationMessage', locale === 'fr' ? 'Sélectionnez l’adresse complète dans les suggestions.' : 'יש לבחור את הכתובת המלאה מתוך ההצעות.');
    await address.press('ArrowDown');
    await address.press('Enter');
    await expect(address).toHaveCount(0);
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
    await dialog.locator('.website-view-menu').click();
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
    const registerLabel = {
      en: "Create an account",
      fr: "Créer un compte",
      he: "יצירת חשבון",
    }[scenario.locale]!;
    const register = page.getByRole("button", {
      name: registerLabel,
      exact: true,
    });
    await register.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute(
      "dir",
      scenario.locale === "he" ? "rtl" : "ltr",
    );
    await expect(dialog.locator('input[autocomplete="name"]')).toBeVisible();
    await expect(dialog.locator('input[type="password"]')).toHaveAttribute(
      "minlength",
      "15",
    );
    const expectedSurface = await contact.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--surface").trim(),
    );
    expect(
      await dialog.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--surface").trim(),
      ),
    ).toBe(expectedSurface);
    await expect(
      dialog.getByRole("button", { name: registerLabel, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
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
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
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
    await page.locator('.commerce-cart-action button').click();
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
  await dialog.locator('.website-view-menu').click();
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
