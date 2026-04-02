import type { CourseLayout, HoleShape, FeatureShape } from './course-layout';
import type { SerializedTopology } from './mesh-topology';
import {
  splineToBoundaryPolygon,
  makeEllipseBoundary,
  makeRectBoundary,
  pointInPolygon,
} from './spline-math';
import type { Point2D } from './spline-math';
import { getTerrainType, getTerrainDisplayName } from './terrain';

export interface NamedRegion {
  id: string;
  name: string;
  holeNumber: number;
  terrainCode: number;
  boundary: Point2D[];
  faceIds: number[];
}

interface ShapeEntry {
  id: string;
  holeNumber: number;
  terrainCode: number;
  label?: string;
  boundary: Point2D[];
}

function holeShapeToBoundary(hole: HoleShape): Point2D[] {
  return splineToBoundaryPolygon(
    hole.centerline,
    hole.centerline.map(p => p.widthLeft),
    hole.centerline.map(p => p.widthRight)
  );
}

function featureShapeToBoundary(feature: FeatureShape): Point2D[] {
  const p = feature.params;
  switch (p.type) {
    case 'ellipse':
      return makeEllipseBoundary(feature.center.x, feature.center.z, p.radiusX, p.radiusZ);
    case 'rectangle':
      return makeRectBoundary(feature.center.x, feature.center.z, p.width, p.height, p.rotation);
    case 'freeform':
      return [...p.boundary];
  }
}

function buildShapeEntries(layout: CourseLayout): ShapeEntry[] {
  const entries: ShapeEntry[] = [];
  for (const hole of layout.holes) {
    entries.push({
      id: hole.id,
      holeNumber: hole.holeNumber,
      terrainCode: hole.terrainCode,
      boundary: holeShapeToBoundary(hole),
    });
  }
  for (const feature of layout.features) {
    entries.push({
      id: feature.id,
      holeNumber: feature.holeNumber,
      terrainCode: feature.terrainCode,
      label: feature.label,
      boundary: featureShapeToBoundary(feature),
    });
  }
  return entries;
}

function generateRegionName(entry: ShapeEntry): string {
  if (entry.label) return entry.label;
  const terrainName = getTerrainDisplayName(getTerrainType(entry.terrainCode));
  if (entry.holeNumber > 0) return `${terrainName} ${entry.holeNumber}`;
  return terrainName;
}

export function deriveNamedRegions(
  layout: CourseLayout,
  topology: SerializedTopology
): NamedRegion[] {
  const entries = buildShapeEntries(layout);
  const regions: NamedRegion[] = entries.map(entry => ({
    id: entry.id,
    name: generateRegionName(entry),
    holeNumber: entry.holeNumber,
    terrainCode: entry.terrainCode,
    boundary: entry.boundary,
    faceIds: [],
  }));

  const vertMap = new Map<number, Point2D>();
  for (const v of topology.vertices) {
    vertMap.set(v.id, { x: v.position.x, z: v.position.z });
  }

  for (const tri of topology.triangles) {
    const v0 = vertMap.get(tri.vertices[0]);
    const v1 = vertMap.get(tri.vertices[1]);
    const v2 = vertMap.get(tri.vertices[2]);
    if (!v0 || !v1 || !v2) continue;

    const centroid: Point2D = {
      x: (v0.x + v1.x + v2.x) / 3,
      z: (v0.z + v1.z + v2.z) / 3,
    };

    for (let i = regions.length - 1; i >= 0; i--) {
      if (pointInPolygon(centroid, regions[i].boundary)) {
        regions[i].faceIds.push(tri.id);
        break;
      }
    }
  }

  return regions;
}

export function findRegionAtPosition(
  regions: NamedRegion[], x: number, z: number
): NamedRegion | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (pointInPolygon({ x, z }, regions[i].boundary)) {
      return regions[i];
    }
  }
  return null;
}

