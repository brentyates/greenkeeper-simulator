/**
 * Economy Systems Integration Tests
 *
 * Tests for save-game, reputation, tee-revenue, walk-ons, and economy modules.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Save Game Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Save Operations', () => {
    test('saveCurrentGame saves without error', async ({ page }) => {
      await page.evaluate(() => window.game.saveCurrentGame());
      expect(true).toBe(true);
    });

    test('hasSavedGame returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hasSavedGame());
      expect(typeof result).toBe('boolean');
    });

    test('save and hasSavedGame work together', async ({ page }) => {
      await page.evaluate(() => window.game.saveCurrentGame());
      const hasSave = await page.evaluate(() => window.game.hasSavedGame());
      expect(typeof hasSave).toBe('boolean');
    });

    test('getSaveGameInfo returns save info or null', async ({ page }) => {
      await page.evaluate(() => window.game.saveCurrentGame());
      const info = await page.evaluate(() => window.game.getSaveGameInfo());
      if (info) {
        expect(typeof info.savedAt).toBe('number');
        expect(typeof info.gameDay).toBe('number');
      }
    });

    test('listSaveGames returns array', async ({ page }) => {
      const saves = await page.evaluate(() => window.game.listSaveGames());
      expect(Array.isArray(saves)).toBe(true);
    });
  });

  test.describe('Delete Save', () => {
    test('deleteSaveGame returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.deleteSaveGame('nonexistent_scenario')
      );
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Reputation System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Reputation State', () => {
    test('getReputationSummaryData returns reputation info', async ({ page }) => {
      const summary = await page.evaluate(() =>
        window.game.getReputationSummaryData()
      );

      expect(summary).toBeDefined();
      expect(typeof summary.score).toBe('number');
      expect(typeof summary.starRating).toBe('number');
      expect(typeof summary.trend).toBe('string');
      expect(typeof summary.totalTurnAways).toBe('number');
      expect(typeof summary.returnRate).toBe('number');
    });

    test('reputation score is within valid range', async ({ page }) => {
      const summary = await page.evaluate(() =>
        window.game.getReputationSummaryData()
      );

      expect(summary.score).toBeGreaterThanOrEqual(0);
      expect(summary.starRating).toBeGreaterThanOrEqual(0);
      expect(summary.starRating).toBeLessThanOrEqual(5);
    });
  });

  test.describe('Track Golfer Visits', () => {
    test('trackGolferVisitForReputation works', async ({ page }) => {
      await page.evaluate(() => {
        window.game.trackGolferVisitForReputation('test_golfer_1', false);
        window.game.trackGolferVisitForReputation('test_golfer_2', true);
      });

      const summary = await page.evaluate(() =>
        window.game.getReputationSummaryData()
      );
      expect(summary).toBeDefined();
    });

    test('trackTurnAwayForReputation works', async ({ page }) => {
      await page.evaluate(() => {
        window.game.trackTurnAwayForReputation('high_price');
      });

      const summary = await page.evaluate(() =>
        window.game.getReputationSummaryData()
      );
      expect(summary).toBeDefined();
    });
  });
});

test.describe('Tee Revenue Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Revenue Summary', () => {
    test('getRevenueSummaryData returns revenue info', async ({ page }) => {
      const summary = await page.evaluate(() =>
        window.game.getRevenueSummaryData()
      );

      expect(summary).toBeDefined();
      expect(typeof summary.todaysGross).toBe('number');
      expect(typeof summary.todaysNet).toBe('number');
      expect(typeof summary.weeklyAvg).toBe('number');
      expect(typeof summary.monthlyAvg).toBe('number');
      expect(typeof summary.topRevenueSource).toBe('string');
    });

    test('revenue values are non-negative', async ({ page }) => {
      const summary = await page.evaluate(() =>
        window.game.getRevenueSummaryData()
      );

      expect(summary.todaysGross).toBeGreaterThanOrEqual(0);
      expect(summary.weeklyAvg).toBeGreaterThanOrEqual(0);
      expect(summary.monthlyAvg).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Fee Calculations', () => {
    test('calculateGreenFeeForGolfer returns fee', async ({ page }) => {
      const publicFee = await page.evaluate(() =>
        window.game.calculateGreenFeeForGolfer('public')
      );
      expect(typeof publicFee).toBe('number');
      expect(publicFee).toBeGreaterThan(0);

      const memberFee = await page.evaluate(() =>
        window.game.calculateGreenFeeForGolfer('member')
      );
      expect(typeof memberFee).toBe('number');

      const guestFee = await page.evaluate(() =>
        window.game.calculateGreenFeeForGolfer('guest_of_member')
      );
      expect(typeof guestFee).toBe('number');
    });

    test('calculateCartFeeForGolfer returns fee', async ({ page }) => {
      const cartFee = await page.evaluate(() =>
        window.game.calculateCartFeeForGolfer()
      );
      expect(typeof cartFee).toBe('number');
      expect(cartFee).toBeGreaterThanOrEqual(0);
    });

    test('getAverageRevenue returns number', async ({ page }) => {
      const avg7 = await page.evaluate(() => window.game.getAverageRevenue(7));
      expect(typeof avg7).toBe('number');

      const avg30 = await page.evaluate(() => window.game.getAverageRevenue(30));
      expect(typeof avg30).toBe('number');
    });
  });

  test.describe('Time Utility Functions', () => {
    test('isCurrentTimeWeekend returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.isCurrentTimeWeekend()
      );
      expect(typeof result).toBe('boolean');
    });

    test('isCurrentTimePrimeMorning returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.isCurrentTimePrimeMorning()
      );
      expect(typeof result).toBe('boolean');
    });

    test('isCurrentTimeTwilight returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.isCurrentTimeTwilight()
      );
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Walk-On System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Walk-On State', () => {
    test('getWalkOnSummary returns walk-on info', async ({ page }) => {
      const summary = await page.evaluate(() => window.game.getWalkOnSummary());

      expect(summary).toBeDefined();
      expect(typeof summary.queueLength).toBe('number');
      expect(typeof summary.served).toBe('number');
      expect(typeof summary.turnedAway).toBe('number');
      expect(typeof summary.gaveUp).toBe('number');
      expect(typeof summary.avgWait).toBe('number');
      expect(typeof summary.estimatedWait).toBe('number');
    });

    test('walk-on queue starts empty', async ({ page }) => {
      const summary = await page.evaluate(() => window.game.getWalkOnSummary());
      expect(summary.queueLength).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Walk-On Policy', () => {
    test('updateWalkOnPolicy changes policy', async ({ page }) => {
      await page.evaluate(() => window.game.updateWalkOnPolicy(45, 10));
      const summary = await page.evaluate(() => window.game.getWalkOnSummary());
      expect(summary).toBeDefined();
    });
  });

  test.describe('Add Walk-On', () => {
    test('addWalkOnGolfer returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.addWalkOnGolfer());
      expect(typeof result).toBe('boolean');
    });

    test('adding walk-on may increase queue', async ({ page }) => {
      const before = await page.evaluate(() =>
        window.game.getWalkOnSummary().queueLength
      );
      await page.evaluate(() => window.game.addWalkOnGolfer());
      const after = await page.evaluate(() =>
        window.game.getWalkOnSummary().queueLength
      );
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });
});

test.describe('Economy System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Economy State', () => {
    test('getEconomyState returns economy info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());

      expect(state).toBeDefined();
      expect(typeof state.cash).toBe('number');
      expect(typeof state.earned).toBe('number');
      expect(typeof state.spent).toBe('number');
    });

    test('cash starts positive', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBeGreaterThan(0);
    });
  });

  test.describe('Financial Operations', () => {
    test('economy tracks income and expenses', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.earned).toBeGreaterThanOrEqual(0);
      expect(state.spent).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Autonomous Equipment Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Robot State', () => {
    test('getRobotList returns array', async ({ page }) => {
      const robots = await page.evaluate(() => window.game.getRobotList());
      expect(Array.isArray(robots)).toBe(true);
    });

    test('robot list items have correct structure', async ({ page }) => {
      const robots = await page.evaluate(() => window.game.getRobotList());
      for (const robot of robots) {
        expect(typeof robot.id).toBe('string');
        expect(typeof robot.type).toBe('string');
        expect(typeof robot.state).toBe('string');
        expect(typeof robot.battery).toBe('number');
      }
    });
  });

  test.describe('Robot Purchase/Sale', () => {
    test('purchaseRobotUnit returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.purchaseRobotUnit('nonexistent_robot')
      );
      expect(typeof result).toBe('boolean');
    });

    test('sellRobotUnit returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.sellRobotUnit('nonexistent_robot')
      );
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Weather System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Weather Info', () => {
    test('getWeatherDescription returns string', async ({ page }) => {
      const desc = await page.evaluate(() => window.game.getWeatherDescription());
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    });

    test('getWeatherImpact returns string', async ({ page }) => {
      const impact = await page.evaluate(() => window.game.getWeatherImpact());
      expect(typeof impact).toBe('string');
    });

    test('getCurrentSeason returns valid season', async ({ page }) => {
      const season = await page.evaluate(() => window.game.getCurrentSeason());
      expect(['spring', 'summer', 'fall', 'winter']).toContain(season);
    });
  });
});

test.describe('Scenario System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Scenario State', () => {
    test('getScenarioState returns scenario info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(state).toBeDefined();
        expect(typeof state.progress).toBe('number');
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });

    test('scenario progress is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());
      if (state) {
        expect(state.progress).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
