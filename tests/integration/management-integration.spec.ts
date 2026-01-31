/**
 * Management Systems Integration Tests
 *
 * Tests economy, employees, research, golfers, and scenarios.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Management Systems Integration', () => {
  test.describe('Economy', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('can get and set cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(5000));

      const economy = await page.evaluate(() => window.game.getEconomyState());
      expect(economy.cash).toBe(5000);
    });

    test('cash decreases when purchasing', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000));

      const before = await page.evaluate(() => window.game.getEconomyState().cash);

      await page.evaluate(() => window.game.placePipe(10, 10, 'pvc'));

      const after = await page.evaluate(() => window.game.getEconomyState().cash);

      expect(after).toBeLessThan(before);
    });
  });

  test.describe('Employees', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('employee roster starts empty or with initial staff', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state.count).toBeGreaterThanOrEqual(0);
      expect(state.maxEmployees).toBeGreaterThan(0);
      expect(state.totalHourlyWages).toBeGreaterThanOrEqual(0);
      expect(state.employees.length).toBe(state.count);
    });

    test('application state tracks job postings', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(state.totalReceived).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(state.applications)).toBe(true);
    });
  });

  test.describe('Game Time', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => {
      window.game.setAllCellsState({ height: 50, moisture: 50, nutrients: 50, health: 80 });
      window.game.setEquipmentResource('mower', 100);
      window.game.setEquipmentResource('sprinkler', 100);
      window.game.setEquipmentResource('spreader', 100);
      window.game.selectEquipment(1);
      window.game.toggleEquipment();
    });
      await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('game time has valid hour and minute values', async ({ page }) => {
      const time = await page.evaluate(() => window.game.getGameTime());

      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThan(24);
      expect(time.minutes).toBeGreaterThanOrEqual(0);
      expect(time.minutes).toBeLessThan(60);
    });

    test('advancing time changes game time', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameTime());

      await page.evaluate(() => window.game.advanceTimeByMinutes(60));

      const after = await page.evaluate(() => window.game.getGameTime());

      // Time should have advanced (exact amount varies by timeScale)
      const beforeTotal = before.hours * 60 + before.minutes;
      const afterTotal = after.hours * 60 + after.minutes;
      expect(afterTotal).toBeGreaterThan(beforeTotal);
    });
  });

  test.describe('Golfers', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('golfer state tracks active and served counts', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      expect(state.active).toBeGreaterThanOrEqual(0);
      expect(state.served).toBeGreaterThanOrEqual(0);
      expect(state.avgSatisfaction).toBeGreaterThanOrEqual(0);
      expect(state.avgSatisfaction).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Research', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('research state has funding level', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(['none', 'minimal', 'normal', 'intensive']).toContain(state.fundingLevel);
      expect(Array.isArray(state.completedResearch)).toBe(true);
    });
  });

  test.describe('Prestige', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('prestige score and tier reflect course quality', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(state.score).toBeGreaterThanOrEqual(0);
      expect(state.stars).toBeGreaterThanOrEqual(0);
      expect(state.amenityScore).toBeGreaterThanOrEqual(0);
      expect(['municipal', 'public', 'semi_private', 'private', 'resort', 'championship']).toContain(state.tier);
    });
  });

  test.describe('Scenarios', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    });

    test('scenario progress tracks financial and operational metrics', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      expect(progress).not.toBeNull();
      expect(progress!.daysElapsed).toBeGreaterThanOrEqual(0);
      expect(progress!.currentCash).toBeGreaterThanOrEqual(0);
      expect(progress!.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(progress!.totalExpenses).toBeGreaterThanOrEqual(0);
      expect(progress!.totalGolfers).toBeGreaterThanOrEqual(0);
      expect(progress!.currentHealth).toBeGreaterThanOrEqual(0);
      expect(progress!.currentRating).toBeGreaterThanOrEqual(0);
    });
  });
});
