import { BabylonEngine } from "../../src/babylon/engine/BabylonEngine";
import { GrassSystem } from "../../src/babylon/systems/GrassSystem";
import { IrrigationRenderSystem } from "../../src/babylon/systems/IrrigationRenderSystem";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import {
  createInitialIrrigationSystem,
  addPipe,
  addWaterSource,
  updatePipePressures,
  IrrigationSystem,
} from "../../src/core/irrigation";

class Sandbox {
  private engine: BabylonEngine;
  private grassSystem: GrassSystem;
  private irrigationRenderSystem: IrrigationRenderSystem;
  private irrigationSystem: IrrigationSystem;
  private scene: Scene;

  constructor() {
    // 3x3 grid for isolation
    this.engine = new BabylonEngine("renderCanvas", 3, 3);
    this.scene = this.engine.getScene();

    // Initialize systems
    const mockCourseData = {
      id: "sandbox",
      name: "Sandbox",
      width: 3,
      height: 3,
      layout: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
      elevation: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      par: 3,
      startingCash: 10000,
    };
    this.grassSystem = new GrassSystem(this.scene, mockCourseData as any);
    this.irrigationRenderSystem = new IrrigationRenderSystem(this.scene);
    this.irrigationSystem = createInitialIrrigationSystem();

    // Add a water source at (0, 0)
    this.irrigationSystem = addWaterSource(
      this.irrigationSystem,
      "municipal",
      0,
      0
    );

    // Setup camera for close-up on the center tile (1, 1)
    this.engine.setZoomLevel("tight");
    this.engine.setCameraTargetGrid(1.5, 1.5, 0);

    // Initial state
    this.grassSystem.setTerrainTypeAt(1, 1, "fairway");
    this.grassSystem.rebuildTileAndNeighbors(1, 1);

    this.engine.start();

    // Expose to window for Playwright
    (window as any).sandbox = this;
    (window as any).game = this;
  }

  public setTerrain(x: number, y: number, type: any) {
    this.grassSystem.setTerrainTypeAt(x, y, type);
    this.grassSystem.rebuildTileAndNeighbors(x, y);
  }

  public setElevation(x: number, y: number, elev: number) {
    this.grassSystem.setElevationAt(x, y, elev);
    this.grassSystem.rebuildTileAndNeighbors(x, y);
  }

  public placePipe(x: number, y: number, type: any = "pvc") {
    this.irrigationSystem = addPipe(this.irrigationSystem, x, y, type, 0);
    this.irrigationSystem = updatePipePressures(this.irrigationSystem);
    this.irrigationRenderSystem.update(this.irrigationSystem);
  }

  public setOverlayMode(mode: any) {
    this.grassSystem.setOverlayMode(mode);
    this.irrigationRenderSystem.setVisible(mode === "irrigation");

    if (mode === "irrigation") {
      this.scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);
    } else {
      this.scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    }
  }

  // Mowing support
  public setMown(x: number, y: number, height: number) {
    const cells = (this.grassSystem as any).cells;
    if (cells[y] && cells[y][x]) {
      cells[y][x].height = height;
      this.grassSystem.rebuildTileAndNeighbors(x, y);
    }
  }

  public setMoisture(x: number, y: number, moisture: number) {
    const cells = (this.grassSystem as any).cells;
    if (cells[y] && cells[y][x]) {
      cells[y][x].moisture = moisture;
      this.grassSystem.rebuildTileAndNeighbors(x, y);
    }
  }

  public setNutrients(x: number, y: number, nutrients: number) {
    const cells = (this.grassSystem as any).cells;
    if (cells[y] && cells[y][x]) {
      cells[y][x].nutrients = nutrients;
      this.grassSystem.rebuildTileAndNeighbors(x, y);
    }
  }

  /**
   * Helper to set neighbors for corner testing.
   * Pattern is a binary string "NW,N,NE,W,E,SW,S,SE" or similar,
   * but let's just make it simple: array of coords relative to center.
   */
  public setNeighbors(
    centerType: any,
    neighborType: any,
    relativecoords: [number, number][]
  ) {
    this.reset();
    this.setTerrain(1, 1, centerType);
    for (const [dx, dy] of relativecoords) {
      this.setTerrain(1 + dx, 1 + dy, neighborType);
    }
  }

  public getIrrigationSystem() {
    return this.irrigationSystem;
  }

  public reset() {
    // Reset terrain to all rough, 0 elevation
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        this.grassSystem.setTerrainTypeAt(x, y, "rough");
        this.grassSystem.setElevationAt(x, y, 0);
      }
    }
    // Deep rebuild
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        this.grassSystem.rebuildTileAndNeighbors(x, y);
      }
    }
    // Reset irrigation
    this.irrigationSystem = createInitialIrrigationSystem();
    this.irrigationSystem = addWaterSource(
      this.irrigationSystem,
      "municipal",
      0,
      0
    );
    this.irrigationRenderSystem.update(this.irrigationSystem);
    this.setOverlayMode("normal");
  }
}

// Start sandbox
new Sandbox();
