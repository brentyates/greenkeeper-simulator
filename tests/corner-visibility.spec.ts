import { test, expect } from '@playwright/test';
import { waitForGameReady } from './utils/test-helpers';

test.describe('Corner Visibility', () => {
  const corners = [
    { name: 'top_left', preset: 'corner_top_left' },
    { name: 'top_right', preset: 'corner_top_right' },
    { name: 'bottom_left', preset: 'corner_bottom_left' },
    { name: 'bottom_right', preset: 'corner_bottom_right' }
  ];

  for (const corner of corners) {
    test(`player visible at ${corner.name} corner`, async ({ page }) => {
      await page.goto(`/?testMode=true&preset=${corner.preset}`);
      await waitForGameReady(page);

      await expect(page).toHaveScreenshot(`corner-${corner.name}.png`);
    });
  }
});
