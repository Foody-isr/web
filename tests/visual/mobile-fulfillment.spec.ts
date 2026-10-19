import { test, expect, type Page } from "@playwright/test";

// Desktop browser automation cannot open an OS keyboard. Keep the layout viewport
// intact while reproducing Safari's visual-viewport resize and pan events.
async function keyboardViewport(page: Page, height: number, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    Object.assign(window.visualViewport!, { height, offsetTop });
    window.visualViewport!.dispatchEvent(new Event("resize"));
    window.visualViewport!.dispatchEvent(new Event("scroll"));
  }, { height, offsetTop });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let height: number | undefined;
    const viewport = Object.assign(new EventTarget(), { offsetTop: 0, scale: 1 });
    Object.defineProperty(viewport, "height", { get: () => height ?? window.innerHeight, set: value => { height = value; } });
    Object.defineProperty(window, "visualViewport", { value: viewport });
  });
  await page.route("**/api/customer-auth/**", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/v1/public/address-autocomplete/config?*", route => route.fulfill({ json: { available: true, enabled: true, provider: "google" } }));
  await page.route("**/api/v1/public/address-autocomplete?*", route => route.fulfill({ json: { suggestions: [
    { id: "street", address: "Demo Street", city: "Test City", street: "Demo Street", house_number: "", token: "", kind: "street" },
    ...Array.from({ length: 7 }, (_, i) => ({ id: String(i), address: `${i + 1} Demo Street`, city: "Test City", street: "Demo Street", house_number: String(i + 1), token: `synthetic-${i}`, kind: "address" })),
  ] } }));
  await page.route("**/api/v1/public/delivery/check?*", route => route.fulfill({ json: { resolved: true, deliverable: true, delivery_fee: 10 } }));
  await page.route("**/api/v1/public/restaurants/*/batch-fulfillment-config?*", route => route.fulfill({ json: {
    enabled: true, ordering_open: true,
    fulfillment_days: [{ date: "2030-10-11", day_name: "Friday", pickup_window: { start: "10:00", end: "12:00" }, delivery_window: { start: "08:00", end: "15:00" } }],
  } }));
});

for (const locale of ["fr", "he", "en"]) {
  test(`delivery suggestions and actions remain usable with the keyboard (${locale})`, async ({ page, isMobile }, testInfo) => {
    await page.goto(`/r/49003/order?lang=${locale}`);
    const dialog = page.locator(".website-entry-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".website-fulfillment-close")).toBeFocused();
    await dialog.getByRole("tab").nth(1).click();
    const input = dialog.getByRole("combobox");
    const fieldBefore = await input.boundingBox();
    const dialogBefore = await dialog.boundingBox();
    await input.fill("Demo");
    if (isMobile) await keyboardViewport(page, 360, 42);
    await expect(dialog.getByRole("option")).toHaveCount(8);
    if (isMobile) {
      await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(360);
      await expect.poll(async () => (await dialog.boundingBox())!.y).toBe(42);
      await expect(dialog.locator(".website-fulfillment-footer")).toBeInViewport();
      await expect(dialog.locator(".website-entry-account button")).toBeInViewport();
      await expect(dialog.getByRole("tablist")).toBeInViewport();
      await expect(dialog.getByRole("link", { name: "Google Maps" })).toBeVisible();
      const field = await input.boundingBox();
      expect(field!.y - 42).toBeCloseTo(fieldBefore!.y - dialogBefore!.y, 0);
      const first = await dialog.getByRole("option").first().boundingBox();
      const results = await dialog.getByRole("listbox").boundingBox();
      expect(first!.y + first!.height).toBeLessThanOrEqual(results!.y + results!.height);
      // Dismissing and reopening the keyboard must not switch layouts or move the field.
      await input.blur();
      await keyboardViewport(page, page.viewportSize()!.height);
      await expect.poll(async () => (await input.boundingBox())!.y).toBeCloseTo(fieldBefore!.y, 0);
      await expect(dialog.getByRole("listbox")).toBeVisible();
      await input.focus();
      await keyboardViewport(page, 360, 42);
      await expect.poll(async () => (await input.boundingBox())!.y - 42).toBeCloseTo(fieldBefore!.y - dialogBefore!.y, 0);
      await page.screenshot({ path: testInfo.outputPath(`keyboard-${locale}.png`), clip: { x: 0, y: 42, width: page.viewportSize()!.width, height: 360 } });
    }
    const last = dialog.getByRole("option").last();
    await last.scrollIntoViewIfNeeded();
    if (isMobile) await expect(input).toBeInViewport();
    await last.click();
    await expect(input).toHaveValue("7 Demo Street, Test City");
    await expect(input).not.toBeFocused();
    await expect(dialog.locator(".website-view-menu")).toBeEnabled();
    if (isMobile) await keyboardViewport(page, page.viewportSize()!.height);
    await expect(dialog.locator(".website-entry-account")).toBeVisible();
    await expect(dialog.getByRole("tablist")).toBeVisible();
    if (isMobile) expect((await input.boundingBox())!.y).toBeCloseTo(fieldBefore!.y, 0);
    await dialog.screenshot({ path: testInfo.outputPath(`delivery-${locale}.png`) });
    await dialog.locator(".website-view-menu").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
}

test("street refinement retains focus and keyboard navigation scrolls to the active address", async ({ page, isMobile }) => {
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  const input = dialog.getByRole("combobox");
  await input.fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await dialog.getByRole("option").first().click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Demo Street , Test City");
  await expect(dialog.locator(".website-view-menu")).toBeDisabled();
  await expect(dialog.getByRole("option")).toHaveCount(8);
  for (let i = 0; i < 8; i++) await input.press("ArrowDown");
  await expect(dialog.getByRole("option").last()).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => {
    const bounds = await dialog.getByRole("option").last().boundingBox();
    const body = await dialog.locator(".website-fulfillment-body").boundingBox();
    return bounds!.y + bounds!.height <= body!.y + body!.height + 1;
  }).toBe(true);
  await input.press("Enter");
  await expect(input).toHaveValue("7 Demo Street, Test City");
});

test("a suggestion can be chosen after dismissing the keyboard", async ({ page, isMobile }) => {
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  const input = dialog.getByRole("combobox");
  await input.fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await expect(dialog.getByRole("option")).toHaveCount(8);
  await input.blur();
  if (isMobile) await keyboardViewport(page, page.viewportSize()!.height);
  await dialog.getByRole("option").nth(1).click();
  await expect(input).toHaveValue("1 Demo Street, Test City");
  await expect(dialog.locator(".website-view-menu")).toBeEnabled();
});

test("switching service and signing in remain available while the keyboard is open", async ({ page, isMobile }) => {
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await dialog.getByRole("combobox").fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await dialog.getByRole("tab").first().click();
  await expect(dialog.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  if (isMobile) await keyboardViewport(page, page.viewportSize()!.height);
  await dialog.getByRole("tab").nth(1).click();
  await expect(dialog.getByRole("combobox")).toHaveValue("Demo");
  await dialog.locator(".website-entry-account button").click();
  await expect(page.locator("dialog[open]:not(.website-entry-dialog)")).toBeVisible();
});

test("resolving a street preserves input focus until a complete address is chosen", async ({ page, isMobile }) => {
  await page.route("**/api/v1/public/address-autocomplete?*", route => route.fulfill({ json: { suggestions: [
    { id: "prediction", address: "Demo Street", city: "Test City", kind: "prediction", lookup_token: "synthetic-lookup" },
  ] } }));
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let requests = 0;
  await page.route("**/api/v1/public/address-autocomplete/resolve?*", async route => {
    if (++requests === 1) {
      await pending;
      await route.fulfill({ json: { suggestion: { id: "street", kind: "street", street: "Demo Street", address: "Demo Street", city: "Test City" } } });
    } else {
      await route.fulfill({ json: { suggestion: { id: "address", kind: "address", street: "Demo Street", address: "Demo Street 10", city: "Test City", token: "synthetic-complete" } } });
    }
  });
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  const input = dialog.getByRole("combobox");
  await input.fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await dialog.getByRole("option").click();
  await expect(input).toHaveAttribute("aria-busy", "true");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  finish();
  await expect(input).toHaveValue("Demo Street , Test City");
  await expect(input).toBeFocused();
  await input.fill("Demo Street 10, Test City");
  await dialog.getByRole("option").click();
  await expect(input).toHaveValue("Demo Street 10, Test City");
  await expect(input).not.toBeFocused();
  await expect(dialog.locator(".website-view-menu")).toBeEnabled();
});

test("editing during address resolution discards its stale result", async ({ page }) => {
  await page.route("**/api/v1/public/address-autocomplete?*", route => route.fulfill({ json: { suggestions: [
    { id: "prediction", address: "Old Street", city: "Test City", kind: "prediction", lookup_token: "synthetic-lookup" },
  ] } }));
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/v1/public/address-autocomplete/resolve?*", async route => {
    await pending;
    await route.fulfill({ json: { suggestion: { id: "old", kind: "address", address: "Old Street 10", city: "Test City", token: "synthetic-old" } } });
  });
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  const input = dialog.getByRole("combobox");
  await input.fill("Old");
  await dialog.getByRole("option").click();
  await expect(input).toHaveAttribute("aria-busy", "true");
  await input.fill("New Street 20");
  finish();
  await expect(input).not.toHaveAttribute("aria-busy", "true");
  await expect(input).toHaveValue("New Street 20");
  await expect(dialog.locator(".website-view-menu")).toBeDisabled();
});

test("a late calendar cannot erase an address draft", async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route("**/api/v1/public/restaurants/49003/batch-fulfillment-config*", async route => {
    await pending;
    await route.fulfill({ json: { enabled: true, ordering_open: true, fulfillment_days: [
      { date: "2030-10-11", day_name: "Friday", pickup_window: { start: "10:00", end: "12:00" }, delivery_window: { start: "08:00", end: "15:00" } },
    ] } });
  });
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  const input = dialog.getByRole("combobox");
  await input.fill("Demo Street 10");
  await expect(dialog.getByRole("option")).toHaveCount(8);
  finish();
  await expect(page.getByText("Pré-commande · Vendredi 11 octobre", { exact: true })).toBeAttached();
  await expect(input).toHaveValue("Demo Street 10");
  await expect(input).toBeFocused();
});

test("pickup and closing remain reachable on a narrow screen", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await expect(dialog.locator(".website-view-menu")).toBeEnabled();
  await expect(dialog.locator(".website-fulfillment-close")).toBeInViewport();
  await expect(dialog.locator(".website-view-menu")).toBeInViewport();
  const overflowing = await dialog.evaluate(node => node.scrollWidth > node.clientWidth);
  expect(overflowing).toBe(false);
  await dialog.locator(".website-fulfillment-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
