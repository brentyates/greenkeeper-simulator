import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Time System', () => {
  test('time displays correctly at morning', async ({ page }) => {
    await page.goto('/?testMode=true&preset=time_morning');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('time-morning-display.png');
  });

  test('time displays correctly at noon', async ({ page }) => {
    await page.goto('/?testMode=true&preset=time_noon');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('time-noon-display.png');
  });

  test('time displays correctly at evening', async ({ page }) => {
    await page.goto('/?testMode=true&preset=time_evening');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('time-evening-display.png');
  });

  test('time displays correctly at night', async ({ page }) => {
    await page.goto('/?testMode=true&preset=time_night');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('time-night-display.png');
  });

  test('day/night cycle changes daylight overlay tint', async ({ page }) => {
    await page.goto('/?testMode=true&preset=time_morning');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('daylight-morning-tint.png');

    await page.goto('/?testMode=true&preset=time_night');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('daylight-night-tint.png');
  });
});
