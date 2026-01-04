import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Resource Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=resource_test');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('mowing depletes fuel resource over time', async ({ page }) => {
    await expect(page).toHaveScreenshot('resource-fuel-before.png');

    // Use public API
    await page.evaluate(() => {
      window.game.selectEquipment(1);
      window.game.toggleEquipment(true);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('right');
      }
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fuel-after.png');
  });

  test('watering depletes water resource over time', async ({ page }) => {
    // Use public API
    await page.evaluate(() => window.game.selectEquipment(2));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-water-before.png');

    await page.evaluate(() => {
      window.game.toggleEquipment(true);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('right');
      }
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-water-after.png');
  });

  test('fertilizing depletes fertilizer resource over time', async ({ page }) => {
    // Use public API
    await page.evaluate(() => window.game.selectEquipment(3));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fert-before.png');

    await page.evaluate(() => {
      window.game.toggleEquipment(true);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('right');
      }
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fert-after.png');
  });

  test('resources stop depleting when equipment deactivated', async ({ page }) => {
    // Use public API
    await page.evaluate(() => {
      window.game.selectEquipment(1);
      window.game.toggleEquipment(true);
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-deactivated-initial.png');

    await page.evaluate(() => {
      window.game.movePlayer('right');
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await expect(page).toHaveScreenshot('resource-deactivated-after.png');
  });
});
