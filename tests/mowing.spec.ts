import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle } from './utils/test-helpers';

test.describe('Mowing Functionality', () => {
  test('mowing changes grass state', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('mowing-before.png');

    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await page.keyboard.down('Space');

    await page.keyboard.press('ArrowRight');
    await waitForPlayerIdle(page);
    await page.keyboard.press('ArrowRight');
    await waitForPlayerIdle(page);
    await page.keyboard.press('ArrowRight');
    await waitForPlayerIdle(page);

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('mowing-after.png');
  });
});
