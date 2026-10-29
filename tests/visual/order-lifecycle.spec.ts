import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';

let api: Server;
let status = 'in_kitchen';
let payment = 'paid';
let posts = 0;
let failRead = false;
let lifecycle: unknown = undefined;
let lifecycleV2: unknown = undefined;
test.beforeEach(() => { lifecycleV2 = undefined; });
let reads = 0;

test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type,x-receipt-token');
    if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
    if (request.method !== 'GET') posts++;
    const path = new URL(request.url!, 'http://127.0.0.1:43227').pathname;
    if (path === '/api/v1/public/orders/99') {
      reads++;
      response.statusCode = failRead ? 503 : 200;
      response.end(JSON.stringify(failRead ? { error: 'unavailable' } : { order: {
        id: 99, restaurant_id: 17, order_type: 'dine_in', status, payment_status: payment,
        total_amount: 20, currency: 'ILS', receipt_token: 'synthetic', items: [], lifecycle, lifecycle_v2: lifecycleV2,
      } }));
    } else if (path === '/api/v1/public/receipts/synthetic') {
      response.end(JSON.stringify({order:{id:99,receipt_token:'synthetic',customer_name:'Synthetic',customer_phone:'',order_type:'dine_in',order_source:'qr_dine_in',order_status:status,payment_status:payment,total_amount:20,created_at:'2026-10-28T10:00:00Z',lifecycle_v2:lifecycleV2},restaurant:{id:17,name:'Synthetic',address:'',phone:''},items:[{id:1,name:'Synthetic food',quantity:1,unit_price:100,total:100}]}));
    } else if (path === '/api/v1/public/restaurants/17') {
      response.end(JSON.stringify({ restaurant: { id: 17, name: 'Synthetic', service_mode: 'table', currency: 'ILS' } }));
    } else if (path.endsWith('/website-pages')) response.end(JSON.stringify({ pages: [] }));
    else { response.statusCode = 404; response.end('{}'); }
  });
  await new Promise<void>(resolve => api.listen(43227, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});

for (const variant of [
  { locale: 'fr', width: 390, paid: 'Payé', partial: 'Partiellement payé', kitchen: 'En cuisine' },
  { locale: 'he', width: 320, paid: 'שולם', partial: 'שולם חלקית', kitchen: 'במטבח' },
  { locale: 'en', width: 1280, paid: 'Paid', partial: 'Partially paid', kitchen: 'In kitchen' },
]) test(`paid order keeps preparation and handoff separate · ${variant.locale}`, async ({ page }, info) => {
  status = 'in_kitchen'; payment = 'paid'; posts = 0; failRead = false; lifecycle = undefined;
  await page.addInitScript(locale => {
    localStorage.setItem('foody-locale', locale);
    class SyntheticSocket extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      close() {}
      constructor() { super(); (window as any).trackingSocket = this; }
    }
    (window as any).WebSocket = SyntheticSocket;
  }, variant.locale);
  await page.setViewportSize({ width: variant.width, height: 900 });
  await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');
  await expect(page.getByText(variant.paid, { exact: true })).toBeVisible();
  const card = page.locator('[data-order-timeline]');
  await expect(card.locator('[data-current="true"]')).toContainText(variant.kitchen);
  await expect(card.locator('[data-step="served"]')).toHaveAttribute('data-done', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('prepaid-preparing.png'), fullPage: true });
  payment = 'partially_paid';
  await page.evaluate(() => (window as any).trackingSocket.onmessage({ data: JSON.stringify({ type: 'payment.completed', order_id: 99, restaurant_id: 17 }) }));
  await expect(page.getByText(variant.partial, { exact: true })).toBeVisible();
  await expect(card.locator('[data-current="true"]')).toContainText(variant.kitchen);
  expect(posts).toBe(0);
});

function facts(preparation = 'in_progress', handoff = 'unknown', paymentState = 'paid') {
  return {
    schema_version: 1, scope: { kind: 'order', id: '99' }, identities: { order_ids: [99] },
    commercial: { state: 'closed', evidence: [] }, payment: { state: paymentState, evidence: [] },
    preparation: { state: preparation, evidence: [], quantities: { total: 1, not_sent: 0, held: 0, in_progress: 0, ready: 0, unknown: 1 } },
    handoff: { state: handoff, tracking: 'unknown', evidence: [] },
  };
}

test('v1 refunded order retains handoff but does not invent unknown preparation', async ({ page }, info) => {
  status = 'refunded'; payment = 'refunded'; lifecycle = facts('unknown', 'complete', 'refunded'); failRead = false;
  await page.addInitScript(() => localStorage.setItem('foody-locale', 'fr'));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');
  const card = page.locator('[data-order-timeline]');
  await expect(card.locator('[data-step="served"]')).toHaveAttribute('data-current', 'true');
  await expect(card.locator('[data-step="in_kitchen"]')).toHaveAttribute('data-done', 'false');
  await expect(card.locator('[data-step="ready"]')).toHaveAttribute('data-done', 'false');
  await expect(page.getByText('Remboursé', { exact: true })).toBeVisible();
  await expect(card.getByText('La progression de préparation n’est pas renseignée.', { exact: true })).toBeVisible();
  await expect(card).not.toContainText('Actualisez');
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('refunded-known-handoff.png'), fullPage: true });
});

test('advertised malformed projection never falls back to payment; retry restores coherent facts', async ({ page }, info) => {
  status = 'in_kitchen'; payment = 'pending'; lifecycle = { ...facts(), schema_version: 2 }; failRead = false; posts = 0;
  await page.addInitScript(() => localStorage.setItem('foody-locale', 'fr'));
  await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');
  await expect(page.getByText('Statut du paiement indisponible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Payer maintenant', exact: true })).toHaveCount(0);
  const card = page.locator('[data-order-timeline]');
  await expect(card.locator('[data-done="true"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('lifecycle-unavailable.png'), fullPage: true });
  lifecycle = facts('in_progress', 'unknown', 'paid');
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByText('Payé', { exact: true })).toBeVisible();
  await expect(card.locator('[data-step="in_kitchen"]')).toHaveAttribute('data-current', 'true');
  expect(posts).toBe(0);
});

test('failed or downgraded advertised reads stay unavailable until v1 recovers', async ({ page }) => {
  status = 'in_kitchen'; payment = 'paid'; lifecycle = facts(); failRead = false; posts = 0;
  await page.addInitScript(() => {
    localStorage.setItem('foody-locale', 'fr');
    class SyntheticSocket extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      close() {}
      constructor() { super(); (window as any).trackingSocket = this; }
    }
    (window as any).WebSocket = SyntheticSocket;
  });
  await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');
  await expect(page.getByText('Payé', { exact: true })).toBeVisible();
  await page.waitForTimeout(100);
  const before = reads;
  await page.evaluate(() => (window as any).trackingSocket.onmessage({ data: JSON.stringify({ type: 'order.updated', order_id: 100, restaurant_id: 17 }) }));
  await page.waitForTimeout(100);
  expect(reads).toBe(before);
  failRead = true;
  await page.evaluate(() => (window as any).trackingSocket.onmessage({ data: JSON.stringify({ type: 'order.updated', order_id: 99, restaurant_id: 17 }) }));
  await expect(page.getByText('Statut du paiement indisponible', { exact: true })).toBeVisible();
  failRead = false; lifecycle = undefined;
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByText('Statut du paiement indisponible', { exact: true })).toBeVisible();
  lifecycle = facts();
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByText('Payé', { exact: true })).toBeVisible();
  expect(posts).toBe(0);
});

test('v1 pending retains the existing Pay now path without checking off food or collecting automatically', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('foody-locale', 'fr'));
  posts = 0; failRead = false; status = 'accepted';
  for (const state of ['authorized', 'pending']) {
    payment = state; lifecycle = facts('not_sent', 'unknown', state);
    await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');
    await expect(page.getByText(state === 'authorized' ? 'Empreinte bancaire autorisée' : 'En attente', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payer maintenant', exact: true })).toHaveCount(state === 'pending' ? 1 : 0);
    await expect(page.locator('[data-order-timeline] [data-done="true"]')).toHaveCount(0);
    await expect(page.locator('[data-step="served"]')).toHaveAttribute('data-current', 'false');
  }
  expect(posts).toBe(0);
});


function factsV2(due:number|null=0) {
 const axis=(state:string)=>({state,evidence:[]});
 return {schema_version:2,scope:{kind:'order',id:'99'},identities:{order_ids:[99]},revision:'a'.repeat(64),
 commercial:{...axis('closed'),editable:false,closed_at:'2026-10-28T10:00:00Z'},
 payment:{...axis(due===0?'partially_refunded':'pending'),amounts:{availability:due===null?'partial':'known',currency:'ILS',minor_unit_exponent:2,total_minor:10000,captured_minor:10000,refunded_minor:2500,net_received_minor:7500,balance_due_minor:due}},
 preparation:{...axis('partially_ready'),quantities:{total:2,not_sent:0,held:1,in_progress:0,ready:1,not_tracked:0,unknown:0}},
 handoff:{...axis('partially_complete'),tracking:'tracked',quantities:{total:2,pending:1,with_courier:0,served:1,picked_up:0,delivered:0,not_tracked:0,unknown:0}},
 tracking:{state:'snapshot',preparation:'tracked',handoff:'tracked',captured_at:'2026-10-28T10:00:00Z'}};
}
for(const variant of [{locale:'fr',width:390,partial:'Partiellement remboursé',handoff:'1 / 2 remis'},{locale:'he',width:320,partial:'הוחזר חלקית',handoff:'1 / 2 נמסרו'}])test(`v2 money and physical partial handoff remain independent · ${variant.locale}`,async({page},info)=>{
 status='served';payment='paid';lifecycle=undefined;lifecycleV2=factsV2();failRead=false;posts=0;
 await page.addInitScript(locale=>localStorage.setItem('foody-locale',locale),variant.locale);await page.setViewportSize({width:variant.width,height:1000});
 await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');await expect(page.getByText(variant.partial,{exact:true})).toBeVisible();
 await expect(page.locator('[data-money-field="refunded_minor"]')).toContainText('25');await expect(page.locator('[data-money-field="net_received_minor"]')).toContainText('75');
 await expect(page.getByText(variant.handoff,{exact:true})).toBeVisible();await expect(page.locator('[data-step="served"]')).toHaveAttribute('data-done','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(posts).toBe(0);await page.screenshot({path:info.outputPath('v2-partial-recorded-money.png'),fullPage:true});
});

test('v2 due unknown blocks Pay now on tracking and confirmation, while a known positive due keeps the existing entry',async({page})=>{
 status='accepted';payment='pending';lifecycle=undefined;lifecycleV2=factsV2(null);failRead=false;posts=0;
 await page.addInitScript(()=>localStorage.setItem('foody-locale','fr'));
 for(const path of ['/order/tracking/99?restaurantId=17&t=synthetic','/order/confirmation/99?restaurantId=17&t=synthetic']) {
  await page.goto(path);await expect(page.getByRole('button',{name:'Payer maintenant',exact:true})).toHaveCount(0);await expect(page.locator('[data-money-field="balance_due_minor"]')).toHaveText('Montant inconnu');
 }
 lifecycleV2=factsV2(2000);await page.goto('/order/confirmation/99?restaurantId=17&t=synthetic');await expect(page.getByRole('button',{name:'Payer maintenant',exact:true})).toBeVisible();expect(posts).toBe(0);
});

test('receipt v2 is own-order only and malformed private fields never enter rendered hydration data',async({page},info)=>{
 status='served';payment='paid';lifecycle=undefined;lifecycleV2=factsV2();failRead=false;posts=0;
 await page.addInitScript(()=>localStorage.setItem('foody-locale','fr'));await page.setViewportSize({width:390,height:1000});
 await page.goto('/receipt/synthetic');await expect(page.getByText('Partiellement remboursé',{exact:true})).toBeVisible();await expect(page.locator('[data-money-field="refunded_minor"]')).toContainText('25');
 const factsBox=await page.locator('[data-lifecycle-v2-facts]').boundingBox(),detailsBox=await page.locator('dl.receipt-details').boundingBox();
 expect(factsBox).not.toBeNull();expect(detailsBox).not.toBeNull();expect(factsBox!.width).toBeGreaterThanOrEqual(detailsBox!.width-2);
 const total=page.locator('[data-money-field="total_minor"]');await expect(total).toContainText('100,00');await expect(total).toContainText('₪');
 expect(await total.locator('bdi').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const lines=Array.from(range.getClientRects());return lines.length>0&&Math.max(...lines.map(rect=>rect.bottom))-Math.min(...lines.map(rect=>rect.top))<=parseFloat(getComputedStyle(element).lineHeight)+1;})).toBe(true);
 await page.screenshot({path:info.outputPath('v2-receipt-recorded-money.png'),fullPage:true});
 lifecycleV2={...factsV2(),identities:{order_ids:[99],financial_check_ids:['sibling-private-id']},units:[{key:'sibling-private-unit'}],actions:[]};
 for(const path of ['/receipt/synthetic','/order/tracking/99?restaurantId=17&t=synthetic']) {
  await page.goto(path);await expect(page.getByText('Statut du paiement indisponible',{exact:true})).toBeVisible();const html=await page.content();expect(html).not.toContain('sibling-private-id');expect(html).not.toContain('sibling-private-unit');
 }
 expect(posts).toBe(0);
});


test('a previously advertised v2 never downgrades to a completed v1 after refresh',async({page})=>{
 status='served';payment='paid';lifecycle=undefined;lifecycleV2=factsV2();failRead=false;posts=0;
 await page.addInitScript(()=>{
  localStorage.setItem('foody-locale','fr');
  class SyntheticSocket extends EventTarget {onmessage:((event:MessageEvent)=>void)|null=null;onopen:(()=>void)|null=null;close(){}constructor(){super();(window as any).trackingSocket=this;}}
  (window as any).WebSocket=SyntheticSocket;
 });
 await page.goto('/order/tracking/99?restaurantId=17&t=synthetic');await page.waitForFunction(()=>!!(window as any).trackingSocket);await expect(page.getByText('Partiellement remboursé',{exact:true})).toBeVisible();
 lifecycleV2=undefined;lifecycle=facts('ready','complete','paid');
 await page.evaluate(()=>(window as any).trackingSocket.onmessage({data:JSON.stringify({type:'order.updated',order_id:99,restaurant_id:17})}));
 await expect(page.getByText('Statut du paiement indisponible',{exact:true})).toBeVisible();await expect(page.locator('[data-order-timeline] [data-done="true"]')).toHaveCount(0);
 lifecycleV2=factsV2();await page.getByRole('button',{name:'Réessayer',exact:true}).click();await expect(page.getByText('Partiellement remboursé',{exact:true})).toBeVisible();expect(posts).toBe(0);
});
