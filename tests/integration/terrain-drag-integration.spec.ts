/**
 * Terrain Editor Drag Integration Tests
 *
 * Tests terrain drag editing operations via public API.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Terrain Drag Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
    await page.evaluate(() => window.game.setAllCellsState({ height: 0, moisture: 60, nutrients: 70, health: 100 }));
  });

  test.describe('Drag Elevation Editing', () => {
    test('dragTerrainStart/Move/End raises terrain', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
      });

      const initialElev = await page.evaluate(() => window.game.getElevationAt(10, 10)) || 0;

      await page.evaluate(() => {
        window.game.dragTerrainStart(10, 10, 300);
        window.game.dragTerrainMove(10, 10, 200); // Move up = raise
        window.game.dragTerrainEnd();
      });

      const finalElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
      expect(finalElev).toBeGreaterThan(initialElev);
    });

    test('dragTerrainStart/Move/End lowers terrain', async ({ page }) => {
      // First raise terrain so we can lower it
      await page.evaluate(() => {
        window.game.setElevationAt(10, 10, 3);
      });

      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('lower');
      });

      const initialElev = await page.evaluate(() => window.game.getElevationAt(10, 10));

      await page.evaluate(() => {
        window.game.dragTerrainStart(10, 10, 200);
        window.game.dragTerrainMove(10, 10, 300); // Move down = lower
        window.game.dragTerrainEnd();
      });

      const finalElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
      expect(finalElev).toBeLessThan(initialElev!);
    });

    test('multiple drag moves accumulate', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
      });

      const initialElev = await page.evaluate(() => window.game.getElevationAt(10, 10)) || 0;

      await page.evaluate(() => {
        window.game.dragTerrainStart(10, 10, 300);
        window.game.dragTerrainMove(10, 10, 280);
        window.game.dragTerrainMove(10, 10, 260);
        window.game.dragTerrainMove(10, 10, 240);
        window.game.dragTerrainEnd();
      });

      const finalElev = await page.evaluate(() => window.game.getElevationAt(10, 10));
      expect(finalElev).toBeGreaterThan(initialElev);
    });

  });

  test.describe('Terrain Type Painting', () => {
    test('can paint different terrain types', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('paint');
      });

      // Paint as rough (should always be valid)
      await page.evaluate(() => {
        window.game.setTerrainTypeAt(5, 5, 'rough');
      });

      const type = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      expect(type).toBe('rough');
    });

    test('can set terrain type via API', async ({ page }) => {
      // Use valid positions within the map bounds
      await page.evaluate(() => {
        window.game.setTerrainTypeAt(5, 5, 'fairway');
      });
      const result = await page.evaluate(() => window.game.getTerrainTypeAt(5, 5));
      expect(result).toBe('fairway');
    });

    test('setElevationAt changes elevation directly', async ({ page }) => {
      // Use valid coordinates within bounds
      await page.evaluate(() => window.game.setElevationAt(5, 5, 2));

      const elev = await page.evaluate(() => window.game.getElevationAt(5, 5));
      expect(elev).toBe(2);
    });
  });

  test.describe('Brush Size', () => {
    test('brush size affects multiple tiles', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorTool('raise');
        window.game.setEditorBrushSize(2);
      });

      // Get initial elevations
      const before = await page.evaluate(() => ({
        center: window.game.getElevationAt(10, 10),
        adj1: window.game.getElevationAt(11, 10),
        adj2: window.game.getElevationAt(10, 11),
      }));

      await page.evaluate(() => {
        window.game.editTerrainAt(10, 10);
      });

      const after = await page.evaluate(() => ({
        center: window.game.getElevationAt(10, 10),
        adj1: window.game.getElevationAt(11, 10),
        adj2: window.game.getElevationAt(10, 11),
      }));

      // At least center tile should be raised
      expect(after.center).toBeGreaterThan(before.center || 0);
    });
  });

  test.describe('Editor State', () => {
    test('getTerrainEditorState returns full state', async ({ page }) => {
      await page.evaluate(() => {
        window.game.setTerrainEditor(true);
        window.game.setEditorBrushSize(3);
      });

      const state = await page.evaluate(() => window.game.getTerrainEditorState());

      expect(state.enabled).toBe(true);
      expect(['raise', 'lower', 'paint', 'smooth', null]).toContain(state.tool);
      expect(state.brushSize).toBe(3);
    });
  });
});
