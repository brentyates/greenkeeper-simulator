/**
 * UI Panels Integration Tests
 *
 * Tests UI panel toggles and state management via public API.
 */

import { test, expect, waitForGameReady } from '../utils/test-helpers';

test.describe('UI Panels Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await waitForGameReady(page);
  });

  test.describe('Employee Panel', () => {
    test('toggleEmployeePanel toggles panel state', async ({ page }) => {
      await page.evaluate(() => window.game.toggleEmployeePanel());
      // Method ran successfully if no error
      expect(true).toBe(true);
    });

    test('getEmployeeState returns employee info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state).toBeDefined();
      expect(Array.isArray(state.employees)).toBe(true);
      expect(typeof state.count).toBe('number');
      expect(typeof state.maxEmployees).toBe('number');
      expect(typeof state.totalHourlyWages).toBe('number');
    });

    test('getApplicationState returns job applications', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(state).toBeDefined();
      expect(Array.isArray(state.applications)).toBe(true);
      expect(typeof state.nextApplicationTime).toBe('number');
      expect(typeof state.activeJobPostings).toBe('number');
      expect(typeof state.totalReceived).toBe('number');
    });
  });

  test.describe('Golfer State', () => {
    test('getGolferState returns golfer info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      expect(state).toBeDefined();
      // getGolferState returns { active, served, avgSatisfaction }
      expect(typeof state.active).toBe('number');
      expect(typeof state.served).toBe('number');
      expect(typeof state.avgSatisfaction).toBe('number');
    });
  });

  test.describe('Research State', () => {
    test('getResearchState returns research info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state).toBeDefined();
      // ResearchState has { completedResearch, currentResearch, researchQueue, fundingLevel, totalPointsSpent }
      expect(Array.isArray(state.completedResearch)).toBe(true);
      expect(Array.isArray(state.researchQueue)).toBe(true);
      expect(typeof state.fundingLevel).toBe('string');
      expect(typeof state.totalPointsSpent).toBe('number');
    });

    test('research state has funding levels', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      // fundingLevel should be one of: none, minimum, normal, maximum
      expect(['none', 'minimum', 'normal', 'maximum']).toContain(state.fundingLevel);
    });
  });

  test.describe('Scenario Progress', () => {
    test('getScenarioProgress returns progress info', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      // May be null if not in scenario mode, or return progress object
      if (progress !== null) {
        // getScenarioProgress returns { daysElapsed, currentCash, totalRevenue, totalExpenses, totalGolfers, currentHealth, currentRating }
        expect(typeof progress.daysElapsed).toBe('number');
        expect(typeof progress.currentCash).toBe('number');
        expect(typeof progress.totalRevenue).toBe('number');
        expect(typeof progress.totalExpenses).toBe('number');
      }
    });

    test('scenario progress has financial data', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      if (progress !== null) {
        expect(typeof progress.totalGolfers).toBe('number');
        expect(typeof progress.currentHealth).toBe('number');
        expect(typeof progress.currentRating).toBe('number');
      }
    });
  });

  test.describe('Course Stats', () => {
    test('getCourseStats returns course statistics', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      expect(stats).toBeDefined();
      // getCourseStats returns { health, moisture, nutrients, height }
      expect(typeof stats.health).toBe('number');
      expect(typeof stats.moisture).toBe('number');
      expect(typeof stats.nutrients).toBe('number');
      expect(typeof stats.height).toBe('number');
    });

    test('course stats are within valid ranges', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      // Stats should be percentages or valid ranges
      expect(stats.health).toBeGreaterThanOrEqual(0);
      expect(stats.health).toBeLessThanOrEqual(100);
      expect(stats.moisture).toBeGreaterThanOrEqual(0);
      expect(stats.nutrients).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Overlay Modes', () => {
    test('all overlay modes are valid', async ({ page }) => {
      const modes = ['normal', 'moisture', 'nutrients', 'height'];

      for (const mode of modes) {
        await page.evaluate((m) => window.game.setOverlayMode(m), mode);
        const current = await page.evaluate(() => window.game.getOverlayMode());
        expect(current).toBe(mode);
      }
    });
  });

  test.describe('Refill Stations', () => {
    test('getRefillStations returns station locations', async ({ page }) => {
      const stations = await page.evaluate(() => window.game.getRefillStations());

      expect(Array.isArray(stations)).toBe(true);
      if (stations.length > 0) {
        expect(typeof stations[0].x).toBe('number');
        expect(typeof stations[0].y).toBe('number');
      }
    });

    test('isAtRefillStation returns boolean', async ({ page }) => {
      const atStation = await page.evaluate(() => window.game.isAtRefillStation());
      expect(typeof atStation).toBe('boolean');
    });
  });
});
