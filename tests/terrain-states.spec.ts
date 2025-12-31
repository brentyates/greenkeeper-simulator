import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Terrain States', () => {
  test('all terrain states render correctly', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_terrain_states');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('all-terrain-states.png');
  });

  test('all grass mown preset renders correctly', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('all-grass-mown.png');
  });

  test('all grass unmown preset renders correctly', async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_unmown');
    await waitForGameReady(page);

    await expect(page).toHaveScreenshot('all-grass-unmown.png');
  });
});
