import { test, expect } from '@playwright/test';

test.describe('Management Panel Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await page.waitForTimeout(1000);
  });

  test('employee panel opens with H key', async ({ page }) => {
    await page.keyboard.press('h');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('employee-panel-open.png');
  });

  test('research panel opens with Y key', async ({ page }) => {
    await page.keyboard.press('y');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('research-panel-open.png');
  });

  test('tee sheet panel opens with G key', async ({ page }) => {
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('tee-sheet-panel-open.png');
  });

  test('marketing dashboard opens with K key', async ({ page }) => {
    await page.keyboard.press('k');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('marketing-panel-open.png');
  });

  test('equipment store opens with B key', async ({ page }) => {
    await page.keyboard.press('b');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('equipment-store-open.png');
  });

  test('amenity panel opens with U key', async ({ page }) => {
    await page.keyboard.press('u');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('amenity-panel-open.png');
  });

  test('tee sheet spacing configuration shows impact', async ({ page }) => {
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('tee-sheet-spacing-default.png');
  });
});
