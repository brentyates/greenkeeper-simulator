import { test, expect } from "@playwright/test";

test.describe("Isolated Rendering Sandbox - Sophisticated", () => {
  test.use({ viewport: { width: 256, height: 256 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/render-sandbox/index.html");
    await page.waitForFunction(() => (window as any).sandbox !== undefined);
    await page.evaluate(() => (window as any).sandbox.reset());
  });

  test.describe("Exhaustive Corners", () => {
    // NW: (-1, -1), N: (0, -1), NE: (1, -1), W: (-1, 0), E: (1, 0), SW: (-1, 1), S: (0, 1), SE: (1, 1)

    test("NW Corner", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setNeighbors("fairway", "rough", [
          [-1, 0],
          [0, -1],
          [-1, -1],
        ]);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("corner-nw.png");
    });

    test("Adjacent Corners (N side)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setNeighbors("fairway", "rough", [
          [-1, 0],
          [0, -1],
          [1, 0],
        ]);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("corner-north-side.png");
    });

    test("Opposite Corners (NW and SE)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "fairway");
        s.setTerrain(0, 0, "rough");
        s.setTerrain(1, 0, "rough");
        s.setTerrain(0, 1, "rough"); // NW set
        s.setTerrain(2, 2, "rough");
        s.setTerrain(1, 2, "rough");
        s.setTerrain(2, 1, "rough"); // SE set
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("corner-opposite.png");
    });

    test("3 Corners (Missing SE)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "fairway");
        s.setTerrain(0, 1, "rough");
        s.setTerrain(1, 0, "rough"); // W and N
        s.setTerrain(2, 1, "rough"); // E
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("corner-3-sides.png");
    });

    test("Island (All 4 Sides)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "fairway");
        s.setTerrain(0, 1, "rough");
        s.setTerrain(2, 1, "rough");
        s.setTerrain(1, 0, "rough");
        s.setTerrain(1, 2, "rough");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("corner-island.png");
    });
  });

  test.describe("Mowing & Terrain Heights", () => {
    test("Fairway - High (30mm, no stripes)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "fairway");
        s.setMown(1, 1, 30);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("mowing-fairway-high.png");
    });

    test("Rough - Mown (15mm)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "rough");
        s.setMown(1, 1, 15);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("mowing-rough-mown.png");
    });

    test("Green - Fringe (8mm)", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "green");
        s.setMown(1, 1, 8);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("mowing-green-fringe.png");
    });
  });

  test.describe("Property Overlays (Light Theme)", () => {
    test("Moisture Overlay - 50%", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(1, 1, "fairway");
        s.setMoisture(1, 1, 50);
        s.setOverlayMode("moisture");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-moisture-50.png");
    });

    test("Moisture Overlay - Dry vs Wet", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(0, 1, "fairway");
        s.setMoisture(0, 1, 10);
        s.setTerrain(1, 1, "fairway");
        s.setMoisture(1, 1, 50);
        s.setTerrain(2, 1, "fairway");
        s.setMoisture(2, 1, 90);
        s.setOverlayMode("moisture");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-moisture-gradient.png");
    });

    test("Nutrients Overlay - Gradient", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setTerrain(0, 1, "fairway");
        s.setNutrients(0, 1, 10);
        s.setTerrain(1, 1, "fairway");
        s.setNutrients(1, 1, 50);
        s.setTerrain(2, 1, "fairway");
        s.setNutrients(2, 1, 90);
        s.setOverlayMode("nutrients");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-nutrients-gradient.png");
    });
  });

  test.describe("Irrigation Visuals (Light Theme)", () => {
    test("should show connected pipes in light schema", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setOverlayMode("irrigation");
        s.placePipe(1, 1, "pvc");
        s.placePipe(1, 0, "pvc"); // North
        s.placePipe(2, 1, "pvc"); // East
      });
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot("irrigation-connected-pipes.png");
    });

    test("should show glowing pressure colors", async ({ page }) => {
      await page.evaluate(() => {
        const s = (window as any).sandbox;
        s.setOverlayMode("irrigation");
        // Source is at (0,0)
        s.placePipe(0, 1, "pvc"); // North-ish
        s.placePipe(1, 1, "pvc"); // Further out
        s.placePipe(2, 1, "pvc"); // Even further
      });
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot("irrigation-pressure-glow.png");
    });
  });
});
