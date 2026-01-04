import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { gridTo3D } from "../engine/BabylonEngine";
import { EmployeeTask } from "../../core/employee-work";
import { MOVE_DURATION_MS } from "../../core/movable-entity";

export interface EmployeePosition {
  readonly employeeId: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly task: EmployeeTask;
  readonly nextX: number | null;
  readonly nextY: number | null;
  readonly moveProgress: number;
}

export interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

interface WorkerMeshGroup {
  container: Mesh;
  body: Mesh;
  head: Mesh;
  hat: Mesh;
  equipment: Mesh | null;
  currentTask: EmployeeTask;
  lastGridX: number;
  lastGridY: number;
  targetGridX: number;
  targetGridY: number;
  visualProgress: number;
}

const TASK_COLORS: Record<EmployeeTask, { body: Color3; equipment: Color3 | null }> = {
  mow_grass: { body: new Color3(0.6, 0.4, 0.2), equipment: new Color3(0.3, 0.5, 0.3) },
  water_area: { body: new Color3(0.2, 0.4, 0.6), equipment: new Color3(0.3, 0.4, 0.7) },
  fertilize_area: { body: new Color3(0.5, 0.35, 0.2), equipment: new Color3(0.6, 0.5, 0.3) },
  rake_bunker: { body: new Color3(0.55, 0.45, 0.35), equipment: new Color3(0.6, 0.4, 0.2) },
  patrol: { body: new Color3(0.4, 0.35, 0.3), equipment: null },
  return_to_base: { body: new Color3(0.4, 0.35, 0.3), equipment: null },
  idle: { body: new Color3(0.35, 0.3, 0.25), equipment: null },
};

export class EmployeeVisualSystem {
  private scene: Scene;
  private elevationProvider: ElevationProvider;
  private workerMeshes: Map<string, WorkerMeshGroup> = new Map();
  private materials: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene, elevationProvider: ElevationProvider) {
    this.scene = scene;
    this.elevationProvider = elevationProvider;
    this.createMaterials();
  }

  private createMaterials(): void {
    const skinMat = new StandardMaterial("workerSkinMat", this.scene);
    skinMat.diffuseColor = new Color3(0.85, 0.7, 0.55);
    skinMat.emissiveColor = new Color3(0.42, 0.35, 0.27);
    this.materials.set("skin", skinMat);

    const hatMat = new StandardMaterial("workerHatMat", this.scene);
    hatMat.diffuseColor = new Color3(0.7, 0.5, 0.2);
    hatMat.emissiveColor = new Color3(0.35, 0.25, 0.1);
    this.materials.set("hat", hatMat);

    const shadowMat = new StandardMaterial("workerShadowMat", this.scene);
    shadowMat.diffuseColor = new Color3(0, 0, 0);
    shadowMat.alpha = 0.25;
    shadowMat.disableLighting = true;
    this.materials.set("shadow", shadowMat);

    for (const [task, colors] of Object.entries(TASK_COLORS)) {
      const bodyMat = new StandardMaterial(`workerBody_${task}`, this.scene);
      bodyMat.diffuseColor = colors.body;
      bodyMat.emissiveColor = colors.body.scale(0.5);
      this.materials.set(`body_${task}`, bodyMat);

      if (colors.equipment) {
        const equipMat = new StandardMaterial(`workerEquip_${task}`, this.scene);
        equipMat.diffuseColor = colors.equipment;
        equipMat.emissiveColor = colors.equipment.scale(0.4);
        this.materials.set(`equip_${task}`, equipMat);
      }
    }
  }

  public update(positions: readonly EmployeePosition[], deltaMs: number): void {
    const currentIds = new Set(positions.map(p => p.employeeId));

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

      this.updateWorkerPosition(group, pos.gridX, pos.gridY, pos.nextX, pos.nextY, deltaMs);
      this.updateWorkerTask(group, pos.task);
    }
  }

  private createWorkerMesh(employeeId: string, startX: number, startY: number): WorkerMeshGroup {
    const container = MeshBuilder.CreateBox(
      `worker_${employeeId}`,
      { size: 0.01 },
      this.scene
    );
    container.isVisible = false;

    const shadow = MeshBuilder.CreateDisc(
      `worker_shadow_${employeeId}`,
      { radius: 0.15, tessellation: 12 },
      this.scene
    );
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.01;
    shadow.material = this.materials.get("shadow")!;
    shadow.parent = container;

    const body = MeshBuilder.CreateCylinder(
      `worker_body_${employeeId}`,
      { height: 0.32, diameterTop: 0.12, diameterBottom: 0.16 },
      this.scene
    );
    body.position.y = 0.16;
    body.material = this.materials.get("body_idle")!;
    body.parent = container;

    const head = MeshBuilder.CreateSphere(
      `worker_head_${employeeId}`,
      { diameter: 0.16 },
      this.scene
    );
    head.position.y = 0.4;
    head.material = this.materials.get("skin")!;
    head.parent = container;

    const hat = MeshBuilder.CreateCylinder(
      `worker_hat_${employeeId}`,
      { height: 0.08, diameterTop: 0.12, diameterBottom: 0.2 },
      this.scene
    );
    hat.position.y = 0.52;
    hat.material = this.materials.get("hat")!;
    hat.parent = container;

    return {
      container,
      body,
      head,
      hat,
      equipment: null,
      currentTask: "idle",
      lastGridX: startX,
      lastGridY: startY,
      targetGridX: startX,
      targetGridY: startY,
      visualProgress: 1,
    };
  }

  private updateWorkerPosition(
    group: WorkerMeshGroup,
    gridX: number,
    gridY: number,
    nextX: number | null,
    nextY: number | null,
    deltaMs: number
  ): void {
    const isMoving = nextX !== null && nextY !== null;
    const targetX = isMoving ? nextX : gridX;
    const targetY = isMoving ? nextY : gridY;

    if (targetX !== group.targetGridX || targetY !== group.targetGridY) {
      group.lastGridX = group.targetGridX;
      group.lastGridY = group.targetGridY;
      group.targetGridX = targetX;
      group.targetGridY = targetY;
      group.visualProgress = 0;
    }

    if (group.visualProgress < 1) {
      group.visualProgress = Math.min(1, group.visualProgress + deltaMs / MOVE_DURATION_MS);
    }

    const startElevation = this.elevationProvider.getElevationAt(group.lastGridX, group.lastGridY, 0);
    const startPos = gridTo3D(group.lastGridX + 0.5, group.lastGridY + 0.5, startElevation);

    const endElevation = this.elevationProvider.getElevationAt(group.targetGridX, group.targetGridY, 0);
    const endPos = gridTo3D(group.targetGridX + 0.5, group.targetGridY + 0.5, endElevation);

    const t = group.visualProgress;
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x = startPos.x + (endPos.x - startPos.x) * easeT;
    const y = startPos.y + (endPos.y - startPos.y) * easeT;
    const z = startPos.z + (endPos.z - startPos.z) * easeT;

    group.container.position = new Vector3(x, y, z);
  }

  private updateWorkerTask(group: WorkerMeshGroup, task: EmployeeTask): void {
    if (group.currentTask === task) return;

    group.currentTask = task;
    const bodyMat = this.materials.get(`body_${task}`);
    if (bodyMat) {
      group.body.material = bodyMat;
    }

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
    const equipMat = this.materials.get(`equip_${task}`);
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
    group.container.dispose();
  }

  public getWorkerCount(): number {
    return this.workerMeshes.size;
  }

  public dispose(): void {
    for (const group of this.workerMeshes.values()) {
      this.disposeWorkerMesh(group);
    }
    this.workerMeshes.clear();

    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();
  }
}
