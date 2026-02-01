/**
 * EntityVisualSystem - 3D mesh-based entity rendering
 *
 * Renders entities as 3D meshes loaded via AssetLoader.
 * Handles smooth movement interpolation and rotation to face movement direction.
 *
 * Note: Animations are not yet implemented - meshes just rotate and move.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";
import { AssetId, AssetInstance, LoadedAsset, loadAsset, createInstance, disposeInstance } from "../assets/AssetLoader";

// Keep these exports for compatibility, though they're not used with meshes
export const SPRITE_FRAMES_PER_DIRECTION = 6;
export const SPRITE_DIRECTIONS_COUNT = 8;
export const SPRITE_ANIMATION_SPEED_MS = 150;
export const ANIM_TYPE_WALK = 0;
export const ANIM_TYPE_PUSHING = 1;

export interface EntityAppearance {
  readonly bodyColor: Color3;
  readonly bodyEmissive: Color3;
  readonly hatColor: Color3;
  readonly hatEmissive: Color3;
  readonly scale: number;
  readonly hasHatBrim: boolean;
  readonly assetId: AssetId;
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
  animationType: number;
  isAnimating: boolean;
  // Legacy sprite fields (unused but kept for interface compatibility)
  direction: number;
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
  assetId: "character.greenkeeper",
};

export const EMPLOYEE_APPEARANCE: EntityAppearance = {
  bodyColor: new Color3(0.4, 0.35, 0.3),
  bodyEmissive: new Color3(0.2, 0.17, 0.15),
  hatColor: new Color3(0.7, 0.5, 0.2),
  hatEmissive: new Color3(0.35, 0.25, 0.1),
  scale: 1.0,
  hasHatBrim: false,
  assetId: "character.employee",
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
    animationType: ANIM_TYPE_WALK,
    isAnimating: false,
    direction: 0,
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
 * Legacy direction index for compatibility
 */
export function getIsometricDirectionIndex(dx: number, dy: number, currentDir: number): number {
  if (dx === 0 && dy === 0) return currentDir;

  const DIR_S = 0, DIR_N = 1, DIR_W = 2, DIR_E = 3;
  const DIR_SE = 4, DIR_SW = 5, DIR_NE = 6, DIR_NW = 7;

  if (dx < 0 && dy === 0) return DIR_NE;
  if (dx > 0 && dy === 0) return DIR_SW;
  if (dy < 0 && dx === 0) return DIR_NW;
  if (dy > 0 && dx === 0) return DIR_SE;
  if (dx < 0 && dy < 0) return DIR_N;
  if (dx > 0 && dy > 0) return DIR_S;
  if (dx < 0 && dy > 0) return DIR_E;
  if (dx > 0 && dy < 0) return DIR_W;

  return currentDir;
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
    state.direction = getIsometricDirectionIndex(dx, dy, state.direction);
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

/**
 * Set animation type (walk vs pushing)
 * Note: Animation playback not yet implemented - just stores the state
 */
export function setEntityAnimationType(state: EntityVisualState, animationType: number): void {
  state.animationType = animationType;
  // TODO: When GLB animations are added, trigger appropriate animation here
}

/**
 * Show equipment (placeholder - creates simple box attached to entity)
 */
export function showEquipmentSprite(_state: EntityVisualState, _scene: Scene): void {
  // Equipment is now handled by attaching to the mesh
  // For now, this is a no-op - equipment will be part of the character model
  // or loaded as a separate asset and attached
}

/**
 * Hide equipment
 */
export function hideEquipmentSprite(_state: EntityVisualState): void {
  // No-op for now
}

/**
 * Update equipment position (no longer needed with parented meshes)
 */
export function updateEquipmentSpritePosition(_state: EntityVisualState): void {
  // No-op - equipment is parented to character mesh
}
