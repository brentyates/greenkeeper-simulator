import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Water Tile Collision', () => {
  test('player cannot walk onto water tiles', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    // Use public API for movement
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('left');
      }
    });
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await expect(page).toHaveScreenshot('water-collision-after-left.png');
  });

  test('player can walk away from water', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    // Use public API
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('right');
      }
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('down');
      }
    });
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('water-collision-moved-away.png');
  });
});
