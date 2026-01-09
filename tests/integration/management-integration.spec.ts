/**
 * Management Systems Integration Tests
 *
 * Tests economy, employees, research, golfers, and scenarios.
 */

import { test, expect } from '@playwright/test';
import { waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('Management Systems Integration', () => {
  test.describe('Economy', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToScenario(page, 'tutorial_basics');
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
      await navigateToScenario(page, 'tutorial_basics');
    });

    test('can get employee state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state).toHaveProperty('employees');
      expect(state).toHaveProperty('count');
      expect(state).toHaveProperty('maxEmployees');
      expect(state).toHaveProperty('totalHourlyWages');
      expect(Array.isArray(state.employees)).toBe(true);
    });

    test('can get application state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(state).toHaveProperty('applications');
      expect(state).toHaveProperty('nextApplicationTime');
      expect(state).toHaveProperty('activeJobPostings');
      expect(state).toHaveProperty('totalReceived');
    });
  });

  test.describe('Game Time', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/?testMode=true&preset=equipment_test');
      await waitForGameReady(page);
    });

    test('can get game time', async ({ page }) => {
      const time = await page.evaluate(() => window.game.getGameTime());

      expect(time).toHaveProperty('day');
      expect(time).toHaveProperty('hours');
      expect(time).toHaveProperty('minutes');
      expect(time).toHaveProperty('totalMinutes');
      expect(typeof time.day).toBe('number');
      expect(typeof time.hours).toBe('number');
      expect(typeof time.minutes).toBe('number');
    });

    test('advancing time changes game time', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameTime());

      await page.evaluate(() => window.game.advanceTimeByMinutes(60));

      const after = await page.evaluate(() => window.game.getGameTime());

      expect(after.totalMinutes).toBe(before.totalMinutes + 60);
    });
  });

  test.describe('Golfers', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToScenario(page, 'tutorial_basics');
    });

    test('can get golfer state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      expect(state).toHaveProperty('active');
      expect(state).toHaveProperty('served');
      expect(state).toHaveProperty('avgSatisfaction');
      expect(typeof state.active).toBe('number');
      expect(typeof state.served).toBe('number');
    });
  });

  test.describe('Research', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToScenario(page, 'tutorial_basics');
    });

    test('can get research state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state).toHaveProperty('currentResearch');
      expect(state).toHaveProperty('completedResearch');
      expect(state).toHaveProperty('fundingLevel');
    });
  });

  test.describe('Prestige', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToScenario(page, 'tutorial_basics');
    });

    test('can get prestige state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getPrestigeState());

      expect(state).toHaveProperty('currentScore');
      expect(state).toHaveProperty('tier');
      expect(state).toHaveProperty('amenities');
    });
  });

  test.describe('Scenarios', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToScenario(page, 'tutorial_basics');
    });

    test('can get scenario progress', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      expect(progress).not.toBeNull();
      expect(progress!).toHaveProperty('objectives');
      expect(progress!).toHaveProperty('daysRemaining');
      expect(progress!).toHaveProperty('status');
      expect(Array.isArray(progress!.objectives)).toBe(true);
    });
  });
});
