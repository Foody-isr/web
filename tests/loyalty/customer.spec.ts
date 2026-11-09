import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const production = process.env.FOODY_LOYALTY_PRODUCTION_PREVIEW === "1";
const cookieName = production
  ? "__Host-foody_customer"
  : "foody_customer_session";
const cookieURL = `${production ? "https" : "http"}://localhost:3131`;
const controlURL = "http://127.0.0.1:18083";
const memberURL = "/api/customer-api/me/loyalty-membership?restaurant_id=9001";
const input = {
  program_id: "11111111-1111-4111-8111-111111111111",
  expected_revision: 1,
  accepted_terms_version: "2026-11-v1",
  accept_terms: true,
};
const join = (page: Page) =>
  page.getByRole("button", { name: "Adhérer à ce programme", exact: true });
async function cookie(context: BrowserContext, who = "a") {
  await context.addCookies([
    {
      name: cookieName,
      value: `synthetic-loyalty-${who}`,
      url: cookieURL,
      secure: production,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function readState(page: Page) {
  return (await page.request.get(`${controlURL}/__state`)).json();
}
async function setup(
  page: Page,
  context: BrowserContext,
  authenticated = true,
  locale = "fr",
) {
  await page.addInitScript(
    (lang) => localStorage.setItem("foody-locale", lang),
    locale,
  );
  await page.route("**/*", (route) =>
    /^(localhost|127\.0\.0\.1|9001\.localhost)$/.test(
      new URL(route.request().url()).hostname,
    )
      ? route.continue()
      : route.abort(),
  );
  if (authenticated) await cookie(context);
}
async function open(page: Page, rid = 9001) {
  await page.goto(`/r/${rid}/account/loyalty`);
  await expect(
    page.getByRole("heading", { name: "Les habitués du Comptoir" }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${controlURL}/__control`, { data: { reset: true } });
});


test("an inactive restaurant has no customer enrollment entry", async ({
  page,
  context,
  request,
}) => {
  await request.post(`${controlURL}/__control`, { data: { unavailable: true } });
  await setup(page, context);
  await page.goto("/r/9001/account/loyalty");
  await expect(
    page.getByText("Le programme de fidélité de ce restaurant n’est pas disponible."),
  ).toBeVisible();
  await expect(join(page)).toHaveCount(0);
  await page.goto("/r/9001/orders");
  await expect(page.getByRole("link", { name: "Fidélité", exact: true })).toHaveCount(0);
});

test.describe("restaurant loyalty", () => {
  test("anonymous visitor reads terms and signs in separately from joining", async ({
    page,
    context,
  }) => {
    await setup(page, context, false);
    await open(page);
    await expect(page.locator("[data-loyalty-terms]")).toContainText(
      "Une visite par commande",
    );
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    expect((await readState(page)).enrollments).toHaveLength(0);
    const response = await page.request.post("/api/customer-auth/email/login", {
      data: { email: "camille@example.invalid", password: "synthetic-only" },
    });
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).not.toHaveProperty("token");
    expect(
      (await context.cookies()).find((c) => c.name === cookieName)?.httpOnly,
    ).toBe(true);
    await page.reload();
    await expect(join(page)).toBeVisible();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(join(page)).toBeDisabled();
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "synthetic-loyalty",
    );
    expect((await readState(page)).enrollments).toHaveLength(0);
  });
  test("explicit consent enrolls once at zero and persists no auth credential in JavaScript", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await open(page);
    await expect(join(page)).toBeDisabled();
    await page.getByRole("checkbox").check();
    await join(page).dblclick();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    const state = await readState(page);
    expect(state.enrollments).toEqual([
      { account: 71001, restaurant: 9001, input },
    ]);
    expect(
      await page.evaluate(() =>
        JSON.stringify({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      ),
    ).not.toContain("synthetic-loyalty");
    await page.reload();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect((await readState(page)).enrollments).toHaveLength(1);
  });
  test("BFF ignores caller authorization, checks owner, query, exact body and mutation origin", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await page.goto("/r/9001/account/loyalty");
    let response = await page.request.get(
      "/api/customer-api/loyalty/program?restaurant_id=9001",
      {
        headers: {
          Authorization: "Bearer synthetic-loyalty-b",
          "X-Receipt-Token": "synthetic-receipt",
        },
      },
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    response = await page.request.post(memberURL, {
      headers: {
        "X-Foody-Loyalty-Account": "71002",
        Authorization: "Bearer synthetic-loyalty-b",
      },
      data: input,
    });
    expect(response.status()).toBe(409);
    response = await page.request.post(memberURL, {
      headers: {
        "X-Foody-Loyalty-Account": "71001",
        Origin: "https://other.example.invalid",
      },
      data: input,
    });
    expect(response.status()).toBe(403);
    response = await page.request.post(memberURL, {
      headers: { "X-Foody-Loyalty-Account": "71001" },
      data: { ...input, account_id: 71002 },
    });
    expect(response.status()).toBe(400);
    response = await page.request.get(memberURL + "&account_id=71002", {
      headers: { "X-Foody-Loyalty-Account": "71001" },
    });
    expect(response.status()).toBe(400);
    response = await page.request.get(
      "/api/customer-api/loyalty/checkout-resolutions?restaurant_id=9001",
    );
    expect(response.status()).toBe(404);
    const state = await readState(page);
    expect(state.enrollments).toHaveLength(0);
    expect(
      state.requests
        .filter((r: any) => r.path.endsWith("/loyalty/program"))
        .every((r: any) => r.account === null && r.receipt === false),
    ).toBe(true);
  });
  test("cookie switch before submission never enrolls the newly signed-in account", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await open(page);
    await page.getByRole("checkbox").check();
    await cookie(context, "b");
    await join(page).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(join(page)).toBeDisabled();
    expect((await readState(page)).enrollments).toHaveLength(0);
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect(
      (await readState(page)).enrollments.map((e: any) => e.account),
    ).toEqual([71002]);
  });
  test("lost success is reconciled by own membership after reload without repeating the POST", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, { data: { loss: true } });
    await setup(page, context);
    await open(page);
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(
      page.getByRole("button", { name: "Reprendre l’adhésion", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect((await readState(page)).enrollments).toHaveLength(1);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("foody.loyalty-enrollment.v1:9001:71001"),
      ),
    ).toBeNull();
  });
  test("uncertain failure resumes only explicitly with the original consent after reload", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, { data: { failures: 1 } });
    await setup(page, context);
    await open(page);
    await page.getByRole("checkbox").check();
    await join(page).click();
    const resume = page.getByRole("button", {
      name: "Reprendre l’adhésion",
      exact: true,
    });
    await expect(resume).toBeVisible();
    await page.reload();
    await expect(resume).toBeVisible();
    expect((await readState(page)).enrollments).toHaveLength(1);
    await resume.click();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect(
      (await readState(page)).enrollments.map((e: any) => e.input),
    ).toEqual([input, input]);
  });
  test("stale revision requires fresh unchecked review and a new explicit choice", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, { data: { stale: true } });
    await setup(page, context);
    await open(page);
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(join(page)).toBeDisabled();
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect(
      (await readState(page)).enrollments.map(
        (e: any) => e.input.expected_revision,
      ),
    ).toEqual([1, 2]);
  });
  test("unavailable own read never invents zero or offers joining", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, {
      data: { ownFailure: true },
    });
    await setup(page, context);
    await page.goto("/r/9001/account/loyalty");
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "n’ont pas pu être vérifiées",
    );
    await expect(page.locator("[data-loyalty-balance]")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
  test("failed session storage prevents first POST", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k.startsWith("foody.loyalty"))
          throw new Error("synthetic storage failure");
        original.call(this, k, v);
      };
    });
    await open(page);
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "ne peut pas être conservée",
    );
    expect((await readState(page)).enrollments).toHaveLength(0);
  });
  test("negative progress and paused membership remain readable without earning or enrollment claims", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, {
      data: { member: { balance: -2 }, program: { enabled: false } },
    });
    await setup(page, context);
    await open(page);
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "-2 visites",
    );
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByText("Comment progresser")).toHaveCount(0);
    await page
      .locator('[aria-labelledby="loyalty-progress-title"]')
      .getByRole("button", { name: "Actualiser", exact: true })
      .click();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "-2 visites",
    );
    expect((await readState(page)).enrollments).toHaveLength(0);
  });
  test("closed membership cannot reopen and is scoped separately to the second restaurant", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, {
      data: { member: { status: "closed", balance: 4 } },
    });
    await setup(page, context);
    await open(page);
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "4 visites",
    );
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await open(page, 9002);
    await expect(page.locator("[data-loyalty-balance]")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await page.getByRole("checkbox").check();
    await join(page).click();
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "0 visites",
    );
    expect(
      (await readState(page)).enrollments.map((e: any) => e.restaurant),
    ).toEqual([9002]);
  });
  test("locale change resets consent and Hebrew mobile uses the restaurant dark theme without overflow", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await open(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Français/ }).click();
    await page.getByRole("button", { name: /English/ }).click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "Join this program", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: "../previews/customer-loyalty-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/r/9002/account/loyalty");
    await page.getByRole("button", { name: /Français/ }).click();
    await page.getByRole("button", { name: /עברית/ }).click();
    await expect(page.locator("main")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-loyalty-terms]")).toContainText(
      "ביקור אחד",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("main")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(20, 39, 35)");
    await page.screenshot({
      path: "../previews/customer-loyalty-hebrew-mobile.png",
      fullPage: true,
    });
  });
  test("preview and iframe render local unavailable state with zero loyalty queries", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await page.goto("/r/9001/account/loyalty?preview=1");
    await expect(
      page.getByText(
        "Le programme de fidélité de ce restaurant n’est pas disponible.",
      ),
    ).toBeVisible();
    expect((await readState(page)).requests).toHaveLength(0);
    const frame = await page.request.get("/r/9001/account/loyalty", {
      headers: { "Sec-Fetch-Dest": "iframe" },
    });
    expect(await frame.text()).toContain(
      "This restaurant’s loyalty program is not available.",
    );
    expect((await readState(page)).requests).toHaveLength(0);
  });
  test("points progression uses exact monetary steps and clean restaurant-host links", async ({
    page,
    context,
    request,
  }) => {
    await request.post(`${controlURL}/__control`, {
      data: {
        program: {
          rules: {
            mode: "points",
            spend_step_minor: 1000,
            units_per_step: 2,
            reward_threshold: 100,
          },
        },
        member: { balance: 24 },
      },
    });
    await setup(page, context);
    await open(page);
    await expect(page.locator("[data-loyalty-balance]")).toHaveText(
      "24 points",
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "24",
    );
    await expect(
      page.getByText(
        "Gagnez 2 points par tranche complète de 10,00 ₪ de produits éligibles payés.",
      ),
    ).toBeVisible();
    await page.screenshot({
      path: "../previews/customer-loyalty-member.png",
      fullPage: true,
    });
    await page.goto("http://9001.localhost:3131/account/loyalty");
    await expect(
      page.getByRole("link", { name: "Retour chez Le Comptoir" }),
    ).toHaveAttribute("href", "/order");
  });
  test("missing or revoked cookie cannot read membership even with a supplied account ID", async ({
    page,
    context,
  }) => {
    await setup(page, context, false);
    const response = await page.request.get(memberURL, {
      headers: {
        "X-Foody-Loyalty-Account": "71001",
        Authorization: "Bearer synthetic-loyalty-a",
      },
    });
    expect(response.status()).toBe(401);
    expect((await readState(page)).requests).toHaveLength(0);
    await cookie(context, "revoked");
    const expired = await page.request.post(memberURL, {
      headers: { "X-Foody-Loyalty-Account": "71001" },
      data: input,
    });
    expect(expired.status()).toBe(401);
    expect((await readState(page)).enrollments).toHaveLength(0);
  });
  test("order history links to loyalty and merchant slug remains on its original route", async ({
    page,
    context,
  }) => {
    await setup(page, context);
    await page.goto("/r/9001/orders");
    await expect(
      page.getByRole("link", { name: "Fidélité", exact: true }),
    ).toHaveAttribute("href", "/r/9001/account/loyalty");
    for (const slug of ["account", "loyalty"]) {
      const res = await page.request.get(`/r/9001/${slug}`);
      expect(res.status()).toBe(200);
      expect(await res.text()).toContain(`Merchant ${slug} page`);
    }
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});
