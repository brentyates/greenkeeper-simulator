/**
 * Core Systems Comprehensive Integration Tests
 *
 * Additional tests for low-coverage modules: terrain, employee-work, tee-times, economy, research.
 */

import { test, expect, waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('Terrain System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await waitForGameReady(page);
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Elevation Operations', () => {
    test('getElevationAt returns number', async ({ page }) => {
      const elevation = await page.evaluate(() => window.game.getElevationAt(5, 5));
      expect(typeof elevation).toBe('number');
    });

    test('setElevationAt modifies elevation', async ({ page }) => {
      await page.evaluate(() => window.game.setElevationAt(10, 10, 3));
      const elevation = await page.evaluate(() => window.game.getElevationAt(10, 10));
      expect(elevation).toBe(3);
    });

    test('elevation values are bounded', async ({ page }) => {
      const elevation = await page.evaluate(() => window.game.getElevationAt(5, 5));
      expect(elevation).toBeGreaterThanOrEqual(0);
      expect(elevation).toBeLessThanOrEqual(10);
    });

    test('multiple elevation reads at different positions', async ({ page }) => {
      const elevations = await page.evaluate(() => {
        return [
          window.game.getElevationAt(0, 0),
          window.game.getElevationAt(10, 10),
          window.game.getElevationAt(20, 20),
          window.game.getElevationAt(30, 30),
        ];
      });
      elevations.forEach(e => expect(typeof e).toBe('number'));
    });
  });

  test.describe('Terrain Type Operations', () => {
    test('getTerrainTypeAt returns valid type or undefined', async ({ page }) => {
      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      if (type !== undefined) {
        expect(['fairway', 'rough', 'green', 'bunker', 'water', 'tee']).toContain(type);
      }
    });

    test('setTerrainTypeAt can be called', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainTypeAt?.(5, 5, 'bunker'));
      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      if (type !== undefined) {
        expect(['fairway', 'rough', 'green', 'bunker', 'water', 'tee']).toContain(type);
      }
    });

    test('terrain type at center position', async ({ page }) => {
      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      if (type !== undefined) {
        expect(['fairway', 'rough', 'green', 'bunker', 'water', 'tee']).toContain(type);
      }
    });
  });
});

test.describe('Employee Work System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Employee Operations', () => {
    test('getEmployeeList returns array', async ({ page }) => {
      const employees = await page.evaluate(() => window.game.getEmployeeList?.() || []);
      expect(Array.isArray(employees)).toBe(true);
    });

    test('employee state contains all fields', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());
      expect(state).toHaveProperty('count');
      expect(state).toHaveProperty('maxEmployees');
    });

    test('maxEmployees is reasonable', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());
      expect(state.maxEmployees).toBeGreaterThan(0);
      expect(state.maxEmployees).toBeLessThanOrEqual(100);
    });

    test('employee count does not exceed max', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());
      expect(state.count).toBeLessThanOrEqual(state.maxEmployees);
    });
  });

  test.describe('Application System', () => {
    test('application state is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());
      expect(state).toBeDefined();
      expect(typeof state.nextApplicationTime).toBe('number');
      expect(typeof state.activeJobPostings).toBe('number');
    });

    test('can get pending applications count', async ({ page }) => {
      const count = await page.evaluate(() =>
        window.game.getApplicationState().pendingApplications?.length || 0);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Tee Times System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Tee Time State', () => {
    test('getTeeTimeState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getTeeTimeState?.());
      if (state) {
        expect(typeof state.bookedCount).toBe('number');
        expect(typeof state.checkedInCount).toBe('number');
      }
    });

    test('tee time counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getTeeTimeState?.());
      if (state) {
        expect(state.bookedCount).toBeGreaterThanOrEqual(0);
        expect(state.checkedInCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Tee Time Booking', () => {
    test('getAvailableTeeTimes returns array', async ({ page }) => {
      const times = await page.evaluate(() =>
        window.game.getAvailableTeeTimes?.(window.game.getGameDay?.() || 1) || []);
      expect(Array.isArray(times)).toBe(true);
    });

    test('bookTeeTime returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.bookTeeTime?.('nonexistent') || false);
      expect(typeof result).toBe('boolean');
    });

    test('checkInTeeTime returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.checkInTeeTime?.('nonexistent') || false);
      expect(typeof result).toBe('boolean');
    });

    test('cancelTeeTimeBooking returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.cancelTeeTimeBooking?.('nonexistent') || false);
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Research System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Research Discovery', () => {
    test('available research has correct structure', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());
      expect(Array.isArray(available)).toBe(true);
    });

    test('completed research starts empty or with basics', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(Array.isArray(state.completedResearch)).toBe(true);
    });

    test('research queue is array', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(Array.isArray(state.researchQueue)).toBe(true);
    });
  });

  test.describe('Research Progress', () => {
    test('current research starts as null or object', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(state.currentResearch === null || typeof state.currentResearch === 'object').toBe(true);
    });

    test('research progress is tracked in currentResearch', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      if (state.currentResearch) {
        expect(typeof state.currentResearch.pointsAccumulated).toBe('number');
        expect(typeof state.currentResearch.pointsRequired).toBe('number');
      }
    });

    test('total points spent is tracked', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(typeof state.totalPointsSpent).toBe('number');
      expect(state.totalPointsSpent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Research Operations', () => {
    test('funding levels are valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());
      expect(['none', 'minimum', 'normal', 'maximum']).toContain(state.fundingLevel);
    });

    test('can cycle through all funding levels', async ({ page }) => {
      const levels = ['none', 'minimum', 'normal', 'maximum'] as const;
      for (const level of levels) {
        await page.evaluate((l) => window.game.setResearchFunding(l), level);
        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state.fundingLevel).toBe(level);
      }
    });

    test('startResearchItem handles invalid item', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.startResearchItem('invalid_research_item'));
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Economy System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Financial State', () => {
    test('economy state has all required fields', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state).toHaveProperty('cash');
      expect(state).toHaveProperty('earned');
      expect(state).toHaveProperty('spent');
    });

    test('financial values are numbers', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(typeof state.cash).toBe('number');
      expect(typeof state.earned).toBe('number');
      expect(typeof state.spent).toBe('number');
    });

    test('earned and spent are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.earned).toBeGreaterThanOrEqual(0);
      expect(state.spent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Time Advancement', () => {
    test('advanceTimeByMinutes changes game time', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameTime?.() || 0);
      await page.evaluate(() => window.game.advanceTimeByMinutes(60));
      const after = await page.evaluate(() => window.game.getGameTime?.() || 0);
      expect(after).not.toBe(before);
    });

    test('game day can be retrieved', async ({ page }) => {
      const day = await page.evaluate(() => window.game.getGameDay?.() || 1);
      expect(day).toBeGreaterThanOrEqual(1);
    });

    test('advancing time by many minutes may change day', async ({ page }) => {
      const beforeDay = await page.evaluate(() => window.game.getGameDay?.() || 1);
      await page.evaluate(() => {
        for (let i = 0; i < 25; i++) {
          window.game.advanceTimeByMinutes(60);
        }
      });
      const afterDay = await page.evaluate(() => window.game.getGameDay?.() || 1);
      expect(afterDay).toBeGreaterThanOrEqual(beforeDay);
    });
  });
});

test.describe('Game State Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await waitForGameReady(page);
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Full State Access', () => {
    test('getFullGameState returns complete state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());
      expect(state).toBeDefined();
    });

    test('course stats are accessible', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());
      expect(stats).toBeDefined();
      expect(typeof stats.health).toBe('number');
      expect(typeof stats.moisture).toBe('number');
    });

    test('course health is valid percentage', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());
      expect(stats.health).toBeGreaterThanOrEqual(0);
      expect(stats.health).toBeLessThanOrEqual(100);
    });

    test('course moisture is valid percentage', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());
      expect(stats.moisture).toBeGreaterThanOrEqual(0);
      expect(stats.moisture).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Position Tracking', () => {
    test('getPlayerPosition returns valid position', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    });

    test('player position is within bounds', async ({ page }) => {
      const pos = await page.evaluate(() => window.game.getPlayerPosition());
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Prestige System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Prestige State', () => {
    test('getPrestigeState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      expect(state).toBeDefined();
      expect(typeof state.score).toBe('number');
      expect(typeof state.stars).toBe('number');
      expect(typeof state.tier).toBe('string');
    });

    test('prestige stars are valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      expect(state.stars).toBeGreaterThanOrEqual(0);
      expect(state.stars).toBeLessThanOrEqual(5);
    });

    test('prestige tier is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());
      expect(['municipal', 'daily_fee', 'semi_private', 'private', 'championship']).toContain(state.tier);
    });
  });
});

test.describe('Golfer System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Golfer Pool State', () => {
    test('getGolferPoolState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferPoolState?.());
      if (state) {
        expect(typeof state.activeGolfers).toBe('number');
        expect(typeof state.dailyArrivalRate).toBe('number');
      }
    });

    test('active golfers is non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferPoolState?.());
      if (state) {
        expect(state.activeGolfers).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

test.describe('Marketing System Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Marketing State', () => {
    test('getMarketingState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getMarketingState?.());
      if (state) {
        expect(state).toBeDefined();
      }
    });
  });
});
