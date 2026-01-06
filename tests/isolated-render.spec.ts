import { test, expect } from "@playwright/test";

test.describe("Isolated Rendering Sandbox", () => {
  test.use({ viewport: { width: 256, height: 256 } });

  test.beforeEach(async ({ page }) => {
    // Navigate to the sandbox. Vite should serve this under /tests/render-sandbox/
    await page.goto("/tests/render-sandbox/index.html");
    // Ensure the sandbox is initialized
    await page.waitForFunction(() => (window as any).sandbox !== undefined);
  });

  test("should render a single tile with a pipe in irrigation mode", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const s = (window as any).sandbox;
      s.setTerrain(1, 1, "fairway");
      s.placePipe(1, 1, "pvc");
      s.setOverlayMode("irrigation");
    });

    // Wait for render
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("isolated-pipe-render.png", {
      maxDiffPixels: 1000,
    });
  });

  test("should render a pipe through a hill", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).sandbox;
      s.setElevation(1, 1, 5); // 0.5 units high
      s.setTerrain(1, 1, "fairway");
      s.placePipe(1, 1, "pvc");
      s.setOverlayMode("irrigation");
    });

    // Wait for render
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("isolated-pipe-hill-render.png", {
      maxDiffPixels: 1000,
    });
  });

  test("should show all pressure level colors clearly", async ({ page }) => {
    await page.evaluate(() => {
      const s = (window as any).sandbox;
      s.setOverlayMode("irrigation");

      // Place pipes with different types/positions to get different pressures
      // Source is at (0, 0)
      s.placePipe(1, 0, "pvc"); // High pressure (near source)
      s.placePipe(2, 0, "pvc"); // Medium pressure
      s.placePipe(1, 1, "pvc"); // Connected to (1, 0)

      // Place a leak to check red color
      const system = s.getIrrigationSystem();
      // We need to manually set leak because sandbox logic is simple
      const pipe = system.pipes.find((p) => p.gridX === 2 && p.gridY === 0);
      if (pipe) {
        (pipe as any).isLeaking = true;
      }

      // Ensure render system sees changes
      s.irrigationRenderSystem.update(system);
    });

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("isolated-all-pressures.png", {
      maxDiffPixels: 1000,
    });
  });
});
