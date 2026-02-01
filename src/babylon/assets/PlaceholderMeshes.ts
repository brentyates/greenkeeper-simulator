/**
 * PlaceholderMeshes - Generate simple meshes when GLB assets aren't available
 *
 * Allows development and testing without waiting for Blender assets.
 * These are simple geometric representations that match expected dimensions.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

import { AssetId } from "./AssetManifest";

// Define LoadedAsset here to avoid circular dependency with AssetLoader
export interface LoadedAsset {
  rootMesh: Mesh;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
}

/**
 * Color palette for placeholders
 */
const COLORS = {
  character: new Color3(0.2, 0.6, 0.3),      // Green (greenkeeper)
  employee: new Color3(0.5, 0.4, 0.3),       // Brown (worker)
  equipment: new Color3(0.7, 0.2, 0.2),      // Red
  pipe: new Color3(0.3, 0.5, 0.8),           // Blue
  sprinkler: new Color3(0.4, 0.7, 0.9),      // Light blue
  prop: new Color3(0.9, 0.8, 0.2),           // Yellow
  treeTrunk: new Color3(0.4, 0.25, 0.1),     // Brown bark
  treeLeaves: new Color3(0.15, 0.45, 0.15),  // Forest green
  shrub: new Color3(0.2, 0.5, 0.2),          // Bush green
};

// Tree size specs (matching asset_specs.py)
const TREE_SIZES: Record<string, { height: number; canopyRadius: number }> = {
  "tree.pine.small": { height: 3.5, canopyRadius: 0.7 },
  "tree.pine.medium": { height: 6.0, canopyRadius: 1.2 },
  "tree.pine.large": { height: 10.0, canopyRadius: 2.0 },
  "tree.oak.small": { height: 4.0, canopyRadius: 1.0 },
  "tree.oak.medium": { height: 7.5, canopyRadius: 2.0 },
  "tree.oak.large": { height: 12.0, canopyRadius: 3.0 },
  "tree.palm": { height: 6.0, canopyRadius: 1.5 },
  "tree.willow": { height: 6.5, canopyRadius: 2.0 },
  "tree.cypress": { height: 9.0, canopyRadius: 0.75 },
};

/**
 * Create a simple humanoid placeholder (capsule body + sphere head)
 */
function createCharacterPlaceholder(scene: Scene, name: string, color: Color3): Mesh {
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = color;
  mat.emissiveColor = color.scale(0.3);

  // Body (cylinder)
  const body = MeshBuilder.CreateCylinder(`${name}_body`, {
    height: 1.0,
    diameter: 0.4,
  }, scene);
  body.position.y = 0.5;

  // Head (sphere)
  const head = MeshBuilder.CreateSphere(`${name}_head`, {
    diameter: 0.35,
  }, scene);
  head.position.y = 1.15;

  // Merge into single mesh
  const merged = Mesh.MergeMeshes([body, head], true, true, undefined, false, true);
  if (merged) {
    merged.name = name;
    merged.material = mat;
    return merged;
  }

  body.material = mat;
  return body;
}

/**
 * Create a simple box placeholder for equipment
 */
function createEquipmentPlaceholder(scene: Scene, name: string): Mesh {
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = COLORS.equipment;
  mat.emissiveColor = COLORS.equipment.scale(0.3);

  // Mower-like shape
  const base = MeshBuilder.CreateBox(`${name}_base`, {
    width: 0.5,
    height: 0.3,
    depth: 0.8,
  }, scene);
  base.position.y = 0.2;

  // Handle
  const handle = MeshBuilder.CreateBox(`${name}_handle`, {
    width: 0.05,
    height: 0.8,
    depth: 0.05,
  }, scene);
  handle.position.set(0, 0.55, -0.35);

  const merged = Mesh.MergeMeshes([base, handle], true, true, undefined, false, true);
  if (merged) {
    merged.name = name;
    merged.material = mat;
    return merged;
  }

  base.material = mat;
  return base;
}

/**
 * Create a pipe segment placeholder
 */
function createPipePlaceholder(scene: Scene, name: string, type: string): Mesh {
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = COLORS.pipe;
  mat.emissiveColor = COLORS.pipe.scale(0.4);

  let mesh: Mesh;

  switch (type) {
    case "straight":
      mesh = MeshBuilder.CreateCylinder(name, {
        height: 1.0,
        diameter: 0.15,
      }, scene);
      mesh.rotation.x = Math.PI / 2;
      break;

    case "corner": {
      // L-shaped pipe
      const h = MeshBuilder.CreateCylinder(`${name}_h`, {
        height: 0.5,
        diameter: 0.15,
      }, scene);
      h.rotation.z = Math.PI / 2;
      h.position.x = 0.25;

      const v = MeshBuilder.CreateCylinder(`${name}_v`, {
        height: 0.5,
        diameter: 0.15,
      }, scene);
      v.rotation.x = Math.PI / 2;
      v.position.z = 0.25;

      mesh = Mesh.MergeMeshes([h, v], true, true, undefined, false, true) || h;
      break;
    }

    case "tee": {
      // T-shaped pipe
      const main = MeshBuilder.CreateCylinder(`${name}_main`, {
        height: 1.0,
        diameter: 0.15,
      }, scene);
      main.rotation.x = Math.PI / 2;

      const branch = MeshBuilder.CreateCylinder(`${name}_branch`, {
        height: 0.5,
        diameter: 0.15,
      }, scene);
      branch.rotation.z = Math.PI / 2;
      branch.position.x = 0.25;

      mesh = Mesh.MergeMeshes([main, branch], true, true, undefined, false, true) || main;
      break;
    }

    case "cross": {
      // + shaped pipe
      const horiz = MeshBuilder.CreateCylinder(`${name}_h`, {
        height: 1.0,
        diameter: 0.15,
      }, scene);
      horiz.rotation.z = Math.PI / 2;

      const vert = MeshBuilder.CreateCylinder(`${name}_v`, {
        height: 1.0,
        diameter: 0.15,
      }, scene);
      vert.rotation.x = Math.PI / 2;

      mesh = Mesh.MergeMeshes([horiz, vert], true, true, undefined, false, true) || horiz;
      break;
    }

    default:
      mesh = MeshBuilder.CreateBox(name, { size: 0.2 }, scene);
  }

  mesh.name = name;
  mesh.material = mat;
  return mesh;
}

/**
 * Create a tree placeholder (trunk + canopy)
 */
function createTreePlaceholder(scene: Scene, name: string, assetId: string): Mesh {
  const size = TREE_SIZES[assetId] || { height: 5, canopyRadius: 1.5 };
  const trunkHeight = size.height * 0.4;
  const canopyHeight = size.height * 0.6;

  const trunkMat = new StandardMaterial(`${name}_trunk_mat`, scene);
  trunkMat.diffuseColor = COLORS.treeTrunk;
  trunkMat.emissiveColor = COLORS.treeTrunk.scale(0.2);

  const leafMat = new StandardMaterial(`${name}_leaf_mat`, scene);
  leafMat.diffuseColor = COLORS.treeLeaves;
  leafMat.emissiveColor = COLORS.treeLeaves.scale(0.3);

  // Trunk
  const trunk = MeshBuilder.CreateCylinder(`${name}_trunk`, {
    height: trunkHeight,
    diameterTop: size.canopyRadius * 0.15,
    diameterBottom: size.canopyRadius * 0.25,
  }, scene);
  trunk.position.y = trunkHeight / 2;
  trunk.material = trunkMat;

  let canopy: Mesh;

  // Different canopy shapes based on tree type
  if (assetId.includes("pine") || assetId.includes("cypress")) {
    // Conical shape for pines/cypress
    canopy = MeshBuilder.CreateCylinder(`${name}_canopy`, {
      height: canopyHeight,
      diameterTop: 0,
      diameterBottom: size.canopyRadius * 2,
      tessellation: 8,
    }, scene);
  } else if (assetId.includes("palm")) {
    // Palm: sphere at top (simplified fronds)
    canopy = MeshBuilder.CreateSphere(`${name}_canopy`, {
      diameter: size.canopyRadius * 2,
      segments: 8,
    }, scene);
  } else {
    // Rounded/oak shape: sphere
    canopy = MeshBuilder.CreateSphere(`${name}_canopy`, {
      diameter: size.canopyRadius * 2,
      segments: 8,
    }, scene);
  }

  canopy.position.y = trunkHeight + canopyHeight / 2;
  canopy.material = leafMat;

  const merged = Mesh.MergeMeshes([trunk, canopy], true, false, undefined, false, true);
  if (merged) {
    merged.name = name;
    return merged;
  }

  trunk.dispose();
  canopy.name = name;
  return canopy;
}

/**
 * Create a shrub placeholder
 */
function createShrubPlaceholder(scene: Scene, name: string): Mesh {
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = COLORS.shrub;
  mat.emissiveColor = COLORS.shrub.scale(0.3);

  // Simple rounded bush shape
  const mesh = MeshBuilder.CreateSphere(name, {
    diameter: 1.0,
    segments: 6,
  }, scene);
  mesh.scaling.y = 0.7; // Flatten slightly
  mesh.position.y = 0.35;
  mesh.material = mat;

  return mesh;
}

/**
 * Create a sprinkler head placeholder
 */
function createSprinklerPlaceholder(scene: Scene, name: string): Mesh {
  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = COLORS.sprinkler;
  mat.emissiveColor = COLORS.sprinkler.scale(0.4);

  const base = MeshBuilder.CreateCylinder(`${name}_base`, {
    height: 0.1,
    diameter: 0.2,
  }, scene);

  const nozzle = MeshBuilder.CreateCylinder(`${name}_nozzle`, {
    height: 0.15,
    diameterTop: 0.05,
    diameterBottom: 0.1,
  }, scene);
  nozzle.position.y = 0.125;

  const mesh = Mesh.MergeMeshes([base, nozzle], true, true, undefined, false, true) || base;
  mesh.name = name;
  mesh.material = mat;
  return mesh;
}

/**
 * Create placeholder based on asset ID
 */
export function createPlaceholderAsset(scene: Scene, assetId: AssetId): LoadedAsset {
  let rootMesh: Mesh;

  if (assetId.startsWith("character.")) {
    const color = assetId.includes("employee") ? COLORS.employee : COLORS.character;
    rootMesh = createCharacterPlaceholder(scene, assetId, color);
  } else if (assetId.startsWith("tree.")) {
    rootMesh = createTreePlaceholder(scene, assetId, assetId);
  } else if (assetId.startsWith("shrub.")) {
    rootMesh = createShrubPlaceholder(scene, assetId);
  } else if (assetId.startsWith("equipment.")) {
    rootMesh = createEquipmentPlaceholder(scene, assetId);
  } else if (assetId.startsWith("irrigation.pipe")) {
    const type = assetId.split("-").pop() || "straight";
    rootMesh = createPipePlaceholder(scene, assetId, type);
  } else if (assetId.startsWith("irrigation.sprinkler")) {
    rootMesh = createSprinklerPlaceholder(scene, assetId);
  } else if (assetId.startsWith("irrigation.water")) {
    const mat = new StandardMaterial(`${assetId}_mat`, scene);
    mat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    mat.emissiveColor = mat.diffuseColor.scale(0.3);
    rootMesh = MeshBuilder.CreateBox(assetId, { width: 0.5, height: 0.4, depth: 0.5 }, scene);
    rootMesh.material = mat;
  } else {
    // Generic prop placeholder
    const mat = new StandardMaterial(`${assetId}_mat`, scene);
    mat.diffuseColor = COLORS.prop;
    mat.emissiveColor = COLORS.prop.scale(0.3);
    rootMesh = MeshBuilder.CreateBox(assetId, { size: 0.3 }, scene);
    rootMesh.material = mat;
  }

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
 * Note: In browser, this uses fetch to check
 */
export async function assetFileExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
