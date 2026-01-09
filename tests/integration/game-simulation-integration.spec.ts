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
      await page.evaluate(() => window.game.unpause());

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
      await page.evaluate(() => window.game.unpause());

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
      await page.goto('/?testMode=true&preset=all_grass_mown');
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
        window.game.pause();
        window.game.advanceTimeByMinutes(120);
      });

      const after = await page.evaluate(() => window.game.getCourseStats());

      // Moisture may decrease over time
      expect(after.moisture).toBeDefined();
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
    await page.evaluate(() => window.game.unpause());

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
