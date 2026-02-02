/**
 * EntityVisualSystem - 3D mesh-based entity rendering
 *
 * Renders entities as 3D meshes loaded via AssetLoader.
 * Handles smooth movement interpolation and rotation to face movement direction.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";
import { AssetId, AssetInstance, loadAsset, createInstance, disposeInstance } from "../assets/AssetLoader";

export interface EntityAppearance {
  readonly assetId: AssetId;
  readonly scale: number;
  /** If true, entity rotates to face movement direction. Default: true */
  readonly rotatesWithMovement?: boolean;
  /** Fixed rotation angle in radians (used when rotatesWithMovement is false) */
  readonly fixedRotation?: number;
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
  isDisposed: boolean;
  /** If true, facingAngle updates based on movement direction */
  rotatesWithMovement: boolean;
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

/**
 * Create a 3D mesh-based entity
 */
export function createEntityMesh(
  scene: Scene,
  id: string,
  appearance: EntityAppearance,
  startX: number,
  startY: number,
  elevationProvider: ElevationProvider
): EntityVisualState {
  // Create a container mesh for positioning
  const container = new Mesh(`entity_${id}`, scene);
  container.isVisible = false;

  // Position container at start with correct terrain elevation
  const startElevation = elevationProvider.getElevationAt(startX, startY, 0);
  const startPos = gridTo3D(startX + 0.5, startY + 0.5, startElevation);
  container.position.copyFrom(startPos);

  const rotatesWithMovement = appearance.rotatesWithMovement !== false;
  const initialRotation = appearance.fixedRotation ?? 0;

  const state: EntityVisualState = {
    container,
    meshInstance: null,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 1,
    facingAngle: initialRotation,
    isAnimating: false,
    isDisposed: false,
    rotatesWithMovement,
  };

  // Load the asset asynchronously (AssetLoader handles caching)
  loadAsset(scene, appearance.assetId)
    .then((loadedAsset) => {
      // Check if entity was disposed while loading
      if (state.isDisposed) {
        return;
      }
      const instance = createInstance(scene, loadedAsset, `${id}_mesh`);
      instance.root.parent = container;
      instance.root.position.set(0, 0, 0);
      instance.root.scaling.setAll(appearance.scale);
      // Apply initial/fixed rotation
      instance.root.rotation.y = state.facingAngle;
      state.meshInstance = instance;
    })
    .catch((error) => {
      console.error(`[EntityVisualSystem] Failed to load asset ${appearance.assetId}:`, error);
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
    // Only update facing direction if entity rotates with movement
    if (state.rotatesWithMovement) {
      const dx = targetX - gridX;
      const dy = targetY - gridY;
      state.facingAngle = calculateFacingAngle(dx, dy, state.facingAngle);
    }
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
  state.isDisposed = true;
  if (state.meshInstance) {
    disposeInstance(state.meshInstance);
    state.meshInstance = null;
  }
  state.container.dispose();
}
