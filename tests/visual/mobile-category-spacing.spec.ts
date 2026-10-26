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
