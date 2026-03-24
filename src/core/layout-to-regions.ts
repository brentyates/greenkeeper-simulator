import type { CourseLayout, HoleShape, FeatureShape } from './course-layout';
import type { CourseData } from '../data/courseData';
import type { TerrainRegion, DelaunayTopologyOptions } from './delaunay-topology';
import { buildDelaunayTopology } from './delaunay-topology';
import {
  splineToBoundaryPolygon,
  makeEllipseBoundary,
  makeRectBoundary,
} from './spline-math';
import type { CourseHoleDefinition } from './hole-construction';

function holeShapeToRegion(hole: HoleShape): TerrainRegion {
  const leftWidths = hole.centerline.map(p => p.widthLeft);
  const rightWidths = hole.centerline.map(p => p.widthRight);
  const boundary = splineToBoundaryPolygon(
    hole.centerline, leftWidths, rightWidths
  );
  return {
    terrainCode: hole.terrainCode,
    boundary,
    elevation: hole.elevation,
    elevationFn: hole.elevationFn,
  };
}

function featureShapeToRegion(feature: FeatureShape): TerrainRegion {
  let boundary;
  const p = feature.params;
  switch (p.type) {
    case 'ellipse':
      boundary = makeEllipseBoundary(
        feature.center.x, feature.center.z, p.radiusX, p.radiusZ
      );
      break;
    case 'rectangle':
      boundary = makeRectBoundary(
        feature.center.x, feature.center.z, p.width, p.height, p.rotation
      );
      break;
    case 'freeform':
      boundary = [...p.boundary];
      break;
  }
  return {
    terrainCode: feature.terrainCode,
    boundary,
    elevation: feature.elevation,
    elevationFn: feature.elevationFn,
  };
}

export function courseLayoutToRegions(layout: CourseLayout): TerrainRegion[] {
  const regions: TerrainRegion[] = [];
  for (const hole of layout.holes) {
    regions.push(holeShapeToRegion(hole));
  }
  for (const feature of layout.features) {
    regions.push(featureShapeToRegion(feature));
  }
  return regions;
}

export function courseLayoutToTopologyOptions(layout: CourseLayout): DelaunayTopologyOptions {
  return {
    worldWidth: layout.worldWidth,
    worldHeight: layout.worldHeight,
    regions: courseLayoutToRegions(layout),
    backgroundTerrainCode: layout.backgroundTerrainCode,
    backgroundElevationFn: layout.backgroundElevationFn,
    boundaryPointSpacing: 1.0,
    fillPointSpacing: 2.5,
  };
}

export function courseLayoutToTopology(layout: CourseLayout) {
  return buildDelaunayTopology(courseLayoutToTopologyOptions(layout));
}

function deriveHoleDefinitions(layout: CourseLayout): CourseHoleDefinition[] {
  const holeNumbers = new Set<number>();
  for (const hole of layout.holes) holeNumbers.add(hole.holeNumber);
  for (const feature of layout.features) holeNumbers.add(feature.holeNumber);

  const definitions: CourseHoleDefinition[] = [];
  for (const holeNum of [...holeNumbers].sort((a, b) => a - b)) {
    if (holeNum <= 0) continue;
    const tees = layout.features.filter(
      f => f.holeNumber === holeNum && f.terrainCode === 5
    );
    const greens = layout.features.filter(
      f => f.holeNumber === holeNum && f.terrainCode === 2
    );

    definitions.push({
      holeNumber: holeNum,
      teeBoxes: tees.map(t => ({
        assetId: 'course.tee.marker.blue',
        x: t.center.x,
        y: t.elevation ?? 0,
        z: t.center.z,
        rotation: 0 as const,
        teeSet: 'championship' as const,
        yardageToPrimaryPin: 0,
      })),
      pinPositions: greens.map((g, i) => ({
        assetId: 'course.flag',
        x: g.center.x,
        y: g.elevation ?? 0,
        z: g.center.z,
        rotation: 0 as const,
        isPrimary: i === 0,
      })),
      yardages: {},
      playable: tees.length > 0 && greens.length > 0,
      validationIssues: [],
    });
  }
  return definitions;
}

export function courseLayoutToCourseData(layout: CourseLayout): CourseData {
  const topology = courseLayoutToTopology(layout);
  const holes = deriveHoleDefinitions(layout);
  const par = holes.length * 4;
  return {
    name: layout.name,
    width: layout.worldWidth,
    height: layout.worldHeight,
    par,
    topology,
    obstacles: layout.obstacles,
    holes,
    layout,
  };
}
