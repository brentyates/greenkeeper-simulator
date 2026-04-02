/**
 * EntityVisualSystem - 3D mesh-based entity rendering
 *
 * Renders entities as 3D meshes loaded via AssetLoader.
 * Handles smooth movement interpolation and rotation to face movement direction.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { gridTo3D } from "../engine/BabylonEngine";
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

export const EMPLOYEE_APPEARANCE: EntityAppearance = {
  assetId: "character.employee",
  scale: 1.8,
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
    .catch(() => {

    });

  return state;
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
