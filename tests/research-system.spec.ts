import { test, expect } from '@playwright/test';

test.describe('Research System Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await page.waitForTimeout(1000);
  });

  test('research panel shows available research', async ({ page }) => {
    await page.keyboard.press('y');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('research-panel-available.png');
  });

  test('research panel shows funding levels', async ({ page }) => {
    await page.keyboard.press('y');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('research-panel-funding.png');
  });
});
