/**
 * MeshEntitySystem - 3D model-based entity rendering
 *
 * Replaces sprite-based EntityVisualSystem with Blender GLB models.
 * Characters are full 3D models that rotate to face movement direction.
 *
 * Benefits over sprites:
 * - No sprite sheet management
 * - Natural rotation (no 8-direction limitation)
 * - Skeletal animation support
 * - Consistent 3D look with terrain
 */

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import {
  AssetId,
  AssetInstance,
  LoadedAsset,
  createInstance,
  disposeInstance,
  loadAsset,
} from "../assets/AssetLoader";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";

export interface MeshEntityState {
  instance: AssetInstance;
  lastGridX: number;
  lastGridY: number;
  targetGridX: number;
  targetGridY: number;
  visualProgress: number;
  currentAnimation: string | null;
  facingAngle: number; // Radians, 0 = south
}

export interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

// Animation names expected in GLB files
const ANIM_IDLE = "idle";
const ANIM_WALK = "walk";
const ANIM_PUSH = "push";

/**
 * Create a mesh-based entity from a loaded asset
 */
export function createMeshEntity(
  scene: Scene,
  asset: LoadedAsset,
  entityId: string,
  startX: number,
  startY: number
): MeshEntityState {
  const instance = createInstance(scene, asset, entityId);

  // Position at start
  const pos = gridTo3D(startX + 0.5, startY + 0.5, 0);
  instance.root.position.copyFrom(pos);

  return {
    instance,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 1,
    currentAnimation: null,
    facingAngle: 0,
  };
}

/**
 * Load an asset and create an entity in one call
 */
export async function loadAndCreateEntity(
  scene: Scene,
  assetId: AssetId,
  entityId: string,
  startX: number,
  startY: number
): Promise<MeshEntityState> {
  const asset = await loadAsset(scene, assetId);
  return createMeshEntity(scene, asset, entityId, startX, startY);
}

/**
 * Calculate facing angle from movement direction
 * Returns angle in radians where 0 = facing south (+Z)
 */
function calculateFacingAngle(dx: number, dy: number, currentAngle: number): number {
  if (dx === 0 && dy === 0) return currentAngle;

  // atan2 gives angle from +X axis, we want from +Z axis
  // Grid: dx- = screen NE, dy- = screen NW
  // In 3D: x maps to screen X, z maps to screen Y (isometric)
  return Math.atan2(dy, dx) + Math.PI / 2;
}

/**
 * Play an animation if available
 */
function playAnimation(state: MeshEntityState, animName: string, loop: boolean = true): void {
  if (state.currentAnimation === animName) return;

  // Stop current animation
  if (state.currentAnimation) {
    const current = state.instance.animations.get(state.currentAnimation);
    if (current) {
      current.stop();
    }
  }

  // Start new animation
  const anim = state.instance.animations.get(animName);
  if (anim) {
    anim.start(loop);
    state.currentAnimation = animName;
  }
}

/**
 * Stop current animation and return to idle
 */
function stopAnimation(state: MeshEntityState): void {
  if (state.currentAnimation) {
    const current = state.instance.animations.get(state.currentAnimation);
    if (current) {
      current.stop();
    }
  }

  // Try to play idle, or just stop if not available
  const idle = state.instance.animations.get(ANIM_IDLE);
  if (idle) {
    idle.start(true);
    state.currentAnimation = ANIM_IDLE;
  } else {
    state.currentAnimation = null;
  }
}

/**
 * Update entity position with smooth interpolation
 */
export function updateMeshEntityPosition(
  state: MeshEntityState,
  gridX: number,
  gridY: number,
  nextX: number | null,
  nextY: number | null,
  deltaMs: number,
  elevationProvider: ElevationProvider,
  isPushing: boolean = false
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

    // Start movement animation
    const animName = isPushing ? ANIM_PUSH : ANIM_WALK;
    playAnimation(state, animName, true);

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
  } else if (state.currentAnimation === ANIM_WALK || state.currentAnimation === ANIM_PUSH) {
    // Movement complete, return to idle
    stopAnimation(state);
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

  state.instance.root.position.set(x, y, z);

  // Apply rotation (smooth interpolation could be added here)
  state.instance.root.rotation.y = state.facingAngle;
}

/**
 * Set the pushing animation state
 */
export function setEntityPushing(state: MeshEntityState, isPushing: boolean): void {
  if (isPushing && state.currentAnimation !== ANIM_PUSH) {
    playAnimation(state, ANIM_PUSH, true);
  } else if (!isPushing && state.currentAnimation === ANIM_PUSH) {
    stopAnimation(state);
  }
}

/**
 * Get world position for attaching effects/equipment
 */
export function getEntityWorldPosition(state: MeshEntityState): Vector3 {
  return state.instance.root.position.clone();
}

/**
 * Dispose entity and free resources
 */
export function disposeMeshEntity(state: MeshEntityState): void {
  disposeInstance(state.instance);
}
