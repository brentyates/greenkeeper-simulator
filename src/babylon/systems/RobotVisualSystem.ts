import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import {
  loadAsset,
  createInstance,
  disposeInstance,
  type AssetId,
  type AssetInstance,
} from "../assets/AssetLoader";
import type { RobotUnit } from "../../core/autonomous-equipment";

export interface RobotElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

interface RobotVisual {
  robotId: string;
  equipmentId: string;
  container: Mesh;
  meshInstance: AssetInstance | null;
  lastWorldX: number;
  lastWorldZ: number;
  isDisposed: boolean;
}

const ROBOT_ASSET_MAP: Record<string, AssetId> = {
  robot_mower_fairway: "vehicle.mower.fairway",
  robot_mower_greens: "vehicle.mower.greens",
  robot_mower_rough: "vehicle.mower.fairway",
  robot_sprayer: "vehicle.sprayer",
  robot_fertilizer: "vehicle.tractor",
  robot_bunker_rake: "course.bunker.rake",
};

function getRobotAssetId(equipmentId: string): AssetId {
  return ROBOT_ASSET_MAP[equipmentId] ?? "vehicle.mower.riding";
}

function getRobotScale(equipmentId: string): number {
  if (equipmentId === "robot_bunker_rake") return 0.75;
  return 0.35;
}

export class RobotVisualSystem {
  private scene: Scene;
  private elevationProvider: RobotElevationProvider;
  private robotVisuals: Map<string, RobotVisual> = new Map();
  private visible: boolean = true;
  private hoveredRobotId: string | null = null;
  private hoverRing: Mesh;
  private hoverRingMaterial: StandardMaterial;

  constructor(scene: Scene, elevationProvider: RobotElevationProvider) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;
    this.hoverRingMaterial = new StandardMaterial("robotHoverRingMat", this.scene);
    this.hoverRingMaterial.diffuseColor = new Color3(0.92, 0.82, 0.28);
    this.hoverRingMaterial.emissiveColor = new Color3(0.82, 0.7, 0.22);
    this.hoverRingMaterial.specularColor = new Color3(0, 0, 0);
    this.hoverRingMaterial.alpha = 0.95;
    this.hoverRingMaterial.disableLighting = true;

    this.hoverRing = MeshBuilder.CreateTorus(
      "robotHoverRing",
      { diameter: 1.45, thickness: 0.08, tessellation: 28 },
      this.scene
    );
    this.hoverRing.rotation.x = Math.PI / 2;
    this.hoverRing.material = this.hoverRingMaterial;
    this.hoverRing.isPickable = false;
    this.hoverRing.isVisible = false;
  }

  public update(robots: readonly RobotUnit[]): void {
    const currentIds = new Set(robots.map((robot) => robot.id));

    for (const [robotId, visual] of this.robotVisuals) {
      if (!currentIds.has(robotId)) {
        this.disposeRobotVisual(visual);
        this.robotVisuals.delete(robotId);
      }
    }

    for (const robot of robots) {
      let visual = this.robotVisuals.get(robot.id);
      if (!visual) {
        visual = this.createRobotVisual(robot);
        this.robotVisuals.set(robot.id, visual);
      }

      const elevation = this.elevationProvider.getElevationAt(robot.worldX, robot.worldZ, 0);
      const worldPos = gridTo3D(robot.worldX, robot.worldZ, elevation);
      worldPos.y += 0.05;
      visual.container.position.copyFrom(worldPos);

      if (visual.meshInstance) {
        const dx = robot.targetX !== null
          ? robot.targetX - robot.worldX
          : robot.worldX - visual.lastWorldX;
        const dz = robot.targetY !== null
          ? robot.targetY - robot.worldZ
          : robot.worldZ - visual.lastWorldZ;
        const magnitude = Math.abs(dx) + Math.abs(dz);
        if (magnitude > 0.001) {
          visual.meshInstance.root.rotation.y = Math.atan2(dz, dx) + Math.PI / 2;
        }
      }

      visual.lastWorldX = robot.worldX;
      visual.lastWorldZ = robot.worldZ;
    }

    this.updateHoverRing(robots);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    for (const visual of this.robotVisuals.values()) {
      visual.container.setEnabled(visible);
    }
    this.hoverRing.isVisible = visible && this.hoveredRobotId !== null;
  }

  public setHoveredRobot(robotId: string | null): void {
    this.hoveredRobotId = robotId;
    if (!robotId || !this.visible) {
      this.hoverRing.isVisible = false;
    }
  }

  public dispose(): void {
    for (const visual of this.robotVisuals.values()) {
      this.disposeRobotVisual(visual);
    }
    this.robotVisuals.clear();
    this.hoverRing.dispose();
    this.hoverRingMaterial.dispose();
  }

  private updateHoverRing(robots: readonly RobotUnit[]): void {
    if (!this.visible || !this.hoveredRobotId) {
      this.hoverRing.isVisible = false;
      return;
    }

    const robot = robots.find((entry) => entry.id === this.hoveredRobotId);
    if (!robot) {
      this.hoverRing.isVisible = false;
      return;
    }

    const elevation = this.elevationProvider.getElevationAt(robot.worldX, robot.worldZ, 0);
    const worldPos = gridTo3D(robot.worldX, robot.worldZ, elevation);
    this.hoverRing.position.set(worldPos.x, worldPos.y + 0.08, worldPos.z);
    this.hoverRing.isVisible = true;
  }

  private createRobotVisual(robot: RobotUnit): RobotVisual {
    const container = new Mesh(`robot_${robot.id}`, this.scene);
    container.isVisible = false;
    container.setEnabled(this.visible);

    const startElevation = this.elevationProvider.getElevationAt(robot.worldX, robot.worldZ, 0);
    const startPos = gridTo3D(robot.worldX, robot.worldZ, startElevation);
    startPos.y += 0.05;
    container.position.copyFrom(startPos);

    const visual: RobotVisual = {
      robotId: robot.id,
      equipmentId: robot.equipmentId,
      container,
      meshInstance: null,
      lastWorldX: robot.worldX,
      lastWorldZ: robot.worldZ,
      isDisposed: false,
    };

    const assetId = getRobotAssetId(robot.equipmentId);
    loadAsset(this.scene, assetId)
      .then((loadedAsset) => {
        if (visual.isDisposed) return;
        const instance = createInstance(this.scene, loadedAsset, `robot_${robot.id}`);
        instance.root.parent = container;
        instance.root.position.set(0, 0, 0);
        instance.root.scaling.setAll(getRobotScale(robot.equipmentId));
        visual.meshInstance = instance;
      })
      .catch(() => {

      });

    return visual;
  }

  private disposeRobotVisual(visual: RobotVisual): void {
    visual.isDisposed = true;
    if (visual.meshInstance) {
      disposeInstance(visual.meshInstance);
      visual.meshInstance = null;
    }
    visual.container.dispose();
  }
}
