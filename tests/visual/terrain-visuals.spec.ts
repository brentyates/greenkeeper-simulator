import { test, expect } from "@playwright/test";

test.describe("Renderer Visual Regression Tests - Terrain & Overlays", () => {
  test.use({ viewport: { width: 256, height: 256 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/render-sandbox/index.html");
    await page.waitForFunction(() => (window as any).modulesLoaded);

    // Inject setup helper
    await page.evaluate(() => {
      (window as any).setupScene = () => {
        const {
          BabylonEngine,
          GrassSystem,
          IrrigationRenderSystem,
          IrrigationCore,
          createMockCourseData,
          TestHelpers,
          Color4,
        } = (window as any).GameModules;

        const engine = new BabylonEngine("renderCanvas", 3, 3);
        const scene = engine.getScene();
        const grassSystem = new GrassSystem(scene, createMockCourseData(3, 3));
        const irrigationRender = new IrrigationRenderSystem(scene);
        let irrigationSystem = IrrigationCore.createInitialIrrigationSystem();

        // Add water source default
        irrigationSystem = IrrigationCore.addWaterSource(
          irrigationSystem,
          "municipal",
          0,
          0
        );

        engine.setZoomLevel("tight");
        engine.start();

        return {
          engine,
          scene,
          grassSystem,
          irrigationRender,
          irrigationSystem,
          IrrigationCore,
          TestHelpers,
          Color4,
        };
      };
    });
  });

  test.describe("Terrain Shapes (Fairway vs Rough)", () => {
    test("Shape: NW Corner (Outer)", async ({ page }) => {
      // 3x3 Fairway Background, Rough in Top-Left (0,0) only.
      // This creates an "inner corner" on the Rough, or an "outer corner" on the Fairway block?
      // Wait, "NW Corner" usually refers to the shape of the specialized tile itself.
      // A Fairway tile at (1,1) with Rough at N and W, Fairway at E and S results in a NW Corner shape for (1,1).
      // Let's create exactly that: Center Fairway, N/W Rough, E/S Fairway. background Rough.
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(
          grassSystem,
          "fairway", // Center
          "rough", // Background
          [
            [1, 0, "fairway"], // East
            [0, 1, "fairway"], // South
            [1, 1, "fairway"], // SouthEast (diagonal)
          ]
        );
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("shape-corner-nw.png");
    });

    test("Shape: North Edge (Straight)", async ({ page }) => {
      // Center Fairway. N Rough. E/W/S Fairway.
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "rough", [
          [-1, 0, "fairway"], // West
          [1, 0, "fairway"], // East
          [0, 1, "fairway"], // South
          // Diagonals for completeness of "edge" shape
          [-1, 1, "fairway"], // SW
          [1, 1, "fairway"], // SE
        ]);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("shape-edge-north.png");
    });

    test("Shape: Diagonal / Checkerboard", async ({ page }) => {
      // Center Fairway. Corners are Fairway. Edges are Rough.
      // (1,1) Fairway. (0,0), (2,0), (0,2), (2,2) Fairway.
      // (0,1), (1,0), (2,1), (1,2) Rough.
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "rough", [
          [-1, -1, "fairway"], // NW
          [1, -1, "fairway"], // NE
          [-1, 1, "fairway"], // SW
          [1, 1, "fairway"], // SE
        ]);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("shape-checkerboard.png");
    });

    test("Shape: Peninsula (3 Sides Enclosed)", async ({ page }) => {
      // Center Fairway. N, W, E Rough. S Fairway.
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "rough", [
          [0, 1, "fairway"], // South only is connected
        ]);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("shape-peninsula-south.png");
    });

    test("Shape: 1x1 Island", async ({ page }) => {
      // Center Fairway. All neighbors Rough.
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "rough", []);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("shape-island-1x1.png");
    });
  });

  test.describe("Mowing Heights", () => {
    test("Grass Height: Unmown Fairway (30mm)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "rough", []); // Island to see edges clearly
        TestHelpers.setMown(grassSystem, 1, 1, 30);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("grass-fairway-30mm.png");
    });

    test("Grass Height: Mown Rough (15mm)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "rough", "fairway", []); // Rough island in fairway background
        TestHelpers.setMown(grassSystem, 1, 1, 15);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("grass-rough-15mm.png");
    });

    test("Grass Height: Green Fringe (8mm)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "green", "rough", []);
        TestHelpers.setMown(grassSystem, 1, 1, 8);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("grass-green-8mm.png");
    });
  });

  test.describe("Gameplay Overlays", () => {
    test("Overlay: Moisture Heatmap (50%)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers, irrigationRender, scene, Color4 } = (
          window as any
        ).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "fairway"); // All fairway
        TestHelpers.setMoisture(grassSystem, 1, 1, 50);

        grassSystem.setOverlayMode("moisture");
        irrigationRender.setVisible(false);
        scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-moisture-50.png");
    });

    test("Overlay: Moisture Gradient (10% -> 50% -> 90%)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "fairway");
        TestHelpers.setMoisture(grassSystem, 0, 1, 10);
        TestHelpers.setMoisture(grassSystem, 1, 1, 50);
        TestHelpers.setMoisture(grassSystem, 2, 1, 90);

        grassSystem.setOverlayMode("moisture");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-moisture-gradient.png");
    });

    test("Overlay: Nutrient Gradient (10% -> 50% -> 90%)", async ({ page }) => {
      await page.evaluate(() => {
        const { grassSystem, TestHelpers } = (window as any).setupScene();
        TestHelpers.setupGrid(grassSystem, "fairway", "fairway");
        TestHelpers.setNutrients(grassSystem, 0, 1, 10);
        TestHelpers.setNutrients(grassSystem, 1, 1, 50);
        TestHelpers.setNutrients(grassSystem, 2, 1, 90);

        grassSystem.setOverlayMode("nutrients");
      });
      await page.waitForTimeout(100);
      await expect(page).toHaveScreenshot("overlay-nutrients-gradient.png");
    });
  });

  test.describe("Irrigation Overlay", () => {
    test("Irrigation: Connected Pipe Network", async ({ page }) => {
      await page.evaluate(() => {
        const {
          grassSystem,
          irrigationRender,
          scene,
          Color4,
          IrrigationCore,
          irrigationSystem,
        } = (window as any).setupScene();

        grassSystem.setOverlayMode("irrigation");
        irrigationRender.setVisible(true);
        scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);

        let sys = irrigationSystem;
        sys = IrrigationCore.addPipe(sys, 1, 1, "pvc", 0);
        sys = IrrigationCore.addPipe(sys, 1, 0, "pvc", 0); // North
        sys = IrrigationCore.addPipe(sys, 2, 1, "pvc", 0); // East

        sys = IrrigationCore.updatePipePressures(sys);
        irrigationRender.update(sys);
      });
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot("irrigation-network.png");
    });

    test("Irrigation: Pressure Drop Visualization", async ({ page }) => {
      await page.evaluate(() => {
        const {
          grassSystem,
          irrigationRender,
          scene,
          Color4,
          IrrigationCore,
          irrigationSystem,
        } = (window as any).setupScene();

        grassSystem.setOverlayMode("irrigation");
        irrigationRender.setVisible(true);
        scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);

        // Source is at (0,0)
        let sys = irrigationSystem;
        sys = IrrigationCore.addPipe(sys, 0, 1, "pvc", 0); // North-ish
        sys = IrrigationCore.addPipe(sys, 1, 1, "pvc", 0); // Further out
        sys = IrrigationCore.addPipe(sys, 2, 1, "pvc", 0); // Even further

        sys = IrrigationCore.updatePipePressures(sys);
        irrigationRender.update(sys);
      });
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot("irrigation-pressure-gradient.png");
    });
  });
});
