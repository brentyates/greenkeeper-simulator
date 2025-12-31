import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Tree Collision', () => {
  test('player cannot walk onto a tree tile', async ({ page }) => {
    await page.goto('/?testMode=true&preset=tree_collision_test');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('tree-collision-initial.png');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);

    await expect(page).toHaveScreenshot('tree-collision-blocked.png');

    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);

    await expect(page).toHaveScreenshot('tree-collision-moved-around.png');
  });
});
