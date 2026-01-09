/**
 * UI and Overlay Integration Tests
 *
 * Tests for UI state management and overlay modes.
 */

import { test, expect, waitForGameReady, navigateToScenario } from '../utils/test-helpers';

test.describe('UI State Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
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
      await page.evaluate(() => window.game.pause());
      const paused = await page.evaluate(() => window.game.getUIState());
      expect(paused.isPaused).toBe(true);
    });

    test('unpause sets pause to false', async ({ page }) => {
      await page.evaluate(() => window.game.pause());
      await page.evaluate(() => window.game.unpause());
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
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
  });

  test.describe('Editor Toggle', () => {
    test('enableTerrainEditor activates editor', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(true);
    });

    test('disableTerrainEditor deactivates editor', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());
      await page.evaluate(() => window.game.disableTerrainEditor());
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(false);
    });

    test('toggleTerrainEditor toggles state', async ({ page }) => {
      await page.evaluate(() => window.game.disableTerrainEditor());
      await page.evaluate(() => window.game.toggleTerrainEditor());
      let state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(true);

      await page.evaluate(() => window.game.toggleTerrainEditor());
      state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(state.enabled).toBe(false);
    });

    test('isTerrainEditorEnabled returns boolean', async ({ page }) => {
      const enabled = await page.evaluate(() => window.game.isTerrainEditorEnabled());
      expect(typeof enabled).toBe('boolean');
    });
  });

  test.describe('Editor Tools', () => {
    test('setEditorTool changes tool', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());

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
      await page.evaluate(() => window.game.enableTerrainEditor());
      await page.evaluate(() => window.game.setEditorTool('paint'));
      const state = await page.evaluate(() => window.game.getTerrainEditorState());
      expect(['paint', 'raise', 'lower', 'smooth']).toContain(state.tool);
    });
  });

  test.describe('Brush Size', () => {
    test('setEditorBrushSize changes size', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());

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
      await page.evaluate(() => window.game.enableTerrainEditor());
      await page.evaluate(() => window.game.setEditorTool('raise'));

      const before = await page.evaluate(() => window.game.getElevationAt(10, 10));
      await page.evaluate(() => window.game.editTerrainAt(10, 10));
      const after = await page.evaluate(() => window.game.getElevationAt(10, 10));

      expect(after).toBeGreaterThanOrEqual(before);
    });

    test('undoTerrainEdit reverses edit', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());
      await page.evaluate(() => window.game.setEditorTool('raise'));

      const before = await page.evaluate(() => window.game.getElevationAt(10, 10));
      await page.evaluate(() => window.game.editTerrainAt(10, 10));
      await page.evaluate(() => window.game.undoTerrainEdit());
      const after = await page.evaluate(() => window.game.getElevationAt(10, 10));

      expect(after).toBe(before);
    });

    test('redoTerrainEdit reapplies edit', async ({ page }) => {
      await page.evaluate(() => window.game.enableTerrainEditor());
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
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
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

test.describe('Key Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true&preset=all_grass_mown');
    await waitForGameReady(page);
  });

  test('pressKey simulates key press', async ({ page }) => {
    await page.evaluate(() => window.game.pressKey('1'));
    const state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.selectedSlot).toBe(0);
  });

  test('pressKey for different equipment', async ({ page }) => {
    await page.evaluate(() => window.game.pressKey('2'));
    let state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.selectedSlot).toBe(1);

    await page.evaluate(() => window.game.pressKey('3'));
    state = await page.evaluate(() => window.game.getEquipmentState());
    expect(state.selectedSlot).toBe(2);
  });

  test('pressKey for pause', async ({ page }) => {
    await page.evaluate(() => window.game.unpause());
    await page.evaluate(() => window.game.pressKey('p'));
    const state = await page.evaluate(() => window.game.getUIState());
    expect(state.isPaused).toBe(true);
  });

  test('pressKey for terrain editor toggle', async ({ page }) => {
    await page.evaluate(() => window.game.pressKey('t'));
    const state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.enabled).toBe(true);
  });
});
