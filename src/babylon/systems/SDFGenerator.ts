import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";

export interface SDFTextureSet {
  // Combined RGBA texture: R=fairway, G=green, B=bunker, A=water
  combined: RawTexture;
  // Separate texture for tee boxes (less common, can share channel)
  tee: RawTexture;
  // Resolution of the textures
  width: number;
  height: number;
  // World units per pixel
  scale: number;
}

export interface SDFGeneratorOptions {
  /** Resolution multiplier (e.g., 4 = 4 pixels per world unit) */
  resolution: number;
  /** Maximum distance to encode (in world units) */
  maxDistance: number;
  /** Samples per spline segment for polygon generation */
  splineSamples: number;
}

const DEFAULT_OPTIONS: SDFGeneratorOptions = {
  resolution: 4,      // 4 pixels per world unit
  maxDistance: 5,     // Encode distances up to 5 units
  splineSamples: 16,  // Smooth spline sampling
};

function encodeDistance(distance: number, maxDistance: number): number {
  if (!isFinite(distance)) {
    return 255;
  }
  const clamped = Math.max(-maxDistance, Math.min(maxDistance, distance));
  const normalized = (clamped / maxDistance + 1) / 2;
  return Math.round(normalized * 255);
}

/**
 * Terrain type codes matching the grid layout
 */
export type GridTerrainCode = 0 | 1 | 2 | 3 | 4 | 5;
export const GRID_TERRAIN = {
  FAIRWAY: 0 as GridTerrainCode,
  ROUGH: 1 as GridTerrainCode,
  GREEN: 2 as GridTerrainCode,
  BUNKER: 3 as GridTerrainCode,
  WATER: 4 as GridTerrainCode,
  TEE: 5 as GridTerrainCode,
};

/**
 * Generate SDF textures directly from grid layout
 * This bypasses vector shape conversion and works reliably for any grid shape
 */
export function generateSDFFromGrid(
  scene: Scene,
  layout: number[][],
  worldWidth: number,
  worldHeight: number,
  options: Partial<SDFGeneratorOptions> = {}
): SDFTextureSet {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const texWidth = Math.ceil(worldWidth * opts.resolution);
  const texHeight = Math.ceil(worldHeight * opts.resolution);
  const scale = 1 / opts.resolution;

  // Generate combined RGBA texture (fairway, green, bunker, water)
  const combinedData = new Uint8Array(texWidth * texHeight * 4);

  // Generate tee texture (single channel, stored as RGBA for compatibility)
  const teeData = new Uint8Array(texWidth * texHeight * 4);

  // Pre-compute which cells are which terrain type for fast lookup
  const gridHeight = layout.length;
  const gridWidth = layout[0]?.length || 0;

  // Process each pixel
  for (let py = 0; py < texHeight; py++) {
    for (let px = 0; px < texWidth; px++) {
      // Convert pixel to world coordinates
      const worldX = (px + 0.5) * scale;
      const worldY = (py + 0.5) * scale;

      const idx = (py * texWidth + px) * 4;

      const resX = gridWidth / worldWidth;
      const resY = gridHeight / worldHeight;

      // Calculate SDF for each terrain type from grid
      const fairwayDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.FAIRWAY, opts.maxDistance, resX, resY);
      const greenDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.GREEN, opts.maxDistance, resX, resY);
      const bunkerDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.BUNKER, opts.maxDistance, resX, resY);
      const waterDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.WATER, opts.maxDistance, resX, resY);
      const teeDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.TEE, opts.maxDistance, resX, resY);

      // Encode distances to 0-255 range
      combinedData[idx + 0] = encodeDistance(fairwayDist, opts.maxDistance);
      combinedData[idx + 1] = encodeDistance(greenDist, opts.maxDistance);
      combinedData[idx + 2] = encodeDistance(bunkerDist, opts.maxDistance);
      combinedData[idx + 3] = encodeDistance(waterDist, opts.maxDistance);

      // Tee texture (use R channel, fill others for visibility)
      teeData[idx + 0] = encodeDistance(teeDist, opts.maxDistance);
      teeData[idx + 1] = 0;
      teeData[idx + 2] = 0;
      teeData[idx + 3] = 255;
    }
  }

  // Create Babylon.js textures
  const combined = RawTexture.CreateRGBATexture(
    combinedData,
    texWidth,
    texHeight,
    scene,
    false,  // generateMipMaps
    false,  // invertY
    Engine.TEXTURE_BILINEAR_SAMPLINGMODE
  );
  combined.name = "sdfCombined";
  combined.wrapU = RawTexture.CLAMP_ADDRESSMODE;
  combined.wrapV = RawTexture.CLAMP_ADDRESSMODE;

  const tee = RawTexture.CreateRGBATexture(
    teeData,
    texWidth,
    texHeight,
    scene,
    false,
    false,
    Engine.TEXTURE_BILINEAR_SAMPLINGMODE
  );
  tee.name = "sdfTee";
  tee.wrapU = RawTexture.CLAMP_ADDRESSMODE;
  tee.wrapV = RawTexture.CLAMP_ADDRESSMODE;

  return {
    combined,
    tee,
    width: texWidth,
    height: texHeight,
    scale,
  };
}

/**
 * Update SDF textures from grid layout
 */
export function updateSDFFromGrid(
  textureSet: SDFTextureSet,
  layout: number[][],
  _worldWidth: number,
  _worldHeight: number,
  options: Partial<SDFGeneratorOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width: texWidth, height: texHeight, scale } = textureSet;

  const gridHeight = layout.length;
  const gridWidth = layout[0]?.length || 0;

  // Generate new texture data
  const combinedData = new Uint8Array(texWidth * texHeight * 4);
  const teeData = new Uint8Array(texWidth * texHeight * 4);

  for (let py = 0; py < texHeight; py++) {
    for (let px = 0; px < texWidth; px++) {
      const worldX = (px + 0.5) * scale;
      const worldY = (py + 0.5) * scale;
      const idx = (py * texWidth + px) * 4;

      const resX = gridWidth / _worldWidth;
      const resY = gridHeight / _worldHeight;

      const fairwayDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.FAIRWAY, opts.maxDistance, resX, resY);
      const greenDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.GREEN, opts.maxDistance, resX, resY);
      const bunkerDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.BUNKER, opts.maxDistance, resX, resY);
      const waterDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.WATER, opts.maxDistance, resX, resY);
      const teeDist = getGridSignedDistance(worldX, worldY, layout, gridWidth, gridHeight, GRID_TERRAIN.TEE, opts.maxDistance, resX, resY);

      combinedData[idx + 0] = encodeDistance(fairwayDist, opts.maxDistance);
      combinedData[idx + 1] = encodeDistance(greenDist, opts.maxDistance);
      combinedData[idx + 2] = encodeDistance(bunkerDist, opts.maxDistance);
      combinedData[idx + 3] = encodeDistance(waterDist, opts.maxDistance);

      teeData[idx + 0] = encodeDistance(teeDist, opts.maxDistance);
      teeData[idx + 1] = 0;
      teeData[idx + 2] = 0;
      teeData[idx + 3] = 255;
    }
  }

  // Update textures
  textureSet.combined.update(combinedData);
  textureSet.tee.update(teeData);
}

/**
 * Compute signed distance to a terrain type from grid layout
 * Uses a search radius to find nearest cells of the target type
 */
function getGridSignedDistance(
  worldX: number,
  worldY: number,
  layout: number[][],
  gridWidth: number,
  gridHeight: number,
  targetType: GridTerrainCode,
  maxDistance: number,
  resX: number = 1,
  resY: number = 1
): number {
  // Get the grid cell we're in
  const cellX = Math.floor(worldX * resX);
  const cellY = Math.floor(worldY * resY);

  // Check if current cell is the target type
  const currentType = layout[cellY]?.[cellX] ?? GRID_TERRAIN.ROUGH;
  const isInside = currentType === targetType;

  let minDist = maxDistance;
  const searchRadiusX = Math.ceil(maxDistance * resX);
  const searchRadiusY = Math.ceil(maxDistance * resY);

  for (let dy = -searchRadiusY; dy <= searchRadiusY; dy++) {
    for (let dx = -searchRadiusX; dx <= searchRadiusX; dx++) {
      const nx = cellX + dx;
      const ny = cellY + dy;

      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        const neighborType = layout[ny][nx];
        const neighborIsTarget = neighborType === targetType;

        if (neighborIsTarget !== isInside) {
          // Boundary cell found. Calculate distance to nearest cell edge/center.
          // For smoothness, we measure distance to the cell center of the nearest differing cell.
          const centerX = (nx + 0.5) / resX;
          const centerY = (ny + 0.5) / resY;
          const dist = Math.sqrt((worldX - centerX) ** 2 + (worldY - centerY) ** 2);
          if (dist < minDist) minDist = dist;
        }
      }
    }
  }

  return isInside ? -minDist : minDist;
}

