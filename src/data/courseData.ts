import { TerrainType, ObstacleType } from '../core/terrain';
import { SerializedTopology } from '../core/mesh-topology';
import { buildDelaunayTopology } from '../core/delaunay-topology';
import { loadCustomCourse, customCourseToCourseData } from './customCourseData';
import type { CourseHoleDefinition } from '../core/hole-construction';
import type { CourseLayout } from '../core/course-layout';

export type { TerrainType, ObstacleType };

export interface ObstacleData {
  x: number;
  y: number;
  type: number;
}

export interface CourseData {
  name: string;
  width: number;
  height: number;
  par: number;
  obstacles?: ObstacleData[];
  holes?: CourseHoleDefinition[];
  topology: SerializedTopology;
  layout?: CourseLayout;
}

const F = 0;
const R = 1;
const G = 2;
const B = 3;
const W = 4;
const T = 5;

// ============================================================================
// POLYGON HELPERS
// ============================================================================

function makeEllipse(
  cx: number, cz: number, rx: number, rz: number, n = 24
): Array<{ x: number; z: number }> {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + Math.cos(2 * Math.PI * i / n) * rx,
    z: cz + Math.sin(2 * Math.PI * i / n) * rz,
  }));
}

function makeRect(
  x1: number, z1: number, x2: number, z2: number
): Array<{ x: number; z: number }> {
  return [
    { x: x1, z: z1 }, { x: x2, z: z1 },
    { x: x2, z: z2 }, { x: x1, z: z2 },
  ];
}

// ============================================================================
// ELEVATION
// ============================================================================

function calcMound(
  x: number, z: number,
  cx: number, cz: number,
  innerR: number, outerR: number, peak: number
): number {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > outerR) return 0;
  if (dist <= innerR) return peak;
  const t = (dist - innerR) / (outerR - innerR);
  return peak * (1 - t * t);
}

function calcBowl(
  x: number, z: number,
  cx: number, cz: number,
  innerR: number, outerR: number, depth: number
): number {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > outerR) return 0;
  if (dist <= innerR) return -depth;
  const t = (dist - innerR) / (outerR - innerR);
  return -depth * (1 - t * t);
}

function calcRidge(
  x: number, z: number,
  ax: number, az: number,
  bx: number, bz: number,
  width: number, height: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return 0;

  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
  const px = ax + dx * t;
  const pz = az + dz * t;
  const dist = Math.hypot(x - px, z - pz);
  if (dist > width) return 0;
  return height * (1 - (dist / width) ** 2);
}

function course3Elevation(x: number, z: number): number {
  const WW = 100, HH = 110;
  const edgeFalloffX = Math.min(1, Math.min(x, WW - x) / 12);
  const edgeFalloffZ = Math.min(1, Math.min(z, HH - z) / 12);
  const edgeFalloff = Math.min(edgeFalloffX, edgeFalloffZ);

  let elevation =
    (Math.sin(x * 0.12 + z * 0.05) + Math.cos(z * 0.11 - x * 0.04)) *
    0.55 *
    edgeFalloff;

  // Large-scale site shape: one high shoulder and a central swale.
  elevation += calcRidge(x, z, 6, 108, 96, 16, 20, 5.2);
  elevation += calcRidge(x, z, 2, 74, 98, 66, 14, -3.8);
  elevation += calcBowl(x, z, 57, 74, 10, 26, 1.8);

  // Pond basin for hole 2 carry.
  elevation += calcBowl(x, z, 53, 69, 6, 16, 4.8);

  // Elevated green pads and small tee shelves per hole.
  elevation += calcMound(x, z, 34, 56, 6.4, 16.4, 5.8);
  elevation += calcMound(x, z, 66, 58, 5.8, 14.6, 4.8);
  elevation += calcMound(x, z, 51, 42, 6.2, 15.2, 5.2);
  elevation += calcMound(x, z, 13.8, 95, 3.2, 9.6, 1.8);
  elevation += calcMound(x, z, 45, 89, 3.2, 9.2, 1.6);
  elevation += calcMound(x, z, 85, 32, 3.0, 9.0, 1.6);

  return elevation;
}

// ============================================================================
// 3-HOLE COURSE — Spline-based layout
// ============================================================================
// World: 100 wide × 110 tall (at 10 yards/unit = 1000 × 1100 yards)
//
// Hole 1 (Par 4, ~380 yds): Dogleg left with wide landing zone, bunker-guarded green.
// Hole 2 (Par 3, ~170 yds): Pond carry to an angled green tucked behind bunkers.
// Hole 3 (Par 4, ~350 yds): Sweeping dogleg right through tree-lined corridor.
// ============================================================================

import { courseLayoutToCourseData } from '../core/layout-to-regions';

const SUNRISE_VALLEY_3_LAYOUT: CourseLayout = {
  id: 'sunrise_valley_3',
  name: 'Sunrise Valley - 3 Hole',
  worldWidth: 100,
  worldHeight: 110,
  backgroundTerrainCode: R,
  backgroundElevationFn: course3Elevation,
  holes: [],
  features: [
    // ====== Hole 1: SVG-traced dogleg par 4 ======
    // Fairway outline traced from Wikipedia Par 4/5 dogleg diagram
    { id: 'h1_fairway', holeNumber: 1, terrainCode: F,
      center: { x: 40, z: 45 },
      params: { type: 'freeform', boundary: [
        { x: 22.5, z: 85.0 }, { x: 16.5, z: 82.4 }, { x: 15.0, z: 76.5 },
        { x: 19.7, z: 72.9 }, { x: 23.9, z: 68.7 }, { x: 29.4, z: 61.1 },
        { x: 36.4, z: 55.2 }, { x: 42.0, z: 50.2 }, { x: 44.8, z: 43.3 },
        { x: 45.3, z: 35.2 }, { x: 45.8, z: 27.0 }, { x: 45.6, z: 16.0 },
        { x: 44.5, z: 4.9 }, { x: 48.4, z: 0.0 }, { x: 55.1, z: 0.1 },
        { x: 58.6, z: 5.7 }, { x: 59.4, z: 12.6 }, { x: 61.6, z: 24.6 },
        { x: 62.7, z: 36.6 }, { x: 61.1, z: 42.0 }, { x: 58.9, z: 47.3 },
        { x: 52.5, z: 57.9 }, { x: 44.7, z: 67.7 }, { x: 37.5, z: 74.7 },
        { x: 30.4, z: 81.9 }, { x: 26.8, z: 84.4 },
      ] } },
    // Green — freeform from SVG
    { id: 'h1_green', holeNumber: 1, terrainCode: G,
      center: { x: 20.7, z: 79.0 },
      params: { type: 'freeform', boundary: [
        { x: 18.6, z: 81.8 }, { x: 17.4, z: 80.9 }, { x: 16.7, z: 79.5 },
        { x: 16.6, z: 77.6 }, { x: 17.2, z: 75.9 }, { x: 18.4, z: 75.4 },
        { x: 19.8, z: 75.3 }, { x: 21.8, z: 75.7 }, { x: 23.6, z: 77.0 },
        { x: 24.0, z: 77.7 }, { x: 24.6, z: 78.3 }, { x: 25.2, z: 80.3 },
        { x: 24.4, z: 82.2 }, { x: 23.8, z: 82.8 }, { x: 23.0, z: 83.1 },
        { x: 21.1, z: 83.0 }, { x: 19.4, z: 82.5 }, { x: 19.0, z: 82.2 },
      ] } },
    // Greenside bunker — freeform from SVG
    { id: 'h1_bunker_gs', holeNumber: 1, terrainCode: B,
      center: { x: 31.0, z: 76.3 },
      params: { type: 'freeform', boundary: [
        { x: 29.0, z: 78.7 }, { x: 28.9, z: 78.1 }, { x: 28.7, z: 77.5 },
        { x: 28.3, z: 76.7 }, { x: 28.3, z: 75.8 }, { x: 28.4, z: 75.4 },
        { x: 28.7, z: 75.1 }, { x: 28.8, z: 74.7 }, { x: 29.1, z: 73.9 },
        { x: 29.6, z: 73.8 }, { x: 30.3, z: 73.7 }, { x: 31.8, z: 73.6 },
        { x: 33.1, z: 73.6 }, { x: 33.6, z: 73.8 }, { x: 33.9, z: 74.2 },
        { x: 33.9, z: 75.4 }, { x: 33.5, z: 76.0 }, { x: 32.5, z: 76.9 },
        { x: 31.6, z: 77.8 }, { x: 30.5, z: 78.8 }, { x: 29.2, z: 78.9 },
      ] } },
    // Fairway bunker — freeform from SVG
    { id: 'h1_bunker_fw', holeNumber: 1, terrainCode: B,
      center: { x: 48.7, z: 45.8 },
      params: { type: 'freeform', boundary: [
        { x: 47.4, z: 49.2 }, { x: 46.8, z: 48.4 }, { x: 46.4, z: 47.5 },
        { x: 46.3, z: 45.9 }, { x: 46.6, z: 45.5 }, { x: 47.1, z: 45.1 },
        { x: 47.5, z: 44.4 }, { x: 47.0, z: 43.1 }, { x: 47.1, z: 42.4 },
        { x: 47.6, z: 42.0 }, { x: 48.2, z: 41.8 }, { x: 49.3, z: 42.0 },
        { x: 50.4, z: 42.5 }, { x: 51.0, z: 43.4 }, { x: 51.2, z: 44.8 },
        { x: 50.9, z: 45.7 }, { x: 49.9, z: 46.7 }, { x: 49.4, z: 47.7 },
        { x: 49.3, z: 48.9 }, { x: 48.2, z: 49.3 },
      ] } },
    { id: 'h1_tee', holeNumber: 1, terrainCode: T,
      center: { x: 22.5, z: 88 },
      params: { type: 'rectangle', width: 5, height: 3, rotation: 0.2 } },

    // ====== Hole 2: Par 3, pond carry ======
    { id: 'h2_fairway', holeNumber: 2, terrainCode: F,
      center: { x: 80, z: 70 },
      params: { type: 'freeform', boundary: [
        { x: 74, z: 90 }, { x: 72, z: 84 }, { x: 73, z: 78 },
        { x: 75, z: 72 }, { x: 76, z: 66 }, { x: 76, z: 60 },
        { x: 82, z: 56 }, { x: 88, z: 60 }, { x: 88, z: 66 },
        { x: 87, z: 72 }, { x: 86, z: 78 }, { x: 84, z: 84 },
        { x: 82, z: 90 },
      ] } },
    { id: 'h2_tee', holeNumber: 2, terrainCode: T,
      center: { x: 78, z: 92 },
      params: { type: 'rectangle', width: 5, height: 3, rotation: 0 } },
    { id: 'h2_water', holeNumber: 2, terrainCode: W,
      center: { x: 80, z: 74 },
      params: { type: 'ellipse', radiusX: 4, radiusZ: 3 } },
    { id: 'h2_green', holeNumber: 2, terrainCode: G,
      center: { x: 82, z: 60 },
      params: { type: 'ellipse', radiusX: 5, radiusZ: 4 } },
    { id: 'h2_bunker_l', holeNumber: 2, terrainCode: B,
      center: { x: 76, z: 58 },
      params: { type: 'ellipse', radiusX: 2.5, radiusZ: 2 } },
    { id: 'h2_bunker_r', holeNumber: 2, terrainCode: B,
      center: { x: 88, z: 57 },
      params: { type: 'ellipse', radiusX: 2, radiusZ: 2.5 } },
  ],
  obstacles: [
    // ====== Hole 1 tree corridor ======
    // Left side dense trees framing the dogleg
    { x: 6, y: 95, type: 2 }, { x: 4, y: 88, type: 1 }, { x: 5, y: 80, type: 2 },
    { x: 7, y: 73, type: 1 }, { x: 6, y: 65, type: 2 }, { x: 8, y: 58, type: 1 },
    { x: 5, y: 50, type: 2 }, { x: 7, y: 43, type: 1 },
    // Right side scattered trees
    { x: 32, y: 92, type: 1 }, { x: 35, y: 84, type: 2 }, { x: 33, y: 76, type: 1 },
    { x: 30, y: 68, type: 2 }, { x: 28, y: 60, type: 1 },
    // Behind hole 1 green
    { x: 12, y: 38, type: 2 }, { x: 20, y: 37, type: 1 }, { x: 24, y: 40, type: 2 },

    // ====== Hole 2 framing ======
    // Left of hole 2
    { x: 42, y: 90, type: 1 }, { x: 40, y: 82, type: 2 }, { x: 43, y: 72, type: 1 },
    { x: 45, y: 64, type: 2 }, { x: 50, y: 56, type: 1 },
    // Right of hole 2
    { x: 68, y: 88, type: 2 }, { x: 70, y: 80, type: 1 }, { x: 72, y: 72, type: 2 },
    { x: 74, y: 64, type: 1 },
    // Behind hole 2 green
    { x: 72, y: 54, type: 2 }, { x: 66, y: 52, type: 1 },

    // ====== Hole 3 tree-lined corridor ======
    // Upper tree line (north side of fairway)
    { x: 50, y: 48, type: 1 }, { x: 56, y: 44, type: 2 }, { x: 62, y: 40, type: 1 },
    { x: 70, y: 36, type: 2 }, { x: 78, y: 30, type: 1 }, { x: 84, y: 24, type: 2 },
    // Lower tree line (south side)
    { x: 54, y: 32, type: 2 }, { x: 62, y: 26, type: 1 }, { x: 68, y: 20, type: 2 },
    { x: 76, y: 16, type: 1 },
    // Around hole 3 green
    { x: 92, y: 14, type: 2 }, { x: 94, y: 6, type: 1 }, { x: 82, y: 2, type: 2 },

    // ====== Perimeter trees ======
    { x: 3, y: 104, type: 2 }, { x: 3, y: 30, type: 1 }, { x: 3, y: 15, type: 2 },
    { x: 96, y: 104, type: 1 }, { x: 96, y: 90, type: 2 }, { x: 96, y: 50, type: 1 },
    { x: 20, y: 105, type: 1 }, { x: 40, y: 106, type: 2 }, { x: 60, y: 105, type: 1 },
    { x: 80, y: 106, type: 2 },
    { x: 15, y: 4, type: 1 }, { x: 35, y: 3, type: 2 }, { x: 50, y: 4, type: 1 },
    { x: 70, y: 3, type: 2 },
  ],
};

const COURSE_3_HOLE: CourseData = courseLayoutToCourseData(SUNRISE_VALLEY_3_LAYOUT);

export const COURSE_HOLE_1: CourseData = {
  name: 'Test Hole',
  width: 12,
  height: 25,
  par: 4,
  topology: buildDelaunayTopology({
    worldWidth: 12,
    worldHeight: 25,
    regions: [
      { terrainCode: G, boundary: makeEllipse(6, 3, 2, 1.5), elevationFn: () => 0 },
      { terrainCode: F, boundary: makeRect(3, 2, 9, 19), elevationFn: () => 0 },
      { terrainCode: T, boundary: makeRect(5, 19, 7, 21), elevationFn: () => 0 },
    ],
    backgroundTerrainCode: R,
    backgroundElevationFn: () => 0,
    boundaryPointSpacing: 1.0,
    fillPointSpacing: 2.0,
  }),
  obstacles: [],
};

const COURSE_TEST: CourseData = {
  name: 'Test Course',
  width: 15,
  height: 15,
  par: 3,
  topology: buildDelaunayTopology({
    worldWidth: 15,
    worldHeight: 15,
    regions: [
      { terrainCode: F, boundary: makeRect(1, 1, 14, 14), elevationFn: () => 0 },
    ],
    backgroundTerrainCode: R,
    backgroundElevationFn: () => 0,
    boundaryPointSpacing: 1.0,
    fillPointSpacing: 2.0,
  }),
};

// Refill stations
export interface RefillStation {
  x: number;
  y: number;
  name: string;
}

export const REFILL_STATIONS: RefillStation[] = [
  { x: 8, y: 50, name: 'Maintenance Shed' },
];

// Course registry
export type CourseId =
  | 'sunrise_valley_1'
  | 'sunrise_valley_3'
  | 'test_course'
  | '3_hole'
  | '9_hole'
  | '18_hole_championship'
  | '18_hole_original'
  | '27_hole'
  | (string & {});

const COURSE_REGISTRY: Partial<Record<CourseId, CourseData>> = {
  'sunrise_valley_1': COURSE_HOLE_1,
  'sunrise_valley_3': COURSE_3_HOLE,
  'test_course': COURSE_TEST,
  '3_hole': COURSE_3_HOLE,
  '9_hole': COURSE_3_HOLE,
  '18_hole_championship': COURSE_3_HOLE,
  '18_hole_original': COURSE_3_HOLE,
  '27_hole': COURSE_3_HOLE,
};

export function getCourseById(courseId: string): CourseData | undefined {
  const registered = COURSE_REGISTRY[courseId as CourseId];
  if (registered) return registered;

  if (courseId.startsWith('custom_')) {
    const custom = loadCustomCourse(courseId);
    if (custom) return customCourseToCourseData(custom);
  }
  return undefined;
}

