import { test, expect } from '@playwright/test';

test.describe('Employee Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await page.waitForTimeout(1000);
  });

  test('employee panel shows current employees', async ({ page }) => {
    await page.keyboard.press('h');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('employee-panel-initial.png');
  });

  test('can view hiring pool', async ({ page }) => {
    await page.keyboard.press('h');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('employee-panel-with-hiring.png');
  });
});
