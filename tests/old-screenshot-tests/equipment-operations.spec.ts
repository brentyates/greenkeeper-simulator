import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Equipment Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('equipment selection via API', async ({ page }) => {
    await page.evaluate(() => window.game.selectEquipment(1));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-mower-selected.png');

    await page.evaluate(() => window.game.selectEquipment(2));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-sprinkler-selected.png');

    await page.evaluate(() => window.game.selectEquipment(3));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-spreader-selected.png');
  });

  test('mowing changes grass state', async ({ page }) => {
    await expect(page).toHaveScreenshot('mowing-before.png');

    await page.evaluate(() => {
      window.game.selectEquipment(1);
      window.game.toggleEquipment(true);
      window.game.movePlayer('right');
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('mowing-after.png');
  });

  test('watering with moisture overlay', async ({ page }) => {
    await page.goto('/?testMode=true&preset=moisture_gradient');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    // Toggle overlay - using pressKey for Tab since there's no direct API yet
    await page.evaluate(() => window.game.pressKey('Tab'));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('watering-overlay-before.png');

    await page.evaluate(() => {
      window.game.selectEquipment(2);  // Sprinkler
      window.game.toggleEquipment(true);
      window.game.movePlayer('right');
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('watering-overlay-after.png');
  });

  test('fertilizing with nutrient overlay', async ({ page }) => {
    await page.goto('/?testMode=true&preset=nutrient_gradient');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    // Toggle overlay twice - using pressKey for Tab
    await page.evaluate(() => {
      window.game.pressKey('Tab');
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.game.pressKey('Tab');
    });
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('fertilizing-overlay-before.png');

    await page.evaluate(() => {
      window.game.selectEquipment(3);  // Spreader
      window.game.toggleEquipment(true);
      window.game.movePlayer('right');
      window.game.movePlayer('right');
      window.game.movePlayer('right');
    });

    await page.evaluate(() => window.game.waitForPlayerIdle());

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('fertilizing-overlay-after.png');
  });

  test('equipment activation and deactivation', async ({ page }) => {
    await page.evaluate(() => window.game.selectEquipment(1));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-inactive.png');

    await page.evaluate(() => window.game.toggleEquipment(true));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-active.png');

    await page.evaluate(() => window.game.toggleEquipment(false));
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-deactivated.png');
  });
});
