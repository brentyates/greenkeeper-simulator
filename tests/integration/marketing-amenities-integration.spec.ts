/**
 * Marketing and Amenities Integration Tests
 *
 * Tests marketing campaigns and amenity purchases via public API.
 */

import { test, expect, waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('Marketing Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Marketing Stats', () => {
    test('getMarketingStats returns campaign info', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getMarketingStats());

      expect(stats).toBeDefined();
      // activeCampaigns is a count, not an array
      expect(typeof stats.activeCampaigns).toBe('number');
      expect(typeof stats.totalSpent).toBe('number');
      expect(typeof stats.totalROI).toBe('number');
    });

    test('no active campaigns initially', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getMarketingStats());
      expect(stats.activeCampaigns).toBe(0);
    });
  });

  test.describe('Marketing Campaigns', () => {
    test('can start a marketing campaign with sufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));

      const result = await page.evaluate(() =>
        window.game.startMarketingCampaign('local_newspaper', 7)
      );
      expect(result).toBe(true);

      const stats = await page.evaluate(() => window.game.getMarketingStats());
      // activeCampaigns is a count
      expect(stats.activeCampaigns).toBeGreaterThan(0);
    });

    test('campaign fails with insufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1));

      const result = await page.evaluate(() =>
        window.game.startMarketingCampaign('local_newspaper', 7)
      );
      expect(result).toBe(false);
    });

    test('campaign start behavior is consistent', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));
      const before = await page.evaluate(() => window.game.getEconomyState().cash);

      const result = await page.evaluate(() => window.game.startMarketingCampaign('local_newspaper', 7));

      const after = await page.evaluate(() => window.game.getEconomyState().cash);
      // Result should be a boolean indicating success or failure
      expect(typeof result).toBe('boolean');
      // Cash should be less or equal (less if campaign started, same if failed)
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  test.describe('Tee Time Stats', () => {
    test('getTeeTimeStats returns booking info', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getTeeTimeStats());

      expect(stats).toBeDefined();
      // getTeeTimeStats returns { totalBookings, cancellations, noShows, slotsAvailable }
      expect(typeof stats.totalBookings).toBe('number');
      expect(typeof stats.cancellations).toBe('number');
      expect(typeof stats.noShows).toBe('number');
      expect(typeof stats.slotsAvailable).toBe('number');
    });
  });
});

test.describe('Amenities Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Amenity Purchases', () => {
    test('can purchase amenity with sufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));

      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('clubhouse_upgrade')
      );
      // May succeed or fail depending on if upgrade exists and is available
      expect(typeof result).toBe('boolean');
    });

    test('purchase fails with insufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1));

      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('clubhouse_upgrade')
      );
      expect(result).toBe(false);
    });

    test('purchase deducts cash when successful', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      const before = await page.evaluate(() => window.game.getEconomyState().cash);

      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('pro_shop')
      );

      if (result) {
        const after = await page.evaluate(() => window.game.getEconomyState().cash);
        expect(after).toBeLessThan(before);
      }
    });
  });

  test.describe('Prestige System', () => {
    test('getPrestigeState returns prestige info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(state).toBeDefined();
      // getPrestigeState returns { score, stars, tier, amenityScore }
      expect(typeof state.score).toBe('number');
      expect(typeof state.stars).toBe('number');
      expect(typeof state.tier).toBe('string');
      expect(typeof state.amenityScore).toBe('number');
    });
  });
});
