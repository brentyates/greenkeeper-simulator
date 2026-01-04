import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Mowing Functionality', () => {
  test('mowing changes grass state', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('mowing-before.png');

    // Use public API instead of keyboard
    await page.evaluate(() => {
      window.game.selectEquipment(1);  // Select mower
      window.game.toggleEquipment(true);  // Turn on
      window.game.movePlayer('right');
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    // Wait for movements to complete
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => {
      window.game.toggleEquipment(false);  // Turn off
    });
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('mowing-after.png');
  });
});
