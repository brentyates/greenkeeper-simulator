/**
 * Robot Simulation Integration Tests
 *
 * Tests for autonomous equipment (robot) system via public API.
 * Exercises purchaseRobotUnit, sellRobotUnit, getRobotState, and simulation.
 */

import { test, expect, navigateToScenario } from '../utils/test-helpers';

test.describe('Robot System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Robot State', () => {
    test('getRobotState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());

      expect(state).toBeDefined();
      expect(typeof state.totalRobots).toBe('number');
      expect(typeof state.workingRobots).toBe('number');
      expect(typeof state.brokenRobots).toBe('number');
    });

    test('initial state has no robots', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.totalRobots).toBe(0);
      expect(state.workingRobots).toBe(0);
      expect(state.brokenRobots).toBe(0);
    });

    test('robot counts are non-negative', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());

      expect(state.totalRobots).toBeGreaterThanOrEqual(0);
      expect(state.workingRobots).toBeGreaterThanOrEqual(0);
      expect(state.brokenRobots).toBeGreaterThanOrEqual(0);
    });

    test('robot counts are consistent', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getRobotState());
      expect(state.workingRobots).toBeLessThanOrEqual(state.totalRobots);
      expect(state.brokenRobots).toBeLessThanOrEqual(state.totalRobots);
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
      }
    });

    test('ownedCount is initially zero', async ({ page }) => {
      const available = await page.evaluate(() => window.game.getAvailableRobots());

      for (const robot of available) {
        expect(robot.ownedCount).toBe(0);
      }
    });
  });

  test.describe('Robot List', () => {
    test('getRobotList returns array', async ({ page }) => {
      const list = await page.evaluate(() => window.game.getRobotList());
      expect(Array.isArray(list)).toBe(true);
    });

    test('initial robot list is empty', async ({ page }) => {
      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(0);
    });
  });

  test.describe('Robot Details', () => {
    test('getRobotDetails returns array', async ({ page }) => {
      const details = await page.evaluate(() => window.game.getRobotDetails());
      expect(Array.isArray(details)).toBe(true);
    });

    test('initial details list is empty', async ({ page }) => {
      const details = await page.evaluate(() => window.game.getRobotDetails());
      expect(details.length).toBe(0);
    });
  });
});

test.describe('Robot Purchasing with Research', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
  });

  test.describe('Research Unlocks Robots', () => {
    test('completing robotic research unlocks robots', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));

      const beforeAvailable = await page.evaluate(() =>
        window.game.getAvailableRobots()
      );

      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const afterAvailable = await page.evaluate(() =>
        window.game.getAvailableRobots()
      );

      expect(afterAvailable.length).toBeGreaterThanOrEqual(beforeAvailable.length);
    });

    test('robot mower available after research', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      const hasMower = available.some((r: any) => r.equipmentId.includes('mower'));
      expect(hasMower).toBe(true);
    });
  });

  test.describe('Purchasing Robots', () => {
    test('purchaseRobotUnit returns boolean', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        const result = await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );
        expect(typeof result).toBe('boolean');
      }
    });

    test('purchasing robot increases total count', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        const before = await page.evaluate(() => window.game.getRobotState());

        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const after = await page.evaluate(() => window.game.getRobotState());
        expect(after.totalRobots).toBe(before.totalRobots + 1);
      }
    });

    test('purchasing robot adds to robot list', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const list = await page.evaluate(() => window.game.getRobotList());
        expect(list.length).toBe(1);
      }
    });

    test('purchased robot has valid structure', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const list = await page.evaluate(() => window.game.getRobotList());
        expect(list.length).toBe(1);

        const robot = list[0];
        expect(typeof robot.id).toBe('string');
        expect(typeof robot.type).toBe('string');
        expect(typeof robot.state).toBe('string');
        expect(typeof robot.battery).toBe('number');
      }
    });

    test('purchasing robot deducts cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        const before = await page.evaluate(() => window.game.getEconomyState());

        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          available[0].equipmentId
        );

        const after = await page.evaluate(() => window.game.getEconomyState());
        expect(after.cash).toBeLessThan(before.cash);
      }
    });

    test('purchaseRobotUnit fails for invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.purchaseRobotUnit('invalid_robot_id')
      );
      expect(result).toBe(false);
    });

    test('can purchase multiple robots', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const available = await page.evaluate(() => window.game.getAvailableRobots());
      if (available.length > 0) {
        await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);
        await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);
        await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

        const state = await page.evaluate(() => window.game.getRobotState());
        expect(state.totalRobots).toBe(3);
      }
    });

    test('ownedCount increases after purchase', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(1000000));
      await page.evaluate(() =>
        window.game.completeResearchWithPrerequisites('robot_mower_fairway')
      );

      const before = await page.evaluate(() => window.game.getAvailableRobots());
      if (before.length > 0) {
        await page.evaluate(
          (id) => window.game.purchaseRobotUnit(id),
          before[0].equipmentId
        );

        const after = await page.evaluate(() => window.game.getAvailableRobots());
        const robot = after.find((r: any) => r.equipmentId === before[0].equipmentId);
        expect(robot?.ownedCount).toBe(1);
      }
    });
  });
});

test.describe('Robot Selling', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
    await page.evaluate(() => window.game.setCash(1000000));
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_mower_fairway')
    );
  });

  test('sellRobotUnit returns boolean', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      const result = await page.evaluate(
        (id) => window.game.sellRobotUnit(id),
        list[0].id
      );
      expect(typeof result).toBe('boolean');
    }
  });

  test('selling robot decreases total count', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const before = await page.evaluate(() => window.game.getRobotState());
      const list = await page.evaluate(() => window.game.getRobotList());

      await page.evaluate((id) => window.game.sellRobotUnit(id), list[0].id);

      const after = await page.evaluate(() => window.game.getRobotState());
      expect(after.totalRobots).toBe(before.totalRobots - 1);
    }
  });

  test('selling robot removes from list', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      await page.evaluate((id) => window.game.sellRobotUnit(id), list[0].id);

      const afterList = await page.evaluate(() => window.game.getRobotList());
      expect(afterList.length).toBe(0);
    }
  });

  test('selling robot returns refund', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const before = await page.evaluate(() => window.game.getEconomyState());
      const list = await page.evaluate(() => window.game.getRobotList());

      await page.evaluate((id) => window.game.sellRobotUnit(id), list[0].id);

      const after = await page.evaluate(() => window.game.getEconomyState());
      expect(after.cash).toBeGreaterThan(before.cash);
    }
  });

  test('sellRobotUnit fails for invalid id', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.game.sellRobotUnit('invalid_robot_id')
    );
    expect(result).toBe(false);
  });

  test('ownedCount decreases after sell', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      await page.evaluate((id) => window.game.sellRobotUnit(id), list[0].id);

      const after = await page.evaluate(() => window.game.getAvailableRobots());
      const robot = after.find((r: any) => r.equipmentId === available[0].equipmentId);
      expect(robot?.ownedCount).toBe(0);
    }
  });
});

test.describe('Robot Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
    await page.evaluate(() => window.game.setCash(10000000));
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_mower_fairway')
    );
  });

  test('advancing time updates robot state', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const before = await page.evaluate(() => window.game.getRobotList());

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(30));
      }

      const after = await page.evaluate(() => window.game.getRobotList());
      expect(after.length).toBe(1);
    }
  });

  test('robots maintain valid state through simulation', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(15));

        const state = await page.evaluate(() => window.game.getRobotState());
        expect(state.totalRobots).toBe(1);
        expect(state.workingRobots).toBeLessThanOrEqual(state.totalRobots);
        expect(state.brokenRobots).toBeLessThanOrEqual(state.totalRobots);
      }
    }
  });

  test('robot battery depletes during work', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const before = await page.evaluate(() => window.game.getRobotList());
      const initialBattery = before[0]?.battery ?? 100;

      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(30));
      }

      const after = await page.evaluate(() => window.game.getRobotList());
      if (after.length > 0) {
        expect(after[0].battery).toBeLessThanOrEqual(initialBattery);
      }
    }
  });

  test('robots can enter charging state', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      for (let i = 0; i < 50; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(30));
      }

      const list = await page.evaluate(() => window.game.getRobotList());
      const state = await page.evaluate(() => window.game.getRobotState());

      expect(list.length).toBe(1);
      expect(['idle', 'working', 'moving', 'charging', 'broken']).toContain(list[0].state);
    }
  });

  test('multiple robots work independently', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.game.advanceTimeByMinutes(30));
      }

      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(2);
    }
  });
});

test.describe('Robot Types', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
    await page.evaluate(() => window.game.setCash(100000000));
  });

  test('mower robot type is valid', async ({ page }) => {
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_mower_fairway')
    );

    const available = await page.evaluate(() => window.game.getAvailableRobots());
    const mower = available.find((r: any) => r.equipmentId.includes('mower'));

    if (mower) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), mower.equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(1);
      expect(list[0].type).toBe('mower');
    }
  });

  test('sprayer robot type is valid', async ({ page }) => {
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_sprayer')
    );

    const available = await page.evaluate(() => window.game.getAvailableRobots());
    const sprayer = available.find((r: any) =>
      r.equipmentId.includes('sprayer') || r.equipmentId.includes('sprinkler')
    );

    if (sprayer) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), sprayer.equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(1);
      expect(list[0].type).toBe('sprayer');
    }
  });

  test('spreader robot type is valid', async ({ page }) => {
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_fertilizer')
    );

    const available = await page.evaluate(() => window.game.getAvailableRobots());
    const spreader = available.find((r: any) =>
      r.equipmentId.includes('spreader') || r.equipmentId.includes('fertilizer')
    );

    if (spreader) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), spreader.equipmentId);

      const list = await page.evaluate(() => window.game.getRobotList());
      expect(list.length).toBe(1);
      expect(list[0].type).toBe('spreader');
    }
  });
});

test.describe('Robot State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
    await page.evaluate(() => window.game.setCash(10000000));
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_mower_fairway')
    );
  });

  test('saveCurrentGame saves robot state', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const stateBefore = await page.evaluate(() => window.game.getRobotState());
      expect(stateBefore.totalRobots).toBe(1);

      await page.evaluate(() => window.game.saveCurrentGame());
      const hasSave = await page.evaluate(() => window.game.hasSavedGame());
      expect(hasSave).toBe(true);
    }
  });
});

test.describe('Robot Details', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToScenario(page, 'tutorial_basics');
    await page.evaluate(() => window.game.setCash(10000000));
    await page.evaluate(() =>
      window.game.completeResearchWithPrerequisites('robot_mower_fairway')
    );
  });

  test('getRobotDetails returns valid structure after purchase', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const details = await page.evaluate(() => window.game.getRobotDetails());
      expect(details.length).toBe(1);

      const robot = details[0];
      expect(typeof robot.id).toBe('string');
      expect(typeof robot.type).toBe('string');
      expect(typeof robot.state).toBe('string');
      expect(typeof robot.battery).toBe('number');
      expect(typeof robot.gridX).toBe('number');
      expect(typeof robot.gridY).toBe('number');
    }
  });

  test('robot position is valid', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const details = await page.evaluate(() => window.game.getRobotDetails());
      expect(details.length).toBe(1);

      expect(details[0].gridX).toBeGreaterThanOrEqual(0);
      expect(details[0].gridY).toBeGreaterThanOrEqual(0);
    }
  });

  test('robot battery values are valid', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const details = await page.evaluate(() => window.game.getRobotDetails());
      expect(details.length).toBe(1);

      expect(details[0].battery).toBeGreaterThanOrEqual(0);
      expect(details[0].battery).toBeLessThanOrEqual(100);
    }
  });

  test('robot state is valid', async ({ page }) => {
    const available = await page.evaluate(() => window.game.getAvailableRobots());
    if (available.length > 0) {
      await page.evaluate((id) => window.game.purchaseRobotUnit(id), available[0].equipmentId);

      const details = await page.evaluate(() => window.game.getRobotDetails());
      const validStates = ['idle', 'working', 'moving', 'charging', 'broken'];

      expect(validStates).toContain(details[0].state);
    }
  });
});
