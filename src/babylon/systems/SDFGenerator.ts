/**
 * SDFGenerator - Generates Signed Distance Field textures from vector shapes
 *
 * Creates high-resolution SDF textures that enable pixel-perfect smooth
 * terrain edges in the shader. Each terrain type gets its own SDF channel.
 */

import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";

import {
  VectorShape,
  TerrainShapeType,
  sampleSpline,
  signedDistanceToPolygon,
} from "../../core/vector-shapes";

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

/**
 * Generate SDF textures from vector shapes
 */
export function generateSDFTextures(
  scene: Scene,
  shapes: VectorShape[],
  worldWidth: number,
  worldHeight: number,
  options: Partial<SDFGeneratorOptions> = {}
): SDFTextureSet {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const texWidth = Math.ceil(worldWidth * opts.resolution);
  const texHeight = Math.ceil(worldHeight * opts.resolution);
  const scale = 1 / opts.resolution;

  // Group shapes by type
  const shapesByType = groupShapesByType(shapes);

  // Generate polygons from splines
  const polygonsByType = new Map<TerrainShapeType, Array<Array<{ x: number; y: number }>>>();

  for (const [type, typeShapes] of shapesByType) {
    const polygons = typeShapes.map(shape =>
      sampleSpline(shape.points, shape.closed, opts.splineSamples)
    );
    polygonsByType.set(type, polygons);
  }

  // Generate combined RGBA texture (fairway, green, bunker, water)
  const combinedData = new Uint8Array(texWidth * texHeight * 4);

  // Generate tee texture (single channel, stored as RGBA for compatibility)
  const teeData = new Uint8Array(texWidth * texHeight * 4);

  // Process each pixel
  for (let py = 0; py < texHeight; py++) {
    for (let px = 0; px < texWidth; px++) {
      // Convert pixel to world coordinates
      const worldX = (px + 0.5) * scale;
      const worldY = (py + 0.5) * scale;

      const idx = (py * texWidth + px) * 4;

      // Calculate SDF for each terrain type
      const fairwayDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('fairway'));
      const greenDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('green'));
      const bunkerDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('bunker'));
      const waterDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('water'));
      const teeDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('tee'));

      // Encode distances to 0-255 range
      // 128 = on the edge, <128 = inside, >128 = outside
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
 * Update existing SDF textures when shapes change
 */
export function updateSDFTextures(
  textureSet: SDFTextureSet,
  shapes: VectorShape[],
  _worldWidth: number,
  _worldHeight: number,
  options: Partial<SDFGeneratorOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width: texWidth, height: texHeight, scale } = textureSet;

  // Group shapes by type
  const shapesByType = groupShapesByType(shapes);

  // Generate polygons from splines
  const polygonsByType = new Map<TerrainShapeType, Array<Array<{ x: number; y: number }>>>();

  for (const [type, typeShapes] of shapesByType) {
    const polygons = typeShapes.map(shape =>
      sampleSpline(shape.points, shape.closed, opts.splineSamples)
    );
    polygonsByType.set(type, polygons);
  }

  // Generate new texture data
  const combinedData = new Uint8Array(texWidth * texHeight * 4);
  const teeData = new Uint8Array(texWidth * texHeight * 4);

  for (let py = 0; py < texHeight; py++) {
    for (let px = 0; px < texWidth; px++) {
      const worldX = (px + 0.5) * scale;
      const worldY = (py + 0.5) * scale;
      const idx = (py * texWidth + px) * 4;

      const fairwayDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('fairway'));
      const greenDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('green'));
      const bunkerDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('bunker'));
      const waterDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('water'));
      const teeDist = getMinSignedDistance(worldX, worldY, polygonsByType.get('tee'));

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
 * Group shapes by terrain type
 */
function groupShapesByType(
  shapes: VectorShape[]
): Map<TerrainShapeType, VectorShape[]> {
  const result = new Map<TerrainShapeType, VectorShape[]>();

  for (const shape of shapes) {
    const list = result.get(shape.type) || [];
    list.push(shape);
    result.set(shape.type, list);
  }

  return result;
}

/**
 * Get minimum signed distance to any polygon of a type
 * For union of shapes: negative if inside ANY shape, positive only if outside ALL
 */
function getMinSignedDistance(
  x: number,
  y: number,
  polygons: Array<Array<{ x: number; y: number }>> | undefined
): number {
  if (!polygons || polygons.length === 0) {
    return Infinity; // No shapes of this type
  }

  let minInsideDist = Infinity;  // Smallest distance when inside (will be negated)
  let minOutsideDist = Infinity; // Smallest distance when outside all shapes
  let isInsideAny = false;

  for (const polygon of polygons) {
    if (polygon.length < 3) continue;

    const dist = signedDistanceToPolygon(x, y, polygon);

    if (dist < 0) {
      // Inside this polygon
      isInsideAny = true;
      // Track the minimum distance to edge while inside
      minInsideDist = Math.min(minInsideDist, Math.abs(dist));
    } else {
      // Outside this polygon - track for case where we're outside all
      minOutsideDist = Math.min(minOutsideDist, dist);
    }
  }

  // If inside any shape, return negative distance (closest edge while inside)
  // Otherwise return positive distance to nearest shape
  return isInsideAny ? -minInsideDist : minOutsideDist;
}

/**
 * Encode signed distance to 0-255 range
 * 128 = edge (distance 0)
 * 0 = fully inside (distance = -maxDistance)
 * 255 = fully outside (distance = +maxDistance)
 */
function encodeDistance(distance: number, maxDistance: number): number {
  // Handle Infinity (no shapes of this type) - treat as max distance outside
  if (!isFinite(distance)) {
    return 255;
  }
  // Clamp to range
  const clamped = Math.max(-maxDistance, Math.min(maxDistance, distance));
  // Map to 0-255
  const normalized = (clamped / maxDistance + 1) / 2;
  return Math.round(normalized * 255);
}

/**
 * Decode 0-255 value back to signed distance
 */
export function decodeDistance(value: number, maxDistance: number): number {
  const normalized = value / 255;
  return (normalized * 2 - 1) * maxDistance;
}

/**
 * Create a debug visualization of the SDF texture
 */
export function createSDFDebugCanvas(
  textureSet: SDFTextureSet,
  channel: 'r' | 'g' | 'b' | 'a' = 'r'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = textureSet.width;
  canvas.height = textureSet.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.createImageData(textureSet.width, textureSet.height);

  // Read texture data (this is a simplified version - actual implementation
  // would need to read from GPU)
  // Channel index mapping
  const channelIndex = { 'r': 0, 'g': 1, 'b': 2, 'a': 3 }[channel];
  void channelIndex; // Mark as used - actual implementation would use this

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Async version of SDF generation for large courses
 * Uses Web Workers if available for parallel computation
 */
export async function generateSDFTexturesAsync(
  scene: Scene,
  shapes: VectorShape[],
  worldWidth: number,
  worldHeight: number,
  options: Partial<SDFGeneratorOptions> = {},
  onProgress?: (progress: number) => void
): Promise<SDFTextureSet> {
  // For now, just wrap the synchronous version
  // A full implementation would use Web Workers for parallel SDF computation
  return new Promise((resolve) => {
    // Simulate async with setTimeout to not block UI
    setTimeout(() => {
      const result = generateSDFTextures(scene, shapes, worldWidth, worldHeight, options);
      onProgress?.(1);
      resolve(result);
    }, 0);
  });
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

