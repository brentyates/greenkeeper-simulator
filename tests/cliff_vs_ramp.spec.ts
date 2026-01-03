import { test, expect } from "@playwright/test";
import { waitForGameReady } from "./utils/test-helpers";

test.describe("Terrain Editor Cliff vs Ramp", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?testMode=true&preset=all_grass_unmown");
    await waitForGameReady(page);
    await page.click("canvas");
    await page.keyboard.press("t");
    await page.waitForTimeout(100);
  });

  test("raising a tile significantly should create a cliff, not a steep ramp", async ({
    page,
  }) => {
    // Directly manipulate state as requested for "holistic state management"
    await page.evaluate(() => {
      window.game.grassSystem.setElevationAt(25, 19, 5);
    });
    await page.waitForTimeout(100);

    // Verify elevation
    const elevation = await page.evaluate(() =>
      window.game.grassSystem.getElevationAt(25, 19)
    );
    expect(elevation).toBe(5);

    // Now check the neighbor (26, 19)
    // We expect a cliff to exist because the gap is > 1
    const cliffExists = await page.evaluate(() => {
      const key = "right_25_19";
      return window.game.grassSystem.cliffMeshes.has(key);
    });

    console.log("Cliff Exists:", cliffExists);
    expect(cliffExists).toBe(true);
  });
});
