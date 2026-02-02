/**
 * EmployeeVisualSystem - Manages 3D mesh rendering for NPC employees
 *
 * Creates and updates employee meshes based on their positions and tasks.
 * Equipment meshes are attached based on current task.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
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
  equipment: Mesh | null;
  currentTask: EmployeeTask;
}

// Equipment colors by task (null = no equipment for this task)
const TASK_EQUIPMENT_COLORS: Record<EmployeeTask, Color3 | null> = {
  mow_grass: new Color3(0.3, 0.5, 0.3),
  water_area: new Color3(0.3, 0.4, 0.7),
  fertilize_area: new Color3(0.6, 0.5, 0.3),
  rake_bunker: new Color3(0.6, 0.4, 0.2),
  patrol: null,
  return_to_base: null,
  idle: null,
};

export class EmployeeVisualSystem {
  private scene: Scene;
  private elevationProvider: ElevationProvider;
  private workerMeshes: Map<string, WorkerMeshGroup> = new Map();
  private taskMaterials: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene, elevationProvider: ElevationProvider) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;
    this.createTaskMaterials();
  }

  private createTaskMaterials(): void {
    for (const [task, equipColor] of Object.entries(TASK_EQUIPMENT_COLORS)) {
      if (equipColor) {
        const equipMat = new StandardMaterial(
          `workerEquip_${task}`,
          this.scene
        );
        equipMat.diffuseColor = equipColor;
        equipMat.emissiveColor = equipColor.scale(0.4);
        equipMat.freeze();
        this.taskMaterials.set(`equip_${task}`, equipMat);
      }
    }
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

  /**
   * Ensure equipment is parented to meshInstance.root if available.
   * This handles the case where equipment was created before mesh finished loading.
   */
  private ensureEquipmentParent(group: WorkerMeshGroup): void {
    if (
      group.equipment &&
      group.meshInstance?.root &&
      group.equipment.parent !== group.meshInstance.root
    ) {
      group.equipment.parent = group.meshInstance.root;
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
      equipment: null,
      currentTask: "idle",
    };
  }

  private updateWorkerTask(group: WorkerMeshGroup, task: EmployeeTask): void {
    if (group.currentTask === task) return;

    group.currentTask = task;

    if (group.equipment) {
      group.equipment.dispose();
      group.equipment = null;
    }

    if (TASK_EQUIPMENT_COLORS[task]) {
      // Parent equipment to meshInstance.root (which rotates with facing angle)
      // Fall back to container if mesh hasn't loaded yet
      const parent = group.meshInstance?.root ?? group.container;
      group.equipment = this.createEquipmentMesh(parent, task);
    }
  }

  private createEquipmentMesh(parent: Mesh, task: EmployeeTask): Mesh {
    const equipMat = this.taskMaterials.get(`equip_${task}`);
    let equipment: Mesh;

    switch (task) {
      case "mow_grass":
        equipment = MeshBuilder.CreateBox(
          "mower",
          { width: 0.3, height: 0.15, depth: 0.5 },
          this.scene
        );
        equipment.position = new Vector3(0.4, 0.1, 0);
        break;

      case "water_area":
        equipment = MeshBuilder.CreateCylinder(
          "waterCan",
          { height: 0.25, diameterTop: 0.1, diameterBottom: 0.18 },
          this.scene
        );
        equipment.position = new Vector3(0.3, 0.4, 0);
        equipment.rotation.z = -0.3;
        break;

      case "fertilize_area":
        equipment = MeshBuilder.CreateBox(
          "spreader",
          { width: 0.35, height: 0.25, depth: 0.2 },
          this.scene
        );
        equipment.position = new Vector3(0.3, 0.25, 0);
        break;

      case "rake_bunker":
        equipment = MeshBuilder.CreateCylinder(
          "rake",
          { height: 1.2, diameter: 0.05 },
          this.scene
        );
        equipment.position = new Vector3(0.25, 0.6, 0);
        equipment.rotation.z = 0.3;
        break;

      default:
        equipment = MeshBuilder.CreateBox("tool", { size: 0.1 }, this.scene);
        equipment.position = new Vector3(0.25, 0.35, 0);
    }

    if (equipMat) {
      equipment.material = equipMat;
    }
    equipment.parent = parent;
    return equipment;
  }

  private disposeWorkerMesh(group: WorkerMeshGroup): void {
    if (group.equipment) {
      group.equipment.dispose();
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

    for (const mat of this.taskMaterials.values()) {
      mat.dispose();
    }
    this.taskMaterials.clear();
  }
}
