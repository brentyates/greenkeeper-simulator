import { test, expect } from '@playwright/test';
import { waitForGameReady, waitForPlayerIdle } from './utils/test-helpers';

test.describe('Resource Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=resource_test');
    await waitForGameReady(page);
    await page.waitForTimeout(200);
  });

  test('mowing depletes fuel resource over time', async ({ page }) => {
    await expect(page).toHaveScreenshot('resource-fuel-before.png');

    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fuel-after.png');
  });

  test('watering depletes water resource over time', async ({ page }) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-water-before.png');

    await page.keyboard.down('Space');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-water-after.png');
  });

  test('fertilizing depletes fertilizer resource over time', async ({ page }) => {
    await page.keyboard.press('3');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fert-before.png');

    await page.keyboard.down('Space');

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-fert-after.png');
  });

  test('resources stop depleting when equipment deactivated', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.down('Space');

    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await page.keyboard.up('Space');
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('resource-deactivated-initial.png');

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await waitForPlayerIdle(page);
    }

    await expect(page).toHaveScreenshot('resource-deactivated-after.png');
  });
});
