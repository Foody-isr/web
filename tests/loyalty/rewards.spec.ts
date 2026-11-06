import { test, expect } from "@playwright/test";
const production = process.env.FOODY_LOYALTY_PRODUCTION_PREVIEW === "1";
const cookieName = production
  ? "__Host-foody_customer"
  : "foody_customer_session";
const cookieURL = `${production ? "https" : "http"}://localhost:3131`;
const fixture = "http://127.0.0.1:18083";
const disabled = process.env.FOODY_LOYALTY_PREVIEW_ENABLED === "0";
test.beforeEach(async ({ request, page, context }) => {
  await request.post(`${fixture}/__control`, {
    data: { reset: true, member: { balance: 0 } },
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
  await page.addInitScript(() => localStorage.setItem("foody-locale", "fr"));
  await page.route("**/*", (route) =>
    /^(localhost|127\.0\.0\.1)$/.test(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});
test("default-off reward read is absent and never reaches backend", async ({
  page,
}) => {
  test.skip(!disabled);
  const response = await page.request.get(
    "/api/customer-api/me/loyalty-rewards?restaurant_id=9001",
    { headers: { "X-Foody-Loyalty-Account": "71001" } },
  );
  expect(response.status()).toBe(404);
  expect(
    (await (await page.request.get(`${fixture}/__state`)).json()).requests,
  ).toHaveLength(0);
});
test.describe("issued reward pilot", () => {
  test.skip(disabled);
  test("issued rights are separate from zero progress with correct statuses and scoped product labels", async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__control`, { data: { rewards: "mixed" } });
    await page.goto("/r/9001/account/loyalty");
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    const list = page.locator("[data-loyalty-rewards]");
    await expect(list.locator("[data-loyalty-reward]")).toHaveCount(6);
    for (const status of [
      "Disponible",
      "Réservée",
      "Utilisée",
      "Expirée",
      "Révoquée",
    ])
      await expect(
        list.getByText(status, { exact: true }).first(),
      ).toBeVisible();
    await expect(
      list.getByText("Café synthétique · Grand", { exact: true }),
    ).toBeVisible();
    await expect(
      list.getByText(/En attente du résultat du paiement/),
    ).toBeVisible();
    await page.screenshot({
      path: "../previews/customer-loyalty-rewards.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Français/ }).click();
    await page.getByRole("button", { name: /עברית/ }).click();
    await expect(
      list.getByText("קפה לדוגמה · גדול", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "../previews/customer-loyalty-rewards-hebrew.png",
      fullPage: true,
    });
  });
  test("pagination is explicit and a revision change cannot assemble a stale list", async ({
    page,
    request,
  }) => {
    await request.post(`${fixture}/__control`, { data: { rewards: "many" } });
    await page.goto("/r/9001/account/loyalty");
    const list = page.locator("[data-loyalty-rewards]");
    await expect(list.locator("[data-loyalty-reward]")).toHaveCount(20);
    await list
      .getByRole("button", { name: "Voir la suite", exact: true })
      .click();
    await expect(list.locator("[data-loyalty-reward]")).toHaveCount(25);
    await request.post(`${fixture}/__control`, {
      data: { rewards: "revision_change" },
    });
    await list.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(list.locator("[data-loyalty-reward]")).toHaveCount(20);
    await list
      .getByRole("button", { name: "Voir la suite", exact: true })
      .click();
    await expect(list.getByRole("alert")).toContainText("ont changé");
    await expect(list.locator("[data-loyalty-reward]")).toHaveCount(0);
  });
  test("failed own read never masquerades as an empty list or another account", async ({
    page,
    request,
    context,
  }) => {
    await request.post(`${fixture}/__control`, { data: { rewards: "error" } });
    await page.goto("/r/9001/account/loyalty");
    const list = page.locator("[data-loyalty-rewards]");
    await expect(list.getByRole("alert")).toContainText(
      "n’ont pas pu être vérifiées",
    );
    await expect(list.getByText(/pas encore de récompense/)).toHaveCount(0);
    await request.post(`${fixture}/__control`, { data: { rewards: "mixed" } });
    await context.addCookies([
      {
        name: cookieName,
        value: "synthetic-loyalty-b",
        url: cookieURL,
        secure: production,
        httpOnly: true,
      },
    ]);
    await list.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.locator("[data-loyalty-reward]")).toHaveCount(0);
  });
  test("BFF protects reward identity and cursor query without enabling reward mutations", async ({
    page,
  }) => {
    const path = "/api/customer-api/me/loyalty-rewards?restaurant_id=9001";
    for (const extra of [
      "&cursor=x&cursor=y",
      "&cursor=%2Fsecret",
      "&account_id=71002",
    ])
      expect(
        (
          await page.request.get(path + extra, {
            headers: { "X-Foody-Loyalty-Account": "71001" },
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await page.request.get(path, {
          headers: { "X-Foody-Loyalty-Account": "71002" },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.post(path, {
          headers: { "X-Foody-Loyalty-Account": "71001" },
          data: { reward_id: "synthetic" },
        })
      ).status(),
    ).toBe(404);
  });
});
