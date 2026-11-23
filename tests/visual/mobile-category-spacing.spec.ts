import { test, expect } from '@playwright/test';

for (const [index, shape] of ['pill', 'rounded', 'underline', 'plain'].entries()) {
  test(`${shape} navigation fits its mobile bar while retaining touch targets`, async ({ page }, testInfo) => {
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.route('**/api/customer-auth/**', route => route.fulfill({ status: 401, json: {} }));
    for (const width of [320, 390, 767, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/r/${49101 + index}/order?lang=${width === 320 ? 'he' : 'fr'}`);
      await expect(page.locator('html')).toHaveAttribute('dir', width === 320 ? 'rtl' : 'ltr');
      const nav = page.locator('.website-order-navigation');
      await expect(nav).toHaveAttribute('data-shape', shape);
      const links = nav.locator('nav a');
      await expect(links).toHaveCount(3);
      const geometry = await links.first().evaluate(el => {
        const link = el.getBoundingClientRect(), bar = el.closest('nav')!.getBoundingClientRect(), css = getComputedStyle(el);
        const top = parseFloat(css.borderTopWidth), bottom = parseFloat(css.borderBottomWidth);
        return { touchHeight: link.height, paintedHeight: link.height - top - bottom, topSpace: link.top - bar.top + top, bottomSpace: bar.bottom - link.bottom + bottom, clip: css.backgroundClip, fontSize: parseFloat(css.fontSize), padding: css.paddingTop };
      });
      expect(geometry.touchHeight).toBeGreaterThanOrEqual(44);
      if (width < 768 && ['pill', 'rounded'].includes(shape)) {
        expect(geometry.paintedHeight).toBeCloseTo(36);
        expect(geometry.topSpace).toBeGreaterThanOrEqual(8);
        expect(geometry.bottomSpace).toBeGreaterThanOrEqual(8);
        expect(geometry.clip).toBe('padding-box');
        expect(geometry.fontSize).toBeCloseTo(14);
      } else if (width >= 768 && ['pill', 'rounded'].includes(shape)) {
        expect(geometry.padding).toBe('10px');
        expect(geometry.clip).toBe('border-box');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 && shape === 'pill') await page.screenshot({ path: `test-results/mobile-categories/pills-${testInfo.project.name}.png` });
      await links.last().click();
      await expect(page).toHaveURL(/#menu-menu-1-3$/);
    }
  });
}

test('parent titles and all subgroups remain in the order-page scroll', async ({ page }) => {
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/api/customer-auth/**', route => route.fulfill({ status: 401, json: {} }));
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/r/49105/order?lang=fr');
    const categories = page.getByRole('navigation', { name: 'Catégories', exact: true });
    const subgroups = page.getByRole('navigation', { name: 'Sous-groupes de Boissons' });
    const drinksLink = categories.getByRole('link', { name: 'Boissons' });
    const branch = page.locator((await drinksLink.getAttribute('href'))!);
    const drinksTitle = branch.getByRole('heading', { name: 'Boissons', exact: true });
    const bottledDrink = branch.getByRole('button', { name: 'Limonade en bouteille' });
    const cannedDrink = branch.getByRole('button', { name: 'Limonade en canette' });
    await expect(branch.getByRole('heading')).toHaveText(['Boissons', 'Bouteilles', 'Canettes']);
    await expect(bottledDrink).toHaveCount(1);
    await expect(cannedDrink).toHaveCount(1);
    await expect(categories.getByRole('link', { name: 'Canettes' })).toHaveCount(0);
    await expect(subgroups).toHaveCount(0);
    await drinksLink.click();
    await expect(drinksTitle).toBeInViewport();
    const bottles = subgroups.getByRole('link', { name: 'Bouteilles' });
    const cans = subgroups.getByRole('link', { name: 'Canettes' });
    await bottles.click();
    await expect(bottles).toHaveAttribute('aria-current', 'location');
    await expect(bottles).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(bottles).toHaveCSS('box-shadow', /inset/);
    await expect(bottledDrink).toBeInViewport();
    await cannedDrink.scrollIntoViewIfNeeded();
    await expect(cannedDrink).toBeInViewport();
    await cans.click();
    await expect(page).toHaveURL(/#menu-menu-1-6$/);
    await expect(cans).toHaveAttribute('aria-current', 'location');
    await expect(cannedDrink).toBeInViewport();
    await expect(bottledDrink).toHaveCount(1);
    await page.goBack();
    await expect(bottles).toHaveAttribute('aria-current', 'location');
    await expect(bottledDrink).toBeInViewport();
    await categories.getByRole('link', { name: 'MENUS' }).click();
    await expect(subgroups).toHaveCount(0);
    const search = page.locator('.website-order-navigation').getByRole('searchbox');
    await search.fill('Limonade');
    await expect(page.getByRole('button', { name: 'Limonade en bouteille' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Limonade en canette' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/r/49105/order?lang=fr#menu-menu-1-6');
  await expect(page.getByRole('button', { name: 'Limonade en canette' })).toBeInViewport();
});

for (const [id, mode] of [[49106, 'standard'], [49107, 'wide']] as const) {
  test(`${mode} aligns the order page and keeps the category bar full width`, async ({ page }) => {
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.route('**/api/customer-auth/**', route => route.fulfill({ status: 401, json: {} }));
    for (const width of [320, 390, 767, 768, 1013, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const rtl = width === 320;
      await page.goto(`/r/${id}/order?lang=${rtl ? 'he' : 'fr'}`);
      const bar = page.locator('.website-order-navigation');
      const rail = bar.locator('.order-menu-categories');
      await expect(page.locator('main[data-menu-width]')).toHaveAttribute('data-menu-width', mode);
      await expect(rail.locator('a')).toHaveCount(9);
      await expect(page.locator('.website-service-controls')).toBeVisible();
      const geometry = await page.evaluate(({ width, rtl }) => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const bar = rect('.website-order-navigation');
        const rail = rect('.order-menu-categories');
        const title = rect('.website-order-category h2');
        const items = rect('.website-order-items');
        const search = rect('.order-menu-search');
        const start = (box: DOMRect) => rtl ? width - box.right : box.left;
        return {
          bar: [bar.left, bar.right],
          starts: [rect('.website-header-logo'), rect('.website-service-controls'), rail, title, items].map(start),
          titleSpacing: title.top - bar.bottom,
          itemSpacing: items.top - title.bottom,
          toolbarBelow: search.top >= rail.bottom,
          documentWidth: document.documentElement.scrollWidth,
        };
      }, { width, rtl });
      const minimum = Math.min(48, Math.max(16, width * .0335));
      const inset = mode === 'standard' ? Math.max(minimum, (width - 1000) / 2) : minimum;
      expect(geometry.bar).toEqual([0, width]);
      geometry.starts.forEach(start => expect(Math.abs(start - inset)).toBeLessThanOrEqual(1));
      expect(geometry.titleSpacing).toBeGreaterThanOrEqual(24);
      expect(geometry.titleSpacing).toBeLessThanOrEqual(33);
      expect(geometry.itemSpacing).toBeGreaterThanOrEqual(16);
      expect(geometry.itemSpacing).toBeLessThanOrEqual(24);
      expect(geometry.documentWidth).toBe(width);
      if (width === 1440) expect(geometry.toolbarBelow).toBe(mode === 'standard');
      if (width <= 390) {
        await expect(rail).toHaveAttribute('data-scroll-end', '');
        await rail.locator('a').last().press('Enter');
        await expect(page).toHaveURL(/#menu-menu-1-9$/);
        await expect(page.locator('.website-order-category h2').last()).toBeInViewport();
      }
    }
  });
}
