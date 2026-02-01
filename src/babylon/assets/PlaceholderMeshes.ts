/**
 * PlaceholderMeshes - Generate placeholder mesh when GLB assets aren't available
 *
 * Uses a single ugly magenta box for ALL assets.
 * This makes it obvious which assets need real Blender models.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

import { AssetId, getAssetSpec } from "./AssetManifest";

// Define LoadedAsset here to avoid circular dependency with AssetLoader
export interface LoadedAsset {
  rootMesh: Mesh;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
}

// Ugly placeholder color - obvious "missing asset" pink/magenta
const PLACEHOLDER_COLOR = new Color3(1.0, 0.0, 1.0);

/**
 * Create a single ugly placeholder box for any asset.
 * Uses the asset's footprint and height from the manifest.
 */
export function createPlaceholderAsset(
  scene: Scene,
  assetId: AssetId
): LoadedAsset {
  const spec = getAssetSpec(assetId);

  // Use middle of height range
  const height = (spec.heightRange[0] + spec.heightRange[1]) / 2;
  const [width, depth] = spec.footprint;

  // Create ugly magenta box
  const mat = new StandardMaterial(`${assetId}_placeholder_mat`, scene);
  mat.diffuseColor = PLACEHOLDER_COLOR;
  mat.emissiveColor = PLACEHOLDER_COLOR.scale(0.5);
  mat.wireframe = true; // Extra ugly

  const rootMesh = MeshBuilder.CreateBox(assetId, { width, height, depth }, scene);
  rootMesh.material = mat;

  // Position based on origin type
  if (spec.origin === "base_center") {
    rootMesh.position.y = height / 2;
  }
  // "center" origin: position.y = 0 (default)

  // Disable master mesh (we clone it)
  rootMesh.setEnabled(false);

  return {
    rootMesh,
    meshes: [rootMesh],
    animationGroups: [], // Placeholders have no animations
  };
}

/**
 * Check if a GLB file exists (for fallback logic)
 */
export async function assetFileExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
