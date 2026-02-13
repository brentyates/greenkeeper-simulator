import { TerrainType, ObstacleType } from '../core/terrain';
import { SerializedTopology } from '../core/mesh-topology';
import { buildDelaunayTopology, TerrainRegion } from '../core/delaunay-topology';
import { loadCustomCourse, customCourseToCourseData } from './customCourseData';
import type { CourseHoleDefinition } from '../core/hole-construction';

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
// 3-HOLE COURSE (REDESIGNED)
// ============================================================================
// World: 100 wide × 110 tall (at 10 yards/unit = 1000 × 1100 yards)
//
// Hole 1 (Par 4, ~380 yds): left corridor, uphill into elevated green.
// Hole 2 (Par 3, ~190 yds): central-right corridor, pond carry to raised target.
// Hole 3 (Par 3, ~180 yds): upper corridor, right-to-left shot to plateau green.
// ============================================================================

function generate3HoleTopology(): SerializedTopology {
  const elev = course3Elevation;
  const regions: TerrainRegion[] = [];

  // ========== HOLE 1: Par 4, left corridor ==========
  regions.push({ terrainCode: F, boundary: makeEllipse(15, 90, 6.5, 8.5), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(18.5, 80, 7.4, 9.2), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(24, 70, 8.6, 10.2), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(30, 61, 9.4, 8.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(26.5, 56.5, 3.2, 2.4), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(41.5, 56.8, 3.0, 2.3), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(34.2, 49, 3.8, 2.5), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(34, 56, 7.4, 5.6), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(37.7, 55.2, 3.2, 2.8), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(30.2, 57.1, 3.0, 2.6), elevationFn: elev });
  regions.push({ terrainCode: T, boundary: makeRect(10.5, 93, 17.5, 97.5), elevationFn: elev });

  // ========== HOLE 2: Par 3, center-right corridor ==========
  regions.push({ terrainCode: F, boundary: makeEllipse(45, 86, 6.0, 7.5), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(51, 77, 7.2, 8.3), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(58, 68, 8.2, 8.8), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(63, 61, 9.0, 7.2), elevationFn: elev });
  regions.push({ terrainCode: W, boundary: makeEllipse(52.5, 69.5, 5.5, 6.5), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(56.2, 59.2, 2.8, 2.1), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(75.0, 59.0, 2.8, 2.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(66.2, 49.2, 3.0, 2.1), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(66, 58, 7.2, 5.4), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(69.8, 58.9, 2.8, 2.4), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(62.7, 57, 2.8, 2.2), elevationFn: elev });
  regions.push({ terrainCode: T, boundary: makeRect(42, 87, 48, 91), elevationFn: elev });

  // ========== HOLE 3: Par 3, upper right-to-left corridor ==========
  regions.push({ terrainCode: F, boundary: makeEllipse(82, 33, 6.4, 4.8), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(74, 35, 7.5, 5.2), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(66, 37.5, 8.4, 5.8), elevationFn: elev });
  regions.push({ terrainCode: F, boundary: makeEllipse(58, 40, 9.0, 6.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(41.0, 41.0, 2.8, 2.1), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(59.4, 44.7, 2.7, 2.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(50.8, 50.0, 3.0, 2.2), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(51, 42, 7.2, 5.2), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(54.4, 41.4, 2.8, 2.2), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(47.8, 43.1, 2.6, 2.1), elevationFn: elev });
  regions.push({ terrainCode: T, boundary: makeRect(82, 30, 88, 34), elevationFn: elev });

  return buildDelaunayTopology({
    worldWidth: 100,
    worldHeight: 110,
    regions,
    backgroundTerrainCode: R,
    backgroundElevationFn: elev,
    boundaryPointSpacing: 1.0,
    fillPointSpacing: 2.5,
  });
}

const course3Topology = generate3HoleTopology();

export const COURSE_3_HOLE: CourseData = {
  name: 'Sunrise Valley - 3 Hole',
  width: 100,
  height: 110,
  par: 10,
  topology: course3Topology,
  obstacles: [
    // West and east perimeter framing.
    { x: 5, y: 103, type: 2 },
    { x: 7, y: 97, type: 1 },
    { x: 5, y: 90, type: 2 },
    { x: 8, y: 83, type: 1 },
    { x: 6, y: 76, type: 2 },
    { x: 5, y: 68, type: 1 },
    { x: 7, y: 60, type: 2 },
    { x: 8, y: 52, type: 1 },
    { x: 6, y: 44, type: 2 },
    { x: 5, y: 36, type: 1 },
    { x: 7, y: 28, type: 2 },
    { x: 8, y: 20, type: 1 },
    { x: 6, y: 12, type: 2 },
    { x: 94, y: 102, type: 1 },
    { x: 93, y: 94, type: 2 },
    { x: 95, y: 86, type: 1 },
    { x: 94, y: 78, type: 2 },
    { x: 93, y: 70, type: 1 },
    { x: 95, y: 62, type: 2 },
    { x: 94, y: 54, type: 1 },
    { x: 93, y: 46, type: 2 },
    { x: 95, y: 38, type: 1 },
    { x: 94, y: 30, type: 2 },
    { x: 93, y: 22, type: 1 },
    { x: 95, y: 14, type: 2 },

    // Top and bottom backdrop.
    { x: 18, y: 105, type: 2 },
    { x: 30, y: 104, type: 1 },
    { x: 44, y: 103, type: 2 },
    { x: 58, y: 104, type: 1 },
    { x: 72, y: 105, type: 2 },
    { x: 84, y: 104, type: 1 },
    { x: 14, y: 6, type: 1 },
    { x: 26, y: 7, type: 2 },
    { x: 38, y: 6, type: 1 },
    { x: 50, y: 7, type: 2 },
    { x: 62, y: 6, type: 1 },
    { x: 74, y: 7, type: 2 },
    { x: 86, y: 6, type: 1 },

    // Hole 1 and hole 2 separator/frames.
    { x: 41, y: 88, type: 2 },
    { x: 39, y: 80, type: 1 },
    { x: 37, y: 72, type: 2 },
    { x: 35, y: 64, type: 1 },
    { x: 33, y: 56, type: 2 },
    { x: 78, y: 84, type: 1 },
    { x: 80, y: 76, type: 2 },
    { x: 82, y: 68, type: 1 },
    { x: 80, y: 60, type: 2 },

    // Around pond and hole 3 green backstop.
    { x: 37, y: 82, type: 1 },
    { x: 35, y: 74, type: 2 },
    { x: 34, y: 66, type: 1 },
    { x: 38, y: 58, type: 2 },
    { x: 46, y: 54, type: 1 },
    { x: 50, y: 56, type: 2 },
    { x: 56, y: 56, type: 1 },
    { x: 62, y: 56, type: 2 },
    { x: 74, y: 50, type: 1 },
    { x: 66, y: 52, type: 2 },
    { x: 58, y: 54, type: 1 },
    { x: 42, y: 46, type: 2 },
    { x: 60, y: 30, type: 2 },
    { x: 70, y: 28, type: 1 },
    { x: 82, y: 48, type: 2 },
    { x: 86, y: 44, type: 1 },
  ],
};

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

export const COURSE_TEST: CourseData = {
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

export const DEFAULT_COURSE = COURSE_3_HOLE;
