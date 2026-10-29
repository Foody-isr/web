import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);
test.use({serviceWorkers:"block"});

const item = {id:"1", name:"Demo sandwich", price:12, groupId:"1", available:true};

// All API requests, including confirmation effects, remain in this synthetic fixture.
async function mockPickup(page: Page, options: {batch?:boolean; fail?:boolean; empty?:boolean; chain?:boolean; slots?:boolean; currency?:string} = {}) {
  const batchRequests: string[] = [];
  await page.addInitScript(({item,currency}) => localStorage.setItem("foody-cart", JSON.stringify({version:1, state:{restaurantId:"9001", currency, lines:[{id:"demo-line",item,quantity:1}]}})), {item,currency:options.currency ?? "ILS"});
  await page.route("**/api/customer-auth/**", route => route.fulfill({status:401,json:{}}));
  await page.route(url => url.pathname.startsWith("/api/v1/public/") || url.pathname.startsWith("/api/customer-api/"), route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/customer-api/, "/api/v1/public");
    if (path.endsWith("/restaurants/9001")) return route.fulfill({json:{restaurant:{
      id:9001, name:"Demo bakery", slug:"demo-bakery", address:"31 Main Street", currency:options.currency ?? "ILS", timezone:"Asia/Jerusalem",
      pickup_enabled:true, delivery_enabled:true, dine_in_enabled:false, batch_fulfillment_enabled:!!options.batch,
      preorders_only:!!options.batch || !!options.slots, scheduling_enabled:!!options.slots, scheduling_max_days_ahead:7,
      ...(options.chain ? {chain_slug:"demo-chain", chain_branch_count:3} : {}),
      website_config:{checkout_config:{lock_order_type:false,offer_sign_in:false}},
    }}});
    if (path.endsWith("/scheduling-config")) return route.fulfill({json:{enabled:true, immediate_available:false, lead_time_minutes:360, slot_duration_minutes:30, slots_by_date:{"2030-10-11":[{start:"15:00",end:"15:30"},{start:"16:00",end:"16:30"}],"2030-10-12":[{start:"15:00",end:"15:30"}]}}});
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
    if (path.endsWith("/menu")) return route.fulfill({json:{currency:options.currency ?? "ILS", menus:[{id:1,name:"Menu",groups:[{id:1,name:"Sandwiches",items:[{...item,id:1,group_id:1}]}]}]}});
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
    await expect(modal.locator('p').filter({hasText:"31 Main Street"})).toHaveAttribute("dir", "auto");
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
  await expect(modal.locator(".website-pickup-timing bdi")).toHaveAttribute("dir", "ltr");
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


test("strict slot pickup selects date and time in the location modal and retains them", async ({page}, info) => {
  await mockPickup(page, {slots:true});
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup&lang=fr");
  await page.locator("button.commerce-fulfillment-row:visible").first().click();
  const modal = page.locator(".website-fulfillment-dialog[open]");
  await expect(modal.getByRole("combobox",{name:"Date",exact:true})).toBeVisible();
  await modal.getByRole("combobox",{name:"Date",exact:true}).selectOption("2030-10-12");
  await expect(modal.getByRole("combobox",{name:"Heure",exact:true})).toHaveValue("15:00");
  await modal.getByRole("button",{name:"Confirmer le retrait",exact:true}).click();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/scheduledFor=2030-10-12/);
  await page.locator("button.commerce-fulfillment-row:visible").first().click();
  await expect(modal.getByRole("combobox",{name:"Date",exact:true})).toHaveValue("2030-10-12");
  await modal.screenshot({path:info.outputPath("pickup-with-calendar-fr.png")});
});

test("delivery without slots blocks confirmation and explains the missing availability", async ({page}) => {
  await mockPickup(page, {slots:true});
  await page.route("**/scheduling-config?**", route => {
    const delivery = new URL(route.request().url()).searchParams.get("order_type") === "delivery";
    return route.fulfill({json:{enabled:true,immediate_available:false,slots_by_date:delivery ? {} : {"2030-10-11":[{start:"15:00",end:"15:30"}]}}});
  });
  await page.goto("/order/cart?restaurantId=9001&orderType=pickup&lang=fr");
  await page.locator("button.commerce-fulfillment-row:visible").first().click();
  const modal = page.locator(".website-fulfillment-dialog[open]");
  await modal.getByRole("tab",{name:"Livraison",exact:true}).click();
  await modal.locator('input[autocomplete="street-address"]').fill("31 Main Street");
  await expect(modal).toContainText("Aucun créneau");
  await expect(modal.locator('button[type="submit"]')).toBeDisabled();
  await modal.getByRole("tab",{name:"Retrait",exact:true}).click();
  await expect(modal.getByRole("combobox",{name:"Heure",exact:true})).toHaveValue("15:00");
  await expect(modal.locator('button[type="submit"]')).toBeEnabled();
});

for(const mode of ['customer','automatic','restaurant'] as const) test(`delivery zone calendar storefront and checkout ${mode}`,async({page},info)=>{
 await mockPickup(page,{currency:"EUR"});await page.setViewportSize({width:mode==='restaurant'?375:1280,height:1000});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/delivery/check?**',route=>route.fulfill({json:{deliverable:true,resolved:true,delivery_fee:mode==='automatic'?0:10,offer_pickup:true,schedule:{delivery_mode:mode,require_prepayment:false,lead_time_minutes:0,slots_by_date:{'2030-10-11':[{start:'14:00',end:'15:00'},{start:'15:00',end:'16:00'}],'2030-10-14':[{start:'14:00',end:'15:00'},{start:'15:00',end:'16:00'}]}}}}));
 await page.goto('/order/cart?restaurantId=9001&orderType=delivery&lang=fr');
 await page.locator('button.commerce-fulfillment-row:visible').first().click();const modal=page.locator('.website-fulfillment-dialog[open]');
 await modal.getByRole('textbox').fill('Synthetic address in Val-de-Marne');
 const promise=modal.getByRole('region',{name:'Livraison à votre adresse',exact:true});await expect(promise).toBeVisible();await expect(promise).toContainText('Frais de livraison');await expect(promise.locator('bdi')).toHaveText(mode==='automatic'?'€0.00':'€10.00');await expect(promise).toHaveClass(/website-schedule-options/);
 if(mode==='customer'){await expect(promise.getByRole('combobox',{name:'Date',exact:true})).toBeVisible();await promise.getByRole('combobox',{name:'Date',exact:true}).selectOption('2030-10-14');}
 else {await expect(promise.getByRole('combobox')).toHaveCount(0);await expect(promise).toContainText(mode==='restaurant'?'Horaire à confirmer':'14:00–15:00');}
 await expect(promise.getByRole('button',{name:'Choisir le retrait à la place',exact:true})).toBeVisible();
 await modal.screenshot({path:info.outputPath(`delivery-dialog-${mode}.png`)});
 await modal.locator('.website-view-menu').click();await expect(modal).toHaveCount(0);
 await page.getByRole('dialog',{name:'Votre panier',exact:true}).locator('.commerce-cart-action button').click();await expect(page).toHaveURL(/order\/checkout/, {timeout:30000});
 const checkout=page.getByRole('region',{name:'Livraison à votre adresse',exact:true});await expect(checkout).toBeVisible();
 if(mode==='customer')await expect(checkout.getByRole('combobox',{name:'Date',exact:true})).toHaveValue('2030-10-14');
 else {await expect(checkout.getByRole('combobox')).toHaveCount(0);await expect(checkout).toContainText(mode==='restaurant'?'Horaire à confirmer':'14:00–15:00');}
 await page.screenshot({path:info.outputPath(`delivery-checkout-${mode}.png`),fullPage:true});expect(errors).toEqual([]);
});


test('pickup and delivery share scheduling controls and required heading',async({page},info)=>{
 await mockPickup(page,{slots:true,currency:'EUR'});
 await page.route('**/delivery/check?**',route=>route.fulfill({json:{deliverable:true,resolved:true,delivery_fee:10,schedule:{delivery_mode:'customer',require_prepayment:false,lead_time_minutes:180,slots_by_date:{'2030-10-11':[{start:'15:00',end:'15:30'}]}}}}));
 await page.goto('/order/cart?restaurantId=9001&orderType=pickup&lang=fr');
 await page.locator('button.commerce-fulfillment-row:visible').first().click();
 const modal=page.locator('.website-fulfillment-dialog[open]');
 await expect(modal.locator('.website-schedule-title')).toHaveText('Choisir un horaire');
 await expect(modal.locator('.website-schedule-options input[type=radio]')).toHaveCount(0);
 await expect(modal.getByRole('combobox',{name:'Date',exact:true})).toBeVisible();
 await expect(modal.getByRole('combobox',{name:'Heure',exact:true})).toHaveValue('15:00');
 await modal.screenshot({path:info.outputPath('pickup-scheduling.png')});
 await modal.getByRole('tab',{name:'Livraison',exact:true}).click();
 await modal.locator('input[autocomplete="street-address"]').fill('Synthetic delivery address');
 const panel=modal.getByRole('region',{name:'Livraison à votre adresse',exact:true});
 await expect(panel.locator('.website-schedule-title')).toHaveText('Choisir un horaire');
 await expect(panel.getByRole('combobox',{name:'Date',exact:true})).toBeVisible();
 await expect(panel.getByRole('combobox',{name:'Heure',exact:true})).toHaveValue('15:00');
 await expect(panel.locator('bdi')).toHaveText('€10.00');
 await modal.screenshot({path:info.outputPath('delivery-scheduling.png')});
});
