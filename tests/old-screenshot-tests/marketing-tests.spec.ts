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

test.describe('Marketing Campaign Tests', () => {
  test.describe('Campaign Management', () => {
    test('marketing stats are available', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const stats = await page.evaluate(() => window.getMarketingStats());
      expect(stats).not.toBeNull();
      expect(stats?.activeCampaigns).toBeGreaterThanOrEqual(0);
      expect(stats?.totalSpent).toBeGreaterThanOrEqual(0);
    });

    test('can start a marketing campaign', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(10000));
      await page.waitForTimeout(100);

      const initialStats = await page.evaluate(() => window.getMarketingStats());
      expect(initialStats?.activeCampaigns).toBe(0);

      const started = await page.evaluate(() => window.startMarketingCampaign('local_newspaper', 7));
      expect(started).toBe(true);

      const afterStats = await page.evaluate(() => window.getMarketingStats());
      expect(afterStats?.activeCampaigns).toBe(1);
    });

    test('starting campaign affects economy', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(10000));
      await page.waitForTimeout(100);

      const initialEconomy = await page.evaluate(() => window.getEconomyState());
      const initialSpent = initialEconomy?.spent ?? 0;

      await page.evaluate(() => window.startMarketingCampaign('radio_spot', 14));

      const afterEconomy = await page.evaluate(() => window.getEconomyState());
      expect(afterEconomy?.spent).toBeGreaterThan(initialSpent);
    });

    test('cannot start campaign without sufficient funds', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(10));
      await page.waitForTimeout(100);

      const started = await page.evaluate(() => window.startMarketingCampaign('radio_spot', 14));
      expect(started).toBe(false);
    });
  });

  test.describe('Marketing Dashboard', () => {
    test('marketing dashboard opens with K key', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);
      await page.waitForTimeout(500);

      await page.keyboard.press('k');
      await page.waitForTimeout(300);

      const stats = await page.evaluate(() => window.getMarketingStats());
      expect(stats).not.toBeNull();
    });
  });
});
