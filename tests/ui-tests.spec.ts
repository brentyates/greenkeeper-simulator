import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle } from './utils/test-helpers';

test.describe('UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('overlay mode cycles correctly', async ({ page }) => {
    await expect(page).toHaveScreenshot('overlay-normal.png');

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-moisture.png');

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-nutrients.png');

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-height.png');

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-back-to-normal.png');
  });

  test('pause menu appears when P pressed', async ({ page }) => {
    await expect(page).toHaveScreenshot('pause-game-running.png');

    await page.keyboard.press('p');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('pause-menu-visible.png');

    await page.keyboard.press('p');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('pause-game-resumed.png');
  });

  test('camera zoom works', async ({ page }) => {
    await expect(page).toHaveScreenshot('zoom-default.png');

    await page.keyboard.press(']');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('zoom-in.png');

    await page.keyboard.press('[');
    await page.waitForTimeout(100);
    await page.keyboard.press('[');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('zoom-out.png');
  });

  test('game state freezes when paused', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    await page.keyboard.press('ArrowRight');
    await waitForPlayerIdle(page);

    await page.keyboard.up('Space');
    await page.keyboard.press('p');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('pause-freeze-initial.png');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('pause-freeze-after-input.png');
  });
});
