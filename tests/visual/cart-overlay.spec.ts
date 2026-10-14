import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";

let api: Server;
let unavailable = false;
const item = { id: "1", name: "Demo sandwich", price: 12, groupId: "1", available: true };
const sourcePage = {
  id: 1, restaurant_id: 9001, slug: "order", title: "Menu", type: "order",
  sort_order: 0, nav_visible: true, is_default: true, is_homepage: true,
  seo: {}, sections: [], settings: { menu_ids: [1] },
  appearance_overrides: { foody_renderer_version: 1, website_order: { layout: "rows", show_search: true, show_fulfillment: false, prompt_on_entry: false } },
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    const path = new URL(request.url!, "http://127.0.0.1:43219").pathname;
    let body: unknown = {};
    if (/\/restaurants\/(9001|synthetic)$/.test(path)) body = { restaurant: {
      id: 9001, slug: "synthetic", name: "Demo bakery", address: "31 Main Street",
      currency: "ILS", timezone: "Asia/Jerusalem", pickup_enabled: true, delivery_enabled: true,
      website_config: { theme_id: "minimal-light", nav_layout: { header: { icons: { cart: true, search: false } } }, checkout_config: { lock_order_type: true } },
    } };
    else if (path.endsWith("/website-pages")) body = { pages: [sourcePage] };
    else if (path.includes("/website-pages/")) body = { page: sourcePage };
    else if (path.endsWith("/menu")) body = { currency: "ILS", menus: [{ id: 1, name: "Menu", groups: [
      { id: 1, name: "Sandwiches", items: Array.from({ length: 24 }, (_, index) => ({ id: index + 1, name: `Demo sandwich ${index + 1}`, price: 12, group_id: 1, is_active: true, availability_state: unavailable ? "sold_out" : "in_stock", buildable_count: unavailable ? 0 : 50 })) },
    ] }] };
    else if (path.endsWith("/address-autocomplete/config")) body = { enabled: false, available: false };
    else if (path.endsWith("/delivery/check")) body = { deliverable: true, resolved: true, delivery_fee: 0 };
    else if (path.includes("customer")) { response.statusCode = 401; }
    response.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve => api.listen(43219, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});

async function openMenu(page: Page, locale: string) {
  unavailable = false;
  await page.addInitScript(({ item, locale }) => {
    localStorage.setItem("foody-locale", locale);
    localStorage.setItem("foody-cart", JSON.stringify({ version: 1, state: { restaurantId: "9001", currency: "ILS", lines: [{ id: "demo-line", item, quantity: 2 }] } }));
  }, { item, locale });
  await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/customer-api/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto("/r/synthetic/order?type=pickup");
  await expect(page.locator(".website-order-menu")).toBeVisible();
  await expect(page.locator(".website-cart-dock button")).toBeVisible();
}

for (const [locale, width] of [["en", 1280], ["fr", 390], ["he", 320]] as const) {
  test(`cart preserves menu, scroll and history · ${locale} · ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openMenu(page, locale);
    const search = page.locator(".website-order-menu input[type=search]");
    await search.fill("sandwich 1");
    await expect(page.locator(".website-order-item")).toHaveCount(11);
    await page.evaluate(() => {
      document.querySelector(".website-order-menu")!.setAttribute("data-preserved", "yes");
      window.scrollTo({ top: 600, behavior: "instant" });
    });
    const originalScroll = await page.evaluate(() => scrollY);
    const originalTheme = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-page"));
    // The fixed menu cart action is reachable without scrolling back to the header.
    const trigger = page.locator(".website-cart-dock button:visible");
    await trigger.click();
    await expect(page).toHaveURL(/\/order\/cart\?/, { timeout: 30_000 });
    expect(errors).toEqual([]);
    const cart = page.locator("dialog.commerce-cart-overlay[open]");
    await expect(cart).toBeVisible();
    await expect(page).toHaveURL(/\/order\/cart\?/);
    await expect(page.locator(".website-order-menu")).toHaveAttribute("data-preserved", "yes");
    await expect(cart.locator(".commerce-item")).toHaveCount(1);
    expect(await page.evaluate(() => scrollY)).toBe(originalScroll);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-page"))).toBe(originalTheme);
    expect(await cart.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await cart.screenshot({ path: info.outputPath("cart-overlay.png") });
    await cart.locator(".commerce-quantity").last().click();
    await expect(cart.locator(".commerce-item")).toContainText("3");
    await cart.locator(".commerce-header a").first().click();
    await expect(cart).toHaveCount(0);
    await expect(page.locator(".website-order-menu")).toHaveAttribute("data-preserved", "yes");
    await expect(search).toHaveValue("sandwich 1");
    expect(await page.evaluate(() => scrollY)).toBe(originalScroll);
    await expect(trigger).toBeFocused();
    await page.goForward();
    await expect(cart).toBeVisible();
    await page.goBack();
    await expect(cart).toHaveCount(0);
    await trigger.click();
    await expect(cart).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cart).toHaveCount(0);
    await expect(search).toHaveValue("sandwich 1");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    expect(errors).toEqual([]);
  });
}

test("cart reaches checkout, and direct visits and reloads render the standalone page", async ({ page }) => {
  await openMenu(page, "en");
  await page.locator("[data-commerce-cart]").click();
  const cart = page.locator("dialog.commerce-cart-overlay[open]");
  await expect(cart).toBeVisible();
  await cart.locator(".commerce-cart-action button").click();
  await expect(page).toHaveURL(/\/order\/checkout\?/);
  await expect(cart).toHaveCount(0);
  await expect(page.locator(".commerce-checkout-columns")).toBeVisible();
  await page.goBack();
  await expect(cart).toBeVisible();
  await page.reload();
  await expect(page.locator(".commerce-title")).toHaveText("Your cart");
  await expect(cart).toHaveCount(0);
  await expect(page.locator(".website-order-menu")).toHaveCount(0);
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup");
  await expect(page.locator(".commerce-item")).toHaveCount(1);
  await expect(cart).toHaveCount(0);
});

test("availability changes still block checkout inside the overlay", async ({ page }) => {
  await openMenu(page, "en");
  unavailable = true;
  await page.locator("[data-commerce-cart]").click();
  const cart = page.locator("dialog.commerce-cart-overlay[open]");
  await expect(cart).toBeVisible();
  await expect(cart.locator(".commerce-cart-action button")).toBeDisabled();
  await expect(cart.getByRole("status").first()).toBeVisible();
});

test("item editing and nested dialogs keep the cart open, and backdrop dismissal restores the menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await openMenu(page, "en");
  await page.locator("[data-commerce-cart]").click();
  const cart = page.locator("dialog.commerce-cart-overlay[open]");
  await expect(cart).toBeVisible();
  await cart.getByRole("button", { name: "Edit · Demo sandwich", exact: true }).click();
  const editor = cart.locator(".website-item-dialog");
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(cart).toBeVisible();
  await cart.locator("button.commerce-fulfillment-row:visible").first().click();
  const fulfillment = cart.locator(".website-fulfillment-dialog[open]");
  await expect(fulfillment).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(fulfillment).toHaveCount(0);
  await expect(cart).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(cart).toHaveCount(0);
  await expect(page.locator(".website-order-menu")).toBeVisible();
});

test("editing an empty cart over checkout does not redirect behind the overlay", async ({ page }) => {
  await openMenu(page, "en");
  await page.locator("[data-commerce-cart]").click();
  let cart = page.locator("dialog.commerce-cart-overlay[open]");
  await expect(cart).toBeVisible();
  await cart.locator(".commerce-cart-action button").click();
  await expect(page).toHaveURL(/\/order\/checkout\?/);
  await page.locator('.commerce-header a[href^="/order/cart"]').click();
  cart = page.locator("dialog.commerce-cart-overlay[open]");
  await expect(cart).toBeVisible();
  await cart.locator(".commerce-remove").click();
  await expect(cart).toContainText("Your cart is empty");
  await expect(page).toHaveURL(/\/order\/cart\?/);
  await cart.locator(".commerce-header a").first().click();
  await expect(page).toHaveURL(/\/r\/9001|\/r\/synthetic/);
});
