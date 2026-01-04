import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Tree Collision', () => {
  test('player cannot walk onto a tree tile', async ({ page }) => {
    await page.goto('/?testMode=true&preset=tree_collision_test');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('tree-collision-initial.png');

    // Use public API for movement
    await page.evaluate(() => window.game.movePlayer('left'));
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await expect(page).toHaveScreenshot('tree-collision-blocked.png');

    await page.evaluate(() => {
      window.game.movePlayer('up');
      window.game.movePlayer('up');
    });
    await page.evaluate(() => window.game.waitForPlayerIdle());

    await expect(page).toHaveScreenshot('tree-collision-moved-around.png');
  });
});
