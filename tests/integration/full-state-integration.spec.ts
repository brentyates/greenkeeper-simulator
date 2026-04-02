/**
 * Full Game State Integration Tests
 *
 * Tests complete game state retrieval and manipulation.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Full Game State Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Complete State Retrieval', () => {
    test('getFullGameState returns all components', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      // Time state
      expect(state.time).toBeDefined();
      expect(typeof state.time.day).toBe('number');
      expect(typeof state.time.hours).toBe('number');
      expect(typeof state.time.minutes).toBe('number');

      // Economy state
      expect(state.economy).toBeDefined();
      expect(typeof state.economy.cash).toBe('number');
      expect(typeof state.economy.earned).toBe('number');
      expect(typeof state.economy.spent).toBe('number');

      // Terrain info
      expect(state.terrain).toBeDefined();
      expect(typeof state.terrain.width).toBe('number');
      expect(typeof state.terrain.height).toBe('number');

      // Editor state
      expect(typeof state.editorEnabled).toBe('boolean');
    });

  });

  test.describe('Terrain State', () => {
    test('terrain dimensions are correct', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());

      expect(state.terrain.width).toBeGreaterThan(0);
      expect(state.terrain.height).toBeGreaterThan(0);
    });

    test('terrain type queries cover all positions', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());
      const { width, height } = state.terrain;

      // Sample some positions
      const positions = [
        { x: 0, y: 0 },
        { x: Math.floor(width / 2), y: Math.floor(height / 2) },
        { x: width - 1, y: height - 1 },
      ];

      for (const pos of positions) {
        const type = await page.evaluate(({ x, y }) =>
          window.game.getTerrainTypeAt(x, y), pos);
        const elev = await page.evaluate(({ x, y }) =>
          window.game.getElevationAt(x, y), pos);

        // May be undefined for positions outside valid terrain
        if (type !== undefined) {
          expect(['fairway', 'rough', 'green', 'bunker', 'water', 'tee']).toContain(type);
        }
      }
    });
  });

  test.describe('Time State', () => {
    test('time values are within valid ranges', async ({ page }) => {
      const time = await page.evaluate(() => window.game.getGameTime());

      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThan(24);
      expect(time.minutes).toBeGreaterThanOrEqual(0);
      expect(time.minutes).toBeLessThan(60);
    });

    test('day count is positive', async ({ page }) => {
      const day = await page.evaluate(() => window.game.getGameDay());
      expect(day).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('UI State', () => {
    test('overlay mode is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());

      expect(['normal', 'moisture', 'nutrients', 'height', 'irrigation']).toContain(state.overlayMode);
    });

    test('pause state is boolean', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());
      expect(typeof state.isPaused).toBe('boolean');
    });
  });
});

test.describe('State Manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('setCash updates economy state', async ({ page }) => {
    await page.evaluate(() => window.game.setCash(12345));
    const state = await page.evaluate(() => window.game.getEconomyState());
    expect(state.cash).toBe(12345);
  });

  test('setElevationAt modifies terrain', async ({ page }) => {
    await page.evaluate(() => window.game.setElevationAt(5, 5, 3));
    const elev = await page.evaluate(() => window.game.getElevationAt(5, 5));
    expect(elev).toBe(3);
  });

  test('setTerrainTypeAt modifies terrain type', async ({ page }) => {
    await page.evaluate(() => window.game.setTerrainTypeAt(5, 5, 'rough'));
    const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
    expect(type).toBe('rough');
  });
});

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('terrain editor operations sequence', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorTool('raise');
      window.game.editTerrainAt(5, 5);
      window.game.setTerrainEditor(false);
    });

    const state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.enabled).toBe(false);
  });
});
