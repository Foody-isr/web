import { test, expect, type Page, type Locator } from "@playwright/test";

// Desktop browser automation cannot open an OS keyboard. Keep the layout viewport
// intact while reproducing Safari's visual-viewport resize and pan events.
async function keyboardViewport(page: Page, height: number, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    Object.assign(window.visualViewport!, { height, offsetTop });
    window.visualViewport!.dispatchEvent(new Event("resize"));
    window.visualViewport!.dispatchEvent(new Event("scroll"));
  }, { height, offsetTop });
}

async function continueAsGuest(dialog: Locator) {
  await expect(dialog).not.toHaveAttribute("aria-busy", "true");
  const guest = dialog.locator(".website-entry-guest");
  if (await guest.isVisible()) await guest.click();
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
  await continueAsGuest(dialog);
    const input = dialog.getByRole("combobox");
    const fieldBefore = await input.boundingBox();
    const dialogBefore = await dialog.boundingBox();
    await input.fill("Demo");
    if (isMobile) await keyboardViewport(page, 360, 42);
    await expect(dialog.getByRole("option")).toHaveCount(8);
    if (isMobile) {
      await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(360);
      await expect.poll(async () => (await dialog.boundingBox())!.y).toBe(42);
      await expect(dialog.locator(".website-view-menu")).toBeHidden();
      await expect(dialog.locator(".website-fulfillment-close")).toBeInViewport();
      await expect(dialog.locator(".website-entry-back")).toBeInViewport();
      await expect(dialog.getByRole("tablist")).toBeInViewport();
      await expect(dialog.getByRole("link", { name: "Google Maps" })).toBeVisible();
      const field = await input.boundingBox();
      expect(field!.y - 42).toBeCloseTo(fieldBefore!.y - dialogBefore!.y, 0);
      const results = await dialog.getByRole("listbox").boundingBox();
      for (let i = 0; i < 4; i++) {
        const option = await dialog.getByRole("option").nth(i).boundingBox();
        expect(option!.height).toBe(44);
        expect(option!.y).toBeGreaterThanOrEqual(results!.y);
        expect(option!.y + option!.height).toBeLessThanOrEqual(results!.y + results!.height - 1);
      }
      expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
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
    await expect(dialog.locator(".website-entry-back")).toBeVisible();
    await expect(dialog.getByRole("tablist")).toBeVisible();
    if (isMobile) expect((await input.boundingBox())!.y).toBeCloseTo(fieldBefore!.y, 0);
    await dialog.screenshot({ path: testInfo.outputPath(`delivery-${locale}.png`) });
    await dialog.locator(".website-view-menu").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
}

for (const authenticated of [false, true]) {
test(`four long suggestions fit on a narrow phone (${authenticated ? "signed in" : "guest"})`, async ({ page, isMobile }) => {
  if (authenticated) {
    await page.route("**/api/customer-auth/session", route => route.fulfill({ json: { account: { id: 70001, name: "Synthetic Customer With A Long Name", email: "test@example.invalid" } } }));
    await page.route("**/api/customer-api/me/checkout-profile?*", route => route.fulfill({ json: { profile: { address: "" }, address_selection: null } }));
  }
  if (isMobile) await page.setViewportSize({ width: 320, height: 568 });
  const address = "A very long street and building name that exceeds the phone width";
  const city = "A long district name, metropolitan city and country";
  await page.route("**/api/v1/public/address-autocomplete?*", route => route.fulfill({ json: { suggestions:
    Array.from({ length: 6 }, (_, i) => ({ id: String(i), address: `${i + 1} ${address}`, city, kind: "prediction", lookup_token: `lookup-${i}` })),
  } }));
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  await dialog.getByRole("combobox").fill("Long");
  if (isMobile) await keyboardViewport(page, 360);
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(6);
  await expect(options.first()).toHaveAccessibleName(`1 ${address} ${city}`);
  if (isMobile) {
    const list = await dialog.getByRole("listbox").boundingBox();
    const fourth = await options.nth(3).boundingBox();
    expect(fourth!.y + fourth!.height).toBeLessThanOrEqual(list!.y + list!.height - 1);
    expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
  }
});
}

test("street refinement retains focus and keyboard navigation scrolls to the active address", async ({ page, isMobile }) => {
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  const input = dialog.getByRole("combobox");
  await input.fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await dialog.getByRole("option").first().click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Demo Street , Test City");
  await expect(dialog.locator(".website-view-menu")).toBeDisabled();
  await expect(dialog.getByRole("option")).toHaveCount(8);
  // Keep Playwright's mouse away from rows scrolling underneath it while
  // exercising keyboard navigation, including touch-device emulation.
  await page.mouse.move(0, 0);
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

test("address contours stay rounded and the results panel follows its content", async ({ page, isMobile }, testInfo) => {
  await page.route("**/api/v1/public/address-autocomplete?*", route => route.fulfill({ json: { suggestions:
    Array.from({ length: 5 }, (_, i) => ({ id: String(i), address: `${i + 1} Demo Street`, city: "Test City", token: `synthetic-${i}`, kind: "address" })),
  } }));
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  const input = dialog.getByRole("combobox");
  await input.fill("Demo");
  const list = dialog.getByRole("listbox");
  await expect(dialog.getByRole("option")).toHaveCount(5);
  await expect(list).toHaveCSS("border-radius", "8px");
  await expect(input).toHaveCSS("border-radius", "8px");
  // The focus indicator stays inside the scroll container instead of losing
  // its top and side edges at the body's clipping boundary.
  expect(await input.evaluate(node => getComputedStyle(node).boxShadow)).toContain("inset");
  if (isMobile) {
    const initialInput = (await input.boundingBox())!;
    const initialList = (await list.boundingBox())!;
    const last = (await dialog.getByRole("option").last().boundingBox())!;
    expect(initialList.y + initialList.height).toBeCloseTo(last.y + last.height + 1, 0);
    expect(initialList.x).toBe(initialInput.x);
    expect(initialList.width).toBe(initialInput.width);
    await dialog.screenshot({ path: testInfo.outputPath("address-contours-keyboard-closed.png") });
    await keyboardViewport(page, 360);
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(360);
    const compactList = (await list.boundingBox())!;
    const fourth = (await dialog.getByRole("option").nth(3).boundingBox())!;
    expect(fourth.y + fourth.height).toBeLessThanOrEqual(compactList.y + compactList.height - 1);
    expect((await input.boundingBox())!.y).toBe(initialInput.y);
    await page.screenshot({ path: testInfo.outputPath("address-contours-keyboard-open.png"), clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 360 } });
    await input.blur();
    await keyboardViewport(page, page.viewportSize()!.height);
    await expect.poll(async () => (await list.boundingBox())!.height).toBe(initialList.height);
  }
});

test("a suggestion can be chosen after dismissing the keyboard", async ({ page, isMobile }) => {
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
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
  await continueAsGuest(dialog);
  await dialog.getByRole("combobox").fill("Demo");
  if (isMobile) await keyboardViewport(page, 320);
  await dialog.getByRole("tab").first().click();
  await expect(dialog.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  if (isMobile) await keyboardViewport(page, page.viewportSize()!.height);
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  await expect(dialog.getByRole("combobox")).toHaveValue("Demo");
  await dialog.locator(".website-entry-back").click();
  await dialog.locator(".customer-entry-sign-in").click();
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
  await continueAsGuest(dialog);
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
  await continueAsGuest(dialog);
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
  await continueAsGuest(dialog);
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
  await continueAsGuest(dialog);
  await expect(dialog.locator(".website-view-menu")).toBeEnabled();
  await expect(dialog.locator(".website-fulfillment-close")).toBeInViewport();
  await expect(dialog.locator(".website-view-menu")).toBeInViewport();
  const overflowing = await dialog.evaluate(node => node.scrollWidth > node.clientWidth);
  expect(overflowing).toBe(false);
  await dialog.locator(".website-fulfillment-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

for (const [locale, signIn, guest] of [
  ["fr", "Me connecter", "Continuer en tant qu’invité"],
  ["en", "Sign in", "Continue as a guest"],
  ["he", "התחברות", "להמשיך כאורח"],
]) {
  test(`text account choices reveal the guest flow without shifting on keyboard use (${locale})`, async ({ page, isMobile }, testInfo) => {
    await page.goto(`/r/49005/order?lang=${locale}`);
    const dialog = page.locator(".website-entry-dialog[open]");
    const choices = dialog.locator(".website-entry-choice");
    await expect(choices.getByRole("button", { name: signIn, exact: true })).toBeVisible();
    await expect(choices.getByRole("button", { name: new RegExp(guest) })).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await expect(dialog.locator(".website-view-menu")).toHaveCount(0);
    await expect(choices.locator(".customer-entry-sign-in")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await dialog.screenshot({ path: testInfo.outputPath(`choice-pickup-${locale}.png`) });
    await dialog.getByRole("tab").nth(1).click();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await dialog.screenshot({ path: testInfo.outputPath(`choice-delivery-${locale}.png`) });
    await continueAsGuest(dialog);
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await expect(choices).toHaveCount(0);
    const before = (await input.boundingBox())!;
    await dialog.screenshot({ path: testInfo.outputPath(`guest-delivery-${locale}.png`) });
    await input.fill("Demo");
    await expect(dialog.getByRole("option")).toHaveCount(8);
    if (isMobile) {
      await keyboardViewport(page, 360);
      await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(360);
      const panel = (await dialog.getByRole("listbox").boundingBox())!;
      const fourth = (await dialog.getByRole("option").nth(3).boundingBox())!;
      expect(fourth.y + fourth.height).toBeLessThanOrEqual(panel.y + panel.height - 1);
      expect((await input.boundingBox())!.y).toBe(before.y);
      await page.screenshot({ path: testInfo.outputPath(`guest-keyboard-${locale}.png`), clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 360 } });
      await input.blur();
      await keyboardViewport(page, page.viewportSize()!.height);
      await expect.poll(async () => (await input.boundingBox())!.y).toBe(before.y);
    }
    await dialog.locator(".website-entry-back").click();
    await expect(choices).toBeVisible();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await continueAsGuest(dialog);
    await expect(input).toHaveValue("Demo");
    await dialog.getByRole("tab").first().click();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await dialog.screenshot({ path: testInfo.outputPath(`guest-pickup-${locale}.png`) });
    expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
  });
}

test("closing sign-in returns to the choices and the guest decision persists", async ({ page }) => {
  await page.goto("/r/49005/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.locator(".customer-entry-sign-in").click();
  const auth = page.locator("dialog[open]:not(.website-entry-dialog)");
  await expect(auth).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(auth).toHaveCount(0);
  await expect(dialog.locator(".website-entry-choice")).toBeVisible();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await continueAsGuest(dialog);
  await expect(dialog.locator(".website-pickup-summary")).toBeVisible();
  await dialog.locator(".website-view-menu").click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".website-fulfillment-bar button").first().click();
  await expect(dialog.locator(".website-pickup-summary")).toBeVisible();
  await expect(dialog.locator(".website-entry-choice")).toHaveCount(0);
  await dialog.getByRole("tab").nth(1).click();
  await expect(dialog.getByRole("combobox")).toBeVisible();
});

test("a returning delivery customer can use or edit their validated saved address", async ({ page }, testInfo) => {
  await page.route("**/api/customer-auth/session", route => route.fulfill({ json: { account: { id: 70002, name: "Client Démo", email: "preview@example.invalid" } } }));
  await page.route("**/api/customer-api/me/checkout-profile?*", route => route.fulfill({ json: {
    profile: { address: "12 Demo Street", city: "Test City" },
    address_selection: { id: "saved", address: "12 Demo Street", city: "Test City", token: "synthetic-saved-proof", kind: "address" },
  } }));
  await page.goto("/r/49005/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await expect(dialog.locator(".website-entry-profile")).toContainText("Client Démo");
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(dialog.locator(".website-entry-saved-address")).toHaveCount(0);
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  const summary = dialog.locator(".website-entry-saved-address");
  await expect(summary).toContainText("12 Demo Street");
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Utiliser cette adresse", exact: true })).toBeEnabled();
  await dialog.screenshot({ path: testInfo.outputPath("invitation-saved-delivery.png") });
  await dialog.getByRole("button", { name: "Utiliser cette adresse", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".website-fulfillment-bar button").first().click();
  await expect(summary).toBeVisible();
  await summary.getByRole("button", { name: "Modifier", exact: true }).click();
  await expect(dialog.getByRole("combobox")).toHaveValue("12 Demo Street, Test City");
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("combobox").fill("Another");
  await expect(summary).toHaveCount(0);
  await dialog.getByRole("tab").first().click();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog.locator(".website-view-menu").click();
  await expect(dialog).toHaveCount(0);
});

test("a saved address without a valid selection still requires the address editor", async ({ page }) => {
  await page.route("**/api/customer-auth/session", route => route.fulfill({ json: { account: { id: 70003, name: "New customer", email: "new@example.invalid" } } }));
  await page.route("**/api/customer-api/me/checkout-profile?*", route => route.fulfill({ json: { profile: { address: "Incomplete street" }, address_selection: null } }));
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  await expect(dialog.getByRole("combobox")).toHaveValue("Incomplete street");
  await expect(dialog.locator(".website-entry-saved-address")).toHaveCount(0);
  await expect(dialog.locator(".website-view-menu")).toBeDisabled();
});

test("signing in retains the delivery draft and offers saved details only when appropriate", async ({ page }) => {
  await page.route("**/api/customer-auth/email/login", route => route.fulfill({ json: { account: { id: 70004, name: "Client Démo", email: "preview@example.invalid" } } }));
  await page.route("**/api/customer-api/me/checkout-profile?*", route => route.fulfill({ json: {
    profile: { address: "12 Saved Street" }, address_selection: { id: "saved", address: "12 Saved Street", city: "Test City", token: "synthetic-saved-proof", kind: "address" },
  } }));
  await page.goto("/r/49003/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await dialog.getByRole("tab").nth(1).click();
  await continueAsGuest(dialog);
  await dialog.getByRole("combobox").fill("My new delivery draft");
  await dialog.locator(".website-entry-back").click();
  await dialog.locator(".customer-entry-sign-in").click();
  const auth = page.locator("dialog[open]:not(.website-entry-dialog)");
  await auth.locator('input[type="email"]').fill("preview@example.invalid");
  await auth.locator('input[type="password"]').fill("synthetic-password-for-tests");
  await auth.locator('button[type="submit"]').click();
  await expect(auth).toHaveCount(0);
  await expect(dialog.locator(".website-entry-profile")).toContainText("Client Démo");
  await expect(dialog.getByRole("combobox")).toHaveValue("My new delivery draft");
  await expect(dialog.locator(".website-entry-saved-address")).toHaveCount(0);
});

test("single-service delivery retains a visible heading and four suggestions", async ({ page, isMobile }) => {
  await page.goto("/r/49006/order?lang=fr");
  const dialog = page.locator(".website-entry-dialog[open]");
  await expect(dialog.getByRole("tablist")).toHaveCount(0);
  await expect(dialog.locator("h2")).toBeInViewport();
  await expect(dialog.locator(".website-entry-guest")).toBeInViewport();
  await continueAsGuest(dialog);
  const input = dialog.getByRole("combobox");
  await expect(input).toBeVisible();
  await input.fill("Demo");
  await expect(dialog.getByRole("option")).toHaveCount(8);
  if (isMobile) {
    await keyboardViewport(page, 360);
    await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(360);
    const panel = (await dialog.getByRole("listbox").boundingBox())!;
    const fourth = (await dialog.getByRole("option").nth(3).boundingBox())!;
    expect(fourth.y + fourth.height).toBeLessThanOrEqual(panel.y + panel.height - 1);
  }
  await dialog.locator(".website-fulfillment-close").click();
  await expect(dialog).toHaveCount(0);
});
