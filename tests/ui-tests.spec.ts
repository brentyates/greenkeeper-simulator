import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('overlay mode cycles correctly', async ({ page }) => {
    await expect(page).toHaveScreenshot('overlay-normal.png');

    // Use public API for Tab key
    await page.evaluate(() => window.game.pressKey('Tab'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-moisture.png');

    await page.evaluate(() => window.game.pressKey('Tab'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-nutrients.png');

    await page.evaluate(() => window.game.pressKey('Tab'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-height.png');

    await page.evaluate(() => window.game.pressKey('Tab'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('overlay-back-to-normal.png');
  });

  test('pause menu appears when P pressed', async ({ page }) => {
    await expect(page).toHaveScreenshot('pause-game-running.png');

    // Use public API
    await page.evaluate(() => window.game.pressKey('p'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('pause-menu-visible.png');

    await page.evaluate(() => window.game.pressKey('p'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('pause-game-resumed.png');
  });

  test('camera zoom works', async ({ page }) => {
    await expect(page).toHaveScreenshot('zoom-default.png');

    // Use public API - note: zoom doesn't have dedicated API yet, using pressKey
    await page.evaluate(() => window.game.pressKey(']'));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('zoom-in.png');

    await page.evaluate(() => window.game.pressKey('['));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.game.pressKey('['));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('zoom-out.png');
  });

  test('game state freezes when paused', async ({ page }) => {
    // Use public API
    await page.evaluate(() => {
      window.game.selectEquipment(1);
      window.game.toggleEquipment(true);
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => {
      window.game.toggleEquipment(false);
      window.game.pressKey('p');  // Pause
    });
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('pause-freeze-initial.png');

    // Try to move while paused - should not work
    await page.evaluate(() => window.game.movePlayer('right'));
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('pause-freeze-after-input.png');
  });
});
