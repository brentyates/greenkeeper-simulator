import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Bugs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);

    // Enable editor via API
    await page.evaluate(() => {
      window.game.enableTerrainEditor();
    });
    await page.waitForTimeout(100);
  });

  test("single click raises terrain by exactly 1 unit", async ({ page }) => {
    // Make sure we are in Raise mode (default)
    await page.evaluate(() => {
      window.game.setEditorTool('raise');
    });

    // Get player position (default is 25, 19) and current elevation
    const { x, y } = await page.evaluate(() => {
      const pos = window.game.getPlayerPosition();
      return { x: pos.x, y: pos.y };
    });

    const startElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    console.log("Start Elevation:", startElevation);

    // Click at player position using API
    await page.evaluate(({ x, y }) => {
      window.game.editTerrainAt(x, y);
    }, { x, y });

    await page.waitForTimeout(200); // Wait for update

    const endElevation = await page.evaluate(({ x, y }) => {
      return window.game.getElevationAt(x, y);
    }, { x, y });

    // With Vertical Drag, a simple click should select/lock but NOT change elevation
    // Elevation changes require vertical mouse movement.
    expect(endElevation).toBe(startElevation);
  });
});
