import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle, pressKey } from './utils/test-helpers';

test.describe('Water Tile Collision', () => {
  test('player cannot walk onto water tiles', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowLeft');
      await waitForPlayerIdle(page);
    }

    await expect(page).toHaveScreenshot('water-collision-after-left.png');
  });

  test('player can walk away from water', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowRight');
      await waitForPlayerIdle(page);
    }
    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowDown');
      await waitForPlayerIdle(page);
    }

    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('water-collision-moved-away.png');
  });
});
