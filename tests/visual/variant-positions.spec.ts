import { createServer, type Server } from 'node:http';
import { test, expect, type Page } from '@playwright/test';

let api: Server;
const config = { source: 'option', source_id: 1, presentation: 'characters', choices: [{ id: 101, count: 1 }, { id: 102, count: 2 }] };
const cake = {
  id: 1, name: 'Number Cake', price: 55, group_id: 1, is_active: true,
  option_sets: [
    { id: 1, name: 'Format', options: [{ id: 101, name: '1 caractère', price: 55, is_active: true }, { id: 102, name: '2 caractères', price: 110, is_active: true }] },
    { id: 2, name: 'Caractère', selection_role: 'identity', selection_config: config, options: [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((name, i) => ({ id: 200 + i, name, price: 999, is_active: true })) },
  ],
  modifier_sets: [],
};
const longCake = { ...cake, id: 2, name: 'Long choices', modifier_sets: [], option_sets: [{ id: 3, name: 'Taille', options: Array.from({ length: 8 }, (_, i) => ({ id: 301 + i, name: `Format ${i + 1}`, price: 50 + i, is_active: true })) }] };
const orderPage = { id: 1, restaurant_id: 9001, slug: 'order', title: 'Menu', type: 'order', sort_order: 0, nav_visible: true, is_default: true, is_homepage: true, seo: {}, sections: [], settings: { menu_ids: [1] },
  appearance_overrides: { foody_renderer_version: 1, website_order: { layout: 'rows', show_fulfillment: false, prompt_on_entry: false } }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json'); response.setHeader('Access-Control-Allow-Origin', '*');
    const path = new URL(request.url!, 'http://localhost').pathname;
    let body: unknown = {};
    if (/\/restaurants\/(9001|synthetic)$/.test(path)) body = { restaurant: { id: 9001, slug: 'synthetic', name: 'Demo pâtisserie', currency: 'EUR', timezone: 'Asia/Jerusalem', pickup_enabled: true, delivery_enabled: false, website_config: { theme_id: 'creme-patisserie', checkout_config: { lock_order_type: true, offer_sign_in: false } } } };
    else if (path.endsWith('/website-pages')) body = { pages: [orderPage] };
    else if (path.includes('/website-pages/')) body = { page: orderPage };
    else if (path.endsWith('/menu')) body = { currency: 'EUR', menus: [{ id: 1, name: 'Menu', groups: [{ id: 1, name: 'Gâteaux', items: [cake, longCake] }] }] };
    else if (path.includes('customer')) response.statusCode = 401;
    response.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve => api.listen(43237, '127.0.0.1', resolve));
});
test.afterAll(async () => { api.closeAllConnections(); await new Promise<void>(resolve => api.close(() => resolve())); });

async function openCake(page: Page, locale = 'fr') {
  await page.addInitScript(() => { localStorage.setItem('foody-locale', 'fr'); localStorage.setItem('foody-menu-locale', 'fr'); });
  await page.route('**/api/customer-auth/**', route => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/customer-api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto(`/r/synthetic/order?type=pickup&lang=${locale}`);
  await page.getByText('Number Cake', { exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Caractère 1', exact: true })).toBeVisible();
}
async function choose(page: Page, position: number, value: string) {
  await page.getByRole('button', { name: `Caractère ${position}`, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

test('two positions preserve repeated digits and clear removed positions when the format shrinks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCake(page);
  const add = page.locator('[data-item-part=footer] button');
  await expect(add).toBeDisabled();
  await page.getByText('2 caractères', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Caractère 2', exact: true })).toBeVisible();
  await choose(page, 1, '1');
  await expect(add).toBeDisabled();
  await choose(page, 2, '1');
  await expect(add).toBeEnabled();
  await page.screenshot({ path: 'test-results/variant-positions/number-cake-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByText('1 caractère', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Caractère 2', exact: true })).toHaveCount(0);
  await page.getByText('2 caractères', { exact: true }).click();
  await expect(add).toBeDisabled();
  await choose(page, 2, 'A');
  await add.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('foody-cart')!).state.lines[0]);
  expect(saved.selectedVariantPrice).toBe(110);
  expect(saved.modifiers).toEqual([]);
  expect(saved.optionSelections.map((s: { optionId: number; selectionIndex: number }) => [s.optionId, s.selectionIndex])).toEqual([[201, 1], [210, 2]]);
});

test('search and keyboard choose one letter; Escape closes only the picker', async ({ page }) => {
  await openCake(page);
  const trigger = page.getByRole('button', { name: 'Caractère 1', exact: true });
  await trigger.click();
  await expect(page.getByRole('option', { name: '0', exact: true })).toBeInViewport();
  await expect.poll(async () => {
    const list = await page.getByRole('listbox').boundingBox();
    const footer = await page.locator('[data-item-part=footer]').boundingBox();
    return !!list && !!footer && list.y + list.height <= footer.y;
  }).toBe(true);
  await page.screenshot({ path: 'test-results/variant-positions/number-cake-picker.png', fullPage: true, animations: 'disabled' });
  const search = page.getByRole('combobox', { name: /Rechercher un choix/ });
  await search.fill('Z');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveText(/Z/);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

for (const locale of ['en', 'he']) test(`character picker works in ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCake(page, locale);
  await page.getByRole('button', { name: 'Caractère 1', exact: true }).click();
  await expect(page.getByRole('combobox', { name: locale === 'he' ? /חיפוש אפשרות/ : /Search choices/ })).toBeVisible();
  await expect(page.getByRole('button', { name: locale === 'he' ? 'ספרות' : 'Digits', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('long variant lists keep absolute prices in a compact searchable picker', async ({ page }) => {
  await page.goto('/r/synthetic/order?type=pickup&lang=fr');
  await page.getByText('Long choices', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Taille', exact: true }).click();
  await page.getByRole('combobox', { name: /Rechercher un choix/ }).fill('Format 8');
  const option = page.getByRole('option', { name: /Format 8/ });
  await expect(option).not.toHaveText(/\+/);
  await option.click();
  await page.locator('[data-item-part=footer] button').click();
  const line = await page.evaluate(() => JSON.parse(localStorage.getItem('foody-cart')!).state.lines[0]);
  expect(line.selectedVariantPrice).toBe(57);
});
