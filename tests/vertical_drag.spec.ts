import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Vertical Drag", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);

    // Focus canvas
    await page.click("canvas");

    // Enable editor
    await page.keyboard.press("t");
    await page.waitForTimeout(100);
  });

  test("vertical drag raises terrain", async ({ page }) => {
    // Select Raise tool (default, but ensuring)
    // Note: In vertical drag mode, raise/lower might be unified or behave similarly
    // For now, let's assume 'raise' tool enables this behavior

    // Current logic uses screen coordinates.
    // Center of screen is roughly (640, 360) which corresponds to tile (25, 19).
    const startX = 640;
    const startY = 360;

    // Get initial elevation
    const startElevation = await page.evaluate(() => {
      const x = 25;
      const y = 19;
      return window.game.grassSystem.getElevationAt(x, y);
    });

    console.log("Start Elevation:", startElevation);

    // Perform drag
    // Move mouse to start
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Drag UP (decrease Y) significantly to trigger raise
    // Let's say 40 pixels up = +2 units (20px per unit)
    await page.mouse.move(startX, startY - 40, { steps: 5 });
    await page.waitForTimeout(100); // Allow updates

    await page.mouse.up();

    // Get final elevation
    const endElevation = await page.evaluate(() => {
      const x = 25;
      const y = 19;
      return window.game.grassSystem.getElevationAt(x, y);
    });

    console.log("End Elevation:", endElevation);

    // Assert elevation increased
    expect(endElevation).toBeGreaterThan(startElevation ?? 0);
  });

  test("vertical drag lowers terrain", async ({ page }) => {
    const startX = 640;
    const startY = 360;

    const startElevation = await page.evaluate(() => {
      const x = 25;
      const y = 19;
      return window.game.grassSystem.getElevationAt(x, y);
    });

    // Move mouse to start
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Drag DOWN (increase Y) significantly to trigger lower
    await page.mouse.move(startX, startY + 40, { steps: 5 });
    await page.waitForTimeout(100);

    await page.mouse.up();

    const endElevation = await page.evaluate(() => {
      const x = 25;
      const y = 19;
      return window.game.grassSystem.getElevationAt(x, y);
    });

    expect(endElevation).toBeLessThan(startElevation ?? 0);
  });
});
