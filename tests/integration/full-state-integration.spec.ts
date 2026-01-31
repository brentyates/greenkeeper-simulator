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

      // Player state
      expect(state.player).toBeDefined();
      expect(typeof state.player.x).toBe('number');
      expect(typeof state.player.y).toBe('number');
      expect(typeof state.player.isMoving).toBe('boolean');

      // Equipment state
      expect(state.equipment).toBeDefined();
      expect(state.equipment.mower).toBeDefined();
      expect(state.equipment.sprinkler).toBeDefined();
      expect(state.equipment.spreader).toBeDefined();

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

    test('state is consistent before and after actions', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getFullGameState());

      // Perform some actions
      await page.evaluate(async () => {
        window.game.selectEquipment(1);
        window.game.movePlayer('right');
        await window.game.waitForPlayerIdle();
      });

      const after = await page.evaluate(() => window.game.getFullGameState());

      // Player position should have changed
      expect(after.player.y).toBe(before.player.y + 1);

      // Equipment should be active
      expect(after.equipment.selectedSlot).toBe(0);
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

  test.describe('Equipment State', () => {
    test('all equipment has valid resource levels', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getEquipmentState());

      if (state.mower) {
        expect(state.mower.resource).toBeGreaterThanOrEqual(0);
        expect(state.mower.resource).toBeLessThanOrEqual(state.mower.max);
      }

      if (state.sprinkler) {
        expect(state.sprinkler.resource).toBeGreaterThanOrEqual(0);
        expect(state.sprinkler.resource).toBeLessThanOrEqual(state.sprinkler.max);
      }

      if (state.spreader) {
        expect(state.spreader.resource).toBeGreaterThanOrEqual(0);
        expect(state.spreader.resource).toBeLessThanOrEqual(state.spreader.max);
      }
    });

    test('equipment selection cycles correctly', async ({ page }) => {
      // Select each equipment type
      await page.evaluate(() => window.game.selectEquipment(1));
      let state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(0);
      expect(state.mower?.active).toBe(true);

      await page.evaluate(() => window.game.selectEquipment(2));
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(1);
      expect(state.sprinkler?.active).toBe(true);

      await page.evaluate(() => window.game.selectEquipment(3));
      state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.selectedSlot).toBe(2);
      expect(state.spreader?.active).toBe(true);
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

  test('setEquipmentResource updates resource levels', async ({ page }) => {
    await page.evaluate(() => window.game.setEquipmentResource('mower', 50));
    const state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.mower?.resource).toBe(50);
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

  test('moving at boundary positions', async ({ page }) => {
    // Move to a corner
    await page.evaluate(() => window.game.teleport(0, 0));

    // Try moving into boundary
    await page.evaluate(async () => {
      window.game.movePlayer('up');
      await window.game.waitForPlayerIdle();
      window.game.movePlayer('left');
      await window.game.waitForPlayerIdle();
    });

    const pos = await page.evaluate(() => window.game.getPlayerPosition());
    // Should still be at or near origin
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  test('equipment with low resources', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setEquipmentResource('mower', 5);
      window.game.selectEquipment(1);
    });

    const state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.mower?.resource).toBeLessThanOrEqual(5);
    // Equipment should still be selected
    expect(state.selectedSlot).toBe(0);
  });

  test('rapid equipment switching', async ({ page }) => {
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        window.game.selectEquipment(1);
        window.game.selectEquipment(2);
        window.game.selectEquipment(3);
      }
    });

    // Should end on spreader (slot 3)
    const state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.selectedSlot).toBe(2);
  });

  test('terrain editor operations sequence', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorTool('raise');
      window.game.editTerrainAt(5, 5);
      window.game.undoTerrainEdit();
      window.game.redoTerrainEdit();
      window.game.setTerrainEditor(false);
    });

    const state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.enabled).toBe(false);
  });
});
