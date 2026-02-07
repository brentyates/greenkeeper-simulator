import { TerrainType, ObstacleType } from '../core/terrain';
import { SerializedTopology } from '../core/mesh-topology';
import { buildDelaunayTopology, TerrainRegion } from '../core/delaunay-topology';
import { loadCustomCourse, customCourseToCourseData } from './customCourseData';

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

function makeFairwayPoly(
  startZ: number, endZ: number,
  baseX: number, amplitude: number, frequency: number, halfWidth: number,
  samples = 24
): Array<{ x: number; z: number }> {
  const left: Array<{ x: number; z: number }> = [];
  const right: Array<{ x: number; z: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const z = startZ + (endZ - startZ) * t;
    const cx = baseX + Math.sin(t * Math.PI * 2 * frequency) * amplitude;
    const hw = halfWidth * (0.7 + 0.3 * Math.cos(t * Math.PI));
    left.push({ x: cx - hw, z });
    right.push({ x: cx + hw, z });
  }

  return [...left, ...right.reverse()];
}

function makeHorizFairwayPoly(
  startX: number, endX: number,
  centerZ: number, halfWidth: number,
  wobbleFreq: number, wobbleAmp: number,
  samples = 24
): Array<{ x: number; z: number }> {
  const top: Array<{ x: number; z: number }> = [];
  const bottom: Array<{ x: number; z: number }> = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = startX + (endX - startX) * t;
    const wobble = Math.sin((x - startX) * wobbleFreq) * wobbleAmp;
    top.push({ x, z: centerZ - halfWidth + wobble });
    bottom.push({ x, z: centerZ + halfWidth + wobble });
  }

  return [...top, ...bottom.reverse()];
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

  let depression = 0;
  const waterDx = x - 62;
  const waterDz = z - 60;
  const waterDist = Math.sqrt(waterDx * waterDx + waterDz * waterDz);
  if (waterDist <= 15.2) {
    const t = waterDist <= 7.2 ? 0 : (waterDist - 7.2) / (15.2 - 7.2);
    depression = -2.4 * (1 - t);
  }

  let moundElev = 0;
  moundElev = Math.max(moundElev, calcMound(x, z, 6, 6, 6, 16, 4.0));
  moundElev = Math.max(moundElev, calcMound(x, z, 92, 6, 6, 16, 4.0));
  moundElev = Math.max(moundElev, calcMound(x, z, 92, 104, 6, 16, 3.5));
  moundElev = Math.max(moundElev, calcMound(x, z, 48, 66, 8, 20, 3.0));
  moundElev = Math.max(moundElev, calcMound(x, z, 24, 38, 6.8, 15.2, 2.6));
  moundElev = Math.max(moundElev, calcMound(x, z, 70, 42, 8.4, 17.2, 2.6));
  moundElev = Math.max(moundElev, calcMound(x, z, 24, 90, 8.4, 17.6, 2.6));

  moundElev += calcRidge(x, z, 36, 60, 56, 76, 8, 1.6);
  moundElev += calcRidge(x, z, 52, 36, 76, 52, 6, 1.2);

  const edgeFalloffX = Math.min(1, Math.min(x, WW - x) / 12);
  const edgeFalloffZ = Math.min(1, Math.min(z, HH - z) / 12);
  const edgeFalloff = Math.min(edgeFalloffX, edgeFalloffZ);
  const rolling = depression < 0 ? 0 : (Math.sin(x * 0.18) * Math.cos(z * 0.14)) * 0.32 * edgeFalloff;

  return depression + moundElev + rolling;
}

// ============================================================================
// 3-HOLE ORGANIC COURSE
// ============================================================================
// World: 100 wide × 110 tall (at 10 yards/unit = 1000 × 1100 yards)
//
// Hole 1 (Par 3, ~160 yds): Plays NORTH, tee near (24,58), green near (24,38)
// Hole 2 (Par 4, ~380 yds): Plays NORTH, tee near (70,82), green near (70,42)
// Hole 3 (Par 3, ~140 yds): Plays WEST, tee near (66,90), green near (24,90)
// ============================================================================

function generate3HoleTopology(): SerializedTopology {
  const elev = course3Elevation;
  const regions: TerrainRegion[] = [];

  // ========== HOLE 1: Par 3, plays NORTH ==========

  // H1 Fairway approach (sinuous path from tee to green area)
  regions.push({
    terrainCode: F,
    boundary: makeFairwayPoly(59, 42, 24, 3.6, 0.55, 7.6),
    elevationFn: elev,
  });

  // H1 Fringe ring around green
  regions.push({
    terrainCode: F,
    boundary: makeEllipse(24, 38, 11, 9),
    elevationFn: elev,
  });

  // H1 Green (main body + two lobes)
  regions.push({ terrainCode: G, boundary: makeEllipse(24, 38, 9.6, 7.2), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(29.2, 36.8, 4.4, 4.4), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(19.6, 41, 4.2, 4.2), elevationFn: elev });

  // H1 Tee box
  regions.push({ terrainCode: T, boundary: makeRect(20, 56, 27, 59), elevationFn: elev });

  // H1 Bunkers - kidney left, pot right
  regions.push({ terrainCode: B, boundary: makeEllipse(14, 38, 4.8, 7.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(34.8, 36.4, 2.4, 2.4), elevationFn: elev });

  // ========== HOLE 2: Par 4, plays NORTH ==========

  // H2 Upper fairway (tee to mid)
  regions.push({
    terrainCode: F,
    boundary: makeFairwayPoly(83, 66, 70, 5.6, 0.6, 8.4),
    elevationFn: elev,
  });

  // H2 Lower fairway (mid to green approach)
  regions.push({
    terrainCode: F,
    boundary: makeFairwayPoly(66, 48, 68, 4.2, 0.5, 6.4),
    elevationFn: elev,
  });

  // H2 Green (kidney shape with lobes)
  regions.push({ terrainCode: G, boundary: makeEllipse(70, 42, 9.6, 7.2), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(66, 38, 4.8, 4.8), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(74, 46, 4.8, 4.8), elevationFn: elev });

  // H2 Tee box
  regions.push({ terrainCode: T, boundary: makeRect(66, 80, 73, 83), elevationFn: elev });

  // H2 Water hazard
  regions.push({ terrainCode: W, boundary: makeEllipse(62, 60, 5.6, 7.6), elevationFn: elev });

  // H2 Fairway bunker cluster
  regions.push({ terrainCode: B, boundary: makeEllipse(76, 66, 5.2, 2.8), elevationFn: elev });

  // H2 Greenside bunkers
  regions.push({ terrainCode: B, boundary: makeEllipse(62, 44, 3.2, 4.8), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(78, 40, 2.6, 2.6), elevationFn: elev });

  // ========== HOLE 3: Par 3, plays WEST ==========

  // H3 Fairway (horizontal approach)
  regions.push({
    terrainCode: F,
    boundary: makeHorizFairwayPoly(36, 64, 89, 3, 0.4, 2.8),
    elevationFn: elev,
  });

  // H3 Wider approach strip
  regions.push({
    terrainCode: F,
    boundary: makeRect(44, 85, 58, 88),
    elevationFn: elev,
  });

  // H3 Green (elongated with lobes)
  regions.push({ terrainCode: G, boundary: makeEllipse(24, 90, 7.2, 9.6), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(20, 92, 4.8, 4.8), elevationFn: elev });
  regions.push({ terrainCode: G, boundary: makeEllipse(28, 88, 4.4, 4.4), elevationFn: elev });

  // H3 Tee box
  regions.push({ terrainCode: T, boundary: makeRect(64, 86, 67, 93), elevationFn: elev });

  // H3 Bunkers
  regions.push({ terrainCode: B, boundary: makeEllipse(24, 80, 7.2, 3.2), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(16, 90, 3.2, 6.8), elevationFn: elev });
  regions.push({ terrainCode: B, boundary: makeEllipse(32, 94, 2.6, 2.6), elevationFn: elev });

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
    { x: 5, y: 17, type: 2 },
    { x: 4, y: 21, type: 1 },
    { x: 19, y: 17, type: 2 },
    { x: 20, y: 21, type: 1 },
    { x: 7, y: 25, type: 1 },
    { x: 17, y: 26, type: 2 },

    { x: 28, y: 20, type: 2 },
    { x: 41, y: 19, type: 1 },
    { x: 42, y: 23, type: 2 },
    { x: 27, y: 28, type: 1 },
    { x: 28, y: 33, type: 2 },
    { x: 41, y: 35, type: 1 },
    { x: 40, y: 38, type: 2 },

    { x: 6, y: 43, type: 2 },
    { x: 5, y: 47, type: 1 },
    { x: 17, y: 41, type: 1 },
    { x: 18, y: 49, type: 2 },
    { x: 36, y: 42, type: 2 },
    { x: 35, y: 48, type: 1 },

    { x: 3, y: 5, type: 1 },
    { x: 8, y: 3, type: 2 },
    { x: 22, y: 4, type: 1 },
    { x: 28, y: 6, type: 2 },
    { x: 44, y: 4, type: 1 },
    { x: 47, y: 8, type: 2 },
    { x: 2, y: 33, type: 2 },
    { x: 46, y: 50, type: 1 },
    { x: 47, y: 52, type: 2 },
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
