import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Vertical Drag", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);

    // Enable editor via API
    await page.evaluate(() => {
      window.game.enableTerrainEditor();
    });
    await page.waitForTimeout(100);
  });

  test("vertical drag raises terrain", async ({ page }) => {
    // Get player position (default is 25, 19)
    const { x, y } = await page.evaluate(() => {
      const pos = window.game.getPlayerPosition();
      return { x: pos.x, y: pos.y };
    });

    // Get initial elevation
    const startElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    console.log("Start Elevation:", startElevation);

    // Perform drag operation via API
    // Start drag at player position with screen Y coordinate
    // Then move up (decrease screen Y) to raise terrain
    const baseScreenY = 360; // Screen center
    await page.evaluate(({ x, y, screenY }) => {
      window.game.dragTerrainStart(x, y, screenY);
    }, { x, y, screenY: baseScreenY });

    // Drag UP (decrease screenY by 40 pixels = +2 elevation units at 20px per unit)
    await page.evaluate(({ x, y, screenY }) => {
      window.game.dragTerrainMove(x, y, screenY - 40);
    }, { x, y, screenY: baseScreenY });

    await page.waitForTimeout(100); // Allow updates

    await page.evaluate(() => {
      window.game.dragTerrainEnd();
    });

    // Get final elevation
    const endElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    console.log("End Elevation:", endElevation);

    // Assert elevation increased
    expect(endElevation).toBeGreaterThan(startElevation ?? 0);
  });

  test("vertical drag lowers terrain", async ({ page }) => {
    // Get player position
    const { x, y } = await page.evaluate(() => {
      const pos = window.game.getPlayerPosition();
      return { x: pos.x, y: pos.y };
    });

    const startElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    // Perform drag operation via API
    const baseScreenY = 360;
    await page.evaluate(({ x, y, screenY }) => {
      window.game.dragTerrainStart(x, y, screenY);
    }, { x, y, screenY: baseScreenY });

    // Drag DOWN (increase screenY by 40 pixels = -2 elevation units)
    await page.evaluate(({ x, y, screenY }) => {
      window.game.dragTerrainMove(x, y, screenY + 40);
    }, { x, y, screenY: baseScreenY });

    await page.waitForTimeout(100);

    await page.evaluate(() => {
      window.game.dragTerrainEnd();
    });

    const endElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    expect(endElevation).toBeLessThan(startElevation ?? 0);
  });
});
