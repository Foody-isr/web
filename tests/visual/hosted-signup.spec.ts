import { expect, test } from "@playwright/test";

for (const scenario of ["approved", "pending signup", "declined signup", "unknown charge"] as const) {
  test(`Omer HPP return requires explicit full-order payment · ${scenario}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("foody-locale", "en"));
    await page.route("**/api/customer-auth/**", (route) => route.fulfill({ status: 401, json: {} }));
    await page.route("**/api/v1/public/**", (route) => {
      if (new URL(route.request().url()).pathname.includes("/restaurants/")) {
        return route.fulfill({ json: { restaurant: { id: 17, slug: "synthetic", name: "Test restaurant", currency: "ILS" } } });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    let confirms = 0, charges = 0;
    await page.route("**/api/customer-api/**", (route) => route.fulfill({ status: 404, json: {} }));
    await page.route("**/api/customer-api/orders/42/payment/signup/confirm?restaurant_id=17", (route) => {
      confirms++;
      expect(route.request().method()).toBe("POST");
      return route.fulfill({ status: scenario === "pending signup" ? 202 : 200, json: scenario === "pending signup"
        ? { completed: false, ready: false }
        : scenario === "declined signup" ? { completed: false, ready: false, declined: true }
        : { completed: false, ready: true, payment_method_token_id: 7, amount_minor: 5900, currency_code: "ILS" } });
    });
    await page.route("**/api/customer-api/orders/42/payment/saved-method?restaurant_id=17", (route) => {
      charges++;
      expect(route.request().postDataJSON()).toEqual({ payment_method_token_id: 7, identity_card_number: "000000000" });
      return route.fulfill({ status: scenario === "unknown charge" ? 502 : 200, json: scenario === "unknown charge" ? { error: "pending" } : { completed: true } });
    });
    await page.goto("/r/synthetic/payment/signup?orderId=42&t=synthetic-receipt");
    if (scenario === "declined signup") {
      await expect(page.getByRole("heading", { name: "Card registration declined" })).toBeVisible();
      await expect(page.getByRole("status")).toContainText("Your order has not been paid");
      await expect(page.locator("#signup-identity")).toHaveCount(0);
      await page.getByRole("button", { name: "Check registration" }).click();
      await expect(page.getByRole("status")).toContainText("Your order has not been paid");
      await page.getByRole("button", { name: "Return to payment" }).click();
      await expect(page).toHaveURL(/\/r\/17\/payment\/failed\?orderId=42&t=synthetic-receipt/);
      expect(charges).toBe(0);
      return;
    }
    if (scenario === "pending signup") {
      await expect(page.getByRole("status")).toContainText("not confirmed yet");
      await expect(page.locator("#signup-identity")).toHaveCount(0);
      expect(charges).toBe(0);
      return;
    }
    const identity = page.locator("#signup-identity");
    await expect(identity).toBeVisible();
    await expect(identity).toHaveAttribute("type", "password");
    expect(confirms).toBeGreaterThan(0);
    expect(charges).toBe(0);
    const pay = page.getByRole("button", { name: /Pay .*59/ });
    await expect(pay).toBeDisabled();
    await identity.fill("123");
    await expect(pay).toBeDisabled();
    await identity.fill("000000000");
    await pay.click();
    if (scenario === "approved") {
      await expect(page).toHaveURL(/\/r\/17\/payment\/success\?orderId=42/);
    } else {
      await expect(page.getByRole("status")).toContainText("Do not submit another payment");
      await expect(identity).toHaveCount(0);
      await expect(pay).toHaveCount(0);
    }
    expect(charges).toBe(1);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain("000000000");
  });
}
