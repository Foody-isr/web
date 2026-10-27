import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";
let api: Server;
const cover = "/assets/placeholder-item-lg.svg";
const pageData = {
  id: 1,
  restaurant_id: 9001,
  slug: "order",
  title: "Menu",
  type: "order",
  sort_order: 0,
  nav_visible: true,
  is_default: true,
  is_homepage: true,
  seo: {},
  sections: [],
  settings: { menu_ids: [1] },
  appearance_overrides: {
    foody_renderer_version: 1,
    website_order: {
      layout: "rows",
      show_fulfillment: false,
      prompt_on_entry: false,
    },
  },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    const path = new URL(request.url!, "http://localhost").pathname;
    let body: unknown = {};
    if (/\/restaurants\/(9001|synthetic)$/.test(path))
      body = {
        restaurant: {
          id: 9001,
          slug: "synthetic",
          name: "Demo restaurant",
          default_locale: "fr",
          currency: "ILS",
          timezone: "Asia/Jerusalem",
          pickup_enabled: true,
          website_config: {
            checkout_config: { lock_order_type: true, offer_sign_in: false },
          },
        },
      };
    else if (path.endsWith("/website-pages")) body = { pages: [pageData] };
    else if (path.includes("/website-pages/")) body = { page: pageData };
    else if (path.endsWith("/menu"))
      body = {
        currency: "ILS",
        menus: [
          {
            id: 1,
            name: "Menu",
            groups: [
              {
                id: 1,
                name: "Products",
                items: [
                  {
                    id: 1,
                    name: "Gallery product",
                    price: 12,
                    is_active: true,
                    image_url: cover,
                    image_urls: [cover + "?two", cover + "?three"],
                  },
                  {
                    id: 2,
                    name: "Legacy product",
                    price: 10,
                    is_active: true,
                    image_url: cover,
                  },
                  {
                    id: 3,
                    name: "No photo product",
                    price: 10,
                    is_active: true,
                  },
                ],
              },
            ],
          },
        ],
      };
    else if (path.includes("customer")) response.statusCode = 401;
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => api.listen(43245, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

for (const scenario of [
  { locale: "fr", width: 1280 },
  { locale: "he", width: 390 },
]) {
  test(`photos navigate, swipe and reset in ${scenario.locale}`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await page.addInitScript((locale) => {
      localStorage.setItem("foody-locale", locale);
    }, scenario.locale);
    await page.route("**/api/customer-auth/**", (route) =>
      route.fulfill({ status: 401, json: {} }),
    );
    await page.goto(`/r/synthetic/order?type=pickup&lang=${scenario.locale}`);
    const open = (name: string) =>
      page
        .locator(".website-order-menu")
        .getByRole("button", { name, exact: true })
        .click();
    await open("Gallery product");
    const modal = page.getByRole("dialog", {
      name: "Gallery product",
      exact: true,
    });
    const gallery = modal.getByRole("region");
    const dots = gallery.getByRole("button", {
      name: /^(Photo \d+ sur \d+|תמונה \d+ מתוך \d+)$/,
    });
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await dots.nth(2).click();
    await expect(gallery.getByRole("img")).toHaveAttribute("src", /three/);
    await gallery
      .getByRole("button", {
        name: scenario.locale === "fr" ? "Photo suivante" : "התמונה הבאה",
        exact: true,
      })
      .click();
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await gallery.focus();
    await page.keyboard.press(
      scenario.locale === "fr" ? "ArrowRight" : "ArrowLeft",
    );
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    const box = await gallery.boundingBox();
    expect(box!.height).toBeGreaterThan(100);
    const start =
      scenario.locale === "fr"
        ? box!.x + box!.width * 0.7
        : box!.x + box!.width * 0.3;
    const end = scenario.locale === "fr" ? start - 100 : start + 100;
    const y = box!.y + box!.height * 0.4;
    if (browserName === "chromium") {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: start, y }],
      });
      for (let step = 1; step <= 8; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start + ((end - start) * step) / 8, y }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      await page.mouse.move(start, y);
      await page.mouse.down();
      await page.mouse.move(end, y, { steps: 8 });
      await page.mouse.up();
    }
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
    await expect(modal).toBeVisible();
    await page.screenshot({
      path: `test-results/product-photos-${scenario.locale}.png`,
    });
    await page.keyboard.press("Escape");
    await open("Gallery product");
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Escape");
    await open("Legacy product");
    await expect(
      page
        .getByRole("dialog", { name: "Legacy product", exact: true })
        .getByRole("region")
        .getByRole("button"),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await open("No photo product");
    await expect(
      page
        .getByRole("dialog", { name: "No photo product", exact: true })
        .locator("[data-item-part=image]"),
    ).toHaveCount(0);
  });
}
