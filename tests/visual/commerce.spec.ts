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
  options: {
    otp?: boolean;
    stock?: number;
    dark?: boolean;
    pageStyle?: string;
  } = {},
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
