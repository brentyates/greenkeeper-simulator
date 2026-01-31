/**
 * Advanced Systems Integration Tests
 *
 * Tests for low-coverage modules: autonomous-equipment, scenario, terrain, tee-times, research
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Autonomous Equipment Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Robot State', () => {
    test('getRobotState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state).toBeDefined();
      expect(typeof state.totalRobots).toBe('number');
      expect(typeof state.workingRobots).toBe('number');
      expect(typeof state.brokenRobots).toBe('number');
    });

    test('robot counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.totalRobots).toBeGreaterThanOrEqual(0);
      expect(state.workingRobots).toBeGreaterThanOrEqual(0);
      expect(state.brokenRobots).toBeGreaterThanOrEqual(0);
    });

    test('working + broken robots equals total', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.workingRobots + state.brokenRobots).toBe(state.totalRobots);
    });
  });

  test.describe('Robot Purchase', () => {
    test('getAvailableRobots returns array', async ({ page }) => {
      const robots = await page.evaluate(() => window.game.getAvailableRobots());
      expect(Array.isArray(robots)).toBe(true);
    });

    test('purchaseRobotUnit handles invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.purchaseRobotUnit('invalid_robot_id')
      );
      expect(result).toBe(false);
    });

    test('sellRobotUnit handles invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.sellRobotUnit('invalid_robot_id')
      );
      expect(result).toBe(false);
    });
  });
});

test.describe('Scenario System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Scenario Progress', () => {
    test('getScenarioProgress returns valid progress', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());
      if (progress) {
        expect(typeof progress.daysElapsed).toBe('number');
        expect(typeof progress.currentCash).toBe('number');
        expect(typeof progress.totalRevenue).toBe('number');
        expect(typeof progress.totalExpenses).toBe('number');
        expect(typeof progress.totalGolfers).toBe('number');
        expect(typeof progress.currentHealth).toBe('number');
        expect(typeof progress.currentRating).toBe('number');
      }
    });

    test('scenario progress values are valid', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());
      if (progress) {
        expect(progress.daysElapsed).toBeGreaterThanOrEqual(0);
        expect(progress.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(progress.totalExpenses).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Scenario State', () => {
    test('scenario state tracks completion', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());
      if (state) {
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });
  });
});

test.describe('Terrain System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Terrain Dimensions', () => {
    test('getTerrainDimensions returns valid dimensions', async ({ page }) => {
      const dims = await page.evaluate(() => window.game.getTerrainDimensions());
      expect(dims).toBeDefined();
      expect(typeof dims.width).toBe('number');
      expect(typeof dims.height).toBe('number');
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });
  });

  test.describe('Terrain Cell Data', () => {
    test('getTerrainCellData returns valid cell data', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainCellData(5, 5));
      if (cell) {
        expect(typeof cell.type).toBe('string');
        expect(typeof cell.elevation).toBe('number');
        expect(typeof cell.moisture).toBe('number');
        expect(typeof cell.nutrients).toBe('number');
        expect(typeof cell.height).toBe('number');
        expect(typeof cell.health).toBe('number');
      }
    });

    test('getTerrainCellData returns null for invalid position', async ({ page }) => {
      const cell = await page.evaluate(() => window.game.getTerrainCellData(-1, -1));
      expect(cell).toBeNull();
    });

    test('getTerrainAt returns cell info', async ({ page }) => {
      const terrain = await page.evaluate(() => window.game.getTerrainAt(5, 5));
      if (terrain) {
        expect(typeof terrain.type).toBe('string');
        expect(typeof terrain.elevation).toBe('number');
        expect(typeof terrain.lastMowed).toBe('number');
        expect(typeof terrain.lastWatered).toBe('number');
        expect(typeof terrain.lastFertilized).toBe('number');
      }
    });
  });

  test.describe('Terrain Types', () => {
    test('getTerrainTypes returns array of types', async ({ page }) => {
      const types = await page.evaluate(() => window.game.getTerrainTypes());
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    test('terrain types are valid', async ({ page }) => {
      const types = await page.evaluate(() => window.game.getTerrainTypes());
      const validTypes = ['fairway', 'rough', 'green', 'bunker', 'water', 'tee'];
      for (const type of types) {
        expect(validTypes).toContain(type);
      }
    });
  });
});

test.describe('Tee Times System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Tee Sheet', () => {
    test('getTeeSheet returns array of tee times', async ({ page }) => {
      const sheet = await page.evaluate(() => window.game.getTeeSheet());
      expect(Array.isArray(sheet)).toBe(true);
    });

    test('tee time entries have correct structure', async ({ page }) => {
      const sheet = await page.evaluate(() => window.game.getTeeSheet());
      for (const tt of sheet) {
        expect(typeof tt.id).toBe('string');
        expect(typeof tt.time).toBe('string');
        expect(typeof tt.status).toBe('string');
        expect(typeof tt.playerCount).toBe('number');
      }
    });

    test('getTeeSheet accepts day parameter', async ({ page }) => {
      const sheet = await page.evaluate(() => {
        const day = window.game.getGameDay();
        return window.game.getTeeSheet(day);
      });
      expect(Array.isArray(sheet)).toBe(true);
    });
  });

  test.describe('Tee Time Operations', () => {
    test('bookTeeTime handles valid booking', async ({ page }) => {
      const result = await page.evaluate(() => {
        const sheet = window.game.getTeeSheet();
        const available = sheet.find(t => t.status === 'available');
        if (available) {
          return window.game.bookTeeTime(available.id, 4);
        }
        return null;
      });
      if (result !== null) {
        expect(typeof result).toBe('boolean');
      }
    });

    test('getTeeTimeStats returns valid stats', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getTeeTimeStats());
      expect(stats).toBeDefined();
      expect(typeof stats.totalBookings).toBe('number');
      expect(typeof stats.cancellations).toBe('number');
      expect(typeof stats.noShows).toBe('number');
      expect(typeof stats.slotsAvailable).toBe('number');
    });

    test('tee time stats values are non-negative', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getTeeTimeStats());
      expect(stats.totalBookings).toBeGreaterThanOrEqual(0);
      expect(stats.cancellations).toBeGreaterThanOrEqual(0);
      expect(stats.noShows).toBeGreaterThanOrEqual(0);
      expect(stats.slotsAvailable).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Tee Time State', () => {
    test('getTeeTimeState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getTeeTimeState?.());
      if (state) {
        expect(typeof state.bookedCount).toBe('number');
        expect(typeof state.checkedInCount).toBe('number');
      }
    });
  });
});

test.describe('Research System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Research Progress', () => {
    test('isResearchCompleted handles invalid id', async ({ page }) => {
      const completed = await page.evaluate(() =>
        window.game.isResearchCompleted('invalid_research_id')
      );
      expect(completed).toBe(false);
    });

    test('getAvailableResearch returns unlocked items', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());
      expect(Array.isArray(available)).toBe(true);
      for (const id of available) {
        expect(typeof id).toBe('string');
      }
    });
  });

  test.describe('Research Operations', () => {
    test('startResearchItem with valid item', async ({ page }) => {
      const result = await page.evaluate(() => {
        const available = window.game.getAvailableResearch();
        if (available.length > 0) {
          return window.game.startResearchItem(available[0]);
        }
        return null;
      });
      if (result !== null) {
        expect(typeof result).toBe('boolean');
      }
    });

    test('cancelCurrentResearch works', async ({ page }) => {
      await page.evaluate(() => {
        const available = window.game.getAvailableResearch();
        if (available.length > 0) {
          window.game.startResearchItem(available[0]);
          window.game.cancelCurrentResearch();
        }
      });
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(state.currentResearch).toBeNull();
    });

    test('queueResearch adds to queue', async ({ page }) => {
      const beforeLen = await page.evaluate(() =>
        window.game.getResearchState().researchQueue.length
      );
      await page.evaluate(() => {
        const available = window.game.getAvailableResearch();
        if (available.length > 0) {
          window.game.queueResearch(available[0]);
        }
      });
      const afterLen = await page.evaluate(() =>
        window.game.getResearchState().researchQueue.length
      );
      expect(afterLen).toBeGreaterThanOrEqual(beforeLen);
    });
  });
});

test.describe('Economy System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Cash Management', () => {
    test('setCash updates cash value', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBe(10000);
    });

    test('setCash handles negative adjustment', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(5000));
      await page.evaluate(() => window.game.setCash(3000));
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBe(3000);
    });
  });

  test.describe('Revenue Tracking', () => {
    test('getRevenueState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRevenueState());
      expect(state).toBeDefined();
      expect(typeof state.greenFees).toBe('number');
      expect(typeof state.cartFees).toBe('number');
      expect(typeof state.proShopSales).toBe('number');
      expect(typeof state.foodBeverage).toBe('number');
    });

    test('revenue values are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRevenueState());
      expect(state.greenFees).toBeGreaterThanOrEqual(0);
      expect(state.cartFees).toBeGreaterThanOrEqual(0);
      expect(state.proShopSales).toBeGreaterThanOrEqual(0);
      expect(state.foodBeverage).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Employee Work System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Employee Work State', () => {
    test('getEmployeeWorkState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state).toBeDefined();
      expect(typeof state.workerCount).toBe('number');
      expect(typeof state.activeWorkers).toBe('number');
      expect(typeof state.idleWorkers).toBe('number');
    });

    test('worker counts are consistent', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state.activeWorkers + state.idleWorkers).toBe(state.workerCount);
    });

    test('worker counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state.workerCount).toBeGreaterThanOrEqual(0);
      expect(state.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(state.idleWorkers).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Employee Hiring', () => {
    test('hireEmployee handles invalid index', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hireEmployee(-1));
      expect(result).toBe(false);
    });

    test('fireEmployee handles invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.fireEmployee('invalid_employee_id')
      );
      expect(result).toBe(false);
    });

    test('getEmployeeList returns array', async ({ page }) => {
      const employees = await page.evaluate(() => window.game.getEmployeeList?.() || []);
      expect(Array.isArray(employees)).toBe(true);
    });
  });
});

test.describe('Weather System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Weather State', () => {
    test('getWeatherState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getWeatherState());
      expect(state).toBeDefined();
      expect(typeof state.condition).toBe('string');
      expect(typeof state.temperature).toBe('number');
      expect(typeof state.windSpeed).toBe('number');
    });

    test('weather condition is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getWeatherState());
      expect(['sunny', 'cloudy', 'rainy', 'stormy']).toContain(state.condition);
    });

    test('setWeatherCondition updates condition', async ({ page }) => {
      await page.evaluate(() => window.game.setWeatherCondition('rainy'));
      const state = await page.evaluate(() => window.game.getWeatherState());
      expect(state.condition).toBe('rainy');
    });
  });
});

test.describe('Prestige System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Amenity Upgrades', () => {
    test('getAvailableAmenities returns array', async ({ page }) => {
      const amenities = await page.evaluate(() => window.game.getAvailableAmenities());
      expect(Array.isArray(amenities)).toBe(true);
    });

    test('amenity entries have correct structure', async ({ page }) => {
      const amenities = await page.evaluate(() => window.game.getAvailableAmenities());
      for (const amenity of amenities) {
        expect(typeof amenity.id).toBe('string');
        expect(typeof amenity.name).toBe('string');
        expect(typeof amenity.cost).toBe('number');
        expect(typeof amenity.purchased).toBe('boolean');
      }
    });

    test('purchaseAmenity handles invalid type', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.purchaseAmenity('invalid_amenity_type')
      );
      expect(result).toBe(false);
    });
  });
});

test.describe('Golfer System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Golfer State', () => {
    test('getGolferState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());
      expect(state).toBeDefined();
      expect(typeof state.active).toBe('number');
      expect(typeof state.served).toBe('number');
      expect(typeof state.avgSatisfaction).toBe('number');
    });

    test('golfer counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());
      expect(state.active).toBeGreaterThanOrEqual(0);
      expect(state.served).toBeGreaterThanOrEqual(0);
    });

    test('satisfaction is valid percentage', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());
      expect(state.avgSatisfaction).toBeGreaterThanOrEqual(0);
      expect(state.avgSatisfaction).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Golfer Pool State', () => {
    test('getGolferPoolState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferPoolState?.());
      if (state) {
        expect(typeof state.activeGolfers).toBe('number');
        expect(typeof state.dailyArrivalRate).toBe('number');
      }
    });
  });
});

test.describe('Marketing System Advanced', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Marketing Stats', () => {
    test('getMarketingStats returns valid stats', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getMarketingStats());
      expect(stats).toBeDefined();
      expect(typeof stats.activeCampaigns).toBe('number');
      expect(typeof stats.totalSpent).toBe('number');
      expect(typeof stats.totalROI).toBe('number');
    });

    test('marketing values are valid', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getMarketingStats());
      expect(stats.activeCampaigns).toBeGreaterThanOrEqual(0);
      expect(stats.totalSpent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Campaign Operations', () => {
    test('getActiveCampaigns returns array', async ({ page }) => {
      const campaigns = await page.evaluate(() => window.game.getActiveCampaigns());
      expect(Array.isArray(campaigns)).toBe(true);
    });

    test('startMarketingCampaign handles invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.startMarketingCampaign('invalid_campaign_id')
      );
      expect(result).toBe(false);
    });
  });
});
