import { test, expect } from "@playwright/test";

test.describe("Renderer Visual Regression Tests - Irrigation System", () => {
  test.use({ viewport: { width: 256, height: 256 } });

  test.beforeEach(async ({ page }) => {
    // Navigate to the sandbox. Vite should serve this under /tests/render-sandbox/
    await page.goto("/tests/render-sandbox/index.html");
    // Ensure the modules are loaded
    await page.waitForFunction(() => (window as any).modulesLoaded);
  });

  test("System: Pipe Segment (PVC, Flat Terrain)", async ({ page }) => {
    await page.evaluate(() => {
      const {
        BabylonEngine,
        GrassSystem,
        IrrigationRenderSystem,
        IrrigationCore,
        createMockCourseData,
        Color4,
      } = (window as any).GameModules;

      // Setup engine and systems
      const engine = new BabylonEngine("renderCanvas", 3, 3);
      const scene = engine.getScene();
      const grassSystem = new GrassSystem(scene, createMockCourseData(3, 3));
      const irrigationRender = new IrrigationRenderSystem(scene);
      let irrigationSystem = IrrigationCore.createInitialIrrigationSystem();

      // Setup specific test state
      // 1. Add water source
      irrigationSystem = IrrigationCore.addWaterSource(
        irrigationSystem,
        "municipal",
        0,
        0
      );

      // 2. Set terrain and zoom
      engine.setZoomLevel("tight");
      grassSystem.setTerrainTypeAt(1, 1, "fairway");
      grassSystem.rebuildTileAndNeighbors(1, 1);

      // 3. Place pipe
      irrigationSystem = IrrigationCore.addPipe(
        irrigationSystem,
        1,
        1,
        "pvc",
        0
      );
      irrigationSystem = IrrigationCore.updatePipePressures(irrigationSystem);
      irrigationRender.update(irrigationSystem);

      // 4. Set visual mode
      grassSystem.setOverlayMode("irrigation");
      irrigationRender.setVisible(true);
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);

      engine.start();
    });

    // Wait for render
    await page.waitForTimeout(200);

    // Renamed screenshot for clarity
    await expect(page).toHaveScreenshot("basic-pipe-flat-fairway.png", {
      maxDiffPixels: 1000,
    });
  });

  test("System: Pipe Height Conformance (Hill)", async ({ page }) => {
    await page.evaluate(() => {
      const {
        BabylonEngine,
        GrassSystem,
        IrrigationRenderSystem,
        IrrigationCore,
        createMockCourseData,
        Color4,
      } = (window as any).GameModules;

      // Setup
      const engine = new BabylonEngine("renderCanvas", 3, 3);
      const scene = engine.getScene();
      const grassSystem = new GrassSystem(scene, createMockCourseData(3, 3));
      const irrigationRender = new IrrigationRenderSystem(scene);
      let irrigationSystem = IrrigationCore.createInitialIrrigationSystem();

      irrigationSystem = IrrigationCore.addWaterSource(
        irrigationSystem,
        "municipal",
        0,
        0
      );
      engine.setZoomLevel("tight");

      // Test specifics: Hill
      grassSystem.setElevationAt(1, 1, 5); // 0.625 units high (5 * 0.125)
      grassSystem.setTerrainTypeAt(1, 1, "fairway");
      grassSystem.rebuildTileAndNeighbors(1, 1);

      // Pipe should follow the elevation
      irrigationSystem = IrrigationCore.addPipe(
        irrigationSystem,
        1,
        1,
        "pvc",
        0
      );
      irrigationSystem = IrrigationCore.updatePipePressures(irrigationSystem);
      irrigationRender.update(irrigationSystem);

      // Mode
      grassSystem.setOverlayMode("irrigation");
      irrigationRender.setVisible(true);
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);

      engine.start();
    });

    // Wait for render
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("pipe-elevation-conformance.png", {
      maxDiffPixels: 1000,
    });
  });

  test("System: Pressure Gradient & Leak Visualization", async ({ page }) => {
    await page.evaluate(() => {
      const {
        BabylonEngine,
        GrassSystem,
        IrrigationRenderSystem,
        IrrigationCore,
        createMockCourseData,
        Color4,
      } = (window as any).GameModules;

      // Setup
      const engine = new BabylonEngine("renderCanvas", 3, 3);
      const scene = engine.getScene();
      const grassSystem = new GrassSystem(scene, createMockCourseData(3, 3));
      const irrigationRender = new IrrigationRenderSystem(scene);
      let irrigationSystem = IrrigationCore.createInitialIrrigationSystem();

      irrigationSystem = IrrigationCore.addWaterSource(
        irrigationSystem,
        "municipal",
        0,
        0
      );
      engine.setZoomLevel("tight");

      // Place pipes with different types/positions
      // High pressure (near source - source is at 0,0)
      irrigationSystem = IrrigationCore.addPipe(
        irrigationSystem,
        1,
        0,
        "pvc",
        0
      );
      // Medium pressure
      irrigationSystem = IrrigationCore.addPipe(
        irrigationSystem,
        2,
        0,
        "pvc",
        0
      );
      // Connected to (1, 0)
      irrigationSystem = IrrigationCore.addPipe(
        irrigationSystem,
        1,
        1,
        "pvc",
        0
      );

      // Leak
      const pipe = irrigationSystem.pipes.find(
        (p: any) => p.gridX === 2 && p.gridY === 0
      );
      if (pipe) {
        (pipe as any).isLeaking = true;
      }

      irrigationSystem = IrrigationCore.updatePipePressures(irrigationSystem);
      irrigationRender.update(irrigationSystem);

      // Mode
      grassSystem.setOverlayMode("irrigation");
      irrigationRender.setVisible(true);
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);

      engine.start();
    });

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot("pressure-leak-visualization.png", {
      maxDiffPixels: 1000,
    });
  });
});
