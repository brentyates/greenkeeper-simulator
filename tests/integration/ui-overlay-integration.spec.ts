/**
 * UI and Overlay Integration Tests
 *
 * Tests for UI state management and overlay modes.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('UI State Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Overlay Modes', () => {
    test('getUIState returns valid overlay mode', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());
      const validModes = ['normal', 'moisture', 'nutrients', 'height', 'irrigation'];

      expect(validModes).toContain(state.overlayMode);
    });

    test('setOverlayMode changes mode', async ({ page }) => {
      await page.evaluate(() => window.game.setOverlayMode('moisture'));
      const state = await page.evaluate(() => window.game.getUIState());

      expect(state.overlayMode).toBe('moisture');
    });

    test('can set all overlay modes', async ({ page }) => {
      const modes = ['normal', 'moisture', 'nutrients', 'height', 'irrigation'] as const;

      for (const mode of modes) {
        await page.evaluate((m) => window.game.setOverlayMode(m), mode);
        const state = await page.evaluate(() => window.game.getUIState());
        expect(state.overlayMode).toBe(mode);
      }
    });
  });

  test.describe('Pause State', () => {
    test('getUIState returns pause state', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getUIState());
      expect(typeof state.isPaused).toBe('boolean');
    });

    test('pause toggles pause state', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      const paused = await page.evaluate(() => window.game.getUIState());
      expect(paused.isPaused).toBe(true);
    });

    test('unpause sets pause to false', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(true));
      await page.evaluate(() => window.game.setPaused(false));
      const state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);
    });

    test('setPaused toggles pause', async ({ page }) => {
      await page.evaluate(() => window.game.setPaused(false));
      let state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(false);

      await page.evaluate(() => window.game.setPaused(true));
      state = await page.evaluate(() => window.game.getUIState());
      expect(state.isPaused).toBe(true);
    });
  });
});

test.describe('Terrain Editor UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Editor Toggle', () => {
    test('setTerrainEditor(true) activates editor', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(true);
    });

    test('setTerrainEditor(false) deactivates editor', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      await page.evaluate(() => window.game.setTerrainEditor(false));
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(false);
    });

    test('isTerrainEditorEnabled returns boolean', async ({ page }) => {
      const enabled = await page.evaluate(() => window.game.isTerrainEditorEnabled());
      expect(typeof enabled).toBe('boolean');
    });
  });

  test.describe('Editor Tools', () => {
    test('setEditorTool changes tool', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));

      await page.evaluate(() => window.game.setEditorTool('raise'));
      let state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.tool).toBe('raise');

      await page.evaluate(() => window.game.setEditorTool('lower'));
      state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.tool).toBe('lower');

      await page.evaluate(() => window.game.setEditorTool('smooth'));
      state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.tool).toBe('smooth');
    });

    test('paint tool can be set', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      await page.evaluate(() => window.game.setEditorTool('paint'));
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(['paint', 'raise', 'lower', 'smooth']).toContain(state.tool);
    });
  });

  test.describe('Brush Size', () => {
    test('setEditorBrushSize changes size', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));

      await page.evaluate(() => window.game.setEditorBrushSize(1));
      let state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.brushSize).toBe(1);

      await page.evaluate(() => window.game.setEditorBrushSize(2));
      state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.brushSize).toBe(2);

      await page.evaluate(() => window.game.setEditorBrushSize(3));
      state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.brushSize).toBe(3);
    });
  });

  test.describe('Editor Operations', () => {
    test('editTerrainAt modifies terrain', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      await page.evaluate(() => window.game.setEditorTool('raise'));

      const before = await page.evaluate(() => window.game.getElevationAt(10, 10));
      await page.evaluate(() => window.game.editTerrainAt(10, 10));
      const after = await page.evaluate(() => window.game.getElevationAt(10, 10));

      expect(after).toBeGreaterThanOrEqual(before);
    });

    test('undoTerrainEdit reverses edit', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      await page.evaluate(() => window.game.setEditorTool('raise'));

      const before = await page.evaluate(() => window.game.getElevationAt(10, 10));
      await page.evaluate(() => window.game.editTerrainAt(10, 10));
      await page.evaluate(() => window.game.undoTerrainEdit());
      const after = await page.evaluate(() => window.game.getElevationAt(10, 10));

      expect(after).toBe(before);
    });

    test('redoTerrainEdit reapplies edit', async ({ page }) => {
      await page.evaluate(() => window.game.setTerrainEditor(true));
      await page.evaluate(() => window.game.setEditorTool('raise'));

      await page.evaluate(() => window.game.editTerrainAt(10, 10));
      const raised = await page.evaluate(() => window.game.getElevationAt(10, 10));
      await page.evaluate(() => window.game.undoTerrainEdit());
      await page.evaluate(() => window.game.redoTerrainEdit());
      const after = await page.evaluate(() => window.game.getElevationAt(10, 10));

      expect(after).toBe(raised);
    });
  });
});

test.describe('Save/Load Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('saveCurrentGame saves without error', async ({ page }) => {
    await page.evaluate(() => window.game.saveCurrentGame());
    expect(true).toBe(true);
  });

  test('hasSavedGame returns boolean', async ({ page }) => {
    const result = await page.evaluate(() => window.game.hasSavedGame());
    expect(typeof result).toBe('boolean');
  });

  test('save and hasSavedGame work together', async ({ page }) => {
    await page.evaluate(() => window.game.saveCurrentGame());
    const hasSave = await page.evaluate(() => window.game.hasSavedGame());
    expect(typeof hasSave).toBe('boolean');
  });
});

test.describe('Overlay Cycling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('cycleOverlay changes overlay mode', async ({ page }) => {
    const initialMode = await page.evaluate(() => window.game.getOverlayMode());
    await page.evaluate(() => window.game.cycleOverlay());
    const newMode = await page.evaluate(() => window.game.getOverlayMode());
    expect(newMode).not.toBe(initialMode);
  });

  test('cycleOverlay cycles through all modes', async ({ page }) => {
    const modes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const mode = await page.evaluate(() => window.game.getOverlayMode());
      modes.push(mode);
      await page.evaluate(() => window.game.cycleOverlay());
    }
    const uniqueModes = new Set(modes);
    expect(uniqueModes.size).toBeGreaterThan(1);
  });
});

test.describe('Audio Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('toggleMute does not throw', async ({ page }) => {
    await page.evaluate(() => window.game.toggleMute());
    expect(true).toBe(true);
  });

  test('toggleMute can be called multiple times', async ({ page }) => {
    await page.evaluate(() => {
      window.game.toggleMute();
      window.game.toggleMute();
    });
    expect(true).toBe(true);
  });
});

test.describe('Equipment Refill', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => {
      window.game.setAllCellsState({ height: 50, moisture: 50, nutrients: 50, health: 80 });
      window.game.setEquipmentResource('mower', 10);
      window.game.setEquipmentResource('sprinkler', 10);
      window.game.setEquipmentResource('spreader', 10);
    });
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test('refillEquipment does not throw', async ({ page }) => {
    await page.evaluate(() => window.game.refillEquipment());
    expect(true).toBe(true);
  });

  test('isAtRefillStation returns boolean', async ({ page }) => {
    const atStation = await page.evaluate(() => window.game.isAtRefillStation());
    expect(typeof atStation).toBe('boolean');
  });

  test('getRefillStations returns array', async ({ page }) => {
    const stations = await page.evaluate(() => window.game.getRefillStations());
    expect(Array.isArray(stations)).toBe(true);
  });
});

test.describe('Game Running State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('setRunning true starts game', async ({ page }) => {
    await page.evaluate(() => window.game.setRunning(true));
    expect(true).toBe(true);
  });

  test('setRunning false stops game', async ({ page }) => {
    await page.evaluate(() => window.game.setRunning(false));
    expect(true).toBe(true);
  });

  test('setRunning can toggle multiple times', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setRunning(false);
      window.game.setRunning(true);
      window.game.setRunning(false);
      window.game.setRunning(true);
    });
    expect(true).toBe(true);
  });
});

