import { test, expect } from "@playwright/test";
import { themes } from "../../lib/themes/generated/themes";

const DIRECTIONS = ["ltr", "rtl"] as const;

test.describe("themes visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sandbox/grid");
    // Wait for one panel to be present before iterating.
    await page.locator('[data-testid^="panel-"]').first().waitFor();
  });

  for (const theme of themes) {
    for (const dir of DIRECTIONS) {
      test(`${theme.id} · ${dir}`, async ({ page }) => {
        const panel = page.getByTestId(`panel-${theme.id}-${dir}`);
        await expect(panel).toBeVisible();
        await expect(panel).toHaveScreenshot(`${theme.id}-${dir}.png`);
      });
    }
  }
});
