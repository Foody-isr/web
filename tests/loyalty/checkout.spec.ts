import { test, expect, type Page } from "@playwright/test";
const production = process.env.FOODY_LOYALTY_PRODUCTION_PREVIEW === "1";
const cookieName = production
  ? "__Host-foody_customer"
  : "foody_customer_session";
const cookieURL = `${production ? "https" : "http"}://localhost:3131`;
const fixture = "http://127.0.0.1:18083";
const checkoutOff = process.env.FOODY_LOYALTY_CHECKOUT_PREVIEW_ENABLED === "0";
const pay = (page: Page) => page.locator(".commerce-confirm-action button");
const choice = (page: Page) =>
  page
    .locator("[data-loyalty-checkout]")
    .getByRole("radio", { name: /Jusqu’à.*15/ });
const state = async (page: Page) =>
  (await page.request.get(`${fixture}/__state`)).json();
test.beforeEach(async ({ page, context, request }) => {
  await request.post(`${fixture}/__control`, {
    data: { reset: true, member: { balance: 0 }, rewards: "mixed" },
  });
  await context.addCookies([
    {
      name: cookieName,
      value: "synthetic-loyalty-a",
      url: cookieURL,
      secure: production,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("foody-locale", "fr");
    localStorage.setItem(
      "foody-cart",
      JSON.stringify({
        version: 1,
        state: {
          restaurantId: "9001",
          currency: "ILS",
          lines: [
            {
              id: "synthetic-checkout-line",
              quantity: 2,
              item: {
                id: "19",
                name: "Demo sandwich",
                price: 12,
                groupId: "1",
                available: true,
              },
            },
          ],
        },
      }),
    );
  });
  await page.route("**/*", (route) =>
    /^(localhost|127\.0\.0\.1)$/.test(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.route("**/order/confirmation/*?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<main>Synthetic owned confirmation</main>",
    }),
  );
});
test("customer checkout remains independently disabled", async ({ page }) => {
  test.skip(!checkoutOff);
  await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
  await expect(page.locator("[data-loyalty-checkout]")).toHaveCount(0);
  expect(
    (
      await page.request.post(
        "/api/customer-api/loyalty/checkouts?restaurant_id=9001",
        { headers: { "X-Foody-Loyalty-Account": "71001" }, data: {} },
      )
    ).status(),
  ).toBe(404);
  expect((await state(page)).creationRequests).toHaveLength(0);
});
test.describe("customer reward order pilot", () => {
  test.skip(checkoutOff);
  test("explicit selection updates the preview and creates only one reduced order", async ({
    page,
  }) => {
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await expect(choice(page)).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Sans récompense", exact: true }),
    ).toBeChecked();
    await choice(page).check();
    await expect(page.locator(".commerce-totals")).toContainText(/15[,.]00/);
    await expect(pay(page)).toContainText(/9[,.]00/);
    await page.screenshot({
      path: "../previews/customer-loyalty-checkout.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Français/ }).click();
    await page.getByRole("button", { name: /עברית/ }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "../previews/customer-loyalty-checkout-hebrew.png",
      fullPage: true,
    });
    await pay(page).click();
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    const s = await state(page);
    expect(s.creationRequests).toHaveLength(1);
    expect(s.creationRequests[0].selection).toMatchObject({
      expected_reduction_minor: 1500,
      expected_total_minor: 900,
    });
    expect(s.bankInitializations).toBe(1);
  });
  test("lost success is recovered after reload with no second order or bank initialization", async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__control`, {
      data: { checkoutLoss: true },
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await choice(page).check();
    await pay(page).click();
    const check = page.getByRole("button", {
      name: "Vérifier la commande",
      exact: true,
    });
    await expect(check).toBeVisible();
    const journal = await page.evaluate(() =>
      sessionStorage.getItem("foody.loyalty-checkout.v1:9001:71001"),
    );
    expect(journal).not.toMatch(/Demo Buyer|972502345678|demo@example/);
    await page.reload();
    await expect(check).toBeVisible();
    expect((await state(page)).creationRequests).toHaveLength(1);
    await check.click();
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    expect((await state(page)).bankInitializations).toBe(1);
    expect((await state(page)).creationRequests).toHaveLength(1);
  });
  test("explicit abandonment blocks a delayed original request before a new choice", async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__control`, {
      data: { checkoutFailure: true },
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await choice(page).check();
    await pay(page).click();
    await page
      .getByRole("button", { name: "Abandonner cette demande", exact: true })
      .click();
    await expect(
      page.getByRole("radio", { name: "Sans récompense", exact: true }),
    ).toBeChecked();
    const original = (await state(page)).creationRequests[0];
    const late = await page.request.post(
      "/api/customer-api/loyalty/checkouts?restaurant_id=9001",
      {
        headers: { "X-Foody-Loyalty-Account": "71001" },
        data: {
          order_type: "pickup",
          payment_method: "pay_now",
          customer_name: "Demo Buyer",
          customer_phone: "+972502345678",
          items: original.items,
          loyalty_reward: original.selection,
        },
      },
    );
    expect(late.status()).toBe(410);
    await choice(page).check();
    await pay(page).click();
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    const s = await state(page);
    expect(s.bankInitializations).toBe(1);
    expect(Object.values(s.checkouts).filter((r: any) => r.order)).toHaveLength(
      1,
    );
  });
  test("a fully covered order confirms without any bank initialization", async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__control`, {
      data: {
        program: { rules: { reward_amount_minor: 2400 } },
        rewards: "many",
      },
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await page
      .getByRole("radio", { name: /Jusqu’à.*24/ })
      .first()
      .check();
    await expect(pay(page)).toContainText("Confirmer la commande");
    await expect(pay(page)).toContainText(/0[,.]00/);
    await pay(page).click();
    await expect(page).toHaveURL(/order\/confirmation\/99/);
    const s = await state(page);
    expect(s.bankInitializations).toBe(0);
    expect(s.creationRequests).toHaveLength(1);
  });
  test("confirmation resumes only the recorded owned page and previews never read loyalty", async ({
    page,
    request,
    context,
  }) => {
    await page.unroute("**/order/confirmation/*?**");
    await request.post(`${fixture}/__control`, {
      data: { checkoutLoss: true },
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await choice(page).check();
    await pay(page).click();
    await page
      .getByRole("button", { name: "Vérifier la commande", exact: true })
      .click();
    await expect(page).toHaveURL(/loyaltyRequestId=/);
    const resume = page.getByRole("button", {
      name: "Continuer sur la page de paiement",
      exact: true,
    });
    await expect(resume).toBeVisible();
    expect((await state(page)).unexpectedPaymentInits).toBe(0);
    expect((await state(page)).bankInitializations).toBe(1);
    const url = page.url();
    await request.post(`${fixture}/__control`, {
      data: { clearCheckoutReads: true },
    });
    await page.goto(url + "&preview=1");
    await expect(page.locator("[data-loyalty-payment-resume]")).toHaveCount(0);
    expect((await state(page)).checkoutReads).toBe(0);
    await page.goto(url);
    await expect(resume).toBeVisible();
    await context.addCookies([
      {
        name: cookieName,
        value: "synthetic-loyalty-b",
        url: cookieURL,
        secure: production,
        httpOnly: true,
      },
    ]);
    await resume.click();
    await expect(
      page.locator("[data-loyalty-payment-resume]").getByRole("alert"),
    ).toContainText("n’ont pas pu être vérifiées");
    expect(page.url()).toContain("/order/confirmation/99");
    expect((await state(page)).bankInitializations).toBe(1);
    expect((await state(page)).unexpectedPaymentInits).toBe(0);
  });
  test("storage failure prevents creation and the optional profile guard rejects a cookie switch", async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k.startsWith("foody.loyalty-checkout"))
          throw new Error("synthetic storage failure");
        original.call(this, k, v);
      };
    });
    await page.goto("/order/checkout?restaurantId=9001&orderType=pickup");
    await choice(page).check();
    await pay(page).click();
    await expect(
      page.locator("[data-loyalty-checkout]").getByRole("alert"),
    ).toContainText("ne peut pas être conservée");
    expect((await state(page)).creationRequests).toHaveLength(0);
    await context.addCookies([
      {
        name: cookieName,
        value: "synthetic-loyalty-b",
        url: cookieURL,
        secure: production,
        httpOnly: true,
      },
    ]);
    const response = await page.request.put(
      "/api/customer-api/me/checkout-profile?restaurant_id=9001",
      {
        headers: { "X-Foody-Loyalty-Account": "71001" },
        data: { name: "Synthetic old tab", phone: "+972502345678" },
      },
    );
    expect(response.status()).toBe(409);
    expect((await state(page)).profileWrites).toBe(0);
  });
});
