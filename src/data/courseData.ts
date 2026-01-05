import { TerrainType, ObstacleType } from '../core/terrain';
import { HoleData } from '../core/golf-logic';

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
  layout: number[][];
  elevation: number[][];
  obstacles?: ObstacleData[];
  holeData?: HoleData;
  yardsPerGrid?: number;
}

const F = 0; // Fairway
const R = 1; // Rough
const G = 2; // Green
const B = 3; // Bunker
const W = 4; // Water
const T = 5; // Tee

function generateRow(width: number, pattern: Array<[number, number, number?]>): number[] {
  const row: number[] = new Array(width).fill(R);
  for (const [start, end, terrain] of pattern) {
    const t = terrain ?? F;
    for (let x = start; x <= end; x++) {
      if (x >= 0 && x < width) row[x] = t;
    }
  }
  return row;
}

// ============================================================================
// 3-HOLE STARTER COURSE
// ============================================================================
// Scale: 20 yards per tile
// Map: 50 wide × 55 tall (1000 × 1100 yards of property)
//
// LAYOUT:
//   ┌─────────────────────────────────────────────────┐
//   │                  EXPANSION SPACE                │
//   │                                                 │
//   │      [H1 GREEN]                                 │
//   │          ↑                                      │
//   │       fairway            [H2 GREEN]             │
//   │          ↑                   ↑                  │
//   │       [TEE 1]             fairway               │
//   │                              ↑                  │
//   │                           [TEE 2]               │
//   │                              ↑                  │
//   │    [H3 GREEN] ← fairway ← [TEE 3]               │
//   │                                                 │
//   │   [CLUBHOUSE]           EXPANSION               │
//   │      AREA                 SPACE                 │
//   └─────────────────────────────────────────────────┘
//
// Hole 1 (Par 3, ~150 yds = 7 tiles): Plays NORTH from near clubhouse
// Hole 2 (Par 4, ~380 yds = 19 tiles): Plays NORTH on right side
// Hole 3 (Par 3, ~140 yds = 7 tiles): Plays WEST back toward clubhouse
//
// ============================================================================

function generate3HoleCourse(): { layout: number[][], elevation: number[][] } {
  const WIDTH = 50;
  const HEIGHT = 55;

  const layout: number[][] = [];
  const elevation: number[][] = [];

  for (let y = 0; y < HEIGHT; y++) {
    layout.push(new Array(WIDTH).fill(R));
    elevation.push(new Array(WIDTH).fill(0));
  }

  // Helper to set terrain
  const setTerrain = (x: number, y: number, terrain: number) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
      layout[y][x] = terrain;
    }
  };

  const setElevation = (x: number, y: number, elev: number) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
      elevation[y][x] = elev;
    }
  };

  const fillRect = (x1: number, y1: number, x2: number, y2: number, terrain: number) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setTerrain(x, y, terrain);
      }
    }
  };

  const fillElevRect = (x1: number, y1: number, x2: number, y2: number, elev: number) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setElevation(x, y, elev);
      }
    }
  };

  const fillCircle = (cx: number, cy: number, radius: number, terrain: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setTerrain(cx + dx, cy + dy, terrain);
        }
      }
    }
  };

  const fillElevCircle = (cx: number, cy: number, radius: number, elev: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setElevation(cx + dx, cy + dy, elev);
        }
      }
    }
  };

  // ========== HOLE 1: Par 3, 160 yards (8 tiles), plays NORTH ==========
  // Tee: (12, 28), Green center: (12, 20)

  // Tee box (2x2)
  fillRect(11, 28, 12, 29, T);
  setTerrain(10, 29, F); setTerrain(13, 29, F);

  // Fairway - single tile strip (par 3, no need for wide landing area)
  for (let y = 23; y <= 27; y++) {
    setTerrain(12, y, F);
  }

  // Green (circular, radius 2 = ~80 yard diameter)
  fillCircle(12, 20, 2, G);
  fillElevCircle(12, 20, 2, 1);

  // Bunkers flanking green
  setTerrain(9, 20, B);
  setTerrain(9, 21, B);
  setTerrain(15, 19, B);
  setTerrain(15, 20, B);

  // ========== HOLE 2: Par 4, 380 yards (19 tiles), plays NORTH ==========
  // Tee: (35, 40), Green center: (35, 21)

  // Tee box (2x2)
  fillRect(34, 40, 35, 41, T);
  setTerrain(33, 40, F); setTerrain(36, 41, F);

  // Fairway - variable width: wider landing zone, narrower approach
  // Landing zone (y 34-39) - 2 tiles wide
  for (let y = 34; y <= 39; y++) {
    setTerrain(34, y, F);
    setTerrain(35, y, F);
  }
  // Narrower approach (y 24-33) - 1-2 tiles
  for (let y = 24; y <= 33; y++) {
    setTerrain(35, y, F);
    if (y >= 28) setTerrain(34, y, F); // widens slightly mid-fairway
  }

  // Water hazard on left side mid-fairway
  setTerrain(32, 30, W);
  setTerrain(32, 31, W);
  setElevation(32, 30, -1);
  setElevation(32, 31, -1);

  // Fairway bunker on right
  setTerrain(37, 32, B);

  // Green (circular, radius 2)
  fillCircle(35, 21, 2, G);
  fillElevCircle(35, 21, 2, 1);

  // Greenside bunkers
  setTerrain(32, 21, B);
  setTerrain(38, 20, B);

  // ========== HOLE 3: Par 3, 140 yards (7 tiles), plays WEST ==========
  // Tee: (32, 45), Green center: (12, 45)

  // Tee box (2x2)
  fillRect(32, 44, 33, 45, T);
  setTerrain(31, 45, F); setTerrain(34, 44, F);

  // Fairway - single tile strip (par 3)
  for (let x = 15; x <= 30; x++) {
    setTerrain(x, 45, F);
  }

  // Green (circular, radius 2)
  fillCircle(12, 45, 2, G);
  fillElevCircle(12, 45, 2, 1);

  // Bunkers
  setTerrain(12, 42, B);
  setTerrain(11, 48, B);

  // ========== TERRAIN FEATURES ==========

  // Hills in corners for visual interest
  fillElevRect(0, 0, 5, 5, 1);
  fillElevRect(44, 0, 49, 5, 1);
  fillElevRect(44, 50, 49, 54, 1);

  // Slight mounding between holes
  fillElevRect(20, 25, 25, 35, 1);

  return { layout, elevation };
}

const { layout: course3Layout, elevation: course3Elevation } = generate3HoleCourse();

export const COURSE_3_HOLE: CourseData = {
  name: 'Sunrise Valley - 3 Hole',
  width: 50,
  height: 55,
  par: 10, // Par 3 + Par 4 + Par 3
  layout: course3Layout,
  elevation: course3Elevation,
  obstacles: [
    // Trees around Hole 1
    { x: 7, y: 19, type: 2 },   // Left of green
    { x: 17, y: 20, type: 1 },  // Right of green
    { x: 9, y: 25, type: 1 },   // Left of fairway
    { x: 15, y: 26, type: 2 },  // Right of fairway

    // Trees around Hole 2
    { x: 30, y: 22, type: 2 },  // Left of green
    { x: 40, y: 21, type: 1 },  // Right of green
    { x: 30, y: 35, type: 1 },  // Near water
    { x: 40, y: 37, type: 2 },  // Right side

    // Trees around Hole 3
    { x: 8, y: 43, type: 2 },   // Above green
    { x: 8, y: 48, type: 1 },   // Below green
    { x: 22, y: 42, type: 1 },  // Mid fairway
    { x: 36, y: 43, type: 2 },  // Near tee

    // Expansion area trees (sparse)
    { x: 5, y: 8, type: 1 },
    { x: 25, y: 5, type: 2 },
    { x: 45, y: 10, type: 1 },
    { x: 3, y: 35, type: 2 },
    { x: 45, y: 48, type: 1 },
  ],
  yardsPerGrid: 20,
  holeData: {
    holeNumber: 1,
    par: 3,
    teeBoxes: [
      { name: 'Championship', x: 12, y: 29, elevation: 0, yardage: 160, par: 3 },
      { name: 'Forward', x: 12, y: 28, elevation: 0, yardage: 140, par: 3 },
    ],
    pinPosition: { x: 12, y: 20, elevation: 1 },
    green: {
      frontEdge: { x: 12, y: 22 },
      center: { x: 12, y: 20 },
      backEdge: { x: 12, y: 18 },
    },
    idealPath: [
      { x: 12, y: 29, description: 'Tee shot' },
      { x: 12, y: 20, description: 'Green' },
    ],
    hazards: [
      {
        type: 'bunker',
        name: 'Left greenside',
        positions: [{ x: 9, y: 20 }, { x: 9, y: 21 }],
      },
      {
        type: 'bunker',
        name: 'Right greenside',
        positions: [{ x: 15, y: 19 }, { x: 15, y: 20 }],
      },
    ],
  },
};

// Simple test hole
export const COURSE_HOLE_1: CourseData = {
  name: 'Test Hole',
  width: 12,
  height: 25,
  par: 4,
  layout: (() => {
    const W = 12, H = 25;
    const layout: number[][] = [];
    for (let y = 0; y < H; y++) {
      if (y <= 1) layout.push(new Array(W).fill(R));
      else if (y <= 4) layout.push(generateRow(W, [[4, 8, G]]));
      else if (y <= 18) layout.push(generateRow(W, [[3, 9]]));
      else if (y <= 20) layout.push(generateRow(W, [[4, 8], [5, 6, T]]));
      else layout.push(new Array(W).fill(R));
    }
    return layout;
  })(),
  elevation: Array(25).fill(null).map(() => Array(12).fill(0)),
  obstacles: [],
  yardsPerGrid: 20,
};

// Tiny test course
export const COURSE_TEST: CourseData = {
  name: 'Test Course',
  width: 15,
  height: 15,
  par: 3,
  layout: Array(15).fill(null).map(() => Array(15).fill(F)),
  elevation: Array(15).fill(null).map(() => Array(15).fill(0)),
  yardsPerGrid: 20,
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
  | '27_hole';

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
  return COURSE_REGISTRY[courseId as CourseId];
}

export const DEFAULT_COURSE = COURSE_3_HOLE;
