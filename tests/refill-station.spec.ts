import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Refill Station', () => {
  test('player can refill resources when near refill station', async ({ page }) => {
    await page.goto('/?testMode=true&preset=refill_test');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('refill-near-station-before.png');

    // Use public API for refill
    await page.evaluate(() => window.game.pressKey('e'));
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('refill-near-station-after.png');
  });

  test('player cannot refill when not near refill station', async ({ page }) => {
    await page.goto('/?testMode=true&preset=refill_test_far');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('refill-far-from-station-before.png');

    // Use public API
    await page.evaluate(() => window.game.pressKey('e'));
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('refill-far-from-station-after.png');
  });

  test('all resources refill to 100% after successful refill', async ({ page }) => {
    await page.goto('/?testMode=true&preset=refill_test');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    // Use public API
    await page.evaluate(() => window.game.pressKey('e'));
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('refill-all-resources-100.png');
  });
});
