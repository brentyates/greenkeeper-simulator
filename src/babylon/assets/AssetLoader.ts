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

import { createPlaceholderAsset, assetFileExists, LoadedAsset } from "./PlaceholderMeshes";
import { ASSET_MANIFEST, AssetId, getAssetPath } from "./AssetManifest";

// Re-export for convenience
export { ASSET_MANIFEST, getAssetPath, getAssetSpec, getAssetsByCategory } from "./AssetManifest";
export type { AssetId, AssetSpec } from "./AssetManifest";
export type { LoadedAsset } from "./PlaceholderMeshes";

export interface AssetInstance {
  root: Mesh;
  meshes: AbstractMesh[];
  animations: Map<string, AnimationGroup>;
}

// Cache for loading/loaded assets - stores Promises to prevent duplicate loads
const assetCache = new Map<string, Promise<LoadedAsset>>();

/**
 * Load a GLB asset from the manifest
 * Falls back to placeholder meshes if GLB file doesn't exist
 * Caches the Promise to prevent duplicate simultaneous loads
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

  // Cache the promise immediately to prevent duplicate loads
  const loadPromise = loadAssetInternal(scene, assetId, usePlaceholder);
  assetCache.set(assetId, loadPromise);

  // If loading fails, remove from cache so it can be retried
  loadPromise.catch(() => {
    assetCache.delete(assetId);
  });

  return loadPromise;
}

/**
 * Internal asset loading implementation
 */
async function loadAssetInternal(
  scene: Scene,
  assetId: AssetId,
  usePlaceholder: boolean
): Promise<LoadedAsset> {

  const path = getAssetPath(assetId);

  // Check if GLB file exists, fallback to placeholder if not
  const fileExists = await assetFileExists(path);
  if (!fileExists) {
    if (usePlaceholder) {
      console.log(`[AssetLoader] GLB not found: ${path}, using placeholder`);
      return createPlaceholderAsset(scene, assetId);
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

  return {
    rootMesh,
    meshes: result.meshes,
    animationGroups: result.animationGroups,
  };
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
export async function clearAssetCache(): Promise<void> {
  // Wait for all pending loads to complete, then dispose
  const assets = await Promise.all(
    Array.from(assetCache.values()).map(p => p.catch(() => null))
  );

  for (const asset of assets) {
    if (asset) {
      asset.rootMesh.dispose();
      for (const group of asset.animationGroups) {
        group.dispose();
      }
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
