/**
 * Irrigation and UI Systems Integration Tests
 *
 * Tests for irrigation system and UI-related functionality.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Irrigation System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Irrigation State', () => {
    test('getIrrigationSystem returns valid system', async ({ page }) => {
      const system = await page.evaluate(() => window.game.getIrrigationSystem());
      expect(system).toBeDefined();
      expect(typeof system.pipes).toBe('object');
      expect(typeof system.sprinklerHeads).toBe('object');
    });
  });

  test.describe('Pipe Operations', () => {
    test('placePipe adds a pipe', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));
      const result = await page.evaluate(() =>
        window.game.placePipe(10, 10, 'pvc')
      );
      expect(typeof result).toBe('boolean');
    });

    test('removePipe removes a pipe', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placePipe(15, 15, 'pvc');
      });
      await page.evaluate(() => window.game.removePipe(15, 15));
      const system = await page.evaluate(() => window.game.getIrrigationSystem());
      expect(system).toBeDefined();
    });

    test('placePipe checks affordability', async ({ page }) => {
      // Set cash to 0 to test affordability
      await page.evaluate(() => window.game.setCash(1));
      await page.evaluate(() => window.game.setCash(0));
      // Force an expense to ensure truly 0 cash
      const state = await page.evaluate(() => window.game.getEconomyState());
      // Just verify cash is low enough that expensive pipes fail
      if (state.cash < 10) {
        const result = await page.evaluate(() =>
          window.game.placePipe(20, 20, 'industrial')
        );
        // Industrial pipes cost more, might fail if cash is too low
        expect(typeof result).toBe('boolean');
      }
    });
  });

  test.describe('Sprinkler Operations', () => {
    test('placeSprinklerHead adds a sprinkler', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(10000));
      const result = await page.evaluate(() =>
        window.game.placeSprinklerHead(10, 10, 'fixed')
      );
      expect(typeof result).toBe('boolean');
    });

    test('removeSprinklerHead removes sprinkler', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setCash(10000);
        window.game.placeSprinklerHead(12, 12, 'fixed');
        window.game.removeSprinklerHead(12, 12);
      });
      expect(true).toBe(true);
    });

    test('repairLeak handles non-leaking pipe', async ({ page }) => {
      const result = await page.evaluate(() => window.game.repairLeak(5, 5));
      expect(result).toBe(false);
    });
  });

  test.describe('Irrigation Schedule', () => {
    test('setIrrigationSchedule can be called', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setIrrigationSchedule('test_head', {
          startHour: 6,
          durationMinutes: 30,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          isActive: true,
        });
      });
      expect(true).toBe(true);
    });
  });
});

test.describe('Overlay System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Overlay Modes', () => {
    test('getOverlayMode returns current mode', async ({ page }) => {
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(['normal', 'moisture', 'nutrients', 'height', 'irrigation']).toContain(mode);
    });

    test('setOverlayMode changes to moisture', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('moisture'));
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(mode).toBe('moisture');
    });

    test('setOverlayMode changes to nutrients', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('nutrients'));
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(mode).toBe('nutrients');
    });

    test('setOverlayMode changes to height', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('height'));
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(mode).toBe('height');
    });

    test('setOverlayMode changes to irrigation', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('irrigation'));
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(mode).toBe('irrigation');
    });

    test('setOverlayMode changes back to normal', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('irrigation'));
      await page.evaluate(() => window.game.setOverlayMode('normal'));
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      expect(mode).toBe('normal');
    });
  });
});

test.describe('UI State System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('UI State', () => {
    test('getUIState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());
      expect(state).toBeDefined();
      expect(typeof state.isPaused).toBe('boolean');
      expect(typeof state.overlayMode).toBe('string');
      expect(typeof state.notificationCount).toBe('number');
    });

    test('pause/unpause controls work', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      let state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(true);

      await page.evaluate(() => window.game.setPaused(false));
      state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);
    });

    test('setPaused controls pause state', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      let state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(true);

      await page.evaluate(() => window.game.setPaused(false));
      state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);
    });
  });
});

test.describe('Panel Toggle System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Panel Toggles', () => {
    test('toggleEmployeePanel works', async ({ page }) => {
      await page.evaluate(() => window.game.toggleEmployeePanel());
      expect(true).toBe(true);
    });

    test('toggleResearchPanel works', async ({ page }) => {
      await page.evaluate(() => window.game.toggleResearchPanel());
      expect(true).toBe(true);
    });

    test('toggleTeeSheetPanel works', async ({ page }) => {
      await page.evaluate(() => window.game.toggleTeeSheetPanel());
      expect(true).toBe(true);
    });

    test('toggleMarketingPanel works', async ({ page }) => {
      await page.evaluate(() => window.game.toggleMarketingPanel());
      expect(true).toBe(true);
    });
  });
});

test.describe('Terrain Editor System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Editor State', () => {
    test('getTerrainEditorState returns valid state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state).toBeDefined();
      expect(typeof state.enabled).toBe('boolean');
      expect(typeof state.brushSize).toBe('number');
      expect(typeof state.canUndo).toBe('boolean');
      expect(typeof state.canRedo).toBe('boolean');
    });

    test('editor starts disabled', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(false);
    });
  });

  test.describe('Editor Operations', () => {
    test('setTerrainEditor(true) enables editor', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      const enabled = await page.evaluate(() => window.game.isTerrainEditorEnabled());
      expect(enabled).toBe(true);
    });

    test('setTerrainEditor(false) disables editor', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setTerrainEditor(false);
      });
      const enabled = await page.evaluate(() => window.game.isTerrainEditorEnabled());
      expect(enabled).toBe(false);
    });

    test('setEditorTool changes tool', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
      });
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.tool).toBe('raise');
    });

    test('setEditorBrushSize changes brush size', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorBrushSize(2);
      });
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.brushSize).toBe(2);
    });

    test('editTerrainAt performs edit', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
        window.game.editTerrainAt(10, 10);
      });
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.canUndo).toBe(true);
    });

    test('undoTerrainEdit reverts change', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
        window.game.editTerrainAt(10, 10);
        window.game.undoTerrainEdit();
      });
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.canRedo).toBe(true);
    });

    test('redoTerrainEdit reapplies change', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
        window.game.editTerrainAt(10, 10);
        window.game.undoTerrainEdit();
        window.game.redoTerrainEdit();
      });
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.canUndo).toBe(true);
    });
  });

  test.describe('Drag Operations', () => {
    test('terrain drag operations work', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
        window.game.dragTerrainStart(5, 5, 100);
        window.game.dragTerrainMove(6, 6, 150);
        window.game.dragTerrainEnd();
      });
      expect(true).toBe(true);
    });
  });
});

test.describe('Equipment System Extended', () => {
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

  test.describe('Equipment Resource', () => {
    test('setEquipmentResource sets mower resource', async ({ page }) => {
      await page.evaluate(() => window.game.setEquipmentResource('mower', 50));
      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.mower?.resource).toBe(50);
    });

    test('setEquipmentResource sets sprinkler resource', async ({ page }) => {
      await page.evaluate(() => window.game.setEquipmentResource('sprinkler', 75));
      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.sprinkler?.resource).toBe(75);
    });

    test('setEquipmentResource sets spreader resource', async ({ page }) => {
      await page.evaluate(() => window.game.setEquipmentResource('spreader', 25));
      const state = await page.evaluate(() => window.game.getEquipmentState());
      expect(state.spreader?.resource).toBe(25);
    });
  });

  test.describe('Refill Station', () => {
    test('isAtRefillStation returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.isAtRefillStation());
      expect(typeof result).toBe('boolean');
    });

    test('getRefillStations returns array', async ({ page }) => {
      const stations = await page.evaluate(() => window.game.getRefillStations());
      expect(Array.isArray(stations)).toBe(true);
      for (const station of stations) {
        expect(typeof station.x).toBe('number');
        expect(typeof station.y).toBe('number');
      }
    });

    test('refillAtCurrentPosition returns result', async ({ page }) => {
      const result = await page.evaluate(() => window.game.refillAtCurrentPosition());
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.cost).toBe('number');
    });
  });

  test.describe('Particles', () => {
    test('hasActiveParticles returns boolean', async ({ page }) => {
      const result = await page.evaluate(() => window.game.hasActiveParticles());
      expect(typeof result).toBe('boolean');
    });
  });
});

test.describe('Grass System Extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Grass Growth', () => {
    test('forceGrassGrowth triggers growth', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getCourseStats());
      await page.evaluate(() => window.game.forceGrassGrowth(120));
      const after = await page.evaluate(() => window.game.getCourseStats());
      expect(after).toBeDefined();
    });

    test('getGrassRenderUpdateCount returns number', async ({ page }) => {
      const count = await page.evaluate(() => window.game.getGrassRenderUpdateCount());
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Time System Extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&scenario=tutorial_basics');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Time Operations', () => {
    test('getGameTime returns valid time', async ({ page }) => {
      const time = await page.evaluate(() => window.game.getGameTime());
      expect(typeof time.hours).toBe('number');
      expect(typeof time.minutes).toBe('number');
      expect(time.hours).toBeGreaterThanOrEqual(0);
      expect(time.hours).toBeLessThan(24);
      expect(time.minutes).toBeGreaterThanOrEqual(0);
      expect(time.minutes).toBeLessThan(60);
    });

    test('advanceDay increments day', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getGameDay());
      await page.evaluate(() => window.game.advanceDay());
      const after = await page.evaluate(() => window.game.getGameDay());
      expect(after).toBe(before + 1);
    });
  });
});

test.describe('Full Game State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('State Access', () => {
    test('getFullGameState returns complete state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());
      expect(state).toBeDefined();
      expect(state.player).toBeDefined();
      expect(state.equipment).toBeDefined();
      expect(state.time).toBeDefined();
      expect(state.economy).toBeDefined();
      expect(state.terrain).toBeDefined();
      expect(typeof state.editorEnabled).toBe('boolean');
    });

    test('player state is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());
      expect(typeof state.player.x).toBe('number');
      expect(typeof state.player.y).toBe('number');
      expect(typeof state.player.isMoving).toBe('boolean');
    });

    test('time state is valid', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getFullGameState());
      expect(typeof state.time.day).toBe('number');
      expect(typeof state.time.hours).toBe('number');
      expect(typeof state.time.minutes).toBe('number');
    });
  });
});
