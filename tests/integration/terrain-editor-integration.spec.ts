/**
 * Terrain Editor Integration Tests
 */

import { test, expect } from '../fixtures/coverage';


test.describe('Terrain Editor Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test('terrain editor can be enabled and disabled', async ({ page }) => {
    expect(await page.evaluate(() => window.game.isTerrainEditorEnabled())).toBe(false);

    await page.evaluate(() => window.game.setTerrainEditor(true));
    expect(await page.evaluate(() => window.game.isTerrainEditorEnabled())).toBe(true);

    await page.evaluate(() => window.game.setTerrainEditor(false));
    expect(await page.evaluate(() => window.game.isTerrainEditorEnabled())).toBe(false);
  });

  test('can enable and disable terrain editor', async ({ page }) => {
    await page.evaluate(() => window.game.setTerrainEditor(true));
    expect(await page.evaluate(() => window.game.isTerrainEditorEnabled())).toBe(true);

    await page.evaluate(() => window.game.setTerrainEditor(false));
    expect(await page.evaluate(() => window.game.isTerrainEditorEnabled())).toBe(false);
  });

  test('can change editor tools', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorTool('raise');
    });

    let state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.tool).toBe('raise');

    await page.evaluate(() => window.game.setEditorTool('lower'));
    state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.tool).toBe('lower');
  });

  test('can change brush size', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorBrushSize(2);
    });

    let state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.brushSize).toBe(2);

    await page.evaluate(() => window.game.setEditorBrushSize(3));
    state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.brushSize).toBe(3);
  });

  test('editing terrain changes elevation', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorTool('raise');
    });

    const initialElev = await page.evaluate(() => window.game.getElevationAt(10, 10));

    await page.evaluate(() => {
      window.game.editTerrainAt(10, 10);
    });

    const finalElev = await page.evaluate(() => window.game.getElevationAt(10, 10));

    expect(finalElev).toBeGreaterThan(initialElev!);
  });

  test('undo and redo work', async ({ page }) => {
    await page.evaluate(() => {
      window.game.setTerrainEditor(true);
      window.game.setEditorTool('raise');
    });

    const initialElev = await page.evaluate(() => window.game.getElevationAt(10, 10));

    await page.evaluate(() => {
      window.game.editTerrainAt(10, 10);
    });

    const afterEditElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
    expect(afterEditElev).toBeGreaterThan(initialElev!);

    // Undo
    await page.evaluate(() => window.game.undoTerrainEdit());

    const afterUndoElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
    expect(afterUndoElev).toBe(initialElev);

    // Redo
    await page.evaluate(() => window.game.redoTerrainEdit());

    const afterRedoElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
    expect(afterRedoElev).toBe(afterEditElev);
  });

  test('undo/redo state is tracked', async ({ page }) => {
    await page.evaluate(() => window.game.setTerrainEditor(true));

    let state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);

    await page.evaluate(() => {
      window.game.setEditorTool('raise');
      window.game.editTerrainAt(10, 10);
    });

    state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);

    await page.evaluate(() => window.game.undoTerrainEdit());

    state = await page.evaluate(() => window.game.getTerrainEditorState());
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(true);
  });
});
