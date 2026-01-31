/**
 * Research and Employee Integration Tests
 *
 * Tests research system and employee management via public API.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Research Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Research State', () => {
    test('getResearchState returns research info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state).toBeDefined();
      expect(['none', 'minimum', 'normal', 'maximum']).toContain(state.fundingLevel);
      expect(Array.isArray(state.completedResearch)).toBe(true);
      expect(Array.isArray(state.researchQueue)).toBe(true);
    });

    test('getAvailableResearch returns available items', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(0);
    });

    test('isResearchCompleted returns boolean', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.isResearchCompleted('basic_push_mower')
      );

      expect(typeof result).toBe('boolean');
    });
  });

  test.describe('Research Control', () => {
    test('can set research funding level', async ({ page }) => {
      await page.evaluate(() => window.game.setResearchFunding('maximum'));
      const state = await page.evaluate(() => window.game.getResearchState());

      expect(state.fundingLevel).toBe('maximum');
    });

    test('can start research item', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        const result = await page.evaluate((itemId) =>
          window.game.startResearchItem(itemId),
          available[0]
        );
        expect(typeof result).toBe('boolean');
      }
    });

    test('can cancel current research', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 0) {
        await page.evaluate((itemId) => window.game.startResearchItem(itemId), available[0]);
        await page.evaluate(() => window.game.cancelCurrentResearch());

        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state.currentResearch).toBeNull();
      }
    });

    test('can queue research items', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableResearch());

      if (available.length > 1) {
        await page.evaluate((itemId) => window.game.queueResearch(itemId), available[1]);

        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state.researchQueue.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Funding Level Cycle', () => {
    test('can cycle through all funding levels', async ({ page }) => {
      const levels = ['none', 'minimum', 'normal', 'maximum'] as const;

      for (const level of levels) {
        await page.evaluate((l) => window.game.setResearchFunding(l), level);
        const state = await page.evaluate(() => window.game.getResearchState());
        expect(state.fundingLevel).toBe(level);
      }
    });
  });
});

test.describe('Employee Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Employee State', () => {
    test('getEmployeeState returns employee info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state).toBeDefined();
      expect(typeof state.count).toBe('number');
      expect(typeof state.maxEmployees).toBe('number');
    });

    test('getApplicationState returns application info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(state).toBeDefined();
      expect(typeof state.nextApplicationTime).toBe('number');
      expect(typeof state.activeJobPostings).toBe('number');
      expect(typeof state.totalReceived).toBe('number');
    });
  });

  test.describe('Employee Roster', () => {
    test('employee roster is accessible', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeState());

      expect(state.count).toBeGreaterThanOrEqual(0);
      expect(state.maxEmployees).toBeGreaterThan(0);
    });
  });

  test.describe('Employee Hiring', () => {
    test('hireEmployee returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hireEmployee(0));
      expect(typeof result).toBe('boolean');
    });

    test('hireEmployee rejects invalid index', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hireEmployee(-1));
      expect(result).toBe(false);

      const result2 = await page.evaluate(() => window.game.hireEmployee(9999));
      expect(result2).toBe(false);
    });
  });

  test.describe('Employee Firing', () => {
    test('fireEmployee returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.fireEmployee('nonexistent'));
      expect(typeof result).toBe('boolean');
    });

    test('fireEmployee returns false for invalid id', async ({ page }) => {
      const result = await page.evaluate(() => window.game.fireEmployee('invalid_id'));
      expect(result).toBe(false);
    });
  });
});

test.describe('Employee Work System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test('employee visual system exists', async ({ page }) => {
    const hasVisuals = await page.evaluate(() => {
      return typeof window.game.getEmployeeState === 'function';
    });
    expect(hasVisuals).toBe(true);
  });

  test('employee state persists over time', async ({ page }) => {
    const before = await page.evaluate(() => window.game.getEmployeeState());
    await page.evaluate(() => window.game.advanceTimeByMinutes(60));
    const after = await page.evaluate(() => window.game.getEmployeeState());

    expect(after.count).toBeDefined();
    expect(after.maxEmployees).toBe(before.maxEmployees);
  });
});
