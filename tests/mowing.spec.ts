import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Mowing Functionality', () => {
  test('mowing changes grass state', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('mowing-before.png');

    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('mowing-after.png');
  });
});
