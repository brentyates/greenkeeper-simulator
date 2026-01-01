import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle } from './utils/test-helpers';

test.describe('Equipment Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('equipment selection via keyboard', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-mower-selected.png');

    await page.keyboard.press('2');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-sprinkler-selected.png');

    await page.keyboard.press('3');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('equipment-spreader-selected.png');
  });

  test('mowing changes grass state', async ({ page }) => {
    await expect(page).toHaveScreenshot('mowing-before.png');

    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('mowing-after.png');
  });

  test('watering with moisture overlay', async ({ page }) => {
    await page.goto('/?testMode=true&preset=moisture_gradient');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('watering-overlay-before.png');

    await page.keyboard.press('2');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('watering-overlay-after.png');
  });

  test('fertilizing with nutrient overlay', async ({ page }) => {
    await page.goto('/?testMode=true&preset=nutrient_gradient');
    await waitForGameReady(page);
    await page.waitForTimeout(200);

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('fertilizing-overlay-before.png');

    await page.keyboard.press('3');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('fertilizing-overlay-after.png');
  });

  test('equipment activation and deactivation via spacebar', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-inactive.png');

    await page.keyboard.down('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-active.png');

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('equipment-deactivated.png');
  });
});
