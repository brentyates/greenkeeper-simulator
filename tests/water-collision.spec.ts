import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Water Tile Collision', () => {
  test('player cannot walk onto water tiles', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('water-collision-after-left.png');
  });

  test('player can walk away from water', async ({ page }) => {
    await page.goto('/?testMode=true&preset=water_collision_test');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('water-collision-initial.png');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(250);
    }

    await expect(page).toHaveScreenshot('water-collision-moved-away.png');
  });
});
