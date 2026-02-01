/**
 * EntityVisualSystem - 3D mesh-based entity rendering
 *
 * Renders entities as 3D meshes loaded via AssetLoader.
 * Handles smooth movement interpolation and rotation to face movement direction.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";
import { AssetId, AssetInstance, LoadedAsset, loadAsset, createInstance, disposeInstance } from "../assets/AssetLoader";

export interface EntityAppearance {
  readonly assetId: AssetId;
  readonly scale: number;
}

export interface EntityVisualState {
  container: Mesh;
  meshInstance: AssetInstance | null;
  lastGridX: number;
  lastGridY: number;
  targetGridX: number;
  targetGridY: number;
  visualProgress: number;
  facingAngle: number;
  isAnimating: boolean;
}

export interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

export const PLAYER_APPEARANCE: EntityAppearance = {
  assetId: "character.greenkeeper",
  scale: 1.0,
};

export const EMPLOYEE_APPEARANCE: EntityAppearance = {
  assetId: "character.employee",
  scale: 1.0,
};

// Asset cache for loaded models
const assetCache: Map<AssetId, Promise<LoadedAsset>> = new Map();

async function getOrLoadAsset(scene: Scene, assetId: AssetId): Promise<LoadedAsset> {
  const cached = assetCache.get(assetId);
  if (cached) {
    return cached;
  }
  const promise = loadAsset(scene, assetId);
  assetCache.set(assetId, promise);
  return promise;
}

/**
 * Create a 3D mesh-based entity
 */
export function createEntityMesh(
  scene: Scene,
  id: string,
  appearance: EntityAppearance,
  startX: number,
  startY: number
): EntityVisualState {
  // Create a container mesh for positioning
  const container = new Mesh(`entity_${id}`, scene);
  container.isVisible = false;

  // Position container at start
  const startPos = gridTo3D(startX + 0.5, startY + 0.5, 0);
  container.position.copyFrom(startPos);

  const state: EntityVisualState = {
    container,
    meshInstance: null,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 1,
    facingAngle: 0,
    isAnimating: false,
  };

  // Load the asset asynchronously
  getOrLoadAsset(scene, appearance.assetId).then((loadedAsset) => {
    const instance = createInstance(scene, loadedAsset, `${id}_mesh`);
    instance.root.parent = container;
    instance.root.position.set(0, 0, 0);
    instance.root.scaling.setAll(appearance.scale);
    state.meshInstance = instance;
  });

  return state;
}

/**
 * Calculate facing angle from movement direction
 * Returns angle in radians where 0 = facing south (+Z in isometric)
 */
function calculateFacingAngle(dx: number, dy: number, currentAngle: number): number {
  if (dx === 0 && dy === 0) return currentAngle;

  // In isometric: grid dx maps to screen diagonal, dy maps to other diagonal
  // We want the mesh to face the direction of movement
  // atan2 gives angle from +X axis, we adjust for our coordinate system
  return Math.atan2(dy, dx) + Math.PI / 2;
}

/**
 * Update entity position with smooth interpolation and rotation
 */
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

  // Detect movement start
  if (targetX !== state.targetGridX || targetY !== state.targetGridY) {
    const dx = targetX - gridX;
    const dy = targetY - gridY;

    // Update facing direction
    state.facingAngle = calculateFacingAngle(dx, dy, state.facingAngle);
    state.isAnimating = true;

    state.lastGridX = state.targetGridX;
    state.lastGridY = state.targetGridY;
    state.targetGridX = targetX;
    state.targetGridY = targetY;
    state.visualProgress = 0;
  }

  // Progress movement
  if (state.visualProgress < 1) {
    state.visualProgress = Math.min(
      1,
      state.visualProgress + deltaMs / MOVE_DURATION_MS
    );
  } else if (state.isAnimating) {
    state.isAnimating = false;
  }

  // Interpolate position
  const startElevation = elevationProvider.getElevationAt(
    state.lastGridX,
    state.lastGridY,
    0
  );
  const startPos = gridTo3D(
    state.lastGridX + 0.5,
    state.lastGridY + 0.5,
    startElevation
  );

  const endElevation = elevationProvider.getElevationAt(
    state.targetGridX,
    state.targetGridY,
    0
  );
  const endPos = gridTo3D(
    state.targetGridX + 0.5,
    state.targetGridY + 0.5,
    endElevation
  );

  const t = state.visualProgress;
  const x = startPos.x + (endPos.x - startPos.x) * t;
  const y = startPos.y + (endPos.y - startPos.y) * t;
  const z = startPos.z + (endPos.z - startPos.z) * t;

  state.container.position.set(x, y, z);

  // Apply rotation to mesh instance
  if (state.meshInstance) {
    state.meshInstance.root.rotation.y = state.facingAngle;
  }
}

/**
 * Dispose entity and free resources
 */
export function disposeEntityMesh(state: EntityVisualState): void {
  if (state.meshInstance) {
    disposeInstance(state.meshInstance);
    state.meshInstance = null;
  }
  state.container.dispose();
}

/**
 * Get world position for effects/equipment attachment
 */
export function getEntityWorldPosition(state: EntityVisualState): Vector3 {
  return state.container.position.clone();
}
