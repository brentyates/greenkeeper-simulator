import type { Point2D } from './spline-math';
import type { ObstacleData } from '../data/courseData';

export interface SplinePoint {
  x: number;
  z: number;
  widthLeft: number;
  widthRight: number;
}

export interface HoleShape {
  id: string;
  holeNumber: number;
  centerline: SplinePoint[];
  terrainCode: number;
  elevation?: number;
  elevationFn?: (x: number, z: number) => number;
}

export interface EllipseParams {
  type: 'ellipse';
  radiusX: number;
  radiusZ: number;
}

export interface RectangleParams {
  type: 'rectangle';
  width: number;
  height: number;
  rotation: number;
}

export interface FreeformParams {
  type: 'freeform';
  boundary: Point2D[];
}

export type FeatureParams = EllipseParams | RectangleParams | FreeformParams;

export interface FeatureShape {
  id: string;
  holeNumber: number;
  label?: string;
  terrainCode: number;
  center: Point2D;
  params: FeatureParams;
  elevation?: number;
  elevationFn?: (x: number, z: number) => number;
}

export interface CourseLayout {
  id: string;
  name: string;
  worldWidth: number;
  worldHeight: number;
  holes: HoleShape[];
  features: FeatureShape[];
  obstacles: ObstacleData[];
  backgroundTerrainCode: number;
  backgroundElevationFn?: (x: number, z: number) => number;
}
