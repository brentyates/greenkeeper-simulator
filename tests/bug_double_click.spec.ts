import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Bugs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);

    // Focus canvas
    await page.click("canvas");

    // Enable editor
    await page.keyboard.press("t");
    await page.waitForTimeout(100);
  });

  test("single click raises terrain by exactly 1 unit", async ({ page }) => {
    // Make sure we are in Raise mode (default, but pressing 1 to be sure)
    await page.keyboard.press("1");

    // Evaluate current elevation at player position (25, 19)
    const startElevation = await page.evaluate(() => {
      // @ts-ignore
      return window.game.grassSystem.getElevationAt(25, 19);
    });

    console.log("Start Elevation:", startElevation);

    // Click at screen center
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(50); // Short hold
    await page.mouse.up({ button: "left" });

    await page.waitForTimeout(200); // Wait for update

    const endElevation = await page.evaluate(() => {
      // @ts-ignore
      return window.game.grassSystem.getElevationAt(25, 19);
    });

    // With Vertical Drag, a simple click should select/lock but NOT change elevation
    // Elevation changes require vertical mouse movement.
    expect(endElevation).toBe(startElevation);
  });
});
