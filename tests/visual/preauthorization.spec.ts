import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

// The build for this spec uses NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:43217.
// Both SSR and browser requests stay on this synthetic local API.
let api: Server;
let paymentStatus = "authorized";
let paymentPosts = 0;

test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "content-type,x-receipt-token");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") { response.statusCode = 204; response.end(); return; }
    const path = new URL(request.url!, "http://127.0.0.1:43217").pathname;
    if (request.method === "POST" && path.includes("/payment/")) paymentPosts++;
    const total = paymentStatus === "authorized" ? 20 : 17;
    if (path === "/api/v1/public/restaurants/synthetic" || path === "/api/v1/public/restaurants/17") {
      response.end(JSON.stringify({ restaurant: { id: 17, slug: "synthetic", name: "Test restaurant", currency: "ILS", website_config: { theme_id: "minimal-light" } } }));
    } else if (path === "/api/v1/public/orders/99") {
      response.end(JSON.stringify({ order: { id: 99, order_type: "pickup", payment_method: "verifone", payment_status: paymentStatus, status: "accepted", total_amount: total, currency: "ILS", receipt_token: "synthetic", items: [{ id: 1, menu_item_id: 546, name: "Synthetic cheese", quantity: 1, price: total }] } }));
    } else if (path === "/api/v1/public/receipts/synthetic") {
      response.end(JSON.stringify({ order: { id: 99, receipt_token: "synthetic", customer_name: "Test customer", customer_phone: "", order_type: "pickup", order_source: "website", order_status: "accepted", payment_status: paymentStatus, total_amount: total, created_at: "2026-10-14T09:00:00Z" }, restaurant: { id: 17, name: "Test restaurant", address: "", phone: "" }, items: [{ id: 1, name: "Synthetic cheese", quantity: 1, unit_price: total, total }] }));
    } else if (path.endsWith("/website-pages")) {
      response.end(JSON.stringify({ pages: [] }));
    } else if (path === "/api/v1/public/menu") {
      response.end(JSON.stringify({ currency: "ILS", menus: [], categories: [], items: [] }));
    } else {
      response.statusCode = 404;
      response.end("{}");
    }
  });
  await new Promise<void>((resolve) => api.listen(43217, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});

for (const locale of ["fr", "he"] as const) {
  test(`saved-card authorization stays distinct from payment · ${locale}`, async ({ page }, testInfo) => {
    paymentStatus = "authorized";
    paymentPosts = 0;
    await page.addInitScript(locale => localStorage.setItem("foody-locale", locale), locale);
    await page.setViewportSize({ width: locale === "he" ? 320 : 390, height: 900 });
    await page.goto("/r/synthetic/payment/success?orderId=99&t=synthetic");
    await expect(page).toHaveURL(/\/order\/confirmation\/99\?/);
    const authorized = locale === "fr" ? "Empreinte bancaire autorisée" : "מסגרת אשראי שמורה";
    await expect(page.getByText(authorized, { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: authorized })).toContainText(locale === "fr" ? "poids réel" : "המשקל בפועל");
    if (locale === "fr") await expect(page.getByText("Total estimé de la commande", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("authorization-confirmation.png"), fullPage: true });
    await page.goto("/order/tracking/99?restaurantId=17&t=synthetic");
    await expect(page.getByText(authorized, { exact: true })).toBeVisible();
    await page.goto("/receipt/synthetic");
    await expect(page.getByText(authorized, { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(locale === "fr" ? "poids réel" : "המשקל בפועל");
    paymentStatus = "paid";
    await page.goto("/order/confirmation/99?restaurantId=17&t=synthetic");
    await expect(page.getByText(authorized, { exact: true })).toHaveCount(0);
    await expect(page.getByText("₪17.00", { exact: true }).first()).toBeVisible();
    expect(paymentPosts).toBe(0);
  });
}
