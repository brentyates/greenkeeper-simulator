/**
 * Comprehensive Game State Integration Tests
 *
 * Tests for complete game state manipulation and verification.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Game State Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Full State Snapshot', () => {
    test('getFullGameState returns complete state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(state).toBeDefined();
      expect(state.player).toBeDefined();
      expect(state.equipment).toBeDefined();
      expect(state.time).toBeDefined();
      expect(state.economy).toBeDefined();
      expect(state.terrain).toBeDefined();
    });

    test('player state has position and movement info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(typeof state.player.x).toBe('number');
      expect(typeof state.player.y).toBe('number');
      expect(typeof state.player.isMoving).toBe('boolean');
    });

    test('equipment state includes all equipment types', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(state.equipment.mower).toBeDefined();
      expect(state.equipment.sprinkler).toBeDefined();
      expect(state.equipment.spreader).toBeDefined();
    });

    test('time state has day, hours, minutes', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(typeof state.time.day).toBe('number');
      expect(typeof state.time.hours).toBe('number');
      expect(typeof state.time.minutes).toBe('number');
    });

    test('economy state has cash tracking', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(typeof state.economy.cash).toBe('number');
      expect(typeof state.economy.earned).toBe('number');
      expect(typeof state.economy.spent).toBe('number');
    });

    test('terrain state has dimensions', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(typeof state.terrain.width).toBe('number');
      expect(typeof state.terrain.height).toBe('number');
      expect(state.terrain.width).toBeGreaterThan(0);
      expect(state.terrain.height).toBeGreaterThan(0);
    });
  });

  test.describe('Course Stats', () => {
    test('getCourseStats returns health metrics', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      expect(stats).toBeDefined();
      expect(typeof stats.health).toBe('number');
      expect(typeof stats.moisture).toBe('number');
      expect(typeof stats.nutrients).toBe('number');
      expect(typeof stats.height).toBe('number');
    });

    test('course stats are within valid ranges', async ({ page }) => {
      const stats = await page.evaluate(() => window.game.getCourseStats());

      expect(stats.health).toBeGreaterThanOrEqual(0);
      expect(stats.health).toBeLessThanOrEqual(100);
      expect(stats.moisture).toBeGreaterThanOrEqual(0);
      expect(stats.moisture).toBeLessThanOrEqual(100);
      expect(stats.nutrients).toBeGreaterThanOrEqual(0);
      expect(stats.nutrients).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Golfer State', () => {
    test('getGolferState returns golfer info', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      expect(state).toBeDefined();
      expect(typeof state.active).toBe('number');
      expect(typeof state.served).toBe('number');
      expect(typeof state.avgSatisfaction).toBe('number');
    });

    test('golfer satisfaction is within valid range', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getGolferState());

      expect(state.avgSatisfaction).toBeGreaterThanOrEqual(0);
      expect(state.avgSatisfaction).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Scenario State', () => {
    test('getScenarioState returns scenario info', async ({ page }) => {
      await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(typeof state.progress).toBe('number');
        expect(typeof state.completed).toBe('boolean');
        expect(typeof state.failed).toBe('boolean');
      }
    });

    test('scenario progress is within 0-100', async ({ page }) => {
      await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
      const state = await page.evaluate(() => window.game.getScenarioState());

      if (state) {
        expect(state.progress).toBeGreaterThanOrEqual(0);
        expect(state.progress).toBeLessThanOrEqual(100);
      }
    });
  });
});

test.describe('Terrain Queries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Elevation Queries', () => {
    test('getElevationAt returns number', async ({ page }) => {
      const elev = await page.evaluate(() => window.game.getElevationAt(5, 5));
      expect(typeof elev).toBe('number');
    });

    test('elevation can be modified', async ({ page }) => {
      await page.evaluate(() => window.game.setElevationAt(5, 5, 3));
      const elev = await page.evaluate(() => window.game.getElevationAt(5, 5));
      expect(elev).toBe(3);
    });

    test('multiple elevation modifications work', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setElevationAt(1, 1, 1);
        window.game.setElevationAt(2, 2, 2);
        window.game.setElevationAt(3, 3, 3);
      });

      const e1 = await page.evaluate(() => window.game.getElevationAt(1, 1));
      const e2 = await page.evaluate(() => window.game.getElevationAt(2, 2));
      const e3 = await page.evaluate(() => window.game.getElevationAt(3, 3));

      expect(e1).toBe(1);
      expect(e2).toBe(2);
      expect(e3).toBe(3);
    });
  });

  test.describe('Terrain Type Queries', () => {
    test('getTerrainTypeAt returns valid type', async ({ page }) => {
      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      const validTypes = ['fairway', 'rough', 'green', 'bunker', 'water', 'tee'];

      if (type !== undefined) {
        expect(validTypes).toContain(type);
      }
    });

    test('terrain type can be modified', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainTypeAt(5, 5, 'bunker'));
      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      expect(type).toBe('bunker');
    });

    test('all terrain types can be set', async ({ page }) => {
      const types = ['fairway', 'rough', 'green', 'bunker', 'water'] as const;

      for (let i = 0; i < types.length; i++) {
        await page.evaluate(({ x, t }) => window.game.setTerrainTypeAt(x, 5, t), { x: i + 1, t: types[i] });
        const type = await page.evaluate((x) => window.game.getTerrainTypeAt(x, 5), i + 1);
        expect(type).toBe(types[i]);
      }
    });
  });
});

test.describe('Economy Manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('setCash updates cash amount', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(99999));
    const state = await page.evaluate(() => window.game.getEconomyState());
    expect(state.cash).toBe(99999);
  });

  test('cash can be set to zero', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(0));
    const state = await page.evaluate(() => window.game.getEconomyState());
    expect(state.cash).toBe(0);
  });

  test('cash can be set to large values', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(10000000));
    const state = await page.evaluate(() => window.game.getEconomyState());
    expect(state.cash).toBe(10000000);
  });
});

test.describe('Time Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('getGameTime returns valid time', async ({ page }) => {
    const time = await page.evaluate(() => window.game.getGameTime());

    expect(time.hours).toBeGreaterThanOrEqual(0);
    expect(time.hours).toBeLessThan(24);
    expect(time.minutes).toBeGreaterThanOrEqual(0);
    expect(time.minutes).toBeLessThan(60);
  });

  test('getGameDay returns positive day', async ({ page }) => {
    const day = await page.evaluate(() => window.game.getGameDay());
    expect(day).toBeGreaterThanOrEqual(1);
  });

  test('advanceTimeByMinutes updates time', async ({ page }) => {
    const before = await page.evaluate(() => window.game.getGameTime());
    await page.evaluate(() => window.game.advanceTimeByMinutes(30));
    const after = await page.evaluate(() => window.game.getGameTime());

    const beforeTotal = before.hours * 60 + before.minutes;
    const afterTotal = after.hours * 60 + after.minutes;

    if (afterTotal >= beforeTotal) {
      expect(afterTotal - beforeTotal).toBeGreaterThanOrEqual(29);
    } else {
      expect(afterTotal + 24 * 60 - beforeTotal).toBeGreaterThanOrEqual(29);
    }
  });

  test('advanceDay increments day', async ({ page }) => {
    const before = await page.evaluate(() => window.game.getGameDay());
    await page.evaluate(() => window.game.advanceDay());
    const after = await page.evaluate(() => window.game.getGameDay());

    expect(after).toBe(before + 1);
  });
});

test.describe('Player Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('getPlayerPosition returns coordinates', async ({ page }) => {
    const pos = await page.evaluate(() => window.game.getPlayerPosition());

    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  test('teleport moves player to position', async ({ page }) => {
    await page.evaluate(() => window.game.teleport(10, 10));
    const pos = await page.evaluate(() => window.game.getPlayerPosition());

    expect(pos.x).toBe(10);
    expect(pos.y).toBe(10);
  });

  test('movePlayer changes position', async ({ page }) => {
    await page.evaluate(() => window.game.teleport(15, 15));
    const before = await page.evaluate(() => window.game.getPlayerPosition());

    await page.evaluate(async () => {
      window.game.movePlayer('right');
      await window.game.waitForPlayerIdle();
    });

    const after = await page.evaluate(() => window.game.getPlayerPosition());
    expect(after.y).toBe(before.y + 1);
  });

  test('all movement directions work', async ({ page }) => {
    await page.evaluate(() => window.game.teleport(20, 20));

    const directions = ['up', 'down', 'left', 'right'] as const;
    for (const dir of directions) {
      await page.evaluate(async (d) => {
        window.game.movePlayer(d);
        await window.game.waitForPlayerIdle();
      }, dir);
    }

    const pos = await page.evaluate(() => window.game.getPlayerPosition());
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
  });
});
