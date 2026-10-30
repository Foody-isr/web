import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { normalizeSiteColors } from "../../lib/siteColors";

let api: Server;
const photo = "/assets/placeholder-item-lg.svg";
const burger = { portion: "6 parts", description: "Synthetic product description. ".repeat(12), id: 2, name: "Classic burger", price: 38, is_active: true, image_url: photo,
  option_sets: [{ id: 1, name: "Size", options: [{ id: 21, name: "Small", price: 38, is_active: true }, { id: 22, name: "Large", price: 42, is_active: true }] }] };
const chicken = { id: 3, name: "Chicken burger", price: 40, is_active: true, image_url: photo };
const soldOut = { id: 4, name: "Pinned sold out", price: 40, is_active: true, image_url: photo };
const fries = { id: 5, name: "Fries", price: 12, is_active: true, image_url: photo };
const wedges = { id: 6, name: "Wedges", price: 14, is_active: true, image_url: photo };
const stepItem = (item: typeof fries, id: number, state?: string) => ({ id, menu_item_id: item.id, price_delta: 0, menu_item: { ...item, availability_state: state } });
const combo = { id: 1, name: "Demo combo", price: 60, image_url: photo, is_active: true, item_type: "combo",
  combo_steps: [
    { id: 101, name: "Main", min_picks: 1, max_picks: 1, items: [stepItem(burger, 11), stepItem(chicken, 12), stepItem(soldOut, 13, "sold_out")] },
    { id: 102, name: "Side", min_picks: 1, max_picks: 1, items: [stepItem(fries, 14), stepItem(wedges, 15)] },
  ] };
const fixed = { ...combo, id: 10, name: "Fixed combo", combo_steps: [{ id: 103, name: "Included", min_picks: 1, max_picks: 1, items: [stepItem(fries, 16)] }] };
const customPalette = { mode: "light", bg: "#ffdfa8", ink: "#301900", accent: "#301900", surface: "#ffdfa8", color_styles: { ...normalizeSiteColors({}), styles: normalizeSiteColors({}).styles.map(style => ({ ...style,
  ...(style.id === "style-1" ? { background: "#ffdfa8", title: "#301900", paragraph: "#503820", button_background: "#301900", button_text: "#ffdfa8",
    menu: { background: "#ffdfa8", heading: "#301900", bar_background: "#301900", category_text: "#ffdfa8", card_background: "#ffdfa8", card_title: "#301900", card_price: "#301900" },
    item_detail: { background: "#ffdfa8", title: "#301900", price: "#301900", button_background: "#301900", button_text: "#ffdfa8", selection_accent: "#301900" } } : {}),
  ...(style.id === "style-2" ? { item_detail: { background: "#002244", title: "#ffffff", description: "#ddeeff", price: "#ffcc00", button_background: "#ffcc00", button_text: "#002244", selection_accent: "#ffcc00" } } : {}),
})) } };
const orderPage = { id: 1, restaurant_id: 9001, slug: "order", title: "Menu", type: "order", sort_order: 0,
  nav_visible: true, is_default: true, is_homepage: true, seo: {}, sections: [], settings: { menu_ids: [1] },
  appearance_overrides: { foody_renderer_version: 1, theme_id: "custom", custom_palette: customPalette,
    website_order: { layout: "rows", color_style: "style-1", card_border: "line", item_radius: "rounded", item_width: "compact", item_aspect_ratio: "16/9", item_image_fit: "contain", show_fulfillment: false, prompt_on_entry: false } },
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const bluePage = { ...orderPage, id: 2, slug: "blue", is_default: false, is_homepage: false,
  appearance_overrides: { ...orderPage.appearance_overrides, website_order: { ...orderPage.appearance_overrides.website_order, item_color_style: "style-2" } } };
const gridPage = { ...orderPage, id: 3, slug: "grid", is_default: false, is_homepage: false,
  appearance_overrides: { ...orderPage.appearance_overrides, website_order: { ...orderPage.appearance_overrides.website_order, layout: "grid", columns: 3, card_radius: "rounded" } } };

test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json"); response.setHeader("Access-Control-Allow-Origin", "*");
    const path = new URL(request.url!, "http://localhost").pathname;
    let body: unknown = {};
    if (/\/restaurants\/(9001|synthetic)$/.test(path)) body = { restaurant: { id: 9001, slug: "synthetic", name: "Demo restaurant", default_locale: "fr", currency: "ILS", timezone: "Asia/Jerusalem", pickup_enabled: true,
      website_config: { theme_id: "custom", custom_palette: customPalette, checkout_config: { lock_order_type: true, offer_sign_in: false } } } };
    else if (path.endsWith("/website-pages")) body = { pages: [orderPage, bluePage, gridPage] };
    else if (path.endsWith("/website-pages/blue")) body = { page: bluePage };
    else if (path.endsWith("/website-pages/grid")) body = { page: gridPage };
    else if (path.includes("/website-pages/")) body = { page: orderPage };
    else if (path.endsWith("/menu")) body = { currency: "ILS", menus: [{ id: 1, name: "Menu", groups: [
      { id: 1, name: "Combos", items: [combo, fixed] }, { id: 2, name: "Burgers", items: [burger, chicken, soldOut] }, { id: 3, name: "Sides", items: [fries, wedges] },
    ] }] };
    else if (path.includes("customer")) response.statusCode = 401;
    response.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve => api.listen(43241, "127.0.0.1", resolve));
});
test.afterAll(async () => { api.closeAllConnections(); await new Promise<void>(resolve => api.close(() => resolve())); });

async function open(page: Page, path = "order", locale = "fr") {
  await page.addInitScript(() => { localStorage.setItem("foody-locale", "fr"); });
  await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/customer-api/**", route => route.fulfill({ status: 401, json: {} }));
  await page.goto(`/r/synthetic/${path}?type=pickup&lang=${locale}`);
  await expect(page.locator(".website-order-menu")).toBeVisible();
  // An attribute on the actual node detects an accidental unmount/remount.
  await page.locator(".website-order-menu").evaluate(node => node.setAttribute("data-preserved", "yes"));
}
const menuButton = (page: Page, name: string) => page.locator(".website-order-menu").getByRole("button", { name, exact: true });

for (const scenario of [{ width: 1280, locale: "fr", path: "order", background: "rgb(255, 223, 168)", action: "rgb(48, 25, 0)" },
  { width: 390, locale: "he", path: "blue", background: "rgb(0, 34, 68)", action: "rgb(255, 204, 0)" }]) {
  test(`combo keeps the published menu and item appearance · ${scenario.width} · ${scenario.locale}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await open(page, scenario.path, scenario.locale);
    const menu = page.locator(".website-order-menu");
    const before = await menuButton(page, "Classic burger").boundingBox();
    await menuButton(page, "Demo combo").click();
    const detail = page.getByRole("dialog", { name: "Demo combo", exact: true });
    await expect(detail).toHaveCSS("background-color", scenario.background);
    await expect(detail.locator("[data-item-part=add]")).toHaveCSS("background-color", scenario.action);
    await page.screenshot({ path: `test-results/combo-theme/details-${scenario.width}-${test.info().project.name}.png` });
    await detail.locator("[data-item-part=add]").click();
    const progress = page.locator("[data-combo-progress]");
    await expect(progress).toBeVisible();
    await expect(menu).toHaveAttribute("data-preserved", "yes");
    await expect(menu).toHaveAttribute("data-layout", "rows");
    await expect(progress.locator("[data-website-item]")).toHaveCSS("background-color", scenario.background);
    await expect(progress.locator(".text-brand").first()).toHaveCSS("color", scenario.action);
    await expect(menuButton(page, "Fries")).toBeDisabled();
    await expect(menuButton(page, "Pinned sold out")).toBeDisabled();
    const during = await menuButton(page, "Classic burger").boundingBox();
    expect(during!.width).toBeCloseTo(before!.width, 0);
    await menuButton(page, "Classic burger").click();
    const variant = page.getByRole("dialog", { name: "Classic burger", exact: true });
    await expect(variant).toHaveCSS("background-color", scenario.background);
    await variant.getByRole("button", { name: /Small/ }).click();
    await expect(menuButton(page, "Fries")).toBeEnabled();
    // Go back, decrement a pick and choose another main in the same catalogue.
    await progress.getByRole("button").first().click();
    await expect(menuButton(page, "Classic burger")).toHaveAttribute("aria-pressed", "true");
    await menu.locator(".website-order-combo-count button").click();
    await expect(menuButton(page, "Classic burger")).toHaveAttribute("aria-pressed", "false");
    await menuButton(page, "Chicken burger").click();
    await expect(menuButton(page, "Fries")).toBeEnabled();
    await progress.getByRole("button", { name: scenario.locale === "he" ? "הצג פרטים" : "Voir détails", exact: true }).click();
    await expect(detail).toHaveCSS("background-color", scenario.background);
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await menuButton(page, "Fries").click();
    await expect(progress.locator("[data-item-part=add]")).toHaveCSS("background-color", scenario.action);
    await expect(progress.locator("[data-item-part=add]")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `test-results/combo-theme/composed-${scenario.width}-${test.info().project.name}.png` });
    await progress.locator("[data-item-part=add]").click();
    await expect(progress).toHaveCount(0);
    await expect(menu).toHaveAttribute("data-preserved", "yes");
    const line = await page.evaluate(() => JSON.parse(localStorage.getItem("foody-cart")!).state.lines[0]);
    expect(line.comboId).toBe(1);
    expect(line.comboSelections.map((selection: { menuItemId: number }) => selection.menuItemId)).toEqual([3, 5]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("cancelling preserves the menu; fixed combo quantities still reach the cart", async ({ page }) => {
  await open(page);
  await menuButton(page, "Demo combo").click();
  await page.getByRole("dialog").locator("[data-item-part=add]").click();
  await page.locator("[data-combo-progress]").getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator("[data-combo-progress]")).toHaveCount(0);
  await expect(page.locator(".website-order-menu")).toHaveAttribute("data-preserved", "yes");
  await menuButton(page, "Fixed combo").click();
  const detail = page.getByRole("dialog", { name: "Fixed combo" });
  await detail.getByRole("button", { name: "Augmenter la quantité" }).click();
  await detail.locator("[data-item-part=add]").click();
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem("foody-cart")!).state.lines);
  expect(lines).toHaveLength(1);
  expect(lines[0].comboId).toBe(10);
  expect(lines[0].comboOrderBatch).toHaveLength(2);
  expect(lines[0].item.price).toBe(120);
  expect(lines[0].comboSelections[0].quantity).toBe(2);
});

test("mobile grid keeps its layout while composing two combos in English", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await open(page, "grid", "en");
  const menu = page.locator(".website-order-menu");
  await menuButton(page, "Demo combo").click();
  const detail = page.getByRole("dialog", { name: "Demo combo" });
  await detail.getByRole("button", { name: "Increase quantity" }).click();
  await detail.locator("[data-item-part=add]").click();
  await expect(menu).toHaveAttribute("data-layout", "grid");
  await menuButton(page, "Chicken burger").click();
  await menuButton(page, "Chicken burger").click();
  await expect(menuButton(page, "Fries")).toBeEnabled();
  await menuButton(page, "Fries").click();
  await menuButton(page, "Fries").click();
  const add = page.locator("[data-combo-progress] [data-item-part=add]");
  await expect(add).toContainText("120.00");
  await add.click();
  await expect(menu).toHaveAttribute("data-preserved", "yes");
  const line = await page.evaluate(() => JSON.parse(localStorage.getItem("foody-cart")!).state.lines[0]);
  expect(line.comboOrderBatch).toHaveLength(2);
  expect(line.comboSelections.map((selection: { quantity: number }) => selection.quantity)).toEqual([2, 2]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


for (const scenario of [{width: 1280, path: "order", locale: "fr", bg: "rgb(255, 223, 168)"},
  {width: 320, path: "blue", locale: "he", bg: "rgb(0, 34, 68)"},
  {width: 390, path: "order", locale: "en", bg: "rgb(255, 223, 168)"}]) {
  test(`item purchase controls stay together through scrolling · ${scenario.width} · ${scenario.locale}`, async ({page}) => {
    await page.setViewportSize({width: scenario.width, height: 740});
    const runtimeErrors: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    await open(page, scenario.path, scenario.locale);
    // Keep Next's development badge from covering the mobile purchase controls.
    await page.addStyleTag({content: "nextjs-portal { display: none; }"});
    const trigger = menuButton(page, "Classic burger");
    await trigger.focus();
    await trigger.press("Enter");
    const detail = page.getByRole("dialog", {name: "Classic burger", exact: true});
    await expect(detail).toHaveCSS("background-color", scenario.bg);
    await expect(detail.locator(".website-item-toolbar")).toHaveCount(0);
    const image = detail.locator("[data-item-part=image]");
    await expect(image).toHaveCSS("aspect-ratio", "16 / 9");
    await expect(image.locator("img")).toHaveCSS("object-fit", "contain");
    const footer = detail.locator("[data-item-part=footer]");
    const quantity = footer.getByRole("spinbutton");
    const add = footer.locator("[data-item-part=add]");
    await expect(quantity).toHaveValue("1");
    await expect(footer.locator("button").first()).toBeDisabled();
    await quantity.click(); // Playwright waits for the opening animation to settle.
    const initialFooter = await footer.boundingBox();
    await detail.locator("[data-item-scroll]").evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect(add).toBeInViewport();
    expect((await footer.boundingBox())!.y).toBeCloseTo(initialFooter!.y, 0);
    await quantity.fill("2");
    await expect(add).toContainText("76.00");
    await detail.locator("[data-item-scroll]").evaluate(node => { node.scrollTop = 0; });
    await detail.locator("label").filter({hasText: /Large/}).click();
    await expect(add).toContainText("84.00");
    await expect(detail.locator("[data-item-part=portion]")).toHaveText("Large");
    await page.screenshot({path: `test-results/combo-theme/item-${scenario.width}-${scenario.locale}-${test.info().project.name}.png`});
    expect(await detail.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await add.click();
    const line = await page.evaluate(() => JSON.parse(localStorage.getItem("foody-cart")!).state.lines[0]);
    expect(line.quantity).toBe(2);
    expect(line.selectedVariantId).toBe(22);
    expect(line.selectedVariantPrice).toBe(42);
    await expect(trigger).toBeFocused();
    expect(runtimeErrors).toEqual([]);
  });
}
