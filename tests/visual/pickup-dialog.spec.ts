import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);
test.use({serviceWorkers:"block"});

const item = {id:"1", name:"Demo sandwich", price:12, groupId:"1", available:true};

// All API requests, including confirmation effects, remain in this synthetic fixture.
async function mockPickup(page: Page, options: {batch?:boolean; fail?:boolean; empty?:boolean; chain?:boolean} = {}) {
  const batchRequests: string[] = [];
  await page.addInitScript(item => localStorage.setItem("foody-cart", JSON.stringify({version:1, state:{restaurantId:"9001", currency:"ILS", lines:[{id:"demo-line",item,quantity:1}]}})), item);
  await page.route("**/api/customer-auth/**", route => route.fulfill({status:401,json:{}}));
  await page.route("**/api/customer-api/**", route => route.fulfill({status:401,json:{}}));
  await page.route("**/api/v1/public/**", route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/restaurants/9001")) return route.fulfill({json:{restaurant:{
      id:9001, name:"Demo bakery", slug:"demo-bakery", address:"31 Main Street", currency:"ILS", timezone:"Asia/Jerusalem",
      pickup_enabled:true, delivery_enabled:true, dine_in_enabled:false, batch_fulfillment_enabled:!!options.batch,
      preorders_only:!!options.batch, scheduling_enabled:false,
      ...(options.chain ? {chain_slug:"demo-chain", chain_branch_count:3} : {}),
      website_config:{checkout_config:{lock_order_type:false}},
    }}});
    if (path.endsWith("/batch-fulfillment-config")) {
      batchRequests.push(url.searchParams.get("order_type") || "");
      return route.fulfill(options.fail ? {status:503, json:{error:"Unavailable"}} : {json:{
        enabled:true, ordering_open:true, current_batch_open_at:"2030-10-01T12:00:00+03:00", current_batch_cutoff:"2030-10-10T18:00:00+03:00",
        fulfillment_days:options.empty ? [] : [{date:"2030-10-11", day_name:"Friday", pickup_window:{start:"10:00",end:"12:00"}, delivery_window:{start:"08:00",end:"15:00"}}],
        next_fulfillment_days:[], upcoming_cycles:[], require_prepayment:false, immediate_available:false,
      }});
    }
    if (path.endsWith("/address-autocomplete/config")) return route.fulfill({json:{available:false,enabled:false}});
    if (path.endsWith("/website-pages")) return route.fulfill({json:{pages:[]}});
    if (path.endsWith("/menu")) return route.fulfill({json:{currency:"ILS", menus:[{id:1,name:"Menu",groups:[{id:1,name:"Sandwiches",items:[{...item,id:1,group_id:1}]}]}]}});
    if (path.endsWith("/delivery/check")) return route.fulfill({json:{resolved:true,deliverable:true,delivery_fee:0}});
    return route.fulfill({json:{}});
  });
  return batchRequests;
}

for (const [locale, width, title, confirm] of [
  ["en",1280,"Pickup at the restaurant","Confirm pickup"],
  ["fr",375,"Retrait sur place","Confirmer le retrait"],
  ["he",320,"איסוף עצמי מהמסעדה","אישור האיסוף"],
] as const) {
  test(`single-location pickup · ${locale} · ${width}`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:900});
    await mockPickup(page);
    await page.goto(`/order/cart?restaurantId=9001&orderType=pickup&lang=${locale}`);
    await page.locator("button.commerce-fulfillment-row:visible").first().click();
    const modal = page.locator(".website-fulfillment-dialog[open]");
    await expect(modal.getByRole("heading", {name:title,exact:true})).toBeVisible();
    await expect(modal.locator("input")).toHaveCount(0);
    await expect(modal.locator('input[type="radio"]')).toHaveCount(0);
    await expect(modal).toContainText("Demo bakery");
    await expect(modal).toContainText("31 Main Street");
    await expect(modal.getByRole("link")).toHaveAttribute("href", "https://maps.google.com/?q=31%20Main%20Street");
    await expect(modal.getByRole("button", {name:confirm,exact:true})).toBeEnabled();
    expect(await modal.evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
    await modal.screenshot({path:testInfo.outputPath("pickup-summary.png")});
    await modal.getByRole("button", {name:confirm,exact:true}).click();
    await expect(modal).toHaveCount(0);
    await page.locator("button.commerce-fulfillment-row:visible").first().click();
    await modal.getByRole("tab").nth(1).click();
    await expect(modal.locator(".website-pickup-summary")).toHaveCount(0);
    await expect(modal.locator("input").first()).toBeVisible();
    await modal.getByRole("tab").first().click();
    await expect(modal.locator("input")).toHaveCount(0);
  });
}

test("pickup calendars use their own windows, handle errors, and retain the chain selector", async ({page}) => {
  const requests = await mockPickup(page, {batch:true,chain:true});
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup&lang=fr");
  await page.locator("button.commerce-fulfillment-row:visible").first().click();
  const modal = page.locator(".website-fulfillment-dialog[open]");
  await expect(modal.locator(".website-pickup-timing")).toContainText("10:00 – 12:00");
  await expect(modal.locator(".website-pickup-timing")).not.toContainText("08:00");
  expect(requests).toContain("pickup");
  await expect(modal.locator(".website-pickup-change-branch")).toHaveAttribute("href", "/c/demo-chain/order?type=pickup&lang=fr");
  await page.route("**/batch-fulfillment-config?order_type=pickup", route => route.fulfill({status:503,json:{error:"Unavailable"}}));
  await page.reload();
  await page.locator("button.commerce-fulfillment-row:visible").first().click();
  await expect(modal.getByRole("alert")).toContainText("Impossible de charger les créneaux", {timeout:15_000});
  await page.route("**/batch-fulfillment-config?order_type=pickup", route => route.fulfill({json:{enabled:true,ordering_open:true,fulfillment_days:[]}}));
  await modal.getByRole("button", {name:"Réessayer",exact:true}).click();
  await expect(modal.locator(".website-pickup-timing")).toContainText("Aucun créneau de retrait");
  await expect(modal.locator(".website-pickup-timing")).not.toContainText("Dès que possible");
});
