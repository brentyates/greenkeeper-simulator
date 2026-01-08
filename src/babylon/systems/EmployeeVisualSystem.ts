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

const TASK_COLORS: Record<
  EmployeeTask,
  { body: Color3; equipment: Color3 | null }
> = {
  mow_grass: {
    body: new Color3(0.6, 0.4, 0.2),
    equipment: new Color3(0.3, 0.5, 0.3),
  },
  water_area: {
    body: new Color3(0.2, 0.4, 0.6),
    equipment: new Color3(0.3, 0.4, 0.7),
  },
  fertilize_area: {
    body: new Color3(0.5, 0.35, 0.2),
    equipment: new Color3(0.6, 0.5, 0.3),
  },
  rake_bunker: {
    body: new Color3(0.55, 0.45, 0.35),
    equipment: new Color3(0.6, 0.4, 0.2),
  },
  patrol: { body: new Color3(0.4, 0.35, 0.3), equipment: null },
  return_to_base: { body: new Color3(0.4, 0.35, 0.3), equipment: null },
  idle: { body: new Color3(0.35, 0.3, 0.25), equipment: null },
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
    for (const [task, colors] of Object.entries(TASK_COLORS)) {
      // Body materials are no longer used with sprites
      // but we keep the loop for equipment materials

      if (colors.equipment) {
        const equipMat = new StandardMaterial(
          `workerEquip_${task}`,
          this.scene
        );
        equipMat.diffuseColor = colors.equipment;
        equipMat.emissiveColor = colors.equipment.scale(0.4);
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
      startY
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
    // Sprite handles body visualization, so we don't change body material here.

    if (group.equipment) {
      group.equipment.dispose();
      group.equipment = null;
    }

    const taskColors = TASK_COLORS[task];
    if (taskColors.equipment) {
      group.equipment = this.createEquipmentMesh(group.container, task);
    }
  }

  private createEquipmentMesh(parent: Mesh, task: EmployeeTask): Mesh {
    const equipMat = this.taskMaterials.get(`equip_${task}`);
    let equipment: Mesh;

    switch (task) {
      case "mow_grass":
        equipment = MeshBuilder.CreateBox(
          "mower",
          { width: 0.2, height: 0.08, depth: 0.15 },
          this.scene
        );
        equipment.position = new Vector3(0.15, 0.08, 0);
        break;

      case "water_area":
        equipment = MeshBuilder.CreateCylinder(
          "waterCan",
          { height: 0.12, diameterTop: 0.06, diameterBottom: 0.1 },
          this.scene
        );
        equipment.position = new Vector3(0.12, 0.18, 0);
        equipment.rotation.z = -0.3;
        break;

      case "fertilize_area":
        equipment = MeshBuilder.CreateBox(
          "spreader",
          { width: 0.18, height: 0.12, depth: 0.1 },
          this.scene
        );
        equipment.position = new Vector3(0.12, 0.12, 0);
        break;

      case "rake_bunker":
        equipment = MeshBuilder.CreateCylinder(
          "rake",
          { height: 0.4, diameter: 0.03 },
          this.scene
        );
        equipment.position = new Vector3(0.1, 0.2, 0);
        equipment.rotation.z = 0.3;
        break;

      default:
        equipment = MeshBuilder.CreateBox("tool", { size: 0.05 }, this.scene);
        equipment.position = new Vector3(0.1, 0.15, 0);
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
