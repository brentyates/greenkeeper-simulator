/**
 * EmployeeVisualSystem - Manages 3D mesh rendering for NPC employees
 *
 * Creates and updates employee meshes based on their positions and tasks.
 * Equipment meshes are attached based on current task.
 */

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { EmployeeTask } from "../../core/employee-work";
import { gridTo3D } from "../engine/BabylonEngine";
import {
  EntityVisualState,
  ElevationProvider,
  EMPLOYEE_APPEARANCE,
  createEntityMesh,
  disposeEntityMesh,
} from "./EntityVisualSystem";
import {
  loadAsset,
  createInstance,
  disposeInstance,
  AssetInstance,
  AssetId,
} from "../assets/AssetLoader";

export interface EmployeePosition {
  readonly employeeId: string;
  readonly worldX: number;
  readonly worldZ: number;
  readonly task: EmployeeTask;
  readonly isMoving: boolean;
}

export type { ElevationProvider } from "./EntityVisualSystem";

interface WorkerMeshGroup extends EntityVisualState {
  equipmentInstance: AssetInstance | null;
  currentTask: EmployeeTask;
  markerMesh: Mesh;
  markerMaterial: StandardMaterial;
}

const TASK_EQUIPMENT_ASSETS: Record<EmployeeTask, AssetId | null> = {
  mow_grass: "equipment.mower.push",
  water_area: "equipment.sprinkler.handheld",
  fertilize_area: "equipment.spreader",
  rake_bunker: "equipment.rake",
  patrol: null,
  return_to_base: null,
  idle: null,
};

const TASK_EQUIPMENT_OFFSET: Record<EmployeeTask, Vector3> = {
  mow_grass: new Vector3(0.4, 0, 0),
  water_area: new Vector3(0.3, 0.3, 0),
  fertilize_area: new Vector3(0.3, 0.15, 0),
  rake_bunker: new Vector3(0.25, 0.5, 0),
  patrol: Vector3.Zero(),
  return_to_base: Vector3.Zero(),
  idle: Vector3.Zero(),
};

export class EmployeeVisualSystem {
  private scene: Scene;
  private elevationProvider: ElevationProvider;
  private workerMeshes: Map<string, WorkerMeshGroup> = new Map();

  constructor(scene: Scene, elevationProvider: ElevationProvider) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;
  }

  public update(positions: readonly EmployeePosition[], _deltaMs: number): void {
    const currentIds = new Set(positions.map((p) => p.employeeId));

    for (const [id, group] of this.workerMeshes) {
      if (!currentIds.has(id)) {
        this.disposeWorkerMesh(group);
        this.workerMeshes.delete(id);
      }
    }

    for (const pos of positions) {
      let group = this.workerMeshes.get(pos.employeeId);

      if (!group) {
        group = this.createWorkerMesh(pos.employeeId, Math.floor(pos.worldX), Math.floor(pos.worldZ));
        this.workerMeshes.set(pos.employeeId, group);
      }

      const elevation = this.elevationProvider.getElevationAt(pos.worldX, pos.worldZ, 0);
      const worldPos = gridTo3D(pos.worldX, pos.worldZ, elevation);
      group.container.position.copyFrom(worldPos);

      if (pos.isMoving && group.rotatesWithMovement) {
        const dx = pos.worldX - group.targetGridX;
        const dz = pos.worldZ - group.targetGridY;
        if (dx !== 0 || dz !== 0) {
          group.facingAngle = Math.atan2(dz, dx) + Math.PI / 2;
          if (group.meshInstance) {
            group.meshInstance.root.rotation.y = group.facingAngle;
          }
        }
      }

      group.targetGridX = pos.worldX;
      group.targetGridY = pos.worldZ;
      group.isAnimating = pos.isMoving;

      this.updateWorkerTask(group, pos.task);
      this.ensureEquipmentParent(group);
    }
  }

  private ensureEquipmentParent(group: WorkerMeshGroup): void {
    if (
      group.equipmentInstance &&
      group.meshInstance?.root &&
      group.equipmentInstance.root.parent !== group.meshInstance.root
    ) {
      group.equipmentInstance.root.parent = group.meshInstance.root;
    }
  }

  private createWorkerMesh(
    employeeId: string,
    startX: number,
    startY: number
  ): WorkerMeshGroup {
    const baseState = createEntityMesh(
      this.scene,
      employeeId,
      EMPLOYEE_APPEARANCE,
      startX,
      startY,
      this.elevationProvider
    );

    const markerMaterial = this.createTaskMarkerMaterial(employeeId);
    const markerMesh = this.createTaskMarker(baseState.container, employeeId);
    markerMesh.material = markerMaterial;
    const idleColor = this.getTaskMarkerColor("idle");
    markerMaterial.diffuseColor = idleColor;
    markerMaterial.emissiveColor = idleColor.scale(0.45);

    return {
      ...baseState,
      equipmentInstance: null,
      currentTask: "idle",
      markerMesh,
      markerMaterial,
    };
  }

  private createTaskMarkerMaterial(employeeId: string): StandardMaterial {
    const material = new StandardMaterial(`employeeMarkerMat_${employeeId}`, this.scene);
    material.diffuseColor = new Color3(0.42, 0.78, 1.0);
    material.emissiveColor = new Color3(0.18, 0.34, 0.55);
    material.specularColor = new Color3(0, 0, 0);
    material.alpha = 0.9;
    material.disableLighting = true;
    return material;
  }

  private createTaskMarker(parent: Mesh, employeeId: string): Mesh {
    const marker = MeshBuilder.CreateDisc(`employeeMarker_${employeeId}`, {
      radius: 0.48,
      tessellation: 24,
    }, this.scene);
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 0.05;
    marker.parent = parent;
    marker.isPickable = false;
    return marker;
  }

  private getTaskMarkerColor(task: EmployeeTask): Color3 {
    switch (task) {
      case "mow_grass":
        return new Color3(0.36, 0.82, 0.43);
      case "water_area":
        return new Color3(0.33, 0.67, 1.0);
      case "fertilize_area":
        return new Color3(0.9, 0.78, 0.25);
      case "rake_bunker":
        return new Color3(0.95, 0.63, 0.34);
      case "return_to_base":
        return new Color3(0.78, 0.78, 0.86);
      case "patrol":
        return new Color3(0.76, 0.52, 0.98);
      case "idle":
      default:
        return new Color3(0.85, 0.85, 0.88);
    }
  }

  private updateWorkerTask(group: WorkerMeshGroup, task: EmployeeTask): void {
    if (group.currentTask === task) return;

    group.currentTask = task;
    const markerColor = this.getTaskMarkerColor(task);
    group.markerMaterial.diffuseColor = markerColor;
    group.markerMaterial.emissiveColor = markerColor.scale(0.45);
    group.markerMesh.scaling.setAll(task === "idle" ? 0.78 : 1.0);
    group.markerMesh.isVisible = true;
    group.markerMesh.material = group.markerMaterial;

    if (group.equipmentInstance) {
      disposeInstance(group.equipmentInstance);
      group.equipmentInstance = null;
    }

    const assetId = TASK_EQUIPMENT_ASSETS[task];
    if (assetId) {
      const parent = group.meshInstance?.root ?? group.container;
      const offset = TASK_EQUIPMENT_OFFSET[task];

      loadAsset(this.scene, assetId)
        .then((loadedAsset) => {
          if (group.currentTask !== task) return;
          const instance = createInstance(this.scene, loadedAsset, `equip_${task}`);
          instance.root.parent = parent;
          instance.root.position = offset.clone();
          instance.root.scaling.setAll(0.5);
          group.equipmentInstance = instance;
        })
        .catch(() => {

        });
    }
  }

  private disposeWorkerMesh(group: WorkerMeshGroup): void {
    if (group.equipmentInstance) {
      disposeInstance(group.equipmentInstance);
    }
    group.markerMaterial.dispose();
    group.markerMesh.dispose();
    disposeEntityMesh(group);
  }

  public getWorkerCount(): number {
    return this.workerMeshes.size;
  }

  public setVisible(visible: boolean): void {
    for (const group of this.workerMeshes.values()) {
      group.container.setEnabled(visible);
      group.markerMesh.isVisible = visible;
    }
  }

  public snapAllToTerrain(): void {
    for (const group of this.workerMeshes.values()) {
      const elevation = this.elevationProvider.getElevationAt(
        group.targetGridX, group.targetGridY, 0
      );
      const worldPos = gridTo3D(group.targetGridX + 0.5, group.targetGridY + 0.5, elevation);
      group.container.position.copyFrom(worldPos);
      group.visualProgress = 1;
    }
  }

  public dispose(): void {
    for (const group of this.workerMeshes.values()) {
      this.disposeWorkerMesh(group);
    }
    this.workerMeshes.clear();
  }
}
