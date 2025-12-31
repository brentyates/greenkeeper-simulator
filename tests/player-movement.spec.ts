import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Player Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
  });

  test('player moves in all 4 isometric directions', async ({ page }) => {
    await expect(page).toHaveScreenshot('movement-initial.png');

    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('movement-up.png');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('movement-right.png');

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('movement-down.png');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('movement-left.png');
  });

  test('player direction sprite updates correctly', async ({ page }) => {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('direction-up.png');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('direction-right.png');

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('direction-down.png');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('direction-left.png');
  });

  test('player stops at map boundaries', async ({ page }) => {
    await page.goto('/?testMode=true&preset=corner_bottom_left');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('boundary-bottom-left-initial.png');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(350);
    }

    await expect(page).toHaveScreenshot('boundary-bottom-left-after.png');
  });
});
