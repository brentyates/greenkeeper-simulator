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

test.describe('Prestige System Tests', () => {
  test.describe('Amenity Purchases', () => {
    test('purchasing amenity increases prestige amenity score', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const initialPrestige = await page.evaluate(() => window.getPrestigeState());
      expect(initialPrestige).not.toBeNull();
      const initialAmenityScore = initialPrestige?.amenityScore ?? 0;

      await page.evaluate(() => window.setCash(100000));
      await page.waitForTimeout(100);

      const purchased = await page.evaluate(() => window.purchaseAmenity('facility_driving_range'));
      expect(purchased).toBe(true);

      const newPrestige = await page.evaluate(() => window.getPrestigeState());
      expect(newPrestige).not.toBeNull();
      expect(newPrestige?.amenityScore).toBeGreaterThan(initialAmenityScore);
    });

    test('prestige score reflects amenity upgrades', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(500000));
      await page.waitForTimeout(100);

      const initialPrestige = await page.evaluate(() => window.getPrestigeState());
      const initialScore = initialPrestige?.score ?? 0;

      await page.evaluate(() => window.purchaseAmenity('clubhouse_1'));
      await page.evaluate(() => window.purchaseAmenity('facility_putting_green'));

      const finalPrestige = await page.evaluate(() => window.getPrestigeState());
      expect(finalPrestige?.amenityScore).toBeGreaterThan(initialPrestige?.amenityScore ?? 0);
      expect(finalPrestige?.score).toBeGreaterThanOrEqual(initialScore);
    });

    test('cannot purchase amenity without sufficient funds', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      await page.evaluate(() => window.setCash(100));
      await page.waitForTimeout(100);

      const purchased = await page.evaluate(() => window.purchaseAmenity('clubhouse_1'));
      expect(purchased).toBe(false);
    });
  });

  test.describe('Star Rating', () => {
    test('prestige state includes star rating and tier', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const prestige = await page.evaluate(() => window.getPrestigeState());
      expect(prestige).not.toBeNull();
      expect(prestige?.stars).toBeGreaterThanOrEqual(0);
      expect(prestige?.stars).toBeLessThanOrEqual(5);
      expect(prestige?.tier).toBeDefined();
      expect(['municipal', 'public', 'semi_private', 'private_club', 'championship']).toContain(prestige?.tier);
    });

    test('star rating increases with amenities and time', async ({ page }) => {
      await page.goto('/?scenario=tutorial_basics');
      await waitForGameReady(page);

      const initialPrestige = await page.evaluate(() => window.getPrestigeState());
      expect(initialPrestige).not.toBeNull();
      const initialScore = initialPrestige?.score ?? 0;

      await page.evaluate(() => window.setCash(500000));
      await page.waitForTimeout(100);

      await page.evaluate(() => window.purchaseAmenity('clubhouse_1'));
      await page.evaluate(() => window.purchaseAmenity('pro_shop_1'));
      await page.evaluate(() => window.purchaseAmenity('dining_1'));
      await page.evaluate(() => window.purchaseAmenity('facility_driving_range'));
      await page.evaluate(() => window.purchaseAmenity('facility_putting_green'));

      const afterPurchasePrestige = await page.evaluate(() => window.getPrestigeState());
      expect(afterPurchasePrestige?.amenityScore).toBeGreaterThan(0);

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.advanceDay());
      }

      const finalPrestige = await page.evaluate(() => window.getPrestigeState());
      expect(finalPrestige).not.toBeNull();
      expect(finalPrestige?.score).toBeGreaterThan(initialScore);
    });
  });
});
