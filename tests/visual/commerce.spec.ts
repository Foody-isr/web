import { test, expect, type Page } from "@playwright/test";

const item = {
  id: "1",
  name: "Demo sandwich",
  price: 12,
  groupId: "1",
  available: true,
};

async function mockCommerce(
  page: Page,
  locale: string,
  options: { otp?: boolean; stock?: number; dark?: boolean } = {},
) {
  await page.addInitScript(
    ({ item, locale }) => {
      localStorage.setItem("foody-locale", locale);
      localStorage.setItem(
        "foody-cart",
        JSON.stringify({
          version: 1,
          state: {
            restaurantId: "9001",
            currency: "EUR",
            lines: [{ id: "demo-line", item, quantity: 2 }],
          },
        }),
      );
    },
    { item, locale },
  );
  await page.route("**/api/customer-auth/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/customer-api/**", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/v1/public/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/website-pages"))
      return route.fulfill({ json: { pages: [] } });
    if (path.endsWith("/menu"))
      return route.fulfill({
        json: {
          currency: "EUR",
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
    if (path.endsWith("/restaurants/9001"))
      return route.fulfill({
        json: {
          restaurant: {
            id: 9001,
            name: "Foody Demo",
            slug: "foody-demo",
            address: "12 Demo Street",
            currency: "EUR",
            vat_rate: 18,
            pickup_enabled: true,
            delivery_enabled: true,
            require_pickup_prepayment: true,
            otp_mode: "required",
            website_config: {
              theme_id:
                locale === "fr"
                  ? "custom"
                  : options.dark
                    ? "editorial-dark"
                    : "minimal-light",
              ...(locale === "fr"
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
    await page.locator('.commerce-columns form button[type="submit"]').click();
    await expect(page.locator(".commerce-contact")).toContainText("Demo Guest");
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
    await page.locator(".commerce-contact button").click();
    await expect(page.locator('form input[type="text"]').first()).toHaveValue(
      "Demo Guest",
    );
  });
}

test("required phone verification remains between details and confirmation", async ({
  page,
}) => {
  await mockCommerce(page, "en", { otp: true });
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await page.locator('form input[type="text"]').first().fill("Demo Guest");
  await page.locator('form input[type="tel"]').fill("0500000000");
  await page.locator('.commerce-columns form button[type="submit"]').click();
  await expect(page.locator('input[maxlength="6"]')).toBeVisible();
  await expect(page.locator(".commerce-confirm-action")).toHaveCount(0);
  await page.locator('input[maxlength="6"]').fill("123456");
  await page.locator('.commerce-columns form button[type="submit"]').click();
  await expect(page.locator(".commerce-contact")).toContainText("Demo Guest");
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
