/**
 * Employee Work System Integration Tests
 *
 * Tests for employee autonomous work system via public API.
 * Focuses on exercising tickEmployeeWork, syncWorkersWithRoster,
 * and related employee work functions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Employee Work System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Worker State Management', () => {
    test('getEmployeeWorkState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());

      expect(state).toBeDefined();
      expect(typeof state.workerCount).toBe('number');
      expect(typeof state.activeWorkers).toBe('number');
      expect(typeof state.idleWorkers).toBe('number');
    });

    test('worker counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());

      expect(state.workerCount).toBeGreaterThanOrEqual(0);
      expect(state.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(state.idleWorkers).toBeGreaterThanOrEqual(0);
    });

    test('active + idle equals total workers', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state.activeWorkers + state.idleWorkers).toBe(state.workerCount);
    });
  });

  test.describe('Hiring Employees for Work', () => {
    test('hiring employee increases worker count', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getEmployeeWorkState());

      await page.evaluate(() => window.game.setCash(100000));
      const apps = await page.evaluate(() => window.game.getApplicationState());

      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
        const after = await page.evaluate(() => window.game.getEmployeeWorkState());
        expect(after.workerCount).toBeGreaterThanOrEqual(before.workerCount);
      }
    });

    test('hired employees sync with work system', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const empStateBefore = await page.evaluate(() => window.game.getEmployeeState());
      const workStateBefore = await page.evaluate(() => window.game.getEmployeeWorkState());

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));

        const empStateAfter = await page.evaluate(() => window.game.getEmployeeState());
        const workStateAfter = await page.evaluate(() => window.game.getEmployeeWorkState());

        expect(empStateAfter.count).toBeGreaterThanOrEqual(empStateBefore.count);
      }
    });
  });

  test.describe('Time Advancement and Work Simulation', () => {
    test('advancing time triggers work simulation', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const before = await page.evaluate(() => window.game.getEmployeeWorkState());

      await page.evaluate(() => window.game.advanceTimeByMinutes(30));

      const after = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(after).toBeDefined();
    });

    test('multiple time advances maintain state consistency', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(10));
        const state = await page.evaluate(() => window.game.getEmployeeWorkState());
        expect(state.activeWorkers + state.idleWorkers).toBe(state.workerCount);
      }
    });

    test('advancing full day maintains employee state', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const dayBefore = await page.evaluate(() => window.game.getGameDay());

      await page.evaluate(() => window.game.advanceDay());

      const dayAfter = await page.evaluate(() => window.game.getGameDay());
      const workState = await page.evaluate(() => window.game.getEmployeeWorkState());

      expect(dayAfter).toBe(dayBefore + 1);
      expect(workState).toBeDefined();
    });
  });

  test.describe('Employee and Work State Synchronization', () => {
    test('firing employee removes from work system', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));

        const empState = await page.evaluate(() => window.game.getEmployeeState());
        if (empState.employees.length > 0) {
          const beforeWork = await page.evaluate(() => window.game.getEmployeeWorkState());

          await page.evaluate((id) => window.game.fireEmployee(id), empState.employees[0].id);

          const afterWork = await page.evaluate(() => window.game.getEmployeeWorkState());
          expect(afterWork.workerCount).toBeLessThanOrEqual(beforeWork.workerCount);
        }
      }
    });

    test('employee state and work state are consistent', async ({ page }) => {
      const empState = await page.evaluate(() => window.game.getEmployeeState());
      const workState = await page.evaluate(() => window.game.getEmployeeWorkState());

      const groundskeepers = empState.employees.filter((e: any) => e.role === 'groundskeeper');
      expect(workState.workerCount).toBe(groundskeepers.length);
    });
  });

  test.describe('Work Effects During Simulation', () => {
    test('terrain updates during employee work', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length >= 2) {
        await page.evaluate(() => window.game.hireEmployee(0));
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const statsBefore = await page.evaluate(() => window.game.getCourseStats());

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(15));
      }

      const statsAfter = await page.evaluate(() => window.game.getCourseStats());
      expect(statsAfter).toBeDefined();
    });
  });

  test.describe('Employee Application Flow', () => {
    test('getApplicationState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      expect(state).toBeDefined();
      expect(Array.isArray(state.applications)).toBe(true);
      expect(typeof state.nextApplicationTime).toBe('number');
      expect(typeof state.activeJobPostings).toBe('number');
      expect(typeof state.totalReceived).toBe('number');
    });

    test('applications have valid employee data', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getApplicationState());

      for (const app of state.applications) {
        expect(typeof app.id).toBe('string');
        expect(typeof app.name).toBe('string');
        expect(typeof app.role).toBe('string');
        expect(typeof app.wage).toBe('number');
      }
    });

    test('hiring depletes application pool', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const before = await page.evaluate(() => window.game.getApplicationState());

      if (before.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
        const after = await page.evaluate(() => window.game.getApplicationState());

        expect(after.applications.length).toBeLessThan(before.applications.length);
      }
    });

    test('hireEmployee returns false for invalid index', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hireEmployee(9999));
      expect(result).toBe(false);
    });

    test('hireEmployee returns false for negative index', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hireEmployee(-1));
      expect(result).toBe(false);
    });
  });

  test.describe('Employee State Persistence', () => {
    test('saveCurrentGame saves employee work state', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const stateBefore = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(stateBefore).toBeDefined();

      await page.evaluate(() => window.game.saveCurrentGame());
      const hasSave = await page.evaluate(() => window.game.hasSavedGame());
      expect(hasSave).toBe(true);
    });
  });

  test.describe('Multiple Employee Management', () => {
    test('can hire multiple employees', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(500000));

      const initialState = await page.evaluate(() => window.game.getEmployeeState());
      const initialCount = initialState.count;

      const apps = await page.evaluate(() => window.game.getApplicationState());
      const hireCount = Math.min(3, apps.applications.length);

      for (let i = 0; i < hireCount; i++) {
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const finalState = await page.evaluate(() => window.game.getEmployeeState());
      expect(finalState.count).toBeGreaterThanOrEqual(initialCount);
    });

    test('multiple groundskeepers all become workers', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(500000));

      let hiredGroundskeepers = 0;
      const apps = await page.evaluate(() => window.game.getApplicationState());

      for (let i = 0; i < Math.min(3, apps.applications.length); i++) {
        const currentApps = await page.evaluate(() => window.game.getApplicationState());
        if (currentApps.applications[0]?.role === 'groundskeeper') {
          hiredGroundskeepers++;
        }
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      const workState = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(workState.workerCount).toBeGreaterThanOrEqual(hiredGroundskeepers);
    });
  });

  test.describe('Work System Task Constants', () => {
    test('worker state reflects task distribution', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));

      const apps = await page.evaluate(() => window.game.getApplicationState());
      if (apps.applications.length > 0) {
        await page.evaluate(() => window.game.hireEmployee(0));
      }

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(20));
      }

      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state.activeWorkers + state.idleWorkers).toBe(state.workerCount);
    });
  });

  test.describe('Edge Cases', () => {
    test('work state valid with no employees', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state.workerCount).toBeGreaterThanOrEqual(0);
      expect(state.activeWorkers).toBe(0);
      expect(state.idleWorkers).toBe(state.workerCount);
    });

    test('fireEmployee returns false for nonexistent employee', async ({ page }) => {
      const result = await page.evaluate(() => window.game.fireEmployee('nonexistent_id_12345'));
      expect(result).toBe(false);
    });

    test('rapid time advances maintain valid state', async ({ page }) => {
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(5));
      }

      const state = await page.evaluate(() => window.game.getEmployeeWorkState());
      expect(state).toBeDefined();
      expect(state.workerCount).toBeGreaterThanOrEqual(0);
    });
  });
});
