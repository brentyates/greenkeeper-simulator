import { ShapeTemplate } from '../core/shape-templates';
import { TERRAIN_CODES } from '../core/terrain';

export const CIRCLE_SHAPE: ShapeTemplate = {
  name: 'Circle',
  shape: 'circle',
  rings: [
    { radiusFraction: 1.0, pointCount: 24, terrainCode: TERRAIN_CODES.ROUGH },
    { radiusFraction: 0.75, pointCount: 16, terrainCode: TERRAIN_CODES.BUNKER },
  ],
  baseRadius: 3,
  centerTerrainCode: TERRAIN_CODES.BUNKER,
};

export const OVAL_SHAPE: ShapeTemplate = {
  name: 'Oval',
  shape: 'oval',
  rings: [
    { radiusFraction: 1.0, pointCount: 26, terrainCode: TERRAIN_CODES.ROUGH },
    { radiusFraction: 0.78, pointCount: 18, terrainCode: TERRAIN_CODES.BUNKER },
  ],
  baseRadius: 3.5,
  aspectX: 1.5,
  aspectZ: 0.85,
  centerTerrainCode: TERRAIN_CODES.BUNKER,
};

export const KIDNEY_SHAPE: ShapeTemplate = {
  name: 'Kidney',
  shape: 'kidney',
  rings: [
    { radiusFraction: 1.0, pointCount: 28, terrainCode: TERRAIN_CODES.ROUGH },
    { radiusFraction: 0.78, pointCount: 20, terrainCode: TERRAIN_CODES.BUNKER },
  ],
  baseRadius: 3.5,
  aspectX: 1.3,
  aspectZ: 1.0,
  kidneyStrength: 0.9,
  centerTerrainCode: TERRAIN_CODES.BUNKER,
};

export const RECTANGLE_SHAPE: ShapeTemplate = {
  name: 'Rectangle',
  shape: 'rectangle',
  rings: [
    { radiusFraction: 1.0, pointCount: 24, terrainCode: TERRAIN_CODES.ROUGH },
    { radiusFraction: 0.8, pointCount: 20, terrainCode: TERRAIN_CODES.BUNKER },
  ],
  baseRadius: 3,
  aspectX: 1.6,
  aspectZ: 0.9,
  centerTerrainCode: TERRAIN_CODES.BUNKER,
};

export const BUILT_IN_TEMPLATES: ShapeTemplate[] = [
  CIRCLE_SHAPE,
  OVAL_SHAPE,
  KIDNEY_SHAPE,
  RECTANGLE_SHAPE,
];
