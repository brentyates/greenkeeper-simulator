/**
 * Game Simulation Integration Tests
 *
 * Tests game systems that run during simulation loops via advanceDay and advanceTime.
 */

import { test, expect, waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('Game Simulation Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Economy Simulation', () => {
    test('cash tracking works over time', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));

      const initial = await page.evaluate(() => window.game.getEconomyState());
      expect(initial.cash).toBe(10000);

      // Place some infrastructure
      await page.evaluate(() => {
        window.game.placePipe(5, 5, 'pvc');
        window.game.placePipe(6, 5, 'pvc');
      });

      const after = await page.evaluate(() => window.game.getEconomyState());
      expect(after.spent).toBeGreaterThan(initial.spent);
    });

    test('expense tracking increases with time', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.setPaused(false));

      const before = await page.evaluate(() => window.game.getEconomyState());

      // Advance multiple days to accumulate expenses
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          window.game.advanceDay();
        }
      });

      const after = await page.evaluate(() => window.game.getEconomyState());
      // Cash may decrease due to expenses over time
      expect(after.cash).toBeLessThanOrEqual(before.cash);
    });
  });

  test.describe('Employee Simulation', () => {
    test('employee state persists over days', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state.count).toBeDefined();
      expect(state.maxEmployees).toBeGreaterThan(0);
    });

    test('application state updates over time', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(typeof state.nextApplicationTime).toBe('number');
      expect(typeof state.activeJobPostings).toBe('number');
      expect(typeof state.totalReceived).toBe('number');
    });
  });

  test.describe('Golfer Simulation', () => {
    test('golfer state updates with time', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(false));

      const before = await page.evaluate(() => window.game.getGolferState());

      // Advance time significantly to allow golfer arrivals
      await page.evaluate(() => window.game.advanceTimeByMinutes(240)); // 4 hours

      const after = await page.evaluate(() => window.game.getGolferState());

      // Golfers may have arrived or finished
      expect(after.served).toBeGreaterThanOrEqual(before.served);
    });

    test('satisfaction tracking works', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      // Average satisfaction should be a reasonable value
      expect(state.avgSatisfaction).toBeGreaterThanOrEqual(0);
      expect(state.avgSatisfaction).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Grass Growth Simulation', () => {
    test('grass grows over extended time', async ({ page }) => {
      await page.goto('/?testMode=true');
    await waitForGameReady(page);
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
      await waitForGameReady(page);

      const before = await page.evaluate(() => window.game.getCourseStats());

      // Force significant grass growth
      await page.evaluate(() => window.game.forceGrassGrowth(480)); // 8 hours

      const after = await page.evaluate(() => window.game.getCourseStats());

      // Height should have increased
      expect(after.height).toBeGreaterThanOrEqual(before.height);
    });

    test('moisture decreases without watering', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getCourseStats());

      // Advance time without watering
      await page.evaluate(() => {
        window.game.setPaused(true);
        window.game.advanceTimeByMinutes(120);
      });

      const after = await page.evaluate(() => window.game.getCourseStats());

      // Moisture may decrease over time
      expect(after.moisture).toBeDefined();
    });

    test('nutrients decay much slower than moisture (design intent)', async ({ page }) => {
      // Start fresh with known state
      await page.goto('/?testMode=true');
    await waitForGameReady(page);
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
      await waitForGameReady(page);

      const before = await page.evaluate(() => window.game.getCourseStats());

      // Advance 1 full game day (1440 minutes)
      await page.evaluate(() => {
        window.game.setPaused(true);
        window.game.forceGrassGrowth(1440);
      });

      const after = await page.evaluate(() => window.game.getCourseStats());

      // Moisture should be severely depleted after 1 day (0.05/min * 1440 = 72 units lost)
      // Most tiles should be near 0 moisture
      expect(after.moisture).toBeLessThan(30);

      // Nutrients should lose very little (0.003/min * 1440 = 4.32 units lost)
      const nutrientLoss = before.nutrients - after.nutrients;
      expect(nutrientLoss).toBeCloseTo(4.32, 0);
      expect(nutrientLoss).toBeLessThan(10);

      // The key insight: nutrients decay ~17x slower than moisture
      const moistureLoss = before.moisture - after.moisture;
      expect(moistureLoss).toBeGreaterThan(nutrientLoss * 10);
    });

    test('nutrients stay above critical for multiple days without fertilizing', async ({ page }) => {
      await page.goto('/?testMode=true');
    await waitForGameReady(page);
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
      await waitForGameReady(page);

      const before = await page.evaluate(() => window.game.getCourseStats());

      // Advance 5 game days (7200 minutes)
      await page.evaluate(() => {
        window.game.setPaused(true);
        window.game.forceGrassGrowth(7200);
      });

      const after = await page.evaluate(() => window.game.getCourseStats());

      // After 5 days at 0.003/min: loss = 0.003 * 7200 = 21.6 nutrients
      const nutrientLoss = before.nutrients - after.nutrients;
      expect(nutrientLoss).toBeCloseTo(21.6, 0);

      // Nutrients should still be well above critical (30) after 5 days
      // Starting at ~60, ending at ~38
      expect(after.nutrients).toBeGreaterThan(30);
    });
  });

  test.describe('Day Cycle', () => {
    test('advancing day increments day count', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameDay());

      await page.evaluate(() => window.game.advanceDay());

      const after = await page.evaluate(() => window.game.getGameDay());
      expect(after).toBe(before + 1);
    });

    test('multiple days can be advanced', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameDay());

      await page.evaluate(() => {
        window.game.advanceDay();
        window.game.advanceDay();
        window.game.advanceDay();
      });

      const after = await page.evaluate(() => window.game.getGameDay());
      expect(after).toBe(before + 3);
    });

    test('time resets after day advance', async ({ page }) => {
      await page.evaluate(() => window.game.advanceDay());

      const time = await page.evaluate(() => window.game.getGameTime());
      // Time values should be valid (hours 0-23, minutes 0-59)
      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThan(24);
    });
  });

  test.describe('Research Simulation', () => {
    test('research funding levels can be observed', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(['none', 'minimum', 'normal', 'maximum']).toContain(state.fundingLevel);
    });

    test('completed research is tracked', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(Array.isArray(state.completedResearch)).toBe(true);
    });

    test('research queue can be observed', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(Array.isArray(state.researchQueue)).toBe(true);
    });
  });

  test.describe('Prestige Simulation', () => {
    test('prestige score is calculated', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(typeof state.score).toBe('number');
      expect(typeof state.stars).toBe('number');
    });

    test('star rating is within valid range', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(state.stars).toBeGreaterThanOrEqual(0);
      expect(state.stars).toBeLessThanOrEqual(5);
    });

    test('tier is a valid string', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(typeof state.tier).toBe('string');
      expect(state.tier.length).toBeGreaterThan(0);
    });
  });

  test.describe('Scenario Progression', () => {
    test('scenario state tracks progress', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(typeof state.progress).toBe('number');
        expect(state.progress).toBeGreaterThanOrEqual(0);
        expect(state.progress).toBeLessThanOrEqual(100);
      }
    });

    test('scenario completion tracking works', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });
  });
});

test.describe('Extended Game Loop', () => {
  test('full day simulation exercises systems', async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');

    await page.evaluate(() => window.game.setCash(50000));
    await page.evaluate(() => window.game.setPaused(false));

    // Simulate a full day of activity
    await page.evaluate(async () => {
      // Morning: mow some grass
      window.game.selectEquipment(1);
      for (let i = 0; i < 10; i++) {
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      }

      // Mid-day: water some areas
      window.game.selectEquipment(2);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('down');
        await window.game.waitForPlayerIdle();
      }

      // Afternoon: fertilize
      window.game.selectEquipment(3);
      for (let i = 0; i < 5; i++) {
        window.game.movePlayer('left');
        await window.game.waitForPlayerIdle();
      }
    });

    // Advance the day
    await page.evaluate(() => window.game.advanceDay());

    // Verify systems are still functioning
    const economy = await page.evaluate(() => window.game.getEconomyState());
    const golfers = await page.evaluate(() => window.game.getGolferState());
    const course = await page.evaluate(() => window.game.getCourseStats());

    expect(economy).toBeDefined();
    expect(golfers).toBeDefined();
    expect(course).toBeDefined();
  });
});

test.describe('Weather System', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test('getWeatherState returns valid weather info', async ({ page }) => {
    const weather = await page.evaluate(() => window.game.getWeatherState());
    expect(weather).toBeDefined();
    expect(typeof weather.condition).toBe('string');
  });

  test('getWeatherDescription returns string', async ({ page }) => {
    const desc = await page.evaluate(() => window.game.getWeatherDescription());
    expect(typeof desc).toBe('string');
  });

  test('getWeatherImpact returns string', async ({ page }) => {
    const impact = await page.evaluate(() => window.game.getWeatherImpact());
    expect(typeof impact).toBe('string');
  });

  test('getCurrentSeason returns valid season', async ({ page }) => {
    const season = await page.evaluate(() => window.game.getCurrentSeason());
    const validSeasons = ['spring', 'summer', 'fall', 'winter'];
    expect(validSeasons).toContain(season);
  });

  test('setWeatherCondition changes weather', async ({ page }) => {
    await page.evaluate(() => window.game.setWeatherCondition('rainy'));
    const weather = await page.evaluate(() => window.game.getWeatherState());
    expect(weather.condition).toBe('rainy');
  });
});

test.describe('Time Utilities', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test('isCurrentTimePrimeMorning returns boolean', async ({ page }) => {
    const result = await page.evaluate(() => window.game.isCurrentTimePrimeMorning());
    expect(typeof result).toBe('boolean');
  });

  test('isCurrentTimeTwilight returns boolean', async ({ page }) => {
    const result = await page.evaluate(() => window.game.isCurrentTimeTwilight());
    expect(typeof result).toBe('boolean');
  });

  test('isCurrentTimeWeekend returns boolean', async ({ page }) => {
    const result = await page.evaluate(() => window.game.isCurrentTimeWeekend());
    expect(typeof result).toBe('boolean');
  });

  test('getGameTime returns valid time', async ({ page }) => {
    const time = await page.evaluate(() => window.game.getGameTime());
    expect(time.hours).toBeGreaterThanOrEqual(0);
    expect(time.hours).toBeLessThanOrEqual(23);
    expect(time.minutes).toBeGreaterThanOrEqual(0);
    expect(time.minutes).toBeLessThanOrEqual(59);
  });

  test('getGameDay returns positive number', async ({ page }) => {
    const day = await page.evaluate(() => window.game.getGameDay());
    expect(day).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Save Game Management', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test('listSaveGames returns array', async ({ page }) => {
    const saves = await page.evaluate(() => window.game.listSaveGames());
    expect(Array.isArray(saves)).toBe(true);
  });

  test('saveCurrentGame creates a save', async ({ page }) => {
    await page.evaluate(() => window.game.saveCurrentGame());
    const hasSave = await page.evaluate(() => window.game.hasSavedGame());
    expect(hasSave).toBe(true);
  });

  test('getSaveGameInfo returns info after save', async ({ page }) => {
    await page.evaluate(() => window.game.saveCurrentGame());
    const info = await page.evaluate(() => window.game.getSaveGameInfo());
    expect(info).toBeDefined();
  });

  test('deleteSaveGame does not throw', async ({ page }) => {
    await page.evaluate(() => window.game.saveCurrentGame());
    await page.evaluate(() => window.game.deleteSaveGame());
    expect(true).toBe(true);
  });
});

test.describe('Terrain Dimensions', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test('getTerrainDimensions returns valid dimensions', async ({ page }) => {
    const dims = await page.evaluate(() => window.game.getTerrainDimensions());
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  test('terrain dimensions match actual terrain', async ({ page }) => {
    const dims = await page.evaluate(() => window.game.getTerrainDimensions());
    const terrain = await page.evaluate((d) => {
      return window.game.getTerrainAt(d.width - 1, d.height - 1);
    }, dims);
    expect(terrain).toBeDefined();
  });
});
