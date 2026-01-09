import { test, expect } from '@playwright/test';

async function waitForGameReady(page: import('@playwright/test').Page, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ready = await page.evaluate(() => window.game !== null);
    if (ready) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Game did not initialize within timeout');
}

test.describe('Tee Time System Tests', () => {
  test.describe('Daily Bookings', () => {
    test('tee time stats are available', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const stats = await page.evaluate(() => window.getTeeTimeStats());
      expect(stats).not.toBeNull();
      expect(stats?.totalBookings).toBeGreaterThanOrEqual(0);
      expect(stats?.slotsAvailable).toBeGreaterThanOrEqual(0);
    });

    test('advancing day processes bookings', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const day1 = await page.evaluate(() => window.getGameDay());
      expect(day1).toBe(1);

      await page.evaluate(() => window.advanceDay());
      await page.waitForTimeout(100);

      const day2 = await page.evaluate(() => window.getGameDay());
      expect(day2).toBe(2);

      const stats = await page.evaluate(() => window.getTeeTimeStats());
      expect(stats).not.toBeNull();
    });

    test('multiple days can be advanced', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const initialDay = await page.evaluate(() => window.getGameDay());
      expect(initialDay).toBe(1);

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.advanceDay());
      }

      const finalDay = await page.evaluate(() => window.getGameDay());
      expect(finalDay).toBe(6);
    });
  });
});
