import { test, expect, type Page } from "@playwright/test";
import * as pgp from "openpgp";
import { cstPublicKey } from "../../lib/__tests__/fixtures/verifone-cst-key";

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
      enabled: true, identity_required: true, direct_card_enabled: false,
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
      expect(route.request().postDataJSON()).toEqual({ payment_method_token_id: 7, identity_card_number: "000000000" });
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
    await expect(panel.locator('[data-card-field]')).toHaveCount(0);
    await panel.screenshot({ path: testInfo.outputPath("payment-new-card.png") });
    await saved.check();
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(0);
    const identity = page.locator("#saved-card-identity");
    await expect(identity).toHaveAttribute("type", "password");
    const selectedCard = panel.locator('fieldset > div > div:has(input[value="7"])');
    await expect(selectedCard).toHaveCSS("border-radius", "10px");
    await expect(panel.locator('label:has(input[value="7"]) > span[aria-hidden="true"]')).toHaveCSS("border-radius", "4px");
    await expect(identity).toHaveCSS("border-radius", "6px");
    await expect(identity.locator('..')).toHaveCSS("border-radius", "6px");
    if (scenario.themeId === "garden-fresh") {
      // Verify the real palette/radius tokens are applied, not a neutral fixture.
      await expect(panel).toHaveCSS("--radius-xl", "32px");
      await expect(panel.locator('fieldset')).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(selectedCard).toHaveCSS("background-color", "rgb(234, 243, 229)");
      await expect(panel.locator('fieldset')).toHaveCSS("color", "rgb(31, 58, 32)");
    }
    await identity.fill("000000000");
    await page.locator('button[aria-controls="saved-card-identity"]').click();
    await expect(identity).toHaveAttribute("type", "text");
    await panel.locator('input[value="new"]').check();
    await expect(panel.locator('input[type="checkbox"]')).not.toBeChecked();
    await saved.check();
    await expect(identity).toHaveValue("");
    await expect(identity).toHaveAttribute("type", "password");
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
    await identity.fill("000000000");
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
    otp?: boolean;
    stock?: number;
    dark?: boolean;
    pageStyle?: string;
    currency?: string;
    themeId?: string;
    pairingId?: string;
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
    { item, locale, currency: options.currency ?? "EUR" },
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
            pickup_enabled: true,
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
      ".commerce-columns > div .commerce-order-details",
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

test("cart location and clock open their own editors without changing the cart", async ({
  page,
}) => {
  await mockCommerce(page, "en");
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup");
  const rows = page.locator(
    ".commerce-fulfillment:visible .commerce-fulfillment-row",
  );
  await rows.first().click();
  await expect(page.locator(".website-fulfillment-dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await rows.last().click();
  await expect(page.locator(".website-schedule-dialog[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".commerce-totals")).toContainText("24.00");
});

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

test("confirmation preview uses the shared themed receipt layout", async ({ page }, testInfo) => {
  await mockCommerce(page, "fr", { pageStyle: "style-5" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/order/confirmation/preview?restaurantId=9001&preview=1&pageSlug=commander");
  const surface = page.locator(".confirmation-surface");
  await expect(surface).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(surface).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(surface).toHaveCSS("font-family", /Inter/);
  await expect(surface.locator("h1")).toHaveCSS("font-family", /Dela Gothic One/);
  await expect(surface.locator(".confirmation-order")).toContainText("Demo sandwich");
  await expect(surface.locator(".commerce-totals")).toContainText("24");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("confirmation-dark-mobile.png"), fullPage: true });
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
