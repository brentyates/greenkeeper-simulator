/**
 * EmployeeVisualSystem - Manages 3D mesh rendering for NPC employees
 *
 * Creates and updates employee meshes based on their positions and tasks.
 * Equipment meshes are attached based on current task.
 */

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { EmployeeTask } from "../../core/employee-work";
import {
  EntityVisualState,
  ElevationProvider,
  EMPLOYEE_APPEARANCE,
  createEntityMesh,
  updateEntityVisualPosition,
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
  readonly gridX: number;
  readonly gridY: number;
  readonly task: EmployeeTask;
  readonly nextX: number | null;
  readonly nextY: number | null;
  readonly moveProgress: number;
}

export type { ElevationProvider } from "./EntityVisualSystem";

interface WorkerMeshGroup extends EntityVisualState {
  equipmentInstance: AssetInstance | null;
  currentTask: EmployeeTask;
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

  public update(positions: readonly EmployeePosition[], deltaMs: number): void {
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
        group = this.createWorkerMesh(pos.employeeId, pos.gridX, pos.gridY);
        this.workerMeshes.set(pos.employeeId, group);
      }

      updateEntityVisualPosition(
        group,
        pos.gridX,
        pos.gridY,
        pos.nextX,
        pos.nextY,
        deltaMs,
        this.elevationProvider
      );
      this.updateWorkerTask(group, pos.task);

      // Re-parent equipment if mesh loaded after equipment was created
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

    return {
      ...baseState,
      equipmentInstance: null,
      currentTask: "idle",
    };
  }

  private updateWorkerTask(group: WorkerMeshGroup, task: EmployeeTask): void {
    if (group.currentTask === task) return;

    group.currentTask = task;

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
        .catch((error) => {
          console.error(`[EmployeeVisualSystem] Failed to load equipment ${assetId}:`, error);
        });
    }
  }

  private disposeWorkerMesh(group: WorkerMeshGroup): void {
    if (group.equipmentInstance) {
      disposeInstance(group.equipmentInstance);
    }
    disposeEntityMesh(group);
  }

  public getWorkerCount(): number {
    return this.workerMeshes.size;
  }

  public dispose(): void {
    for (const group of this.workerMeshes.values()) {
      this.disposeWorkerMesh(group);
    }
    this.workerMeshes.clear();
  }
}
