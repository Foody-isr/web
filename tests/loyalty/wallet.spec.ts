import {
  test,
  expect,
  type Page,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
const fixture = `http://127.0.0.1:${process.env.FOODY_LOYALTY_FIXTURE_PORT || 18083}`;
const webOff = process.env.FOODY_LOYALTY_PREVIEW_ENABLED === "0";
const disabled =
  webOff || process.env.FOODY_LOYALTY_WALLET_PREVIEW_ENABLED === "0";
const production = process.env.FOODY_LOYALTY_PRODUCTION_PREVIEW === "1";
const program = "11111111-1111-4111-8111-111111111111";
const membership = "33333333-3333-4333-8333-333333333333";
const headers = { "X-Foody-Loyalty-Account": "71001" };
const assertion = { membership_id: membership, program_id: program };
const walletURL = "/api/customer-api/loyalty/wallet?restaurant_id=9001";
const googleURL =
  "/api/customer-api/loyalty/wallet/cards/google?restaurant_id=9001";
const appleURL = "/api/loyalty-wallet/apple";
const form = (change: Record<string, string> = {}) =>
  new URLSearchParams({
    restaurant_id: "9001",
    expected_account: "71001",
    ...assertion,
    return_path: "/r/9001/account/loyalty",
    ...change,
  }).toString();
const formHeaders = {
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: "http://localhost:3131",
};
const control = (request: APIRequestContext, data: unknown) =>
  request.post(`${fixture}/__control`, { data });
const state = async (request: APIRequestContext) =>
  (await request.get(`${fixture}/__state`)).json();
const cookie = (context: BrowserContext, value: string) =>
  context.addCookies([
    {
      name: production ? "__Host-foody_customer" : "foody_customer_session",
      value,
      url: `${production ? "https" : "http"}://localhost:3131`,
      httpOnly: true,
      secure: production,
      sameSite: "Lax",
    },
  ]);
const section = (page: Page) => page.locator("[data-loyalty-wallet]");
const posts = (data: any) =>
  data.walletRequests.filter((r: any) => r.method === "POST");
const appleRequest = (request: APIRequestContext, data = form()) =>
  request.post(appleURL, { headers: formHeaders, data, maxRedirects: 0 });

test.beforeEach(async ({ request, context, page }) => {
  await control(request, {
    reset: true,
    member: { balance: 3 },
    wallet: { apple: true, google: true },
    rewards: "mixed",
  });
  await cookie(context, "synthetic-loyalty-a");
  await page.addInitScript(() => localStorage.setItem("foody-locale", "fr"));
  await page.route("**/*", (route) =>
    /^(localhost|127\.0\.0\.1)$/.test(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});

test("Wallet remains independently absent with zero backend calls when disabled", async ({
  page,
}) => {
  const request = page.request;
  test.skip(!disabled);
  await page.goto("/r/9001/account/loyalty");
  await expect(section(page)).toHaveCount(0);
  expect((await request.get(walletURL, { headers })).status()).toBe(404);
  expect(
    (await request.post(googleURL, { headers, data: assertion })).status(),
  ).toBe(404);
  expect((await appleRequest(request)).status()).toBe(404);
  expect((await request.get(appleURL)).status()).toBe(404);
  if (!webOff)
    expect(
      (
        await request.get(
          "/api/customer-api/loyalty/program?restaurant_id=9001",
        )
      ).status(),
    ).toBe(200);
  expect((await state(request)).walletRequests).toHaveLength(0);
});

test.describe("owned Wallet pilot", () => {
  test.skip(disabled);
  test("only explicit provider actions are offered; FR/EN/HE and small RTL retain their layout", async ({
    page,
  }) => {
    const request = page.request;
    await page.goto("/r/9001/account/loyalty");
    const panel = section(page);
    await expect(
      panel.getByRole("button", { name: "Ajouter la carte à Apple Wallet" }),
    ).toBeEnabled();
    await expect(
      panel.getByRole("button", { name: "Ajouter à Google Wallet" }),
    ).toBeEnabled();
    expect(posts(await state(request))).toHaveLength(0);
    await page.screenshot({
      path: "../previews/customer-wallet-fr-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /Français/ }).click();
    await page.getByRole("button", { name: /English/ }).click();
    await expect(
      panel.getByRole("button", { name: "Add to Google Wallet" }),
    ).toBeVisible();
    await expect(panel.locator("img")).toHaveAttribute(
      "src",
      "/wallet/google-en.svg",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /English/ }).click();
    await page.getByRole("button", { name: /עברית/ }).click();
    await expect(
      panel.getByRole("heading", { name: "הכרטיס שלך ב-Wallet" }),
    ).toBeVisible();
    await expect(panel.locator("img")).toHaveAttribute(
      "src",
      "/wallet/google-he.svg",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const box of await panel.getByRole("button").all()) {
      const bounds = await box.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: "../previews/customer-wallet-he-mobile.png",
      fullPage: true,
    });
    expect(posts(await state(request))).toHaveLength(0);
  });
  test("an inactive member can revoke an existing card in the restaurant dark theme", async ({
    page,
  }) => {
    const request = page.request;
    await control(request, { member: { restaurant: 9002 } });
    expect(
      (
        await appleRequest(
          request,
          form({
            restaurant_id: "9002",
            return_path: "/r/9002/account/loyalty",
          }),
        )
      ).status(),
    ).toBe(200);
    await control(request, { member: { restaurant: 9002, status: "closed" } });
    await page.goto("/r/9002/account/loyalty");
    const panel = section(page);
    await expect(
      panel.getByText("Carte inactive", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.locator("[data-wallet-apple], [data-wallet-google]"),
    ).toHaveCount(0);
    await panel.getByRole("button", { name: "Désactiver cette carte" }).click();
    await expect(
      panel.getByRole("button", { name: "Confirmer la désactivation" }),
    ).toBeEnabled();
    await panel.screenshot({
      path: "../previews/customer-wallet-dark-confirm.png",
    });
    expect(posts(await state(request))).toHaveLength(1);
  });
  test("unavailable providers stay hidden; read failures and incoherent scopes never invent availability", async ({
    page,
  }) => {
    const request = page.request;
    await control(request, { wallet: { google: false } });
    await page.goto("/r/9001/account/loyalty");
    await expect(
      section(page).getByRole("button", { name: /Ajouter la carte/ }),
    ).toBeEnabled();
    await expect(section(page).locator("[data-wallet-google]")).toHaveCount(0);
    await control(request, { wallet: { apple: false } });
    await section(page)
      .getByRole("button", { name: "Actualiser", exact: true })
      .click();
    await expect(section(page)).toHaveCount(0);
    await control(request, { walletReadFault: "error" });
    await page.reload();
    await expect(section(page).getByRole("alert")).toContainText(
      "Impossible de vérifier",
    );
    await expect(
      section(page).locator("[data-wallet-apple], [data-wallet-google]"),
    ).toHaveCount(0);
    await control(request, {
      walletReadFault: "",
      wallet: { google: true },
      walletIncoherent: true,
    });
    await section(page)
      .getByRole("button", { name: "Actualiser", exact: true })
      .click();
    await expect(section(page).getByRole("alert")).toBeVisible();
    await expect(section(page).locator("[data-wallet-google]")).toHaveCount(0);
    expect(posts(await state(request))).toHaveLength(0);
  });
  test("Apple uses native form download, stable issuance and no browser credential storage", async ({
    page,
  }) => {
    const request = page.request;
    await page.goto("/r/9001/account/loyalty");
    const button = section(page).getByRole("button", {
      name: "Ajouter la carte à Apple Wallet",
    });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toBe("foody-loyalty.pkpass");
    expect(await readFile((await download.path())!)).toEqual(
      await readFile("tests/fixtures/loyalty-wallet.pkpass"),
    );
    const response = await appleRequest(request);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(
      "application/vnd.apple.pkpass",
    );
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    await section(page)
      .getByRole("button", { name: "Actualiser", exact: true })
      .click();
    await expect(section(page).locator("[data-wallet-card]")).toHaveCount(1);
    await expect(
      section(page).getByText("Carte préparée", { exact: true }),
    ).toBeVisible();
    const data = await state(request);
    expect(data.walletCards["9001:71001"]).toHaveLength(1);
    expect(data.members["9001:71001"].balance).toBe(3);
    expect(data.enrollments).toHaveLength(0);
    expect(posts(data).map((r: any) => r.input)).toEqual([
      assertion,
      assertion,
    ]);
    const browserData = await page.evaluate((production) => {
      const dom = document.documentElement.cloneNode(true) as HTMLElement;
      // Next dev's RSC diagnostics serialize request headers in debug scripts.
      // The production run asserts the complete HTML, including every script.
      if (!production)
        dom.querySelectorAll("script").forEach((script) => script.remove());
      return {
        dom: dom.innerHTML,
        cookies: document.cookie,
        storage: JSON.stringify([
          Object.entries(localStorage),
          Object.entries(sessionStorage),
        ]),
      };
    }, production);
    expect(JSON.stringify(browserData)).not.toMatch(
      /synthetic-wallet-only-not-a-real-token|synthetic-loyalty-a|eyJhbGciOiJSUzI1NiJ9/,
    );
  });
  test("Google prepares only on click, rechecks identity then opens the allowed destination", async ({
    page,
  }) => {
    const request = page.request;
    let destination = "";
    await page.route("https://pay.google.com/**", async (route) => {
      destination = route.request().url();
      await route.fulfill({
        contentType: "text/html",
        body: "<p>Synthetic Google screen</p>",
      });
    });
    await page.goto("/r/9001/account/loyalty");
    await expect(section(page).locator("[data-wallet-google]")).toBeEnabled();
    expect(posts(await state(request))).toHaveLength(0);
    await section(page).locator("[data-wallet-google]").click();
    await expect(page).toHaveURL(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    expect(destination).toContain("/gp/v/save/");
    const data = await state(request);
    expect(
      posts(data).map((r: any) => ({ account: r.account, input: r.input })),
    ).toEqual([{ account: 71001, input: assertion }]);
    expect(
      data.walletRequests.filter((r: any) => r.method === "GET").length,
    ).toBeGreaterThanOrEqual(2);
    expect(data.bankInitializations).toBe(0);
    expect(data.members["9001:71001"].balance).toBe(3);
  });
  test("a cookie switch before either issuance is rejected before any backend mutation", async ({
    page,
    context,
  }) => {
    const request = page.request;
    await page.goto("/r/9001/account/loyalty");
    await expect(section(page).locator("[data-wallet-google]")).toBeEnabled();
    await cookie(context, "synthetic-loyalty-b");
    expect(
      (await request.post(googleURL, { headers, data: assertion })).status(),
    ).toBe(409);
    const response = await appleRequest(request);
    expect(response.status()).toBe(303);
    expect(response.headers().location).toContain(
      "wallet_result=wallet_session_changed",
    );
    expect(posts(await state(request))).toHaveLength(0);
  });
  test("a cookie switch after Google preparation blocks the stale link navigation", async ({
    page,
    context,
  }) => {
    const request = page.request;
    let navigated = false;
    await page.route("https://pay.google.com/**", (route) => {
      navigated = true;
      return route.abort();
    });
    await page.route(
      "**/api/customer-api/loyalty/wallet/cards/google?*",
      async (route) => {
        const response = await route.fetch();
        await cookie(context, "synthetic-loyalty-b");
        await route.fulfill({ response });
      },
    );
    await page.goto("/r/9001/account/loyalty");
    await section(page).locator("[data-wallet-google]").click();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(section(page)).toHaveCount(0);
    expect(navigated).toBe(false);
    expect(posts(await state(request))).toHaveLength(1);
    expect(page.url()).not.toContain("save/");
    expect(
      await page.evaluate(() =>
        JSON.stringify([
          Object.entries(localStorage),
          Object.entries(sessionStorage),
        ]),
      ),
    ).not.toContain("eyJhbGci");
  });
  test("revocation requires explicit confirmation, preserves points and works while providers are off", async ({
    page,
  }) => {
    const request = page.request;
    await appleRequest(request);
    const before = await state(request);
    await control(request, { wallet: { apple: false, google: false } });
    await page.goto("/r/9001/account/loyalty");
    const panel = section(page);
    await expect(panel.locator("[data-wallet-card]")).toHaveCount(1);
    await expect(
      panel.locator("[data-wallet-apple], [data-wallet-google]"),
    ).toHaveCount(0);
    await panel.getByRole("button", { name: "Désactiver cette carte" }).click();
    await expect(panel.locator("[data-wallet-confirm]")).toContainText(
      "Vos points et récompenses restent conservés",
    );
    await panel.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Désactiver cette carte" }),
    ).toBeFocused();
    expect(posts(await state(request))).toHaveLength(1);
    await panel.getByRole("button", { name: "Désactiver cette carte" }).click();
    await panel
      .getByRole("button", { name: "Confirmer la désactivation" })
      .click();
    await expect(panel).toHaveCount(0);
    const after = await state(request);
    expect(after.members).toEqual(before.members);
    expect(after.rewards).toEqual(before.rewards);
    expect(after.walletCards["9001:71001"]).toHaveLength(0);
    expect(posts(after).at(-1).input).toEqual({});
  });
  test("lost revocation is recovered by a read without an automatic mutation retry", async ({
    page,
  }) => {
    const request = page.request;
    await appleRequest(request);
    await control(request, { walletRevokeLoss: true });
    await page.goto("/r/9001/account/loyalty");
    const panel = section(page);
    await panel.getByRole("button", { name: "Désactiver cette carte" }).click();
    await panel
      .getByRole("button", { name: "Confirmer la désactivation" })
      .click();
    await expect(panel.getByRole("alert")).toBeVisible();
    expect(posts(await state(request))).toHaveLength(2);
    await panel
      .getByRole("button", { name: "Actualiser", exact: true })
      .click();
    await expect(panel.locator("[data-wallet-card]")).toHaveCount(0);
    expect(posts(await state(request))).toHaveLength(2);
  });
  test("strict BFF scope, bodies, origins and allowlist exclude native protocol and identity injection", async ({
    page,
  }) => {
    const request = page.request;
    for (const extra of [
      "&restaurant_id=9001",
      "&account_id=71002",
      "&receipt_token=private",
    ])
      expect((await request.get(walletURL + extra, { headers })).status()).toBe(
        400,
      );
    expect(
      (
        await request.get(walletURL, {
          headers: { "X-Foody-Loyalty-Account": "71002" },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(googleURL, {
          headers: { ...headers, Origin: "http://localhost:9999" },
          data: assertion,
        })
      ).status(),
    ).toBe(403);
    for (const input of [
      { ...assertion, account_id: 71002 },
      { ...assertion, program_id: "invalid" },
    ])
      expect(
        (await request.post(googleURL, { headers, data: input })).status(),
      ).toBe(400);
    expect(
      (
        await request.post(googleURL, {
          headers: { ...headers, "Content-Type": "text/plain" },
          data: JSON.stringify(assertion),
        })
      ).status(),
    ).toBe(415);
    expect(
      (
        await request.post(googleURL, {
          headers: { ...headers, "Content-Type": "application/json" },
          data: "x".repeat(513),
        })
      ).status(),
    ).toBe(413);
    for (const path of [
      "loyalty/wallet/cards/apple",
      "loyalty/wallet/apple/v1/devices/private/registrations",
    ])
      expect(
        (
          await request.post(`/api/customer-api/${path}?restaurant_id=9001`, {
            headers,
            data: assertion,
          })
        ).status(),
      ).toBe(404);
    expect(
      (
        await request.post(
          `/api/customer-api/loyalty/wallet/cards/apple/55555555-5555-4555-8555-000000000001/revoke?restaurant_id=9001`,
          { headers, data: {} },
        )
      ).status(),
    ).toBe(413);
    expect(posts(await state(request))).toHaveLength(0);
    const response = await request.post(googleURL, {
      headers: {
        ...headers,
        Authorization: "Bearer synthetic-loyalty-b",
        "X-Receipt-Token": "synthetic-receipt",
      },
      data: assertion,
    });
    expect(response.status()).toBe(200);
    const sent = posts(await state(request))[0];
    expect(sent.account).toBe(71001);
    expect(sent.receipt).toBe(false);
  });
  test("unsafe upstream links, private metadata and redirects become fixed errors", async ({
    page,
  }) => {
    const request = page.request;
    for (const fault of ["unsafe", "redirect", "error"]) {
      await control(request, { walletIssueFault: fault });
      const response = await request.post(googleURL, {
        headers,
        data: assertion,
      });
      expect(response.status()).toBe(503);
      expect(await response.json()).toEqual({ error: "wallet_unavailable" });
    }
    await control(request, { walletReadFault: "private" });
    const response = await request.get(walletURL, { headers });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: "wallet_unavailable" });
  });
  test("Apple rejects untrusted transport and redirects only to the restaurant with a fixed notice", async ({
    page,
  }) => {
    const request = page.request;
    for (const fault of ["mime", "archive", "oversize", "redirect", "error"]) {
      await control(request, { walletIssueFault: fault });
      const response = await appleRequest(request);
      expect(response.status()).toBe(303);
      expect(new URL(response.headers().location).origin).toBe(
        "http://localhost:3131",
      );
      expect(response.headers().location).toMatch(
        /\/r\/9001\/account\/loyalty\?wallet_result=wallet_(unavailable|invalid)$/,
      );
    }
    const foreign = await appleRequest(
      request,
      form({ return_path: "https://attacker.example.invalid" }),
    );
    expect(new URL(foreign.headers().location).pathname).toBe(
      "/r/9001/account/loyalty",
    );
    expect(
      (
        await request.post(appleURL, {
          headers: {
            ...formHeaders,
            Origin: "https://attacker.example.invalid",
          },
          data: form(),
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(403);
    await page.goto(
      "/r/9001/account/loyalty?wallet_result=private-provider-message",
    );
    await expect(page.locator("[data-wallet-notice]")).toContainText(
      "n’a pas pu aboutir",
    );
    await expect(page.locator("[data-wallet-notice]")).not.toContainText(
      "private-provider-message",
    );
    await page.locator("[data-wallet-notice]").getByRole("button").click();
    expect(page.url()).not.toContain("wallet_result");
  });
  test("preview and framed renderers never read Wallet or offer live mutations", async ({
    page,
  }) => {
    const request = page.request;
    await page.goto("/r/9001/account/loyalty?preview=1");
    await expect(section(page)).toHaveCount(0);
    expect((await state(request)).walletRequests).toHaveLength(0);
    const response = await request.get("/r/9001/account/loyalty", {
      headers: { "Sec-Fetch-Dest": "iframe" },
    });
    expect(await response.text()).not.toContain("data-wallet-apple");
    expect((await state(request)).walletRequests).toHaveLength(0);
  });
});
