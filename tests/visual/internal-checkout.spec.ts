import { createServer, type Server } from 'node:http';
import { test, expect, type Page } from '@playwright/test';

let api: Server;
const palette = { mode: 'light', bg: '#f5eee1', ink: '#243b36', accent: '#2b6651', surface: '#fffaf1' };
const sourcePage = { id:1,restaurant_id:9001,slug:'order',title:'Menu',type:'order',sort_order:0,nav_visible:true,is_default:true,is_homepage:true,seo:{},sections:[],settings:{menu_ids:[1]},appearance_overrides:{foody_renderer_version:1,theme_id:'custom',custom_palette:palette},created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z' };
const fields = [
  {id:'customer_name',kind:'builtin',enabled:true,required:true,label:{fr:'Votre nom pour la commande'}},
  {id:'customer_phone',kind:'builtin',enabled:true,required:true},
  {id:'occasion',kind:'custom',type:'text',enabled:true,required:true,label:{fr:'Occasion'}},
];
const restaurant = {id:9001,slug:'demo',name:'Maison Démo',address:'31 rue Démo',currency:'ILS',country_code:'IL',timezone:'Asia/Jerusalem',pickup_enabled:true,delivery_enabled:true,otp_mode:'required',scheduling_enabled:true,batch_fulfillment_enabled:true,orders_paused:true,website_config:{theme_id:'custom',custom_palette:{...palette,bg:'#eeeeee',accent:'#990000'},checkout_config:{pickup:{fields,require_auth:true},delivery:{fields:[...fields,{id:'delivery_city',kind:'builtin',enabled:true,required:true},{id:'delivery_address',kind:'builtin',enabled:true,required:true}],require_auth:true}}}};
const basket = {paid:false,mode:'link',started:false,currency:'ILS',total:48,delivery_fee:10,discount_amount:2,order_type:'delivery',scheduled_for:'2026-11-06T00:00:00Z',window_start:'12:00',window_end:'14:00',items:[{id:1,menu_item_id:10,name:'Salade démo',quantity:2,price:20,modifiers:[{name:'Sans oignon'}]}]};
const savedCart = {version:1,state:{restaurantId:'31337',currency:'USD',tourId:999,tourSlug:'other-tour',lines:[{id:'personal-line',item:{id:'other',groupId:'other',name:'Panier personnel',price:999},quantity:1}]}};

test.beforeAll(async () => {
  api=createServer((request,response)=>{
    response.setHeader('Content-Type','application/json');response.setHeader('Access-Control-Allow-Origin','*');
    const path=new URL(request.url!,'http://127.0.0.1:18089').pathname;
    let result:unknown={};
    if (/\/restaurants\/9001$/.test(path)) result={restaurant};
    else if (path.endsWith('/website-pages')) result={pages:[sourcePage]};
    else if (path.includes('/website-pages/')) result={page:sourcePage};
    else if (path.endsWith('/address-autocomplete/config')) result={enabled:false,available:false};
    else if (path.endsWith('/delivery/cities')) result={cities:[]};
    else if (path.endsWith('/menu')) result={currency:'ILS',menus:[{id:1,name:'Menu',groups:[{id:1,name:'Salades',items:[{id:10,name:'Changed catalog price',price:900,group_id:1,is_active:true,availability_state:'sold_out',buildable_count:0}]}]}]};
    else if (path.includes('customer')) response.statusCode=401;
    response.end(JSON.stringify(result));
  });
  await new Promise<void>(resolve=>api.listen(18089,'127.0.0.1',resolve));
});
test.afterAll(async()=>{api.closeAllConnections();await new Promise<void>((resolve,reject)=>api.close(error=>error?reject(error):resolve()));});

async function install(page: Page, result:object=basket, status=200) {
  const submissions:Record<string,unknown>[]=[];const quotes:Record<string,unknown>[]=[];
  await page.addInitScript(cart=>{localStorage.setItem('foody-locale','fr');localStorage.setItem('foody-cart',JSON.stringify(cart));},savedCart);
  await page.route('**/api/customer-auth/**',route=>route.fulfill({status:401,json:{}}));
  await page.route('**/api/customer-api/**',route=>new URL(route.request().url()).pathname.endsWith('/restaurants/9001')?route.continue():route.fulfill({status:401,json:{}}));
  await page.route('**/api/v1/public/orders/99/internal-checkout**',route=>{
    expect(route.request().headers()['x-receipt-token']).toBe('synthetic-token');
    expect(route.request().headers()['referer']).toBeUndefined();
    if(new URL(route.request().url()).pathname.endsWith('/quote')){quotes.push(route.request().postDataJSON());return route.fulfill({json:{delivery_fee:15,discount_amount:2,total:53}});}
    if(route.request().method()==='POST'){submissions.push(route.request().postDataJSON());return route.fulfill({status:409,json:{error:'synthetic_pending'}});}
    return route.fulfill({status,json:result});
  });
  return {submissions,quotes};
}
const link='/r/9001/payment/checkout/99?t=synthetic-token';
async function openCheckout(page:Page){await page.goto(link);await expect(page).toHaveURL(/\/order\/cart\?/);await page.locator('.commerce-cart-action button').click();await expect(page).toHaveURL(/\/order\/checkout\?/);}
async function fillDetails(page:Page,delivery=true){await page.getByLabel('Votre nom pour la commande').fill('Client démo');await page.locator('input[type="tel"]').fill('502345678');await page.getByLabel('Occasion').fill('Déjeuner');if(delivery){await page.getByLabel('Ville').fill('Ville démo');await page.getByLabel('Adresse de livraison').fill('12 rue Démo');}}

test('private link uses the normal themed cart and keeps the personal basket intact',async({page},info)=>{
  await install(page);await page.goto('/order/cart?restaurantId=9001');
  await expect(page.locator('.commerce-surface')).toBeVisible();
  const theme=await page.locator('.commerce-surface').evaluate(node=>({bg:getComputedStyle(node).backgroundColor,font:getComputedStyle(node).fontFamily,brand:getComputedStyle(document.documentElement).getPropertyValue('--brand')}));
  await page.goto(link);await expect(page).toHaveURL(/\/order\/cart\?.*preparedOrderId=99/);
  await expect(page.locator('.commerce-items')).toContainText('Salade démo');
  await expect(page.locator('.commerce-header')).toContainText('Maison Démo');
  await expect(page.locator('.commerce-items')).not.toContainText('Panier personnel');
  await expect(page.getByRole('button',{name:/Supprimer|Augmenter|Diminuer/})).toHaveCount(0);
  expect(await page.locator('.commerce-surface').evaluate(node=>({bg:getComputedStyle(node).backgroundColor,font:getComputedStyle(node).fontFamily,brand:getComputedStyle(document.documentElement).getPropertyValue('--brand')}))).toEqual(theme);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('foody-cart')!))).toEqual(savedCart);
  await expect(page.locator('.commerce-fulfillment:visible')).toContainText('12:00 – 14:00');
  await page.screenshot({path:info.outputPath('existing-cart-prepared-order.png'),fullPage:true});
});

test('same checkout uses published contact fields and recalculated server total without creating another order',async({page},info)=>{
  const state=await install(page);let ordinaryCreates=0;
  await page.route('**/api/v1/public/orders',route=>{ordinaryCreates++;return route.abort();});
  await openCheckout(page);await expect(page.locator('.commerce-checkout-columns')).toBeVisible();
  await expect(page.locator('[data-checkout-sign-in]')).toHaveCount(0);await fillDetails(page);
  await page.getByRole('button',{name:/Calculer la livraison et le total/}).click();
  await expect(page.getByRole('status')).toContainText('Vérifiez le total mis à jour');
  await expect(page.locator('.commerce-totals')).toContainText(/53[,.]00/);
  await page.getByRole('button',{name:/Payer avec Sumit/}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Le paiement n’a pas pu être ouvert');
  expect(state.submissions).toHaveLength(1);expect(state.submissions[0]).toMatchObject({name:'Client démo',phone:'+972502345678',address:'12 rue Démo',city:'Ville démo',custom_fields:{occasion:'Déjeuner'},expected_total_minor:5300});
  expect(ordinaryCreates).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('foody-cart')!))).toEqual(savedCart);
  await page.screenshot({path:info.outputPath('existing-checkout-prepared-order.png'),fullPage:true});
});

test('changing the address invalidates the quote and requires another price review',async({page})=>{
  const state=await install(page);await openCheckout(page);await fillDetails(page);
  await page.getByRole('button',{name:/Calculer la livraison et le total/}).click();await expect(page.getByRole('button',{name:/Payer avec Sumit/})).toBeVisible();
  await page.getByLabel('Adresse de livraison').fill('24 rue Démo');
  await expect(page.getByRole('button',{name:/Calculer la livraison et le total/})).toBeVisible();
  await page.getByRole('button',{name:/Calculer la livraison et le total/}).click();expect(state.quotes).toHaveLength(2);expect(state.submissions).toHaveLength(0);
});

test('pickup uses the saved price even after the public catalog changes',async({page})=>{
  const state=await install(page,{...basket,order_type:'pickup',total:38,delivery_fee:0});await openCheckout(page);await page.reload();await fillDetails(page,false);await page.getByRole('button',{name:/Payer avec Sumit/}).click();await expect(page.locator('main').getByRole('alert')).toBeVisible();expect(state.quotes).toHaveLength(0);expect(state.submissions[0]).toMatchObject({name:'Client démo'});await expect(page.locator('.commerce-totals')).toContainText(/38[,.]00/);
});

test('expired private link stays inside the normal restaurant cart and offers recovery',async({page})=>{await install(page,{error:'expired'},410);await page.goto(link);await expect(page.locator('main').getByRole('alert')).toContainText('expiré');await expect(page.getByRole('button',{name:/Payer avec Sumit/})).toHaveCount(0);});

test('paid order cannot open another payment',async({page})=>{await install(page,{paid:true});await page.goto(link);await expect(page.getByRole('heading',{name:'Cette commande est déjà payée'})).toBeVisible();await expect(page.getByRole('button',{name:/Payer avec Sumit/})).toHaveCount(0);});

test('resuming payment does not collect or overwrite customer details',async({page})=>{const state=await install(page,{...basket,started:true});await openCheckout(page);await expect(page.locator('.commerce-contact')).toHaveCount(0);await page.getByRole('button',{name:/Reprendre le même paiement/}).click();await expect(page.locator('main').getByRole('alert')).toBeVisible();expect(state.submissions).toEqual([{}]);});

for(const lang of ['en','he'])test(`existing cart and checkout remain responsive in ${lang}`,async({page},info)=>{await page.setViewportSize({width:390,height:844});await install(page);await page.addInitScript(language=>localStorage.setItem('foody-locale',language),lang);await page.goto(link);await expect(page.locator('.commerce-items')).toContainText('Salade démo');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.commerce-cart-action button').click();await expect(page.locator('.commerce-contact')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`existing-checkout-${lang}.png`),fullPage:true});});

test('the shared checkout opens the reviewed Sumit payment',async({page})=>{
  await install(page);await page.route('https://app.sumit.co.il/pay/synthetic',route=>route.fulfill({contentType:'text/html',body:'<h1>Sumit fixture</h1>'}));
  await page.route('**/api/v1/public/orders/99/internal-checkout?*',route=>route.request().method()==='POST'?route.fulfill({json:{payment_url:'https://app.sumit.co.il/pay/synthetic'}}):route.fallback());
  await openCheckout(page);await fillDetails(page);await page.getByRole('button',{name:/Calculer la livraison et le total/}).click();await page.getByRole('button',{name:/Payer avec Sumit/}).click();await expect(page).toHaveURL('https://app.sumit.co.il/pay/synthetic');
});
