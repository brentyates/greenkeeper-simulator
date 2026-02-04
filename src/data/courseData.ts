import { TerrainType, ObstacleType } from '../core/terrain';
import { HoleData } from '../core/golf-logic';
import { VectorShape, createEllipseShape, createCircleShape } from '../core/vector-shapes';

export type { TerrainType, ObstacleType };

export interface ObstacleData {
  x: number;
  y: number;
  type: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CourseData {
  name: string;
  width: number;
  height: number;
  par: number;
  layout: number[][];
  elevation?: number[][];
  vertexElevations?: number[][];
  vertexPositions?: Vec3[][];
  obstacles?: ObstacleData[];
  holeData?: HoleData;
  yardsPerGrid?: number;
  vectorShapes?: VectorShape[];
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

function generate3HoleCourse(): { layout: number[][], elevation: number[][], vertexElevations: number[][] } {
  const WIDTH = 50;
  const HEIGHT = 55;
  const MESH_RES = 2;
  const VERTEX_WIDTH = WIDTH * MESH_RES + 1;
  const VERTEX_HEIGHT = HEIGHT * MESH_RES + 1;

  const layout: number[][] = [];
  const elevation: number[][] = [];
  const vertexElevations: number[][] = [];

  for (let y = 0; y < HEIGHT; y++) {
    layout.push(new Array(WIDTH).fill(R));
    elevation.push(new Array(WIDTH).fill(0));
  }

  for (let vy = 0; vy < VERTEX_HEIGHT; vy++) {
    vertexElevations.push(new Array(VERTEX_WIDTH).fill(0));
  }

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

  const _fillElevRect = (x1: number, y1: number, x2: number, y2: number, elev: number) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setElevation(x, y, elev);
      }
    }
  };
  void _fillElevRect;

  const fillCircle = (cx: number, cy: number, radius: number, terrain: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setTerrain(cx + dx, cy + dy, terrain);
        }
      }
    }
  };

  const _fillElevCircle = (cx: number, cy: number, radius: number, elev: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setElevation(cx + dx, cy + dy, elev);
        }
      }
    }
  };
  void _fillElevCircle;

  const fillEllipse = (cx: number, cy: number, rx: number, ry: number, terrain: number) => {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
          setTerrain(cx + dx, cy + dy, terrain);
        }
      }
    }
  };

  const _fillElevEllipse = (cx: number, cy: number, rx: number, ry: number, elev: number) => {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
          setElevation(cx + dx, cy + dy, elev);
        }
      }
    }
  };
  void _fillElevEllipse;

  const fillSmoothMound = (cx: number, cy: number, innerR: number, outerR: number, peakElev: number) => {
    for (let vy = 0; vy < VERTEX_HEIGHT; vy++) {
      for (let vx = 0; vx < VERTEX_WIDTH; vx++) {
        const worldX = vx / MESH_RES;
        const worldZ = vy / MESH_RES;
        const dx = worldX - cx;
        const dy = worldZ - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= outerR) {
          let elev = 0;
          if (dist <= innerR) {
            elev = peakElev;
          } else {
            const t = (dist - innerR) / (outerR - innerR);
            elev = peakElev * (1 - t * t);
          }
          vertexElevations[vy][vx] = Math.max(vertexElevations[vy][vx], elev);
        }
      }
    }

    for (let dy = -Math.ceil(outerR); dy <= Math.ceil(outerR); dy++) {
      for (let dx = -Math.ceil(outerR); dx <= Math.ceil(outerR); dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= outerR) {
          let elev = 0;
          if (dist <= innerR) {
            elev = peakElev;
          } else {
            const t = (dist - innerR) / (outerR - innerR);
            elev = peakElev * (1 - t);
          }
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            elevation[y][x] = Math.max(elevation[y][x], elev);
          }
        }
      }
    }
  };

  const _fillVertexFlat = (x1: number, y1: number, x2: number, y2: number, z: number) => {
    const vx1 = Math.floor(x1 * MESH_RES);
    const vy1 = Math.floor(y1 * MESH_RES);
    const vx2 = Math.ceil(x2 * MESH_RES);
    const vy2 = Math.ceil(y2 * MESH_RES);

    for (let vy = vy1; vy <= vy2 && vy < VERTEX_HEIGHT; vy++) {
      for (let vx = vx1; vx <= vx2 && vx < VERTEX_WIDTH; vx++) {
        vertexElevations[vy][vx] = z;
      }
    }
  };
  void _fillVertexFlat;

  // ========== HOLE 1: Par 3, 160 yards, plays NORTH ==========
  // Elevated green with undulating approach

  // Tee box (3x2)
  fillRect(10, 28, 13, 29, T);

  // Approach fairway - wider for visual appeal
  for (let y = 23; y <= 27; y++) {
    for (let x = 10; x <= 14; x++) {
      setTerrain(x, y, F);
    }
  }

  // Green - larger ellipse shape, raised with smooth slope
  fillEllipse(12, 19, 4, 3, G);
  fillSmoothMound(12, 19, 3, 7, 2.5);

  // Fringe around green
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const inFringe = (dx * dx) / 25 + (dy * dy) / 16 <= 1;
      const inGreen = (dx * dx) / 16 + (dy * dy) / 9 <= 1;
      if (inFringe && !inGreen) {
        setTerrain(12 + dx, 19 + dy, F);
      }
    }
  }

  // Bunkers - kidney-shaped left, pot bunker right
  fillEllipse(7, 19, 2, 3, B);
  fillCircle(17, 18, 1, B);
  setTerrain(18, 19, B);

  // ========== HOLE 2: Par 4, 380 yards, plays NORTH ==========
  // Dogleg with water hazard, large undulating green

  // Tee box (3x2)
  fillRect(33, 40, 36, 41, T);

  // Fairway - wide landing zone
  for (let y = 32; y <= 39; y++) {
    const width = y >= 36 ? 4 : 3;
    for (let x = 33; x < 33 + width; x++) {
      setTerrain(x, y, F);
    }
  }
  // Approach narrows
  for (let y = 25; y <= 31; y++) {
    setTerrain(34, y, F);
    setTerrain(35, y, F);
    if (y <= 28) setTerrain(36, y, F);
  }

  // Water hazard - sunken pond with gradual banks
  fillEllipse(31, 30, 2, 3, W);
  setTerrain(29, 31, W);
  setTerrain(30, 32, W);
  // Gradual slope down to water
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const x = 31 + dx;
      const y = 30 + dy;
      if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
        if (dist <= 3) {
          elevation[y][x] = -2.0;
        } else if (dist <= 6) {
          const t = (dist - 3) / 3;
          elevation[y][x] = Math.min(elevation[y][x], -2.0 * (1 - t));
        }
      }
    }
  }

  // Fairway bunker cluster on right
  fillEllipse(38, 33, 2, 1, B);

  // Green - large kidney shape
  fillEllipse(35, 21, 4, 3, G);
  setTerrain(32, 20, G); setTerrain(32, 21, G);
  setTerrain(38, 21, G); setTerrain(38, 22, G);
  // Raised green with smooth slope
  fillSmoothMound(35, 21, 4, 8, 2.5);

  // Greenside bunkers
  fillEllipse(31, 22, 1, 2, B);
  fillCircle(39, 20, 1, B);

  // ========== HOLE 3: Par 3, 140 yards, plays WEST ==========
  // Over water to peninsula green

  // Tee box (2x3)
  fillRect(32, 43, 33, 46, T);

  // Fairway approach
  for (let x = 17; x <= 30; x++) {
    setTerrain(x, 44, F);
    setTerrain(x, 45, F);
  }

  // Green - elongated, raised with smooth slope
  fillEllipse(12, 45, 3, 4, G);
  fillSmoothMound(12, 45, 4, 8, 2.5);

  // Dramatic bunkers
  fillEllipse(12, 40, 3, 1, B);
  fillEllipse(8, 45, 1, 3, B);
  fillCircle(16, 47, 1, B);

  // ========== TERRAIN FEATURES ==========

  // Rolling hills in corners with smooth falloff
  fillSmoothMound(3, 3, 3, 8, 4.0);
  fillSmoothMound(46, 3, 3, 8, 4.0);
  fillSmoothMound(46, 52, 3, 8, 3.5);

  // Mounding between holes
  fillSmoothMound(24, 33, 4, 10, 3.0);

  return { layout, elevation, vertexElevations };
}

const { layout: course3Layout, elevation: course3Elevation, vertexElevations: course3VertexElevations } = generate3HoleCourse();

export const COURSE_3_HOLE: CourseData = {
  name: 'Sunrise Valley - 3 Hole',
  width: 50,
  height: 55,
  par: 10,
  layout: course3Layout,
  elevation: course3Elevation,
  vertexElevations: course3VertexElevations,
  obstacles: [
    // Trees framing Hole 1 green
    { x: 5, y: 17, type: 2 },
    { x: 4, y: 21, type: 1 },
    { x: 19, y: 17, type: 2 },
    { x: 20, y: 21, type: 1 },
    // Along Hole 1 fairway
    { x: 7, y: 25, type: 1 },
    { x: 17, y: 26, type: 2 },

    // Trees around Hole 2
    { x: 28, y: 20, type: 2 },
    { x: 41, y: 19, type: 1 },
    { x: 42, y: 23, type: 2 },
    // Near water feature
    { x: 27, y: 28, type: 1 },
    { x: 28, y: 33, type: 2 },
    // Right side of fairway
    { x: 41, y: 35, type: 1 },
    { x: 40, y: 38, type: 2 },

    // Trees around Hole 3
    { x: 6, y: 43, type: 2 },
    { x: 5, y: 47, type: 1 },
    { x: 17, y: 41, type: 1 },
    { x: 18, y: 49, type: 2 },
    { x: 36, y: 42, type: 2 },
    { x: 35, y: 48, type: 1 },

    // Background trees for depth
    { x: 3, y: 5, type: 1 },
    { x: 8, y: 3, type: 2 },
    { x: 22, y: 4, type: 1 },
    { x: 28, y: 6, type: 2 },
    { x: 44, y: 4, type: 1 },
    { x: 47, y: 8, type: 2 },
    // Edge trees
    { x: 2, y: 33, type: 2 },
    { x: 46, y: 50, type: 1 },
    { x: 47, y: 52, type: 2 },
  ],
  yardsPerGrid: 20,
  holeData: {
    holeNumber: 1,
    par: 3,
    teeBoxes: [
      { name: 'Championship', x: 12, y: 29, elevation: 0, yardage: 160, par: 3 },
      { name: 'Forward', x: 12, y: 28, elevation: 0, yardage: 140, par: 3 },
    ],
    pinPosition: { x: 12, y: 19, elevation: 1.5 },
    green: {
      frontEdge: { x: 12, y: 22 },
      center: { x: 12, y: 19 },
      backEdge: { x: 12, y: 16 },
    },
    idealPath: [
      { x: 12, y: 29, description: 'Tee shot' },
      { x: 12, y: 19, description: 'Green' },
    ],
    hazards: [
      {
        type: 'bunker',
        name: 'Left greenside',
        positions: [{ x: 7, y: 17 }, { x: 7, y: 19 }, { x: 7, y: 21 }],
      },
      {
        type: 'bunker',
        name: 'Pot bunker right',
        positions: [{ x: 17, y: 18 }, { x: 18, y: 19 }],
      },
    ],
  },
  vectorShapes: [
    // Hole 1 green - smooth ellipse (16 points for extra smoothness)
    createEllipseShape('green', 12, 19, 4.5, 3.5, 0, 16, 1.0),
    // Hole 1 bunkers
    createEllipseShape('bunker', 7, 19, 2.5, 3, 0.2, 12, 1.0),
    createCircleShape('bunker', 17.5, 18.5, 1.8, 10, 1.0),

    // Hole 2 green - larger kidney shape
    createEllipseShape('green', 35, 21, 5, 3.5, -0.1, 16, 1.0),
    // Hole 2 bunkers
    createEllipseShape('bunker', 31, 22, 1.5, 2.5, 0.3, 12, 1.0),
    createCircleShape('bunker', 39.5, 20, 1.5, 10, 1.0),
    // Hole 2 water
    createEllipseShape('water', 31, 30, 3, 4, 0.2, 16, 1.0),

    // Hole 3 green - elongated
    createEllipseShape('green', 12, 45, 4, 5, 0, 16, 1.0),
    // Hole 3 bunkers
    createEllipseShape('bunker', 12, 40, 3.5, 1.5, 0, 12, 1.0),
    createEllipseShape('bunker', 7.5, 45, 1.5, 3.5, 0, 12, 1.0),
    createCircleShape('bunker', 16.5, 47, 1.5, 10, 1.0),
  ],
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
