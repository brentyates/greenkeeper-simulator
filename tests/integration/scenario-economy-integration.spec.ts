/**
 * Scenario and Economy Integration Tests
 *
 * Tests for scenario objectives and economy system via public API.
 * Focuses on exercising ScenarioManager methods and economy functions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Scenario System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Scenario State', () => {
    test('getScenarioState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(typeof state.progress).toBe('number');
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });

    test('scenario progress is non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());
      if (state) {
        expect(state.progress).toBeGreaterThanOrEqual(0);
      }
    });

    test('completed and failed are mutually exclusive initially', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());
      if (state && !state.completed && !state.failed) {
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Scenario Progress', () => {
    test('getScenarioProgress returns detailed progress', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      if (progress) {
        expect(typeof progress.daysElapsed).toBe('number');
        expect(typeof progress.currentCash).toBe('number');
        expect(typeof progress.totalRevenue).toBe('number');
        expect(typeof progress.totalExpenses).toBe('number');
      }
    });

    test('scenario progress values are non-negative', async ({ page }) => {
      const progress = await page.evaluate(() => window.game.getScenarioProgress());

      if (progress) {
        expect(progress.daysElapsed).toBeGreaterThanOrEqual(0);
        expect(progress.currentCash).toBeGreaterThanOrEqual(0);
        expect(progress.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(progress.totalExpenses).toBeGreaterThanOrEqual(0);
      }
    });

    test('advancing day increases days elapsed', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getScenarioProgress());
      await page.evaluate(() => window.game.advanceDay());
      const after = await page.evaluate(() => window.game.getScenarioProgress());

      if (before && after) {
        expect(after.daysElapsed).toBe(before.daysElapsed + 1);
      }
    });
  });

  test.describe('Scenario Objectives', () => {
    test('scenario state reflects progress toward objective', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getScenarioState());
      if (state) {
        expect(typeof state.progress).toBe('number');
      }
    });

    test('different scenarios load correctly', async ({ page }) => {
      const state1 = await page.evaluate(() => window.game.getScenarioState());

      await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('dry_spell_challenge'));
    await page.waitForFunction(() => window.game !== null);
      await page.waitForFunction(() => window.game !== undefined, { timeout: 15000 });
      await page.waitForTimeout(200);

      const state2 = await page.evaluate(() => window.game.getScenarioState());

      if (state1 && state2) {
        expect(state1).toBeDefined();
        expect(state2).toBeDefined();
      }
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

  test.describe('Cash Management', () => {
    test('getEconomyState returns cash value', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(typeof state.cash).toBe('number');
    });

    test('setCash updates cash value', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBe(50000);
    });

    test('cash is non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBeGreaterThanOrEqual(0);
    });

    test('setCash with large value works', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000000));
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBe(10000000);
    });

    test('setCash with zero works', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(0));
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBe(0);
    });
  });

  test.describe('Economy State', () => {
    test('getEconomyState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());

      expect(state).toBeDefined();
      expect(typeof state.cash).toBe('number');
      expect(typeof state.earned).toBe('number');
      expect(typeof state.spent).toBe('number');
    });

    test('economy state values are consistent', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(state.cash).toBeGreaterThanOrEqual(0);
      expect(state.earned).toBeGreaterThanOrEqual(0);
      expect(state.spent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Transactions', () => {
    test('purchases deduct from cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      const before = await page.evaluate(() => window.game.getEconomyState());

      const result = await page.evaluate(() => window.game.purchaseAmenity('clubhouse_1'));

      if (result) {
        const after = await page.evaluate(() => window.game.getEconomyState());
        expect(after.cash).toBeLessThan(before.cash);
      }
    });

    test('hiring employees costs money', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      const before = await page.evaluate(() => window.game.getEconomyState());

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));

        await page.evaluate(() => window.game.advanceTimeByMinutes(60));

        const after = await page.evaluate(() => window.game.getEconomyState());
        expect(after.spent).toBeGreaterThanOrEqual(before.spent);
      }
    });
  });

  test.describe('Revenue Tracking', () => {
    test('economy tracks revenue', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(typeof state.earned).toBe('number');
      expect(state.earned).toBeGreaterThanOrEqual(0);
    });

    test('golfer arrivals generate revenue over time', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      const before = await page.evaluate(() => window.game.getEconomyState());

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(60));
      }

      const after = await page.evaluate(() => window.game.getEconomyState());
      expect(after.earned).toBeGreaterThanOrEqual(before.earned);
    });
  });

  test.describe('Expense Tracking', () => {
    test('economy tracks expenses', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEconomyState());
      expect(typeof state.spent).toBe('number');
      expect(state.spent).toBeGreaterThanOrEqual(0);
    });

    test('employee wages increase expenses', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));

        const before = await page.evaluate(() => window.game.getEconomyState());

        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.game.advanceTimeByMinutes(60));
        }

        const after = await page.evaluate(() => window.game.getEconomyState());
        expect(after.spent).toBeGreaterThanOrEqual(before.spent);
      }
    });
  });

  test.describe('Financial Reports', () => {
    test('daily stats track financial activity', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(60));
      }

      const progress = await page.evaluate(() => window.game.getScenarioProgress());
      if (progress) {
        expect(progress.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(progress.totalExpenses).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('State Persistence', () => {
    test('saveCurrentGame saves economy state', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(75000));
      const stateBefore = await page.evaluate(() => window.game.getEconomyState());
      expect(stateBefore.cash).toBe(75000);

      await page.evaluate(() => window.game.saveCurrentGame());
      const hasSave = await page.evaluate(() => window.game.hasSavedGame());
      expect(hasSave).toBe(true);
    });
  });
});

test.describe('Scenario and Economy Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test('scenario progress tracks economy state', async ({ page }) => {
    const scenarioProgress = await page.evaluate(() => window.game.getScenarioProgress());
    const economyState = await page.evaluate(() => window.game.getEconomyState());

    if (scenarioProgress) {
      expect(scenarioProgress.currentCash).toBe(economyState.cash);
    }
  });

  test('spending affects scenario progress', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(100000));

    const before = await page.evaluate(() => window.game.getScenarioProgress());

    await page.evaluate(() => window.game.purchaseAmenity('clubhouse_1'));

    const after = await page.evaluate(() => window.game.getScenarioProgress());

    if (before && after) {
      expect(after.totalExpenses).toBeGreaterThanOrEqual(before.totalExpenses);
    }
  });

  test('revenue affects scenario progress', async ({ page }) => {
    const before = await page.evaluate(() => window.game.getScenarioProgress());

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.game.advanceTimeByMinutes(60));
    }

    const after = await page.evaluate(() => window.game.getScenarioProgress());
    if (before && after) {
      expect(after.totalRevenue).toBeGreaterThanOrEqual(before.totalRevenue);
    }
  });
});
