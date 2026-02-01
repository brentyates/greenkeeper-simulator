/**
 * PlaceholderMeshes - Generate simple meshes when GLB assets aren't available
 *
 * Allows development and testing without waiting for Blender assets.
 * These are simple geometric representations that match expected dimensions.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { LoadedAsset, AssetId } from "./AssetLoader";

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
