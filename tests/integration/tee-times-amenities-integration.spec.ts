/**
 * Tee Times and Amenities Integration Tests
 *
 * Tests tee time booking system and amenity upgrades via public API.
 */

import { test, expect, waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('Tee Times Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Tee Sheet', () => {
    test('getTeeSheet returns tee time array', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());

      expect(Array.isArray(teeSheet)).toBe(true);
    });

    test('getTeeSheet accepts optional day parameter', async ({ page }) => {
      const day = await page.evaluate(() => window.game.getGameDay());
      const teeSheet = await page.evaluate((d) => window.game.getTeeSheet(d), day);

      expect(Array.isArray(teeSheet)).toBe(true);
    });

    test('tee times have expected structure', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());

      if (teeSheet.length > 0) {
        const tt = teeSheet[0];
        expect(typeof tt.id).toBe('string');
        expect(typeof tt.time).toBe('string');
        expect(typeof tt.status).toBe('string');
        expect(typeof tt.playerCount).toBe('number');
      }
    });

    test('tee time status is valid', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());
      const validStatuses = ['available', 'booked', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];

      for (const tt of teeSheet) {
        expect(validStatuses).toContain(tt.status);
      }
    });
  });

  test.describe('Tee Time Booking', () => {
    test('bookTeeTime returns boolean', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());
      const available = teeSheet.find(tt => tt.status === 'available');

      if (available) {
        const result = await page.evaluate((id) =>
          window.game.bookTeeTime(id, 4),
          available.id
        );
        expect(typeof result).toBe('boolean');
      }
    });

    test('bookTeeTime with different player counts', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());
      const available = teeSheet.filter(tt => tt.status === 'available');

      if (available.length >= 3) {
        await page.evaluate((id) => window.game.bookTeeTime(id, 2), available[0].id);
        await page.evaluate((id) => window.game.bookTeeTime(id, 3), available[1].id);
        await page.evaluate((id) => window.game.bookTeeTime(id, 4), available[2].id);

        const updatedSheet = await page.evaluate(() => window.game.getTeeSheet());
        expect(updatedSheet.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Tee Time Check-In', () => {
    test('checkInTeeTime returns boolean', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());
      const available = teeSheet.find(tt => tt.status === 'available');

      if (available) {
        await page.evaluate((id) => window.game.bookTeeTime(id, 4), available.id);
        const result = await page.evaluate((id) =>
          window.game.checkInTeeTime(id),
          available.id
        );
        expect(typeof result).toBe('boolean');
      }
    });
  });

  test.describe('Tee Time Cancellation', () => {
    test('cancelTeeTimeBooking returns boolean', async ({ page }) => {
      const teeSheet = await page.evaluate(() => window.game.getTeeSheet());
      const available = teeSheet.find(tt => tt.status === 'available');

      if (available) {
        await page.evaluate((id) => window.game.bookTeeTime(id, 4), available.id);
        const result = await page.evaluate((id) =>
          window.game.cancelTeeTimeBooking(id),
          available.id
        );
        expect(typeof result).toBe('boolean');
      }
    });
  });

  test.describe('Tee Time Stats', () => {
    test('getTeeTimeStats returns booking info', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getTeeTimeStats());

      expect(stats).toBeDefined();
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

  test.describe('Available Amenities', () => {
    test('getAvailableAmenities returns upgrade list', async ({ page }) => {
      const amenities = await page.evaluate(() => window.game.getAvailableAmenities());

      expect(Array.isArray(amenities)).toBe(true);
    });

    test('amenities have expected structure', async ({ page }) => {
      const amenities = await page.evaluate(() => window.game.getAvailableAmenities());

      if (amenities.length > 0) {
        const a = amenities[0];
        expect(typeof a.id).toBe('string');
        expect(typeof a.name).toBe('string');
        expect(typeof a.cost).toBe('number');
        expect(typeof a.purchased).toBe('boolean');
      }
    });

    test('amenity costs are positive', async ({ page }) => {
      const amenities = await page.evaluate(() => window.game.getAvailableAmenities());

      for (const a of amenities) {
        expect(a.cost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Amenity Purchases', () => {
    test('purchaseAmenity returns boolean', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('clubhouse_upgrade')
      );
      expect(typeof result).toBe('boolean');
    });

    test('purchaseAmenity fails with insufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1));
      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('clubhouse_upgrade')
      );
      expect(result).toBe(false);
    });
  });

  test.describe('Prestige System', () => {
    test('getPrestigeState returns complete prestige info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(state).toBeDefined();
      expect(typeof state.score).toBe('number');
      expect(typeof state.stars).toBe('number');
      expect(typeof state.tier).toBe('string');
      expect(typeof state.amenityScore).toBe('number');
    });

    test('prestige score is non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      expect(state.score).toBeGreaterThanOrEqual(0);
    });

    test('star rating is within 0-5 range', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      expect(state.stars).toBeGreaterThanOrEqual(0);
      expect(state.stars).toBeLessThanOrEqual(5);
    });

    test('tier is a valid prestige tier', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      const validTiers = ['municipal', 'public', 'semi_private', 'private', 'exclusive', 'championship'];
      expect(validTiers).toContain(state.tier);
    });
  });
});

test.describe('Marketing Campaign Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Campaign Management', () => {
    test('getActiveCampaigns returns array', async ({ page }) => {
      const campaigns = await page.evaluate(() => window.game.getActiveCampaigns());

      expect(Array.isArray(campaigns)).toBe(true);
    });

    test('can start and track campaign', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));

      const result = await page.evaluate(() =>
        window.game.startMarketingCampaign('local_newspaper', 7)
      );

      if (result) {
        const campaigns = await page.evaluate(() => window.game.getActiveCampaigns());
        expect(campaigns.length).toBeGreaterThan(0);
      }
    });

    test('campaign has expected structure', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      await page.evaluate(() => window.game.startMarketingCampaign('local_newspaper', 7));

      const campaigns = await page.evaluate(() => window.game.getActiveCampaigns());

      if (campaigns.length > 0) {
        const c = campaigns[0];
        expect(typeof c.campaignId).toBe('string');
        expect(typeof c.daysRemaining).toBe('number');
      }
    });

    test('endMarketingCampaign returns boolean', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      await page.evaluate(() => window.game.startMarketingCampaign('local_newspaper', 7));

      const campaigns = await page.evaluate(() => window.game.getActiveCampaigns());

      if (campaigns.length > 0) {
        const result = await page.evaluate((id) =>
          window.game.endMarketingCampaign(id),
          campaigns[0].campaignId
        );
        expect(typeof result).toBe('boolean');
      }
    });
  });

  test.describe('Marketing Stats', () => {
    test('getMarketingStats returns campaign info', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getMarketingStats());

      expect(stats).toBeDefined();
      expect(typeof stats.activeCampaigns).toBe('number');
      expect(typeof stats.totalSpent).toBe('number');
      expect(typeof stats.totalROI).toBe('number');
    });
  });
});
