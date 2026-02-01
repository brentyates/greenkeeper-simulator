/**
 * AssetLoader - Centralized GLB/GLTF asset loading with caching
 *
 * Handles loading Blender-exported models with:
 * - Automatic caching of loaded assets
 * - Clone support for instancing
 * - Animation group management
 * - Consistent material setup for isometric style
 */

import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/loaders/glTF";

import { createPlaceholderAsset, assetFileExists } from "./PlaceholderMeshes";

export interface LoadedAsset {
  rootMesh: Mesh;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
}

export interface AssetInstance {
  root: Mesh;
  meshes: AbstractMesh[];
  animations: Map<string, AnimationGroup>;
}

// Cache for loaded master assets
const assetCache = new Map<string, LoadedAsset>();

// Asset manifest - maps logical names to file paths
export const ASSET_MANIFEST = {
  // Characters
  "character.greenkeeper": "/assets/models/characters/greenkeeper.glb",
  "character.employee": "/assets/models/characters/employee.glb",

  // Trees
  "tree.pine.small": "/assets/models/trees/pine_small.glb",
  "tree.pine.medium": "/assets/models/trees/pine_medium.glb",
  "tree.pine.large": "/assets/models/trees/pine_large.glb",
  "tree.oak.small": "/assets/models/trees/oak_small.glb",
  "tree.oak.medium": "/assets/models/trees/oak_medium.glb",
  "tree.oak.large": "/assets/models/trees/oak_large.glb",
  "tree.palm": "/assets/models/trees/palm.glb",
  "tree.willow": "/assets/models/trees/willow.glb",
  "tree.cypress": "/assets/models/trees/cypress.glb",

  // Shrubs
  "shrub.hedge": "/assets/models/shrubs/hedge.glb",
  "shrub.flowering": "/assets/models/shrubs/flowering.glb",

  // Equipment
  "equipment.mower": "/assets/models/equipment/mower.glb",
  "equipment.spreader": "/assets/models/equipment/spreader.glb",
  "equipment.sprinkler-handheld": "/assets/models/equipment/sprinkler_handheld.glb",

  // Irrigation
  "irrigation.pipe-straight": "/assets/models/irrigation/pipe_straight.glb",
  "irrigation.pipe-corner": "/assets/models/irrigation/pipe_corner.glb",
  "irrigation.pipe-tee": "/assets/models/irrigation/pipe_tee.glb",
  "irrigation.pipe-cross": "/assets/models/irrigation/pipe_cross.glb",
  "irrigation.sprinkler-head": "/assets/models/irrigation/sprinkler_head.glb",
  "irrigation.water-source": "/assets/models/irrigation/water_source.glb",

  // Props
  "prop.flag": "/assets/models/props/flag.glb",
  "prop.tee-marker": "/assets/models/props/tee_marker.glb",
  "prop.ball": "/assets/models/props/ball.glb",
  "prop.bench": "/assets/models/props/bench.glb",
  "prop.trash-bin": "/assets/models/props/trash_bin.glb",
  "prop.ball-washer": "/assets/models/props/ball_washer.glb",
} as const;

export type AssetId = keyof typeof ASSET_MANIFEST;

/**
 * Load a GLB asset from the manifest
 * Falls back to placeholder meshes if GLB file doesn't exist
 * Caches the result for future cloning
 */
export async function loadAsset(
  scene: Scene,
  assetId: AssetId,
  usePlaceholder: boolean = true
): Promise<LoadedAsset> {
  const cached = assetCache.get(assetId);
  if (cached) {
    return cached;
  }

  const path = ASSET_MANIFEST[assetId];

  // Check if GLB file exists, fallback to placeholder if not
  const fileExists = await assetFileExists(path);
  if (!fileExists) {
    if (usePlaceholder) {
      console.log(`[AssetLoader] GLB not found: ${path}, using placeholder`);
      const placeholder = createPlaceholderAsset(scene, assetId);
      assetCache.set(assetId, placeholder);
      return placeholder;
    } else {
      throw new Error(`Asset file not found: ${path}`);
    }
  }

  const directory = path.substring(0, path.lastIndexOf("/") + 1);
  const filename = path.substring(path.lastIndexOf("/") + 1);

  const result = await SceneLoader.ImportMeshAsync("", directory, filename, scene);

  // Find or create root mesh
  let rootMesh: Mesh;
  if (result.meshes.length === 1) {
    rootMesh = result.meshes[0] as Mesh;
  } else {
    // Create container for multi-mesh assets
    rootMesh = new Mesh(`${assetId}_root`, scene);
    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = rootMesh;
      }
    }
  }

  // Disable the master - we only use clones
  rootMesh.setEnabled(false);

  // Convert PBR materials to StandardMaterial for consistent isometric look
  for (const mesh of result.meshes) {
    if (mesh.material instanceof PBRMaterial) {
      const pbr = mesh.material;
      const std = new StandardMaterial(`${mesh.material.name}_std`, scene);
      std.diffuseColor = pbr.albedoColor || std.diffuseColor;
      std.emissiveColor = (pbr.emissiveColor || std.diffuseColor).scale(0.3);
      std.specularColor = std.diffuseColor.scale(0.1);
      mesh.material = std;
    }
  }

  const asset: LoadedAsset = {
    rootMesh,
    meshes: result.meshes,
    animationGroups: result.animationGroups,
  };

  assetCache.set(assetId, asset);
  return asset;
}

/**
 * Create an instance (clone) of a loaded asset
 * Use this for placing multiple copies of the same model
 */
export function createInstance(
  _scene: Scene,
  asset: LoadedAsset,
  instanceId: string
): AssetInstance {
  const root = asset.rootMesh.clone(`${instanceId}_root`, null) as Mesh;
  root.setEnabled(true);

  const meshes: AbstractMesh[] = [root];

  // Clone child meshes
  for (const sourceMesh of asset.meshes) {
    if (sourceMesh !== asset.rootMesh && sourceMesh.parent === asset.rootMesh) {
      const clone = sourceMesh.clone(`${instanceId}_${sourceMesh.name}`, root);
      if (clone) {
        meshes.push(clone);
      }
    }
  }

  // Clone animation groups targeting the new meshes
  const animations = new Map<string, AnimationGroup>();
  for (const sourceGroup of asset.animationGroups) {
    const clonedGroup = sourceGroup.clone(
      `${instanceId}_${sourceGroup.name}`,
      (target) => {
        // Retarget animations to cloned meshes
        const originalName = (target as AbstractMesh).name;
        return meshes.find(m => m.name.endsWith(originalName)) || target;
      }
    );
    animations.set(sourceGroup.name, clonedGroup);
  }

  return { root, meshes, animations };
}

/**
 * Preload multiple assets in parallel
 * Call this during game initialization
 */
export async function preloadAssets(
  scene: Scene,
  assetIds: AssetId[]
): Promise<void> {
  await Promise.all(assetIds.map(id => loadAsset(scene, id)));
}

/**
 * Check if an asset exists in the manifest
 */
export function hasAsset(assetId: string): assetId is AssetId {
  return assetId in ASSET_MANIFEST;
}

/**
 * Clear the asset cache (useful for scene disposal)
 */
export function clearAssetCache(): void {
  for (const asset of assetCache.values()) {
    asset.rootMesh.dispose();
    for (const group of asset.animationGroups) {
      group.dispose();
    }
  }
  assetCache.clear();
}

/**
 * Dispose a single asset instance
 */
export function disposeInstance(instance: AssetInstance): void {
  for (const [, group] of instance.animations) {
    group.dispose();
  }
  instance.root.dispose();
}
