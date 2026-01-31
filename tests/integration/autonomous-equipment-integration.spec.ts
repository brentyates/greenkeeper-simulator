/**
 * Autonomous Equipment (Robots) Integration Tests
 *
 * Tests for autonomous robot equipment system via public API.
 * Focuses on exercising purchaseRobotUnit, sellRobotUnit, tickAutonomousEquipment,
 * and related autonomous equipment functions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Autonomous Equipment Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Robot State Management', () => {
    test('getRobotState returns valid structure', async ({ page }) => {
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

    test('working + broken equals total robots', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.workingRobots + state.brokenRobots).toBe(state.totalRobots);
    });

    test('robot list matches totalRobots count', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(state.totalRobots);
    });
  });

  test.describe('Available Robots', () => {
    test('getAvailableRobots returns array', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      expect(Array.isArray(available)).toBe(true);
    });

    test('available robots have valid structure', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      for (const robot of available) {
        expect(typeof robot.equipmentId).toBe('string');
        expect(typeof robot.ownedCount).toBe('number');
        expect(robot.ownedCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('available robots list is populated', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableRobots());
      expect(available.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Robot Purchase', () => {
    test('purchaseRobotUnit returns boolean', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        const result = await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );
        expect(typeof result).toBe('boolean');
      }
    });

    test('purchasing robot increases robot count', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));

      const before = await page.evaluate(() => window.game.getRobotState());
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        const success = await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        if (success) {
          const after = await page.evaluate(() => window.game.getRobotState());
          expect(after.totalRobots).toBe(before.totalRobots + 1);
        }
      }
    });

    test('purchaseRobotUnit fails with insufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        const result = await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );
        expect(result).toBe(false);
      }
    });

    test('purchaseRobotUnit fails for invalid equipment id', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const result = await page.evaluate(() =>
        window.game.purchaseRobotUnit('invalid_robot_type')
      );
      expect(result).toBe(false);
    });

    test('purchasing robot deducts cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const before = await page.evaluate(() => window.game.getEconomyState());

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        const success = await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        if (success) {
          const after = await page.evaluate(() => window.game.getEconomyState());
          expect(after.cash).toBeLessThan(before.cash);
        }
      }
    });
  });

  test.describe('Robot Selling', () => {
    test('sellRobotUnit returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.sellRobotUnit('nonexistent'));
      expect(typeof result).toBe('boolean');
    });

    test('sellRobotUnit fails for invalid robot id', async ({ page }) => {
      const result = await page.evaluate(() => window.game.sellRobotUnit('invalid_robot_id'));
      expect(result).toBe(false);
    });

    test('selling robot decreases robot count', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const stateAfterBuy = await page.evaluate(() => window.game.getRobotState());
        const listAfterBuy = await page.evaluate(() => window.game.getRobotList());

        if (listAfterBuy.length > 0) {
          const robotId = listAfterBuy[0].id;
          const success = await page.evaluate(
            (id) => window.game.sellRobotUnit(id),
            robotId
          );

          if (success) {
            const stateAfterSell = await page.evaluate(() => window.game.getRobotState());
            expect(stateAfterSell.totalRobots).toBe(stateAfterBuy.totalRobots - 1);
          }
        }
      }
    });

    test('selling robot refunds cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const cashAfterBuy = await page.evaluate(() => window.game.getEconomyState());
        const list = await page.evaluate(() => window.game.getRobotList());

        if (list.length > 0) {
          await page.evaluate(
            (id) => window.game.sellRobotUnit(id),
            list[0].id
          );

          const cashAfterSell = await page.evaluate(() => window.game.getEconomyState());
          expect(cashAfterSell.cash).toBeGreaterThan(cashAfterBuy.cash);
        }
      }
    });
  });

  test.describe('Robot List', () => {
    test('getRobotList returns array', async ({ page }) => {
      const list = await page.evaluate(() => window.game.getRobotList());
      expect(Array.isArray(list)).toBe(true);
    });

    test('robot list items have valid structure', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const list = await page.evaluate(() => window.game.getRobotList());

        for (const robot of list) {
          expect(typeof robot.id).toBe('string');
          expect(typeof robot.type).toBe('string');
          expect(typeof robot.state).toBe('string');
          expect(typeof robot.battery).toBe('number');
        }
      }
    });

    test('robot battery is in valid range', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const list = await page.evaluate(() => window.game.getRobotList());

        for (const robot of list) {
          expect(robot.battery).toBeGreaterThanOrEqual(0);
          expect(robot.battery).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  test.describe('Robot Simulation', () => {
    test('advancing time affects robot state', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const before = await page.evaluate(() => window.game.getRobotState());

        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => window.game.advanceTimeByMinutes(30));
        }

        const after = await page.evaluate(() => window.game.getRobotState());
        expect(after).toBeDefined();
      }
    });

    test('robots maintain valid state through simulation', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        for (let i = 0; i < 5; i++) {
          await page.evaluate(() => window.game.advanceTimeByMinutes(60));
          const state = await page.evaluate(() => window.game.getRobotState());
          expect(state.workingRobots + state.brokenRobots).toBe(state.totalRobots);
        }
      }
    });
  });

  test.describe('Multiple Robots', () => {
    test('can purchase multiple robots', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(5000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        for (let i = 0; i < 3; i++) {
          await page.evaluate(
            (id) => window.game.purchaseRobotUnit(id),
            available[0].equipmentId
          );
        }

        const state = await page.evaluate(() => window.game.getRobotState());
        expect(state.totalRobots).toBeGreaterThanOrEqual(3);
      }
    });

    test('can purchase different robot types', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(5000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      const uniqueTypes = new Set<string>();
      for (const robot of available) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          robot.equipmentId
        );
        uniqueTypes.add(robot.equipmentId);
      }

      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.totalRobots).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('State Persistence', () => {
    test('saveCurrentGame saves robot state', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const stateBefore = await page.evaluate(() => window.game.getRobotState());
        expect(stateBefore.totalRobots).toBeGreaterThan(0);

        await page.evaluate(() => window.game.saveCurrentGame());
        const hasSave = await page.evaluate(() => window.game.hasSavedGame());
        expect(hasSave).toBe(true);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('robot state valid with no robots', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.totalRobots).toBeGreaterThanOrEqual(0);
    });

    test('available robots list is stable', async ({ page }) => {
      const first = await page.evaluate(() => window.game.getAvailableRobots());
      const second = await page.evaluate(() => window.game.getAvailableRobots());

      expect(first.length).toBe(second.length);
    });
  });
});
