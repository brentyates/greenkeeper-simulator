import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";

export interface EntityAppearance {
  readonly bodyColor: Color3;
  readonly bodyEmissive: Color3;
  readonly hatColor: Color3;
  readonly hatEmissive: Color3;
  readonly scale: number;
  readonly hasHatBrim: boolean;
}

export interface EntityVisualState {
  container: Mesh;
  body: Mesh;
  head: Mesh;
  hat: Mesh;
  hatBrim: Mesh | null;
  lastGridX: number;
  lastGridY: number;
  targetGridX: number;
  targetGridY: number;
  visualProgress: number;
}

export interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

export const PLAYER_APPEARANCE: EntityAppearance = {
  bodyColor: new Color3(0.11, 0.48, 0.24),
  bodyEmissive: new Color3(0.06, 0.24, 0.12),
  hatColor: new Color3(0.9, 0.9, 0.85),
  hatEmissive: new Color3(0.45, 0.45, 0.42),
  scale: 1.0,
  hasHatBrim: true,
};

export const EMPLOYEE_APPEARANCE: EntityAppearance = {
  bodyColor: new Color3(0.4, 0.35, 0.3),
  bodyEmissive: new Color3(0.2, 0.17, 0.15),
  hatColor: new Color3(0.7, 0.5, 0.2),
  hatEmissive: new Color3(0.35, 0.25, 0.1),
  scale: 0.8,
  hasHatBrim: false,
};

export function createEntityMesh(
  scene: Scene,
  id: string,
  appearance: EntityAppearance,
  startX: number,
  startY: number
): EntityVisualState {
  const scale = appearance.scale;

  const container = MeshBuilder.CreateBox(
    `entity_${id}`,
    { size: 0.01 },
    scene
  );
  container.isVisible = false;

  const shadow = MeshBuilder.CreateDisc(
    `shadow_${id}`,
    { radius: 0.2 * scale, tessellation: 16 },
    scene
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.01;
  const shadowMat = new StandardMaterial(`shadowMat_${id}`, scene);
  shadowMat.diffuseColor = new Color3(0, 0, 0);
  shadowMat.alpha = 0.3;
  shadowMat.disableLighting = true;
  shadow.material = shadowMat;
  shadow.parent = container;

  const body = MeshBuilder.CreateCylinder(
    `body_${id}`,
    { height: 0.4 * scale, diameterTop: 0.16 * scale, diameterBottom: 0.2 * scale },
    scene
  );
  body.position.y = 0.2 * scale;
  const bodyMat = new StandardMaterial(`bodyMat_${id}`, scene);
  bodyMat.diffuseColor = appearance.bodyColor;
  bodyMat.emissiveColor = appearance.bodyEmissive;
  body.material = bodyMat;
  body.parent = container;

  const head = MeshBuilder.CreateSphere(
    `head_${id}`,
    { diameter: 0.2 * scale },
    scene
  );
  head.position.y = 0.5 * scale;
  const headMat = new StandardMaterial(`headMat_${id}`, scene);
  headMat.diffuseColor = new Color3(0.94, 0.82, 0.69);
  headMat.emissiveColor = new Color3(0.47, 0.41, 0.35);
  head.material = headMat;
  head.parent = container;

  const hat = MeshBuilder.CreateCylinder(
    `hat_${id}`,
    { height: 0.1 * scale, diameterTop: 0.16 * scale, diameterBottom: 0.24 * scale },
    scene
  );
  hat.position.y = 0.65 * scale;
  const hatMat = new StandardMaterial(`hatMat_${id}`, scene);
  hatMat.diffuseColor = appearance.hatColor;
  hatMat.emissiveColor = appearance.hatEmissive;
  hat.material = hatMat;
  hat.parent = container;

  let hatBrim: Mesh | null = null;
  if (appearance.hasHatBrim) {
    hatBrim = MeshBuilder.CreateDisc(
      `hatBrim_${id}`,
      { radius: 0.16 * scale, tessellation: 16 },
      scene
    );
    hatBrim.rotation.x = Math.PI / 2;
    hatBrim.position.y = 0.6 * scale;
    hatBrim.material = hatMat;
    hatBrim.parent = container;
  }

  return {
    container,
    body,
    head,
    hat,
    hatBrim,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 1,
  };
}

export function updateEntityVisualPosition(
  state: EntityVisualState,
  gridX: number,
  gridY: number,
  nextX: number | null,
  nextY: number | null,
  deltaMs: number,
  elevationProvider: ElevationProvider
): void {
  const isMoving = nextX !== null && nextY !== null;
  const targetX = isMoving ? nextX : gridX;
  const targetY = isMoving ? nextY : gridY;

  if (targetX !== state.targetGridX || targetY !== state.targetGridY) {
    state.lastGridX = state.targetGridX;
    state.lastGridY = state.targetGridY;
    state.targetGridX = targetX;
    state.targetGridY = targetY;
    state.visualProgress = 0;
  }

  if (state.visualProgress < 1) {
    state.visualProgress = Math.min(1, state.visualProgress + deltaMs / MOVE_DURATION_MS);
  }

  const startElevation = elevationProvider.getElevationAt(state.lastGridX, state.lastGridY, 0);
  const startPos = gridTo3D(state.lastGridX + 0.5, state.lastGridY + 0.5, startElevation);

  const endElevation = elevationProvider.getElevationAt(state.targetGridX, state.targetGridY, 0);
  const endPos = gridTo3D(state.targetGridX + 0.5, state.targetGridY + 0.5, endElevation);

  const t = state.visualProgress;
  const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const x = startPos.x + (endPos.x - startPos.x) * easeT;
  const y = startPos.y + (endPos.y - startPos.y) * easeT;
  const z = startPos.z + (endPos.z - startPos.z) * easeT;

  state.container.position = new Vector3(x, y, z);
}

export function disposeEntityMesh(state: EntityVisualState): void {
  if (state.hatBrim) {
    state.hatBrim.dispose();
  }
  state.container.dispose();
}

export function getEntityWorldPosition(state: EntityVisualState): Vector3 {
  return state.container.position.clone();
}
