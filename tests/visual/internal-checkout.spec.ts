import { test, expect, type Page } from '@playwright/test';

const basket = {
  paid: false, mode: 'link', started: false, currency: 'ILS', total: 48, delivery_fee: 10, discount_amount: 2,
  order_type: 'delivery', scheduled_for: '2026-11-06T00:00:00Z', window_start: '12:00', window_end: '14:00',
  items: [{ id: 1, menu_item_id: 10, name: 'Salade démo', quantity: 2, price: 20, modifiers: [{ name: 'Sans oignon' }] }],
};

async function install(page: Page, result: object = basket, status = 200) {
  const submissions: Record<string, string>[] = [];
  await page.addInitScript(() => localStorage.setItem('foody-locale', 'fr'));
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.route('**/api/v1/public/orders/99/internal-checkout**', route => {
    expect(route.request().headers()['x-receipt-token']).toBe('synthetic-token');
    expect(route.request().headers()['referer']).toBeUndefined();
    if (new URL(route.request().url()).pathname.endsWith('/quote')) return route.fulfill({ json: { delivery_fee: 15, discount_amount: 2, total: 53 } });
    if (route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON());
      return route.fulfill({ status: 409, json: { error: 'synthetic_pending' } });
    }
    return route.fulfill({ status, json: result });
  });
  return submissions;
}

test('recipient reviews the basket and enters contact and delivery details without changing prices', async ({ page }, info) => {
  const submissions = await install(page);
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await expect(page.getByRole('heading', { name: 'Votre panier', exact: true })).toBeVisible();
  await expect(page.getByText('2 × Salade démo')).toBeVisible();
  await page.getByLabel('Nom complet', { exact: true }).fill('Client démo');
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('0500000000');
  await page.getByLabel('Adresse de livraison', { exact: true }).fill('12 rue Démo');
  await page.getByLabel('Ville', { exact: true }).fill('Ville démo');
  await page.getByRole('button', { name: 'Calculer la livraison et le total', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Vérifiez le total mis à jour');
  await page.getByRole('button', { name: 'Payer avec Sumit', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Le paiement n’a pas pu être ouvert');
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({ name: 'Client démo', phone: '0500000000', address: '12 rue Démo', city: 'Ville démo', locale: 'fr', expected_total_minor: 5300 });
  expect(submissions[0]).not.toHaveProperty('total');
  await expect(page.getByLabel('Nom complet', { exact: true })).toHaveValue('Client démo');
  await page.screenshot({ path: info.outputPath('prepared-basket-fr.png') });
});

test('an expired link shows recovery instead of a payment action', async ({ page }) => {
  await install(page, { error: 'expired' }, 410);
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await expect(page.locator('main').getByRole('alert')).toContainText('expiré');
  await expect(page.getByRole('button', { name: 'Payer avec Sumit', exact: true })).toHaveCount(0);
});

test('a paid order cannot be charged again', async ({ page }) => {
  await install(page, { paid: true });
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await expect(page.getByRole('heading', { name: 'Cette commande est déjà payée', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Payer avec Sumit', exact: true })).toHaveCount(0);
});

test('resuming a hosted payment never asks to overwrite the original contact details', async ({ page }) => {
  await install(page, { ...basket, started: true });
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await expect(page.getByRole('button', { name: 'Reprendre le même paiement', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nom complet', { exact: true })).toHaveCount(0);
});

for (const language of ['en', 'he']) {
  test(`prepared basket fits a mobile viewport in ${language}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await install(page);
    await page.goto(`/r/9001/checkout/99?t=synthetic-token&lang=${language}`);
    await expect(page.getByRole('button', { name: language === 'he' ? 'חישוב משלוח וסכום סופי' : 'Calculate delivery and total', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`prepared-basket-${language}.png`), fullPage: true });
  });
}

test('recipient reviews the recalculated amount before navigation to hosted Sumit', async ({ page }) => {
  await install(page);
  await page.route('https://app.sumit.co.il/pay/synthetic', route => route.fulfill({ contentType: 'text/html', body: '<h1>Sumit fixture</h1>' }));
  await page.route('**/api/v1/public/orders/99/internal-checkout?*', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().postDataJSON().expected_total_minor).toBe(5300);
    return route.fulfill({ json: { payment_url: 'https://app.sumit.co.il/pay/synthetic' } });
  });
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await page.getByLabel('Nom complet', { exact: true }).fill('Client démo');
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('0500000000');
  await page.getByLabel('Adresse de livraison', { exact: true }).fill('12 rue Démo');
  await page.getByRole('button', { name: 'Calculer la livraison et le total', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Vérifiez le total mis à jour');
  await page.getByRole('button', { name: 'Payer avec Sumit', exact: true }).click();
  await expect(page).toHaveURL('https://app.sumit.co.il/pay/synthetic');
});

test('editing the address discards the reviewed delivery price and requires a fresh quote', async ({ page }) => {
  await install(page);
  await page.goto('/r/9001/checkout/99?t=synthetic-token');
  await page.getByLabel('Nom complet', { exact: true }).fill('Client démo');
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('0500000000');
  await page.getByLabel('Adresse de livraison', { exact: true }).fill('12 rue Démo');
  await page.getByRole('button', { name: 'Calculer la livraison et le total', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Payer avec Sumit', exact: true })).toBeVisible();
  await page.getByLabel('Adresse de livraison', { exact: true }).fill('14 rue Démo');
  await expect(page.getByRole('button', { name: 'Payer avec Sumit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Calculer la livraison et le total', exact: true })).toBeVisible();
});
