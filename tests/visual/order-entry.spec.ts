import { test, expect, type Page } from "@playwright/test";
import type { WebsiteV3StateMessage } from "../../lib/preview/websiteV3Protocol";

test.describe("installed app navigation", () => {
  test("keeps one tab bar on the shared host", async ({ page, baseURL }) => {
    await checkInstalledNavigation(page, new URL(baseURL!).origin, false);
  });

  test("keeps one tab bar on the restaurant domain", async ({ playwright, baseURL }) => {
    const origin = new URL(baseURL!);
    origin.hostname = "pwa-nav-foody-fixture.vercel.app";
    const browser = await playwright.chromium.launch({
      args: [`--host-resolver-rules=MAP ${origin.hostname} 127.0.0.1`, "--no-proxy-server"],
    });
    try {
      const page = await browser.newPage({ serviceWorkers: "block" });
      await checkInstalledNavigation(page, origin.origin, true);
    } finally {
      await browser.close();
    }
  });

  test("pins the order title above the categories while the service details scroll away", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    });
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto("/r/49012/order?lang=fr");
    const header = page.locator(".mobile-order-header");
    await expect(header).toHaveCount(0);
    await page.locator(".website-order-entry").getByRole("button", { name: "Retrait" }).click();
    const step = page.locator(".website-order-step");
    await step.getByRole("button", { name: "Commander sans compte", exact: true }).click();
    await step.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(header.getByRole("heading", { name: "À emporter" })).toBeVisible();
    await expect(page.locator('[data-editor-region="header"]')).toBeHidden();
    const location = page.locator(".website-service-location");
    await expect(location).toBeInViewport();
    const navigation = page.locator(".website-order-navigation");
    const category = navigation.getByRole("link", { name: "Pâtisseries" });
    await category.click();
    const group = page.locator(".website-order-category").filter({ has: page.getByRole("button", { name: "Brioche 1" }) });
    await expect.poll(async () => {
      const title = (await header.boundingBox())!;
      const bar = (await navigation.boundingBox())!;
      return Math.abs(title.y) + Math.abs(bar.y - title.height);
    }).toBeLessThan(1);
    await expect.poll(async () => {
      const bar = (await navigation.boundingBox())!;
      const section = (await group.boundingBox())!;
      return section.y - bar.y - bar.height;
    }).toBeGreaterThanOrEqual(22);
    await expect(location).not.toBeInViewport();
    await expect(category).toHaveAttribute("aria-current", "location");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: testInfo.outputPath("pwa-order-scrolled.png") });

    await header.evaluate(element => element.style.setProperty("--type-ordercataloguetitle-size-mult", "1.75"));
    await expect.poll(async () => {
      const height = (await header.boundingBox())!.height;
      const top = await navigation.evaluate(element => parseFloat(getComputedStyle(element).top));
      return Math.abs(top - height);
    }).toBeLessThan(1);
    await header.getByRole("button", { name: "Retour au choix du mode" }).click();
    await expect(page.getByRole("heading", { name: "Comment souhaitez-vous commander ?" })).toBeVisible();
    await expect(header).toHaveCount(0);
  });

  test("renders the More page with readable right-to-left navigation on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    });
    await page.goto("/r/49012/account/more?lang=he");
    const more = page.locator(".mobile-more");
    await expect(more).toHaveAttribute("dir", "rtl");
    await expect(more.getByRole("heading", { name: "עוד", exact: true })).toHaveCSS("font-family", /Manrope/);
    const link = more.getByRole("link", { name: "היסטוריית הזמנות" });
    await expect(link).toHaveAttribute("href", "/r/49012/orders?lang=he");
    await expect(link.locator("svg").last()).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test("shares More typography across desktop, mobile browser and the installed app", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto("/r/49012/account/more?lang=fr");
    const more = page.locator(".mobile-more");
    const heading = more.getByRole("heading", { name: "Plus", exact: true });
    const history = more.getByRole("link", { name: "Historique" });
    await expect(heading).toHaveCSS("font-family", /Manrope/);
    await expect(history).toHaveCSS("font-family", /Inter/);
    const readTypography = () => more.locator("h1, h2, li a").evaluateAll(elements => elements.map(element => {
      const { fontFamily, fontSize, fontWeight, lineHeight } = getComputedStyle(element);
      return { fontFamily, fontSize, fontWeight, lineHeight };
    }));
    const desktopTypography = await readTypography();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await readTypography()).toEqual(desktopTypography);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    });
    await page.reload();
    const tab = page.locator('.mobile-tabbar [data-mobile-tab="more"]');
    await expect(tab).toHaveCSS("font-family", /Inter/);
    await expect(tab).toHaveCSS("font-size", "12px");
    await expect.poll(readTypography).toEqual(desktopTypography);
  });

  test("the editor preview applies the site fonts to More from a page with its own fonts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/r/49012/order?preview=1&lang=fr");
    const draft: WebsiteV3StateMessage = {
      type: "foody.website-v3.state",
      revision: 1,
      contentRevision: 1,
      restaurantId: 49012,
      activePageKey: "1",
      device: "mobile",
      state: {
        config: {
          typography: { site: { headingFont: "Manrope", bodyFont: "Inter" } },
          nav_layout: { mobile_experience: {
            version: 1,
            navigation: { enabled: true, items: [{ id: "more", target: "more", placement: "bar" }] },
          } },
          preview_mobile_experience: { mode: "standalone", screen: "page", locale: "fr" },
        },
        pages: [{
          id: 1,
          slug: "order",
          title: "Menu",
          type: "order",
          sort_order: 0,
          is_default: true,
          appearance_overrides: { typography: { site: { headingFont: "Georgia", bodyFont: "Georgia" } } },
        }],
        sections: [],
        deleted_section_ids: [],
      },
    };
    await expect(page.locator("[data-website-v3-page]")).toBeVisible();
    await page.evaluate(state => window.postMessage(state, window.location.origin), draft);
    const tab = page.locator('.mobile-tabbar [data-mobile-tab="more"]');
    await expect(tab).toBeVisible();
    await expect(page.locator("[data-website-v3-page]")).toHaveCSS("font-family", /Georgia/);
    await tab.click();
    await expect(page.locator(".mobile-more").getByRole("heading", { name: "Plus", exact: true }))
      .toHaveCSS("font-family", /Manrope/);
    await expect(tab).toHaveCSS("font-family", /Inter/);
  });
});

async function checkInstalledNavigation(page: Page, origin: string, customDomain: boolean) {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const root = "/r/49012";
  const home = customDomain ? "/" : root;
  const order = customDomain ? "/order" : root + "/order";
  const siteHeader = page.locator('[data-editor-region="header"]');
  const siteFooter = page.locator('[data-editor-region="footer-branding"]');
  const navigation = page.getByRole("navigation", { name: "Navigation mobile", exact: true });
  const tab = (id: string) => navigation.locator(`[data-mobile-tab="${id}"]`);

  await page.goto(origin + home + "?lang=fr");
  await expect(siteHeader).toBeVisible();
  await expect(siteFooter).toBeVisible();
  await expect(navigation).toHaveCount(0);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
  });
  await page.reload();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(tab("home")).toHaveAttribute("aria-current", "page");
  await expect(siteHeader).toBeHidden();
  await expect(siteFooter).toBeHidden();
  const originalBar = await navigation.elementHandle();
  const homeScroll = await page.evaluate(() => {
    window.scrollTo({ top: 300, behavior: "instant" });
    return window.scrollY;
  });
  expect(homeScroll).toBe(300);

  let recordOrderRequest!: () => void;
  const orderRequested = new Promise<void>(resolve => { recordOrderRequest = resolve; });
  let releaseOrderRequest!: () => void;
  const orderResponse = new Promise<void>(resolve => { releaseOrderRequest = resolve; });
  await page.route(url => url.pathname === order && url.searchParams.has("_rsc"), async route => {
    recordOrderRequest();
    await orderResponse;
    await route.continue();
  });
  try {
    await tab("order").click({ noWaitAfter: true });
    await orderRequested;
    await expect(navigation).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(homeScroll);
    expect(await navigation.evaluate((node, initial) => node === initial, originalBar)).toBe(true);
  } finally {
    releaseOrderRequest();
  }

  await expect(tab("order")).toHaveAttribute("aria-current", "page");
  await expect(siteHeader).toBeHidden();
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("browse", "1");
    window.history.replaceState(null, "", url);
  });
  const search = page.locator(".website-order-menu").getByRole("searchbox");
  await expect(page.locator(".mobile-order-header").getByRole("heading", { name: "La carte" })).toBeVisible();
  await search.fill("Sandwich");
  const scrollTop = await page.evaluate(() => {
    window.scrollTo({ top: 48, behavior: "instant" });
    return window.scrollY;
  });
  expect(scrollTop).toBeGreaterThan(0);

  await tab("more").click();
  const more = page.locator(".mobile-more");
  await expect(more.getByRole("heading", { name: "Plus", exact: true })).toHaveCSS("font-family", /Manrope/);
  await expect(more.getByRole("heading", { name: "Mon compte" })).toBeVisible();
  await expect(more.getByRole("link", { name: "Historique" })).toBeVisible();
  await expect(tab("more")).toHaveAttribute("aria-current", "page");

  let repeatRequests = 0;
  const repeatPageRequest = (url: URL) => url.origin === origin && url.searchParams.has("_rsc");
  await page.route(repeatPageRequest, route => { repeatRequests++; return route.abort(); });
  await tab("home").click();
  await expect(tab("home")).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(origin + home + "?lang=fr");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(homeScroll);
  await tab("order").click();
  await expect(search).toHaveValue("Sandwich");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrollTop);
  await page.goBack();
  await expect(tab("home")).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(tab("more")).toHaveAttribute("aria-current", "page");
  expect(repeatRequests).toBe(0);
  await page.unroute(repeatPageRequest);

  await tab("orders").click();
  await expect(tab("orders")).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(origin + root + "/orders?lang=fr");
  expect(await navigation.evaluate((node, initial) => node === initial, originalBar)).toBe(true);
}

for (const width of [390, 1280]) {
  test(`service first keeps the initial chooser and allows changes on the menu (${width})`, async ({ page }, testInfo) => {
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
    await page.locator('[aria-haspopup="dialog"]').filter({ hasText: "Menu" }).click();
    const drawer = page.locator(".website-header-menu-dialog[open]");
    await expect(drawer.getByRole("link", { name: "Menu", exact: true })).toBeVisible();
    await expect(drawer.getByText(/Changer de langue/)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: testInfo.outputPath("choose-mode.png") });
    await page.locator(".website-order-entry").getByRole("button", { name: /Retrait/ }).click();
    const step = page.locator(".website-order-step");
    const details = page.locator(".website-entry-dialog[open]");
    await expect(page).toHaveURL(/fulfillment=pickup/);
    await expect(step).toBeVisible();
    await expect(chooser).toHaveCount(0);
    await expect(details).toHaveCount(0);
    await step.getByRole("button", { name: "Commander sans compte", exact: true }).click();
    await expect(step.locator(".website-schedule-lists")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("pickup-step.png") });
    await page.goBack();
    await expect(chooser).toBeVisible();
    await page.goForward();
    await step.getByRole("button", { name: "Commander sans compte", exact: true }).click();
    await step.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(menu).toBeVisible();
    await expect(page).toHaveURL(/service=pickup/);
    const reminder = page.locator(".website-preorder-reminder");
    await expect(reminder).toContainText("10:00");
    await expect(page.locator(".website-service-time > span:visible")).toContainText("10:00");
    if (width === 390) {
      const header = page.locator("[data-mobile-catalogue]");
      await expect(header.getByRole("heading", { name: "À emporter" })).toBeVisible();
      const back = await header.getByRole("button", { name: "Retour au choix du mode" }).boundingBox();
      const menuButton = await header.getByRole("button", { name: "Navigation principale" }).boundingBox();
      expect(back!.x).toBeLessThan(menuButton!.x);
      expect(Math.abs(back!.y - menuButton!.y)).toBeLessThan(2);
      const location = await page.locator(".website-service-location").boundingBox();
      const time = await page.locator(".website-service-time").boundingBox();
      expect(time!.y).toBeLessThan(location!.y);
      expect(time!.width).toBe(location!.width);
      expect(location!.y + location!.height).toBeLessThan(200);
    }
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
    await menu.getByRole("button", { name: "Demo sandwich", exact: true }).click();
    await page.locator('[data-item-part="add"]:visible').click();
    if (width === 390) {
      await page.getByRole("button", { name: "Retour au choix du mode" }).click();
      await expect(chooser).toBeVisible();
      await page.goBack();
      await expect(page.locator(".website-cart-dock .website-cart-count")).toContainText("1");
      await page.locator("[data-mobile-catalogue]").getByRole("button", { name: "Navigation principale" }).click();
      await expect(drawer.getByRole("link", { name: "Entry Demo", exact: true })).toBeVisible();
      await drawer.getByRole("button", { name: "Changer de mode" }).click();
    } else await page.locator(".website-catalogue-mode button").click();
    await expect(details).toBeVisible();
    expect(await details.evaluate(element => element.matches(":modal"))).toBe(width === 390);
    await details.getByRole("tab", { name: "Livraison" }).click();
    const address = details.getByRole("textbox", { name: "Adresse de livraison", exact: true });
    await address.fill("Outside Test City");
    await expect(details.getByText(/hors de notre zone/)).toBeVisible();
    await expect(details.getByRole("button", { name: /Confirmer l’adresse|Enregistrer/ })).toBeDisabled();
    await address.fill("12 Demo Street, Test City");
    await details.locator('button[type="submit"]').click();
    await expect(details).toHaveCount(0);
    await expect(chooser).toHaveCount(0);
    await expect(menu).toBeVisible();
    await expect(page.locator(".website-cart-dock .website-cart-count")).toContainText("1");
    await expect(page).toHaveURL(/service=delivery/);
    if (width === 390) {
      await expect(page.locator(".website-catalogue-mobile-heading h1")).toHaveText("Livraison");
      await expect(page.locator(".website-service-location .website-service-compact-value")).toContainText("12 Demo Street");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280) {
      await page.locator(".website-cart-dock button:visible").click();
      await page.locator("button.commerce-fulfillment-row:visible").first().click();
      await expect(details).toBeVisible();
      await expect(details.getByRole("tab")).toHaveCount(0);
      await expect(details.getByRole("heading", { name: "Adresse de livraison" })).toBeVisible();
    }
  });
}

for (const [id, variant] of [[49009, "legacy"], [49010, "themed"]] as const) {
  test(`the compact mobile title stays above the categories on the ${variant} header`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 340 });
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    await page.locator(".website-order-entry").getByRole("button", { name: "Retrait" }).click();
    await page.locator(".website-order-step").getByRole("button", { name: "Commander sans compte", exact: true }).click();
    await page.locator(".website-order-step").getByRole("button", { name: "Confirmer le retrait" }).click();

    const header = page.locator(".website-service-catalogue > [data-mobile-catalogue]");
    const title = header.getByRole("heading", { name: "À emporter" });
    const navigation = page.locator(".website-order-navigation");
    const location = page.locator(".website-service-location");
    await expect(title).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(location).toBeInViewport();
    const size = await title.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(size).toBeGreaterThan(31);
    expect(size).toBeLessThan(33);

    await header.evaluate(element => element.style.setProperty("--type-ordercataloguetitle-size-mult", "1.55"));
    await expect.poll(async () => {
      const height = (await header.boundingBox())!.height;
      const top = await navigation.evaluate(element => parseFloat(getComputedStyle(element).top));
      return Math.abs(top - height);
    }).toBeLessThan(1);

    await navigation.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 24));
    await expect.poll(async () => {
      const bounds = (await header.boundingBox())!;
      const categoryTop = (await navigation.boundingBox())!.y;
      return Math.abs(bounds.y) + Math.abs(categoryTop - bounds.height);
    }).toBeLessThan(1);
    const fieldBottom = await location.evaluate(element => element.getBoundingClientRect().bottom);
    expect(fieldBottom).toBeLessThan((await header.boundingBox())!.height);
    await header.getByRole("button", { name: "Navigation principale" }).click();
    await expect(page.locator(".website-header-menu-dialog[open]")).toBeVisible();
  });
}

test("a mobile catalogue opened from a story invites a mode choice without leaving the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto("/r/49009/order?browse=1&lang=fr");
  await expect(page.getByRole("heading", { name: "La carte" })).toBeVisible();
  await expect(page.locator(".website-order-menu")).toBeVisible();
  await expect(page.locator(".website-order-entry")).toHaveCount(0);
  const chooser = page.getByRole("button", { name: "Choisir retrait ou livraison", exact: true });
  await chooser.click();
  await expect(page.locator(".website-entry-dialog[open]")).toBeVisible();
});

for (const [id, offered, width] of [[49009, true, 390], [49011, false, 1280]] as const) {
  test(`the dedicated delivery step respects the sign-in invitation (${offered ? "on" : "off"})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/customer-auth/session", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    const chooser = page.locator(".website-order-entry");
    await chooser.getByRole("button", { name: "Livraison", exact: true }).click();
    const step = page.locator(".website-order-step");
    const address = step.getByRole("textbox", { name: "Adresse de livraison", exact: true });
    const guest = step.getByRole("button", { name: "Commander sans compte", exact: true });
    if (offered) {
      await expect(step.getByRole("heading", { name: "Livraison", exact: true })).toBeVisible();
      await expect(address).toHaveCount(0);
      const signIn = step.getByRole("button", { name: "Me connecter", exact: true });
      await expect(signIn).toBeEnabled();
      await expect(signIn).toHaveAccessibleDescription(/^Retrouvez votre adresse/);
      const benefit = await step.getByText(/^Retrouvez votre adresse/).boundingBox();
      expect((await signIn.boundingBox())!.y).toBeLessThan(benefit!.y);
      expect((await guest.boundingBox())!.y).toBeGreaterThan(benefit!.y + benefit!.height);
      await guest.click();
    } else {
      await expect(guest).toHaveCount(0);
    }
    await expect(step.getByRole("heading", { name: "Adresse de livraison", exact: true })).toBeVisible();
    await address.fill("12 Demo Street, Test City");
    const signIn = step.getByRole("button", { name: "Se connecter", exact: true });
    await signIn.click();
    const accountDialog = page.locator("dialog[open]").filter({ has: page.locator('input[type="email"]') });
    await expect(accountDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountDialog).toHaveCount(0);
    await expect(signIn).toBeFocused();
    await expect(address).toHaveValue("12 Demo Street, Test City");
    await step.locator("button[type=submit]").click();
    await expect(page).toHaveURL(/service=delivery/);
    await expect(page.locator(".website-order-menu")).toBeVisible();
  });
}

test("signing in on the dedicated delivery step restores the saved address", async ({ page }) => {
  const account = { id: 70008, name: "Demo customer", email: "demo@example.invalid" };
  await page.route("**/api/customer-auth/session", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/customer-auth/email/login", route => route.fulfill({ json: { account } }));
  await page.route("**/api/customer-api/me/checkout-profile?*", route => route.fulfill({ json: {
    profile: { address: "12 Demo Street", city: "Test City" },
    address_selection: { id: "saved", address: "12 Demo Street", city: "Test City", token: "synthetic-saved-proof", kind: "address" },
  } }));
  await page.goto("/r/49009/order?lang=fr");
  await page.locator(".website-order-entry").getByRole("button", { name: "Livraison", exact: true }).click();
  const step = page.locator(".website-order-step");
  await step.getByRole("button", { name: "Me connecter", exact: true }).click();
  const accountDialog = page.locator("dialog[open]").filter({ has: page.locator('input[type="email"]') });
  await accountDialog.locator('input[type="email"]').fill(account.email);
  await accountDialog.locator('input[type="password"]').fill("synthetic-test-password");
  await accountDialog.locator("button[type=submit]").click();
  await expect(accountDialog).toHaveCount(0);
  await expect(step.locator(".website-entry-saved-address")).toContainText("12 Demo Street");
  await expect(step.getByRole("button", { name: "Commander sans compte", exact: true })).toHaveCount(0);
  await step.getByRole("button", { name: "Utiliser cette adresse", exact: true }).click();
  await expect(page).toHaveURL(/service=delivery/);
});

for (const [id, offered] of [[49009, true], [49011, false]] as const) {
  test(`the dedicated pickup step respects the sign-in invitation (${offered ? "on" : "off"})`, async ({ page }) => {
    await page.route("**/api/customer-auth/session", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/${id}/order?lang=fr`);
    await page.locator(".website-order-entry").getByRole("button", { name: "Retrait", exact: true }).click();
    const step = page.locator(".website-order-step");
    const guest = step.getByRole("button", { name: "Commander sans compte", exact: true });
    const confirm = step.getByRole("button", { name: "Confirmer le retrait", exact: true });
    const signIn = step.getByRole("button", { name: "Se connecter", exact: true });
    if (offered) {
      await expect(confirm).toHaveCount(0);
      await step.getByRole("button", { name: "Me connecter", exact: true }).click();
      const account = page.locator("dialog[open]").filter({ has: page.locator('input[type="email"]') });
      await expect(account).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(account).toHaveCount(0);
      await guest.click();
    } else {
      await expect(guest).toHaveCount(0);
    }
    await expect(signIn).toBeEnabled();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page).toHaveURL(/service=pickup/);
  });
}

for (const [format, service, id, width] of [
  ["dedicated", "Retrait", 49009, 390],
  ["dedicated", "Livraison", 49011, 1280],
  ["classic", "Retrait", 49007, 1280],
  ["classic", "Livraison", 49008, 320],
] as const) {
  test(`a signed-in customer can order as a guest (${format}, ${service})`, async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await context.addCookies([{ name: "foody_customer_session", value: "synthetic-entry-session", url: baseURL!, httpOnly: true }]);
    await page.goto(`/r/${id}/order?lang=fr`);
    const surface = page.locator(format === "dedicated" ? ".website-order-step" : ".website-entry-dialog[open]");
    if (format === "dedicated") {
      await page.locator(".website-order-entry").getByRole("button", { name: service, exact: true }).click();
    } else {
      await surface.getByRole("tab", { name: service, exact: true }).click();
    }
    const signedIn = surface.locator(".website-entry-profile");
    await expect(signedIn).toHaveText("Connecté Client Démo");
    const signOut = surface.getByRole("button", { name: "Se déconnecter et commander sans compte", exact: true });
    const savedAddress = surface.locator(".website-entry-saved-address");
    if (service === "Livraison") await expect(savedAddress).toContainText("12 Saved Street");
    await expect(signOut).toBeInViewport();
    await surface.screenshot({ path: testInfo.outputPath("signed-in.png") });

    if (format === "classic" && service === "Livraison") {
      const logout = "**/api/customer-auth/logout";
      await page.route(logout, route => route.fulfill({ status: 503 }), { times: 1 });
      await signOut.click();
      await expect(surface.getByRole("alert")).toContainText("Réessayez");
      await expect(signedIn).toBeVisible();
      await expect(savedAddress).toBeVisible();
      await expect(signOut).toBeEnabled();
    }

    await signOut.click();
    await expect(signedIn).toHaveCount(0);
    await expect(surface.getByRole("button", { name: "Commander sans compte", exact: true })).toHaveCount(0);
    if (service === "Retrait") {
      await expect(surface.getByRole("button", { name: "Confirmer le retrait" })).toBeEnabled();
    } else {
      await expect(savedAddress).toHaveCount(0);
      const address = surface.getByRole("textbox", { name: "Adresse de livraison", exact: true });
      await expect(address).toBeEditable();
      await expect(address).toHaveValue("");
    }
    const session = await page.request.get("/api/customer-auth/session");
    expect(session.status()).toBe(401);
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
    const login = dialog.locator('.customer-entry-sign-in');
    await expect(login).toHaveAccessibleDescription(/\S/);
    const benefit = await dialog.locator('.website-entry-login > p').boundingBox();
    await expect(guest).toBeVisible(); await expect(guest).toBeEnabled();
    expect((await login.boundingBox())!.y).toBeLessThan(benefit!.y);
    expect((await guest.boundingBox())!.y).toBeGreaterThan(benefit!.y + benefit!.height);
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


test("the chooser shares the configured navigation and applies its page appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto("/r/49010/order?lang=fr");
  const chooser = page.locator(".website-order-entry");
  const header = page.locator('.website-header[data-template="order"]');
  await expect(header).toHaveCSS("background-color", "rgb(176, 203, 187)");
  await expect(chooser.getByRole("heading")).toHaveCSS("font-family", /Georgia/);
  await expect(chooser.getByRole("heading")).toHaveCSS("font-weight", "600");
  await expect(chooser.getByRole("heading")).toHaveCSS("font-size", "67.584px");
  await expect(page.locator(".website-order-start-content")).toHaveCSS("background-color", "rgb(252, 240, 220)");
  const pickup = chooser.getByRole("button", { name: "Retrait" });
  await expect(pickup).toHaveCSS("background-color", "rgb(143, 65, 43)");

  const openDrawer = async () => {
    await header.locator(".website-header-menu").click();
    const drawer = page.locator(".website-header-menu-dialog[open]");
    await expect(drawer).toBeVisible();
    expect((await drawer.boundingBox())?.x).toBe(0);
    const contact = drawer.getByRole("link", { name: "Contacter le café" });
    await expect(contact).toHaveAttribute("href", "mailto:demo@example.com");
    await expect(contact).toHaveCSS("font-weight", "800");
    await expect(contact).toHaveCSS("color", "rgb(101, 68, 50)");
    await expect(drawer.getByRole("link", { name: "Commander" })).toBeVisible();
    await expect(drawer.getByText(/Changer de langue/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  };
  await openDrawer();
  await pickup.click();
  const step = page.locator(".website-order-step");
  await expect(step).toBeVisible();
  await openDrawer();
  await step.getByRole("button", { name: "Commander sans compte", exact: true }).click();
  await step.getByRole("button", { name: "Confirmer le retrait" }).click();
  await expect(page.locator(".website-order-menu")).toBeVisible();
  await openDrawer();
});


for (const [locale, pickup, guest, confirm] of [
  ["fr", "Retrait", "Commander sans compte", "Confirmer le retrait"],
  ["he", "איסוף", "להזמין ללא חשבון", "אישור האיסוף"],
]) {
  test(`the mobile carousel keeps filled cards readable with a full group (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto(`/r/49010/order?lang=${locale}`);
    await page.locator(".website-order-entry").getByRole("button", { name: pickup }).click();
    const step = page.locator(".website-order-step");
    await step.getByRole("button", { name: guest, exact: true }).click();
    await step.getByRole("button", { name: confirm }).click();
    const rail = page.locator('.website-order-items[data-mobile-layout="carousel"]').first();
    const cards = rail.locator(".website-order-item");
    await expect(cards).toHaveCount(5);

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const header = page.locator(".website-header[data-mobile-catalogue]");
      await expect(header.getByRole("heading", { name: locale === "fr" ? "À emporter" : "איסוף עצמי" })).toBeVisible();
      const back = await header.locator(".website-catalogue-mobile-heading button").boundingBox();
      const menu = await header.locator(".website-header-menu").boundingBox();
      expect(locale === "fr" ? back!.x < menu!.x : back!.x > menu!.x).toBe(true);
      await expect(cards.first()).toHaveCSS("flex-direction", "column-reverse");
      const dimensions = await rail.evaluate(element => ({
        visible: element.clientWidth,
        scrollable: element.scrollWidth,
        page: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.scrollable).toBeGreaterThan(dimensions.visible);
      expect(dimensions.page).toBe(dimensions.viewport);
      expect((await cards.first().boundingBox())?.width).toBeGreaterThanOrEqual(128);
      expect((await cards.first().locator(".website-order-item-media").boundingBox())?.width).toBeGreaterThan(75);
      expect((await cards.first().locator(".website-order-item-copy").boundingBox())?.width).toBeGreaterThan(75);
    }

    await page.setViewportSize({ width: 1280, height: 844 });
    const first = await cards.first().boundingBox();
    const third = await cards.nth(2).boundingBox();
    const fourth = await cards.nth(3).boundingBox();
    expect(first?.y).toBe(third?.y);
    expect(fourth?.y).toBeGreaterThan(first?.y ?? Infinity);
  });
}
