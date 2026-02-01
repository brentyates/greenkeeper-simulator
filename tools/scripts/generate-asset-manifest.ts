/**
 * Generate asset manifest JSON for Blender tools
 *
 * This script exports the TypeScript asset manifest to JSON format
 * that can be read by Python Blender scripts.
 *
 * Run: npx ts-node tools/scripts/generate-asset-manifest.ts
 * Or via npm: npm run assets:manifest
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the manifest from the TypeScript source
import {
  ASSET_MANIFEST,
  TILE_SIZE,
  CHARACTER_HEIGHT,
  ASSET_COUNT,
} from "../../src/babylon/assets/AssetManifest.js";

// Output path for the generated JSON
const OUTPUT_PATH = path.join(__dirname, "../blender/asset_manifest.json");

// Convert the manifest to a format suitable for Python
interface PythonAssetSpec {
  path: string;
  height_range: [number, number];
  footprint: [number, number];
  origin: string;
  animations?: string[];
  notes: string;
}

const pythonManifest: Record<string, PythonAssetSpec> = {};

for (const [assetId, spec] of Object.entries(ASSET_MANIFEST)) {
  pythonManifest[assetId] = {
    path: spec.path,
    height_range: spec.heightRange,
    footprint: spec.footprint,
    origin: spec.origin,
    animations: spec.animations,
    notes: spec.notes,
  };
}

const output = {
  // Metadata
  _meta: {
    generated: new Date().toISOString(),
    source: "src/babylon/assets/AssetManifest.ts",
    asset_count: ASSET_COUNT,
  },
  // Constants
  constants: {
    tile_size: TILE_SIZE,
    character_height: CHARACTER_HEIGHT,
  },
  // Asset specs
  assets: pythonManifest,
};

// Ensure directory exists
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write JSON file
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

console.log(`Asset manifest generated: ${OUTPUT_PATH}`);
console.log(`Total assets: ${ASSET_COUNT}`);
