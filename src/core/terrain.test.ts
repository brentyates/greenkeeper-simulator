import { describe, it, expect } from 'vitest';
import {
  getTerrainType,
  getObstacleType,
  getInitialValues,
  gridToScreen,
  screenToGrid,
  calculateHealth,
  isWalkable,
  canMoveFromTo,
  getRampDirection,
  getCellsInRadius,
  getCornerHeights,
  getSlopeType,
  getBaseElevationForSlope,
  getTerrainSpeedModifier,
  getTerrainMowable,
  getTerrainWaterable,
  getTerrainFertilizable,
  clampToGrid,
  isGrassTerrain,
  isNonRough,
  getTerrainDisplayName,
  getObstacleDisplayName,
  getTerrainThresholds,
  getGrassState,
  getOptimalDiagonal,
  validateSlopeConstraint,
  getSurfacePhysics,
  getSlopeFrictionModifier,
  calculateSlopeAngle,
  getSlopeVector,
  getTileNormal,
  isSubmerged,
  isPartiallySubmerged,
  getWaterDepth,
  getEffectiveTerrainType,
  DEFAULT_WATER_LEVEL,
  MAX_SLOPE_DELTA,
  getMaxCornerDelta,
  isValidSlopeConstraint,
  validateTerrainData,
  createRCTTileData,
  parseRCTTileHeights,
  exportToRCTFormat,
  importFromRCTFormat,
  getTerrainCode,
  getAdjacentPositions,
  RCTTerrainData,
  CellState,
  CornerHeights,
  RCTCornerHeights,
  TILE_WIDTH,
  ELEVATION_HEIGHT,
  TERRAIN_CODES,
  OBSTACLE_CODES,
} from './terrain';

describe('Terrain Type Mapping', () => {
  it('maps code 0 to fairway', () => {
    expect(getTerrainType(0)).toBe('fairway');
  });

  it('maps code 1 to rough', () => {
    expect(getTerrainType(1)).toBe('rough');
  });

  it('maps code 2 to green', () => {
    expect(getTerrainType(2)).toBe('green');
  });

  it('maps code 3 to bunker', () => {
    expect(getTerrainType(3)).toBe('bunker');
  });

  it('maps code 4 to water', () => {
    expect(getTerrainType(4)).toBe('water');
  });

  it('maps code 5 to tee', () => {
    expect(getTerrainType(5)).toBe('tee');
  });

  it('maps unknown codes to rough', () => {
    expect(getTerrainType(99)).toBe('rough');
    expect(getTerrainType(-1)).toBe('rough');
  });
});

describe('Obstacle Type Mapping', () => {
  it('maps code 0 to none', () => {
    expect(getObstacleType(0)).toBe('none');
  });

  it('maps code 1 to tree', () => {
    expect(getObstacleType(1)).toBe('tree');
  });

  it('maps code 2 to pine_tree', () => {
    expect(getObstacleType(2)).toBe('pine_tree');
  });

  it('maps code 3 to shrub', () => {
    expect(getObstacleType(3)).toBe('shrub');
  });

  it('maps code 4 to bush', () => {
    expect(getObstacleType(4)).toBe('bush');
  });

  it('maps unknown codes to none', () => {
    expect(getObstacleType(99)).toBe('none');
  });
});

describe('Initial Values', () => {
  it('sets fairway with medium height and good moisture/nutrients', () => {
    const values = getInitialValues('fairway');
    expect(values.height).toBe(30);
    expect(values.moisture).toBe(60);
    expect(values.nutrients).toBe(70);
  });

  it('sets rough with tall height and moderate stats', () => {
    const values = getInitialValues('rough');
    expect(values.height).toBe(70);
    expect(values.moisture).toBe(50);
    expect(values.nutrients).toBe(50);
  });

  it('sets green with very short height and high stats', () => {
    const values = getInitialValues('green');
    expect(values.height).toBe(10);
    expect(values.moisture).toBe(70);
    expect(values.nutrients).toBe(80);
  });

  it('sets bunker with no height and low moisture', () => {
    const values = getInitialValues('bunker');
    expect(values.height).toBe(0);
    expect(values.moisture).toBe(20);
    expect(values.nutrients).toBe(0);
  });

  it('sets water with full moisture', () => {
    const values = getInitialValues('water');
    expect(values.height).toBe(0);
    expect(values.moisture).toBe(100);
    expect(values.nutrients).toBe(0);
  });

  it('sets tee with short height and good stats', () => {
    const values = getInitialValues('tee');
    expect(values.height).toBe(15);
    expect(values.moisture).toBe(65);
    expect(values.nutrients).toBe(75);
  });
});

describe('Coordinate Conversion', () => {
  const mapWidth = 50;

  describe('gridToScreen', () => {
    it('converts origin (0,0) to center-top of screen', () => {
      const screen = gridToScreen(0, 0, mapWidth);
      expect(screen.x).toBe(mapWidth * TILE_WIDTH / 2);
      expect(screen.y).toBe(0);
    });

    it('moving right in grid moves right-down on screen', () => {
      const origin = gridToScreen(0, 0, mapWidth);
      const moved = gridToScreen(1, 0, mapWidth);
      expect(moved.x).toBeGreaterThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('moving down in grid moves left-down on screen', () => {
      const origin = gridToScreen(0, 0, mapWidth);
      const moved = gridToScreen(0, 1, mapWidth);
      expect(moved.x).toBeLessThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('applies elevation offset to Y position', () => {
      const flat = gridToScreen(5, 5, mapWidth, 0);
      const elevated = gridToScreen(5, 5, mapWidth, 1);
      expect(elevated.x).toBe(flat.x);
      expect(elevated.y).toBe(flat.y - ELEVATION_HEIGHT);
    });

    it('higher elevation moves sprite higher on screen', () => {
      const low = gridToScreen(5, 5, mapWidth, 0);
      const high = gridToScreen(5, 5, mapWidth, 2);
      expect(high.y).toBeLessThan(low.y);
      expect(high.y).toBe(low.y - 2 * ELEVATION_HEIGHT);
    });
  });

  describe('screenToGrid', () => {
    it('converts center-top of screen to origin', () => {
      const grid = screenToGrid(mapWidth * TILE_WIDTH / 2, 0, mapWidth);
      expect(grid.x).toBe(0);
      expect(grid.y).toBe(0);
    });

    it('is approximately inverse of gridToScreen (without elevation)', () => {
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const screen = gridToScreen(x, y, mapWidth);
          const back = screenToGrid(screen.x, screen.y, mapWidth);
          expect(back.x).toBe(x);
          expect(back.y).toBe(y);
        }
      }
    });
  });
});

describe('Health Calculation', () => {
  function makeCell(overrides: Partial<CellState>): CellState {
    return {
      x: 0, y: 0,
      type: 'fairway',
      height: 50,
      moisture: 50,
      nutrients: 50,
      health: 100,
      elevation: 0,
      obstacle: 'none',
      lastMowed: 0,
      lastWatered: 0,
      lastFertilized: 0,
      ...overrides
    };
  }

  it('bunker always has 100 health', () => {
    const cell = makeCell({ type: 'bunker', moisture: 0, nutrients: 0, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('water always has 100 health', () => {
    const cell = makeCell({ type: 'water', moisture: 100, nutrients: 0, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('perfect conditions yield 100 health', () => {
    const cell = makeCell({ moisture: 100, nutrients: 100, height: 0 });
    expect(calculateHealth(cell)).toBe(100);
  });

  it('worst conditions yield 0 health', () => {
    const cell = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(cell)).toBe(0);
  });

  it('moisture contributes 35% to health', () => {
    const high = makeCell({ moisture: 100, nutrients: 0, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(35);
  });

  it('nutrients contribute 35% to health', () => {
    const high = makeCell({ moisture: 0, nutrients: 100, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(35);
  });

  it('height contributes 30% to health (inverted)', () => {
    const short = makeCell({ moisture: 0, nutrients: 0, height: 0 });
    const tall = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(short) - calculateHealth(tall)).toBe(30);
  });

  it('health is clamped between 0 and 100', () => {
    const overMax = makeCell({ moisture: 150, nutrients: 150, height: -50 });
    const underMin = makeCell({ moisture: -50, nutrients: -50, height: 150 });
    expect(calculateHealth(overMax)).toBe(100);
    expect(calculateHealth(underMin)).toBe(0);
  });
});

describe('Walkability', () => {
  function makeCell(overrides: Partial<CellState>): CellState {
    return {
      x: 0, y: 0,
      type: 'fairway',
      height: 50,
      moisture: 50,
      nutrients: 50,
      health: 100,
      elevation: 0,
      obstacle: 'none',
      lastMowed: 0,
      lastWatered: 0,
      lastFertilized: 0,
      ...overrides
    };
  }

  describe('isWalkable', () => {
    it('returns false for null cell', () => {
      expect(isWalkable(null)).toBe(false);
    });

    it('returns false for water terrain', () => {
      const cell = makeCell({ type: 'water' });
      expect(isWalkable(cell)).toBe(false);
    });

    it('returns true for fairway terrain', () => {
      const cell = makeCell({ type: 'fairway' });
      expect(isWalkable(cell)).toBe(true);
    });

    it('returns true for rough terrain', () => {
      const cell = makeCell({ type: 'rough' });
      expect(isWalkable(cell)).toBe(true);
    });

    it('returns true for bunker terrain', () => {
      const cell = makeCell({ type: 'bunker' });
      expect(isWalkable(cell)).toBe(true);
    });

    it('returns true for green terrain', () => {
      const cell = makeCell({ type: 'green' });
      expect(isWalkable(cell)).toBe(true);
    });

    it('returns false when obstacle is tree', () => {
      const cell = makeCell({ obstacle: 'tree' });
      expect(isWalkable(cell)).toBe(false);
    });

    it('returns false when obstacle is pine_tree', () => {
      const cell = makeCell({ obstacle: 'pine_tree' });
      expect(isWalkable(cell)).toBe(false);
    });

    it('returns false when obstacle is shrub', () => {
      const cell = makeCell({ obstacle: 'shrub' });
      expect(isWalkable(cell)).toBe(false);
    });

    it('returns false when obstacle is bush', () => {
      const cell = makeCell({ obstacle: 'bush' });
      expect(isWalkable(cell)).toBe(false);
    });
  });

  describe('canMoveFromTo', () => {
    it('returns false when target cell is null', () => {
      const from = makeCell({});
      expect(canMoveFromTo(from, null)).toBe(false);
    });

    it('returns false when source cell is null', () => {
      const to = makeCell({});
      expect(canMoveFromTo(null, to)).toBe(false);
    });

    it('returns false when target is not walkable', () => {
      const from = makeCell({});
      const to = makeCell({ type: 'water' });
      expect(canMoveFromTo(from, to)).toBe(false);
    });

    it('allows movement between same elevation', () => {
      const from = makeCell({ elevation: 1 });
      const to = makeCell({ elevation: 1 });
      expect(canMoveFromTo(from, to)).toBe(true);
    });

    it('allows movement with elevation difference of 1', () => {
      const from = makeCell({ elevation: 0 });
      const to = makeCell({ elevation: 1 });
      expect(canMoveFromTo(from, to)).toBe(true);
    });

    it('allows movement down with elevation difference of 1', () => {
      const from = makeCell({ elevation: 2 });
      const to = makeCell({ elevation: 1 });
      expect(canMoveFromTo(from, to)).toBe(true);
    });

    it('blocks movement with elevation difference of 2 or more', () => {
      const from = makeCell({ elevation: 0 });
      const to = makeCell({ elevation: 2 });
      expect(canMoveFromTo(from, to)).toBe(false);
    });

    it('blocks movement down with elevation difference of 2 or more', () => {
      const from = makeCell({ elevation: 3 });
      const to = makeCell({ elevation: 1 });
      expect(canMoveFromTo(from, to)).toBe(false);
    });
  });
});

describe('Ramp Direction Detection', () => {
  it('detects north ramp when north neighbor is 1 higher', () => {
    const result = getRampDirection(0, 1, 0, 0, 0);
    expect(result).toBe('north');
  });

  it('detects south ramp when south neighbor is 1 higher', () => {
    const result = getRampDirection(0, 0, 1, 0, 0);
    expect(result).toBe('south');
  });

  it('detects east ramp when east neighbor is 1 higher', () => {
    const result = getRampDirection(0, 0, 0, 1, 0);
    expect(result).toBe('east');
  });

  it('detects west ramp when west neighbor is 1 higher', () => {
    const result = getRampDirection(0, 0, 0, 0, 1);
    expect(result).toBe('west');
  });

  it('returns null when on flat terrain', () => {
    const result = getRampDirection(0, 0, 0, 0, 0);
    expect(result).toBeNull();
  });

  it('returns null when elevation difference is more than 1', () => {
    const result = getRampDirection(0, 2, 0, 0, 0);
    expect(result).toBeNull();
  });

  it('returns null when both opposing sides are elevated', () => {
    const result = getRampDirection(0, 1, 1, 0, 0);
    expect(result).toBeNull();
  });

  it('handles null neighbors by treating as same elevation', () => {
    const result = getRampDirection(0, 1, null, null, null);
    expect(result).toBe('north');
  });

  it('treats all null neighbors as same elevation', () => {
    const result = getRampDirection(1, null, null, null, null);
    expect(result).toBeNull();
  });
});

describe('Area Selection', () => {
  it('returns single cell for radius 0', () => {
    const cells = getCellsInRadius(5, 5, 0);
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('returns 5 cells for radius 1 (diamond pattern)', () => {
    const cells = getCellsInRadius(5, 5, 1);
    expect(cells).toHaveLength(5);
    expect(cells).toContainEqual({ x: 5, y: 5 });
    expect(cells).toContainEqual({ x: 4, y: 5 });
    expect(cells).toContainEqual({ x: 6, y: 5 });
    expect(cells).toContainEqual({ x: 5, y: 4 });
    expect(cells).toContainEqual({ x: 5, y: 6 });
  });

  it('returns 13 cells for radius 2', () => {
    const cells = getCellsInRadius(5, 5, 2);
    expect(cells).toHaveLength(13);
  });

  it('handles negative center coordinates', () => {
    const cells = getCellsInRadius(-5, -5, 1);
    expect(cells).toContainEqual({ x: -5, y: -5 });
    expect(cells).toContainEqual({ x: -6, y: -5 });
  });

  it('returns empty array for negative radius', () => {
    const cells = getCellsInRadius(5, 5, -1);
    expect(cells).toEqual([]);
  });
});

describe('Corner Heights Calculation', () => {
  it('returns all zeros for flat terrain', () => {
    const corners = getCornerHeights(0, 0, 0, 0, 0);
    expect(corners).toEqual({ n: 0, e: 0, s: 0, w: 0 });
  });

  it('marks north corner as raised when north neighbor is higher', () => {
    const corners = getCornerHeights(0, 1, 0, 0, 0);
    expect(corners.n).toBe(1);
    expect(corners.e).toBe(0);
    expect(corners.s).toBe(0);
    expect(corners.w).toBe(0);
  });

  it('marks east corner as raised when east neighbor is higher', () => {
    const corners = getCornerHeights(0, 0, 1, 0, 0);
    expect(corners.e).toBe(1);
  });

  it('marks south corner as raised when south neighbor is higher', () => {
    const corners = getCornerHeights(0, 0, 0, 1, 0);
    expect(corners.s).toBe(1);
  });

  it('marks west corner as raised when west neighbor is higher', () => {
    const corners = getCornerHeights(0, 0, 0, 0, 1);
    expect(corners.w).toBe(1);
  });

  it('marks all corners raised when all neighbors are higher', () => {
    const corners = getCornerHeights(0, 1, 1, 1, 1);
    expect(corners).toEqual({ n: 1, e: 1, s: 1, w: 1 });
  });

  it('treats null neighbors as same elevation', () => {
    const corners = getCornerHeights(0, null, null, null, null);
    expect(corners).toEqual({ n: 0, e: 0, s: 0, w: 0 });
  });

  it('only marks raised if neighbor is strictly higher', () => {
    const corners = getCornerHeights(1, 1, 1, 1, 1);
    expect(corners).toEqual({ n: 0, e: 0, s: 0, w: 0 });
  });

  it('correctly identifies adjacent raised corners (NE edge)', () => {
    const corners = getCornerHeights(0, 1, 1, 0, 0);
    expect(corners.n).toBe(1);
    expect(corners.e).toBe(1);
    expect(corners.s).toBe(0);
    expect(corners.w).toBe(0);
  });
});

describe('Slope Type Detection', () => {
  it('returns flat when no corners are raised', () => {
    const corners: CornerHeights = { n: 0, e: 0, s: 0, w: 0 };
    expect(getSlopeType(corners)).toBe('flat');
  });

  describe('single corner slopes', () => {
    it('detects slope_n when north corner is raised', () => {
      expect(getSlopeType({ n: 1, e: 0, s: 0, w: 0 })).toBe('slope_n');
    });

    it('detects slope_e when east corner is raised', () => {
      expect(getSlopeType({ n: 0, e: 1, s: 0, w: 0 })).toBe('slope_e');
    });

    it('detects slope_s when south corner is raised', () => {
      expect(getSlopeType({ n: 0, e: 0, s: 1, w: 0 })).toBe('slope_s');
    });

    it('detects slope_w when west corner is raised', () => {
      expect(getSlopeType({ n: 0, e: 0, s: 0, w: 1 })).toBe('slope_w');
    });
  });

  describe('edge slopes (two adjacent corners)', () => {
    it('detects slope_ne when N and E corners are raised', () => {
      expect(getSlopeType({ n: 1, e: 1, s: 0, w: 0 })).toBe('slope_ne');
    });

    it('detects slope_se when E and S corners are raised', () => {
      expect(getSlopeType({ n: 0, e: 1, s: 1, w: 0 })).toBe('slope_se');
    });

    it('detects slope_sw when S and W corners are raised', () => {
      expect(getSlopeType({ n: 0, e: 0, s: 1, w: 1 })).toBe('slope_sw');
    });

    it('detects slope_nw when N and W corners are raised', () => {
      expect(getSlopeType({ n: 1, e: 0, s: 0, w: 1 })).toBe('slope_nw');
    });
  });

  describe('saddle slopes (two opposite corners)', () => {
    it('detects saddle_ns when N and S corners are raised', () => {
      expect(getSlopeType({ n: 1, e: 0, s: 1, w: 0 })).toBe('saddle_ns');
    });

    it('detects saddle_ew when E and W corners are raised', () => {
      expect(getSlopeType({ n: 0, e: 1, s: 0, w: 1 })).toBe('saddle_ew');
    });
  });

  describe('valley slopes (three corners raised, one lowered)', () => {
    it('detects valley_n when all except N are raised', () => {
      expect(getSlopeType({ n: 0, e: 1, s: 1, w: 1 })).toBe('valley_n');
    });

    it('detects valley_e when all except E are raised', () => {
      expect(getSlopeType({ n: 1, e: 0, s: 1, w: 1 })).toBe('valley_e');
    });

    it('detects valley_s when all except S are raised', () => {
      expect(getSlopeType({ n: 1, e: 1, s: 0, w: 1 })).toBe('valley_s');
    });

    it('detects valley_w when all except W are raised', () => {
      expect(getSlopeType({ n: 1, e: 1, s: 1, w: 0 })).toBe('valley_w');
    });
  });

  describe('all corners raised', () => {
    it('returns flat when all corners are equally raised', () => {
      expect(getSlopeType({ n: 1, e: 1, s: 1, w: 1 })).toBe('flat');
    });
  });
});

describe('Base Elevation for Slope', () => {
  it('returns 0 for all-zero corners', () => {
    expect(getBaseElevationForSlope({ n: 0, e: 0, s: 0, w: 0 })).toBe(0);
  });

  it('returns 0 when any corner is 0', () => {
    expect(getBaseElevationForSlope({ n: 1, e: 1, s: 1, w: 0 })).toBe(0);
    expect(getBaseElevationForSlope({ n: 0, e: 1, s: 1, w: 1 })).toBe(0);
  });

  it('returns 1 when all corners are 1', () => {
    expect(getBaseElevationForSlope({ n: 1, e: 1, s: 1, w: 1 })).toBe(1);
  });

  it('returns minimum of all corner heights', () => {
    expect(getBaseElevationForSlope({ n: 0, e: 1, s: 0, w: 1 })).toBe(0);
    expect(getBaseElevationForSlope({ n: 1, e: 0, s: 1, w: 0 })).toBe(0);
  });
});

describe('Terrain Constants', () => {
  it('TERRAIN_CODES match getTerrainType mappings', () => {
    expect(getTerrainType(TERRAIN_CODES.FAIRWAY)).toBe('fairway');
    expect(getTerrainType(TERRAIN_CODES.ROUGH)).toBe('rough');
    expect(getTerrainType(TERRAIN_CODES.GREEN)).toBe('green');
    expect(getTerrainType(TERRAIN_CODES.BUNKER)).toBe('bunker');
    expect(getTerrainType(TERRAIN_CODES.WATER)).toBe('water');
  });

  it('OBSTACLE_CODES match getObstacleType mappings', () => {
    expect(getObstacleType(OBSTACLE_CODES.NONE)).toBe('none');
    expect(getObstacleType(OBSTACLE_CODES.TREE)).toBe('tree');
    expect(getObstacleType(OBSTACLE_CODES.PINE_TREE)).toBe('pine_tree');
    expect(getObstacleType(OBSTACLE_CODES.SHRUB)).toBe('shrub');
    expect(getObstacleType(OBSTACLE_CODES.BUSH)).toBe('bush');
  });
});

describe('Terrain Speed Modifier', () => {
  it('fairway has full speed', () => {
    expect(getTerrainSpeedModifier('fairway')).toBe(1.0);
  });

  it('green has full speed', () => {
    expect(getTerrainSpeedModifier('green')).toBe(1.0);
  });

  it('rough slows movement', () => {
    expect(getTerrainSpeedModifier('rough')).toBe(0.7);
  });

  it('bunker significantly slows movement', () => {
    expect(getTerrainSpeedModifier('bunker')).toBe(0.5);
  });

  it('water blocks movement', () => {
    expect(getTerrainSpeedModifier('water')).toBe(0.0);
  });

  it('tee has full speed', () => {
    expect(getTerrainSpeedModifier('tee')).toBe(1.0);
  });
});

describe('Terrain Capabilities', () => {
  describe('getTerrainMowable', () => {
    it('returns true for grass terrains', () => {
      expect(getTerrainMowable('fairway')).toBe(true);
      expect(getTerrainMowable('rough')).toBe(true);
      expect(getTerrainMowable('green')).toBe(true);
    });

    it('returns false for non-grass terrains', () => {
      expect(getTerrainMowable('bunker')).toBe(false);
      expect(getTerrainMowable('water')).toBe(false);
    });
  });

  describe('getTerrainWaterable', () => {
    it('returns true for grass terrains', () => {
      expect(getTerrainWaterable('fairway')).toBe(true);
      expect(getTerrainWaterable('rough')).toBe(true);
      expect(getTerrainWaterable('green')).toBe(true);
    });

    it('returns false for non-grass terrains', () => {
      expect(getTerrainWaterable('bunker')).toBe(false);
      expect(getTerrainWaterable('water')).toBe(false);
    });
  });

  describe('getTerrainFertilizable', () => {
    it('returns true for grass terrains', () => {
      expect(getTerrainFertilizable('fairway')).toBe(true);
      expect(getTerrainFertilizable('rough')).toBe(true);
      expect(getTerrainFertilizable('green')).toBe(true);
    });

    it('returns false for non-grass terrains', () => {
      expect(getTerrainFertilizable('bunker')).toBe(false);
      expect(getTerrainFertilizable('water')).toBe(false);
    });
  });
});

describe('clampToGrid', () => {
  it('clamps values within bounds', () => {
    expect(clampToGrid(5, 0, 10)).toBe(5);
    expect(clampToGrid(0, 0, 10)).toBe(0);
    expect(clampToGrid(9.9, 0, 10)).toBe(9);
  });

  it('clamps values below minimum to minimum', () => {
    expect(clampToGrid(-5, 0, 10)).toBe(0);
    expect(clampToGrid(-1, 0, 10)).toBe(0);
  });

  it('clamps values at or above maximum to max-1', () => {
    expect(clampToGrid(10, 0, 10)).toBe(9);
    expect(clampToGrid(15, 0, 10)).toBe(9);
  });

  it('floors floating point values', () => {
    expect(clampToGrid(5.9, 0, 10)).toBe(5);
    expect(clampToGrid(5.1, 0, 10)).toBe(5);
  });

  it('works with non-zero minimum', () => {
    expect(clampToGrid(0, 5, 15)).toBe(5);
    expect(clampToGrid(10, 5, 15)).toBe(10);
    expect(clampToGrid(20, 5, 15)).toBe(14);
  });
});

describe('isGrassTerrain', () => {
  it('returns true for fairway', () => {
    expect(isGrassTerrain('fairway')).toBe(true);
  });

  it('returns true for rough', () => {
    expect(isGrassTerrain('rough')).toBe(true);
  });

  it('returns true for green', () => {
    expect(isGrassTerrain('green')).toBe(true);
  });

  it('returns false for bunker', () => {
    expect(isGrassTerrain('bunker')).toBe(false);
  });

  it('returns false for water', () => {
    expect(isGrassTerrain('water')).toBe(false);
  });
});

describe('isNonRough', () => {
  it('returns false for rough', () => {
    expect(isNonRough('rough')).toBe(false);
  });

  it('returns true for fairway', () => {
    expect(isNonRough('fairway')).toBe(true);
  });

  it('returns true for green', () => {
    expect(isNonRough('green')).toBe(true);
  });

  it('returns true for tee', () => {
    expect(isNonRough('tee')).toBe(true);
  });
});

describe('getTerrainDisplayName', () => {
  it('returns Fairway for fairway', () => {
    expect(getTerrainDisplayName('fairway')).toBe('Fairway');
  });

  it('returns Rough for rough', () => {
    expect(getTerrainDisplayName('rough')).toBe('Rough');
  });

  it('returns Green for green', () => {
    expect(getTerrainDisplayName('green')).toBe('Green');
  });

  it('returns Bunker for bunker', () => {
    expect(getTerrainDisplayName('bunker')).toBe('Bunker');
  });

  it('returns Water for water', () => {
    expect(getTerrainDisplayName('water')).toBe('Water');
  });

  it('returns Tee Box for tee', () => {
    expect(getTerrainDisplayName('tee')).toBe('Tee Box');
  });
});

describe('getObstacleDisplayName', () => {
  it('returns None for none', () => {
    expect(getObstacleDisplayName('none')).toBe('None');
  });

  it('returns Tree for tree', () => {
    expect(getObstacleDisplayName('tree')).toBe('Tree');
  });

  it('returns Pine Tree for pine_tree', () => {
    expect(getObstacleDisplayName('pine_tree')).toBe('Pine Tree');
  });

  it('returns Shrub for shrub', () => {
    expect(getObstacleDisplayName('shrub')).toBe('Shrub');
  });

  it('returns Bush for bush', () => {
    expect(getObstacleDisplayName('bush')).toBe('Bush');
  });
});

describe('getTerrainThresholds', () => {
  it('returns correct thresholds for fairway', () => {
    const thresholds = getTerrainThresholds('fairway');
    expect(thresholds.mownHeight).toBe(20);
    expect(thresholds.growingHeight).toBe(45);
  });

  it('returns correct thresholds for rough', () => {
    const thresholds = getTerrainThresholds('rough');
    expect(thresholds.mownHeight).toBe(30);
    expect(thresholds.growingHeight).toBe(60);
  });

  it('returns correct thresholds for green', () => {
    const thresholds = getTerrainThresholds('green');
    expect(thresholds.mownHeight).toBe(10);
    expect(thresholds.growingHeight).toBe(22);
  });

  it('returns correct thresholds for tee', () => {
    const thresholds = getTerrainThresholds('tee');
    expect(thresholds.mownHeight).toBe(12);
    expect(thresholds.growingHeight).toBe(25);
  });

  it('returns default thresholds for non-grass terrain', () => {
    const bunkerThresholds = getTerrainThresholds('bunker');
    expect(bunkerThresholds.mownHeight).toBe(30);
    expect(bunkerThresholds.growingHeight).toBe(60);

    const waterThresholds = getTerrainThresholds('water');
    expect(waterThresholds.mownHeight).toBe(30);
    expect(waterThresholds.growingHeight).toBe(60);
  });

  it('green has the strictest thresholds', () => {
    const green = getTerrainThresholds('green');
    const fairway = getTerrainThresholds('fairway');
    const rough = getTerrainThresholds('rough');

    expect(green.mownHeight).toBeLessThan(fairway.mownHeight);
    expect(fairway.mownHeight).toBeLessThan(rough.mownHeight);
  });
});

describe('getGrassState', () => {
  const createCell = (type: 'fairway' | 'rough' | 'green' | 'bunker' | 'water', height: number): CellState => ({
    x: 0,
    y: 0,
    type,
    height,
    moisture: 50,
    nutrients: 50,
    health: 80,
    elevation: 0,
    obstacle: 'none',
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
  });

  describe('fairway', () => {
    it('returns mown when height <= 20', () => {
      expect(getGrassState(createCell('fairway', 0))).toBe('mown');
      expect(getGrassState(createCell('fairway', 10))).toBe('mown');
      expect(getGrassState(createCell('fairway', 20))).toBe('mown');
    });

    it('returns growing when height > 20 and <= 45', () => {
      expect(getGrassState(createCell('fairway', 21))).toBe('growing');
      expect(getGrassState(createCell('fairway', 30))).toBe('growing');
      expect(getGrassState(createCell('fairway', 45))).toBe('growing');
    });

    it('returns unmown when height > 45', () => {
      expect(getGrassState(createCell('fairway', 46))).toBe('unmown');
      expect(getGrassState(createCell('fairway', 100))).toBe('unmown');
    });
  });

  describe('green', () => {
    it('returns mown when height <= 10', () => {
      expect(getGrassState(createCell('green', 0))).toBe('mown');
      expect(getGrassState(createCell('green', 5))).toBe('mown');
      expect(getGrassState(createCell('green', 10))).toBe('mown');
    });

    it('returns growing when height > 10 and <= 22', () => {
      expect(getGrassState(createCell('green', 11))).toBe('growing');
      expect(getGrassState(createCell('green', 15))).toBe('growing');
      expect(getGrassState(createCell('green', 22))).toBe('growing');
    });

    it('returns unmown when height > 22', () => {
      expect(getGrassState(createCell('green', 23))).toBe('unmown');
      expect(getGrassState(createCell('green', 50))).toBe('unmown');
    });
  });

  describe('rough', () => {
    it('returns mown when height <= 30', () => {
      expect(getGrassState(createCell('rough', 0))).toBe('mown');
      expect(getGrassState(createCell('rough', 15))).toBe('mown');
      expect(getGrassState(createCell('rough', 30))).toBe('mown');
    });

    it('returns growing when height > 30 and <= 60', () => {
      expect(getGrassState(createCell('rough', 31))).toBe('growing');
      expect(getGrassState(createCell('rough', 45))).toBe('growing');
      expect(getGrassState(createCell('rough', 60))).toBe('growing');
    });

    it('returns unmown when height > 60', () => {
      expect(getGrassState(createCell('rough', 61))).toBe('unmown');
      expect(getGrassState(createCell('rough', 100))).toBe('unmown');
    });
  });

  describe('non-grass terrain', () => {
    it('returns mown for bunker', () => {
      expect(getGrassState(createCell('bunker', 50))).toBe('mown');
    });

    it('returns mown for water', () => {
      expect(getGrassState(createCell('water', 50))).toBe('mown');
    });
  });
});

describe('RCT Optimal Diagonal', () => {
  it('chooses nwse diagonal when nw-se difference is smaller', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 0, sw: 1 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('chooses nesw diagonal when ne-sw difference is smaller', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 2, sw: 1 };
    expect(getOptimalDiagonal(corners)).toBe('nesw');
  });

  it('chooses nwse when diagonals are equal', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('handles north edge raised', () => {
    const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('handles east edge raised - equal diagonals defaults to nwse', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 1, sw: 0 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('handles south edge raised - equal diagonals defaults to nwse', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 1, sw: 1 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('handles west edge raised - equal diagonals defaults to nwse', () => {
    const corners: RCTCornerHeights = { nw: 1, ne: 0, se: 0, sw: 1 };
    expect(getOptimalDiagonal(corners)).toBe('nwse');
  });

  it('handles corner raised - nw only prefers nesw', () => {
    const corners: RCTCornerHeights = { nw: 2, ne: 0, se: 0, sw: 0 };
    expect(getOptimalDiagonal(corners)).toBe('nesw');
  });

  it('handles corner raised - se only prefers nesw', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 2, sw: 0 };
    expect(getOptimalDiagonal(corners)).toBe('nesw');
  });
});

describe('RCT Slope Constraint Validation', () => {
  it('validates flat terrain', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
    expect(validateSlopeConstraint(corners)).toBe(true);
  });

  it('validates single step slopes', () => {
    const corners: RCTCornerHeights = { nw: 1, ne: 0, se: 0, sw: 0 };
    expect(validateSlopeConstraint(corners)).toBe(true);
  });

  it('validates two step slopes within default limit', () => {
    const corners: RCTCornerHeights = { nw: 2, ne: 0, se: 0, sw: 0 };
    expect(validateSlopeConstraint(corners)).toBe(true);
  });

  it('rejects slopes exceeding default limit of 2', () => {
    const corners: RCTCornerHeights = { nw: 3, ne: 0, se: 0, sw: 0 };
    expect(validateSlopeConstraint(corners)).toBe(false);
  });

  it('accepts custom max delta', () => {
    const corners: RCTCornerHeights = { nw: 5, ne: 0, se: 0, sw: 0 };
    expect(validateSlopeConstraint(corners, 5)).toBe(true);
    expect(validateSlopeConstraint(corners, 4)).toBe(false);
  });

  it('validates all corner combinations', () => {
    const corners: RCTCornerHeights = { nw: 1, ne: 2, se: 0, sw: 1 };
    expect(validateSlopeConstraint(corners)).toBe(true);
  });

  it('rejects when any two corners exceed limit', () => {
    const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 3, sw: 0 };
    expect(validateSlopeConstraint(corners)).toBe(false);
  });

  it('validates uniform elevated terrain', () => {
    const corners: RCTCornerHeights = { nw: 5, ne: 5, se: 5, sw: 5 };
    expect(validateSlopeConstraint(corners)).toBe(true);
  });
});

describe('Surface Physics', () => {
  describe('getSurfacePhysics', () => {
    it('returns low friction for green', () => {
      const physics = getSurfacePhysics('green');
      expect(physics.friction).toBe(0.3);
      expect(physics.rollResistance).toBe(0.01);
    });

    it('returns medium friction for fairway', () => {
      const physics = getSurfacePhysics('fairway');
      expect(physics.friction).toBe(0.4);
      expect(physics.rollResistance).toBe(0.02);
    });

    it('returns high friction for rough', () => {
      const physics = getSurfacePhysics('rough');
      expect(physics.friction).toBe(0.7);
      expect(physics.rollResistance).toBe(0.08);
    });

    it('returns very high friction for bunker', () => {
      const physics = getSurfacePhysics('bunker');
      expect(physics.friction).toBe(0.9);
      expect(physics.rollResistance).toBe(0.15);
    });

    it('returns maximum roll resistance for water', () => {
      const physics = getSurfacePhysics('water');
      expect(physics.rollResistance).toBe(1.0);
      expect(physics.bounciness).toBe(0.0);
    });

    it('green has lowest roll resistance', () => {
      const green = getSurfacePhysics('green');
      const fairway = getSurfacePhysics('fairway');
      const rough = getSurfacePhysics('rough');
      expect(green.rollResistance).toBeLessThan(fairway.rollResistance);
      expect(fairway.rollResistance).toBeLessThan(rough.rollResistance);
    });

    it('bunker has lowest bounciness of playable surfaces', () => {
      const bunker = getSurfacePhysics('bunker');
      const rough = getSurfacePhysics('rough');
      const fairway = getSurfacePhysics('fairway');
      expect(bunker.bounciness).toBeLessThan(rough.bounciness);
      expect(rough.bounciness).toBeLessThan(fairway.bounciness);
    });

    it('returns tee properties similar to fairway', () => {
      const tee = getSurfacePhysics('tee');
      expect(tee.friction).toBe(0.35);
      expect(tee.bounciness).toBe(0.3);
      expect(tee.rollResistance).toBe(0.015);
    });
  });

  describe('getSlopeFrictionModifier', () => {
    it('returns 1.0 for flat surface', () => {
      expect(getSlopeFrictionModifier(0)).toBe(1.0);
    });

    it('increases friction on slopes', () => {
      expect(getSlopeFrictionModifier(15)).toBeGreaterThan(1.0);
      expect(getSlopeFrictionModifier(30)).toBeGreaterThan(getSlopeFrictionModifier(15));
    });

    it('handles negative angles', () => {
      expect(getSlopeFrictionModifier(-15)).toBe(getSlopeFrictionModifier(15));
    });

    it('returns ~1.3 at 45 degrees', () => {
      expect(getSlopeFrictionModifier(45)).toBeCloseTo(1.3, 2);
    });
  });
});

describe('Water Level Handling', () => {
  describe('isSubmerged', () => {
    it('returns true when all corners below water level', () => {
      const corners: RCTCornerHeights = { nw: -1, ne: -1, se: -1, sw: -1 };
      expect(isSubmerged(corners, 0)).toBe(true);
    });

    it('returns false when any corner at or above water level', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: -1, se: -1, sw: -1 };
      expect(isSubmerged(corners, 0)).toBe(false);
    });

    it('returns false for elevated terrain', () => {
      const corners: RCTCornerHeights = { nw: 2, ne: 2, se: 2, sw: 2 };
      expect(isSubmerged(corners, 0)).toBe(false);
    });

    it('uses default water level of 0', () => {
      const corners: RCTCornerHeights = { nw: -1, ne: -1, se: -1, sw: -1 };
      expect(isSubmerged(corners)).toBe(true);
    });

    it('respects custom water level', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 1, sw: 1 };
      expect(isSubmerged(corners, 2)).toBe(true);
      expect(isSubmerged(corners, 1)).toBe(false);
    });
  });

  describe('isPartiallySubmerged', () => {
    it('returns true when some but not all corners below water', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: -1, se: -1, sw: 0 };
      expect(isPartiallySubmerged(corners, 0)).toBe(true);
    });

    it('returns false when all corners above water', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 1, sw: 1 };
      expect(isPartiallySubmerged(corners, 0)).toBe(false);
    });

    it('returns false when all corners below water', () => {
      const corners: RCTCornerHeights = { nw: -1, ne: -1, se: -1, sw: -1 };
      expect(isPartiallySubmerged(corners, 0)).toBe(false);
    });

    it('handles single corner below water', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 1, sw: -1 };
      expect(isPartiallySubmerged(corners, 0)).toBe(true);
    });
  });

  describe('getWaterDepth', () => {
    it('returns 0 for terrain above water', () => {
      const corners: RCTCornerHeights = { nw: 2, ne: 2, se: 2, sw: 2 };
      expect(getWaterDepth(corners, 0)).toBe(0);
    });

    it('returns depth for submerged terrain', () => {
      const corners: RCTCornerHeights = { nw: -2, ne: -2, se: -2, sw: -2 };
      expect(getWaterDepth(corners, 0)).toBe(2);
    });

    it('uses minimum corner height', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: -1, se: -3, sw: -2 };
      expect(getWaterDepth(corners, 0)).toBe(3);
    });

    it('respects custom water level', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      expect(getWaterDepth(corners, 2)).toBe(2);
    });
  });

  describe('getEffectiveTerrainType', () => {
    it('returns water when fully submerged', () => {
      const corners: RCTCornerHeights = { nw: -1, ne: -1, se: -1, sw: -1 };
      expect(getEffectiveTerrainType('fairway', corners, 0)).toBe('water');
    });

    it('returns original type when not submerged', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 1, sw: 1 };
      expect(getEffectiveTerrainType('fairway', corners, 0)).toBe('fairway');
      expect(getEffectiveTerrainType('green', corners, 0)).toBe('green');
      expect(getEffectiveTerrainType('bunker', corners, 0)).toBe('bunker');
    });

    it('returns original type when partially submerged', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: -1, se: -1, sw: 1 };
      expect(getEffectiveTerrainType('rough', corners, 0)).toBe('rough');
    });
  });

  it('DEFAULT_WATER_LEVEL is 0', () => {
    expect(DEFAULT_WATER_LEVEL).toBe(0);
  });
});

describe('Slope Constraints (RCT Spec 6.1)', () => {
  it('MAX_SLOPE_DELTA is 2', () => {
    expect(MAX_SLOPE_DELTA).toBe(2);
  });

  describe('getMaxCornerDelta', () => {
    it('returns 0 for flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      expect(getMaxCornerDelta(corners)).toBe(0);
    });

    it('returns correct delta for gentle slope', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      expect(getMaxCornerDelta(corners)).toBe(1);
    });

    it('returns correct delta for valid max slope', () => {
      const corners: RCTCornerHeights = { nw: 2, ne: 2, se: 0, sw: 0 };
      expect(getMaxCornerDelta(corners)).toBe(2);
    });

    it('returns correct delta for steep invalid slope', () => {
      const corners: RCTCornerHeights = { nw: 3, ne: 0, se: 0, sw: 0 };
      expect(getMaxCornerDelta(corners)).toBe(3);
    });

    it('finds max across all corner pairs', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 4, sw: 2 };
      expect(getMaxCornerDelta(corners)).toBe(4);
    });

    it('handles negative elevations', () => {
      const corners: RCTCornerHeights = { nw: -2, ne: 1, se: 0, sw: -1 };
      expect(getMaxCornerDelta(corners)).toBe(3);
    });
  });

  describe('isValidSlopeConstraint', () => {
    it('returns true for flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 5, ne: 5, se: 5, sw: 5 };
      expect(isValidSlopeConstraint(corners)).toBe(true);
    });

    it('returns true for delta of 1', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      expect(isValidSlopeConstraint(corners)).toBe(true);
    });

    it('returns true for delta of exactly 2', () => {
      const corners: RCTCornerHeights = { nw: 2, ne: 2, se: 0, sw: 0 };
      expect(isValidSlopeConstraint(corners)).toBe(true);
    });

    it('returns false for delta of 3', () => {
      const corners: RCTCornerHeights = { nw: 3, ne: 3, se: 0, sw: 0 };
      expect(isValidSlopeConstraint(corners)).toBe(false);
    });

    it('allows custom max delta', () => {
      const corners: RCTCornerHeights = { nw: 4, ne: 0, se: 0, sw: 0 };
      expect(isValidSlopeConstraint(corners, 4)).toBe(true);
      expect(isValidSlopeConstraint(corners, 3)).toBe(false);
    });
  });

  describe('validateTerrainData', () => {
    it('validates empty layout', () => {
      const result = validateTerrainData([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates terrain with no errors', () => {
      const layout = [[0, 1, 2], [1, 0, 3], [2, 3, 0]];
      const result = validateTerrainData(layout);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid terrain codes', () => {
      const layout = [[0, 99, 2], [1, -5, 3]];
      const result = validateTerrainData(layout);
      expect(result.valid).toBe(false);
      expect(result.errors.filter(e => e.type === 'invalid_terrain_code')).toHaveLength(2);
    });

    it('validates elevation with valid slopes', () => {
      const layout = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const elevation = [[0, 0, 0], [0, 1, 0], [0, 0, 0]];
      const result = validateTerrainData(layout, elevation);
      expect(result.valid).toBe(true);
    });

    it('detects slopes that are too steep', () => {
      const layout = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const elevation = [[0, 0, 0], [0, 5, 0], [0, 0, 0]];
      const result = validateTerrainData(layout, elevation);
      expect(result.valid).toBe(false);
      expect(result.errors.filter(e => e.type === 'slope_too_steep').length).toBeGreaterThan(0);
    });

    it('allows custom max slope delta', () => {
      const layout = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const elevation = [[0, 0, 0], [0, 5, 0], [0, 0, 0]];
      const resultStrict = validateTerrainData(layout, elevation, 2);
      const resultPermissive = validateTerrainData(layout, elevation, 10);
      expect(resultStrict.valid).toBe(false);
      expect(resultPermissive.valid).toBe(true);
    });

    it('returns error details with position', () => {
      const layout = [[0, 99], [0, 0]];
      const result = validateTerrainData(layout);
      expect(result.errors[0].x).toBe(1);
      expect(result.errors[0].y).toBe(0);
      expect(result.errors[0].message).toContain('Invalid terrain code');
    });

    it('handles sparse elevation array', () => {
      const layout = [[0, 0], [0, 0]];
      const elevation = [[0]] as number[][];
      const result = validateTerrainData(layout, elevation);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Slope Calculations', () => {
  describe('calculateSlopeAngle', () => {
    it('returns 0 for flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      expect(calculateSlopeAngle(corners)).toBe(0);
    });

    it('returns 0 for uniformly elevated flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 5, ne: 5, se: 5, sw: 5 };
      expect(calculateSlopeAngle(corners)).toBe(0);
    });

    it('returns positive angle for north-sloping terrain', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      expect(calculateSlopeAngle(corners)).toBeGreaterThan(0);
    });

    it('returns positive angle for east-sloping terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 1, sw: 0 };
      expect(calculateSlopeAngle(corners)).toBeGreaterThan(0);
    });

    it('steeper slopes have larger angles', () => {
      const gentle: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      const steep: RCTCornerHeights = { nw: 2, ne: 2, se: 0, sw: 0 };
      expect(calculateSlopeAngle(steep)).toBeGreaterThan(calculateSlopeAngle(gentle));
    });

    it('respects custom height step', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      const smallStep = calculateSlopeAngle(corners, 8);
      const largeStep = calculateSlopeAngle(corners, 32);
      expect(largeStep).toBeGreaterThan(smallStep);
    });
  });

  describe('getSlopeVector', () => {
    it('returns zero magnitude for flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const vector = getSlopeVector(corners);
      expect(vector.magnitude).toBe(0);
      expect(vector.angle).toBe(0);
    });

    it('returns downward south direction for north-high terrain', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      const vector = getSlopeVector(corners);
      expect(vector.magnitude).toBeGreaterThan(0);
      expect(vector.direction).toBeCloseTo(-90, 0);
    });

    it('returns downward east direction for west-high terrain', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 0, se: 0, sw: 1 };
      const vector = getSlopeVector(corners);
      expect(vector.magnitude).toBeGreaterThan(0);
      expect(Math.abs(vector.direction)).toBeCloseTo(180, 0);
    });

    it('returns downward north direction for south-high terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 1, sw: 1 };
      const vector = getSlopeVector(corners);
      expect(vector.magnitude).toBeGreaterThan(0);
      expect(vector.direction).toBeCloseTo(90, 0);
    });

    it('returns downward west direction for east-high terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 1, sw: 0 };
      const vector = getSlopeVector(corners);
      expect(vector.magnitude).toBeGreaterThan(0);
      expect(vector.direction).toBeCloseTo(0, 0);
    });

    it('angle matches calculateSlopeAngle', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      const vector = getSlopeVector(corners);
      const angle = calculateSlopeAngle(corners);
      expect(vector.angle).toBeCloseTo(angle, 5);
    });
  });

  describe('getTileNormal', () => {
    it('returns upward normal for flat terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const normal = getTileNormal(corners);
      expect(normal.x).toBeCloseTo(0, 5);
      expect(normal.y).toBeCloseTo(0, 5);
      expect(normal.z).toBeCloseTo(1, 5);
    });

    it('returns normalized vector', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 0, se: 0, sw: 1 };
      const normal = getTileNormal(corners);
      const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('tilts toward low side for sloped terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 1, se: 1, sw: 0 };
      const normal = getTileNormal(corners);
      expect(normal.x).toBeLessThan(0);
      expect(normal.z).toBeGreaterThan(0);
    });

    it('different slopes produce different normals', () => {
      const cornersNS: RCTCornerHeights = { nw: 1, ne: 1, se: 0, sw: 0 };
      const cornersEW: RCTCornerHeights = { nw: 0, ne: 1, se: 1, sw: 0 };
      const normalNS = getTileNormal(cornersNS);
      const normalEW = getTileNormal(cornersEW);
      expect(normalNS.x).not.toBeCloseTo(normalEW.x, 3);
    });
  });
});

describe('RCT Data Format', () => {
  describe('createRCTTileData', () => {
    it('creates tile with correct position', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const tile = createRCTTileData(5, 10, corners, 'fairway');
      expect(tile.pos).toEqual([5, 10]);
    });

    it('creates tile with correct heights array', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 2, se: 3, sw: 4 };
      const tile = createRCTTileData(0, 0, corners, 'rough');
      expect(tile.heights).toEqual([1, 2, 3, 4]);
    });

    it('preserves terrain type', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const tile = createRCTTileData(0, 0, corners, 'green');
      expect(tile.type).toBe('green');
    });

    it('sets water flag for submerged tiles', () => {
      const corners: RCTCornerHeights = { nw: -1, ne: -1, se: -1, sw: -1 };
      const tile = createRCTTileData(0, 0, corners, 'fairway', 0);
      expect(tile.flags.water).toBe(true);
    });

    it('clears water flag for elevated tiles', () => {
      const corners: RCTCornerHeights = { nw: 1, ne: 1, se: 1, sw: 1 };
      const tile = createRCTTileData(0, 0, corners, 'fairway', 0);
      expect(tile.flags.water).toBe(false);
    });

    it('sets protected flag for green terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const tile = createRCTTileData(0, 0, corners, 'green');
      expect(tile.flags.protected).toBe(true);
    });

    it('clears protected flag for non-green terrain', () => {
      const corners: RCTCornerHeights = { nw: 0, ne: 0, se: 0, sw: 0 };
      const tile = createRCTTileData(0, 0, corners, 'fairway');
      expect(tile.flags.protected).toBe(false);
    });
  });

  describe('parseRCTTileHeights', () => {
    it('parses heights array to corner heights', () => {
      const corners = parseRCTTileHeights([1, 2, 3, 4]);
      expect(corners.nw).toBe(1);
      expect(corners.ne).toBe(2);
      expect(corners.se).toBe(3);
      expect(corners.sw).toBe(4);
    });

    it('handles zero heights', () => {
      const corners = parseRCTTileHeights([0, 0, 0, 0]);
      expect(corners).toEqual({ nw: 0, ne: 0, se: 0, sw: 0 });
    });
  });

  describe('getTerrainCode', () => {
    it('returns correct code for fairway', () => {
      expect(getTerrainCode('fairway')).toBe(TERRAIN_CODES.FAIRWAY);
    });

    it('returns correct code for rough', () => {
      expect(getTerrainCode('rough')).toBe(TERRAIN_CODES.ROUGH);
    });

    it('returns correct code for green', () => {
      expect(getTerrainCode('green')).toBe(TERRAIN_CODES.GREEN);
    });

    it('returns correct code for bunker', () => {
      expect(getTerrainCode('bunker')).toBe(TERRAIN_CODES.BUNKER);
    });

    it('returns correct code for water', () => {
      expect(getTerrainCode('water')).toBe(TERRAIN_CODES.WATER);
    });

    it('returns correct code for tee', () => {
      expect(getTerrainCode('tee')).toBe(TERRAIN_CODES.TEE);
    });
  });

  describe('exportToRCTFormat', () => {
    it('exports empty layout', () => {
      const data = exportToRCTFormat([], undefined);
      expect(data.gridSize).toEqual([0, 0]);
      expect(data.tiles).toEqual([]);
    });

    it('exports simple 2x2 layout', () => {
      const layout = [[0, 1], [2, 3]];
      const data = exportToRCTFormat(layout, undefined);
      expect(data.gridSize).toEqual([2, 2]);
      expect(data.tiles.length).toBe(4);
    });

    it('includes height step', () => {
      const data = exportToRCTFormat([[0]], undefined, 16);
      expect(data.heightStep).toBe(16);
    });

    it('preserves terrain types', () => {
      const layout = [[0]];
      const data = exportToRCTFormat(layout, undefined);
      expect(data.tiles[0].type).toBe('fairway');
    });

    it('calculates corner heights from elevation', () => {
      const layout = [[0]];
      const elevation = [[2]];
      const data = exportToRCTFormat(layout, elevation);
      expect(data.tiles[0].heights).toEqual([2, 2, 2, 2]);
    });
  });

  describe('importFromRCTFormat', () => {
    it('creates layout from RCT data', () => {
      const data: RCTTerrainData = {
        gridSize: [2, 2],
        heightStep: 16,
        tiles: [
          { pos: [0, 0], heights: [0, 0, 0, 0], type: 'fairway', flags: { water: false, protected: false } },
          { pos: [1, 0], heights: [0, 0, 0, 0], type: 'rough', flags: { water: false, protected: false } },
          { pos: [0, 1], heights: [0, 0, 0, 0], type: 'green', flags: { water: false, protected: true } },
          { pos: [1, 1], heights: [0, 0, 0, 0], type: 'bunker', flags: { water: false, protected: false } }
        ]
      };
      const result = importFromRCTFormat(data);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(result.layout[0][0]).toBe(TERRAIN_CODES.FAIRWAY);
      expect(result.layout[0][1]).toBe(TERRAIN_CODES.ROUGH);
      expect(result.layout[1][0]).toBe(TERRAIN_CODES.GREEN);
      expect(result.layout[1][1]).toBe(TERRAIN_CODES.BUNKER);
    });

    it('calculates average elevation from corner heights', () => {
      const data: RCTTerrainData = {
        gridSize: [1, 1],
        heightStep: 16,
        tiles: [
          { pos: [0, 0], heights: [2, 2, 4, 4], type: 'fairway', flags: { water: false, protected: false } }
        ]
      };
      const result = importFromRCTFormat(data);
      expect(result.elevation?.[0][0]).toBe(3);
    });

    it('ignores out-of-bounds tiles', () => {
      const data: RCTTerrainData = {
        gridSize: [2, 2],
        heightStep: 16,
        tiles: [
          { pos: [5, 5], heights: [0, 0, 0, 0], type: 'water', flags: { water: true, protected: false } }
        ]
      };
      const result = importFromRCTFormat(data);
      expect(result.layout[0][0]).toBe(TERRAIN_CODES.ROUGH);
    });

    it('handles empty tiles array', () => {
      const data: RCTTerrainData = {
        gridSize: [2, 2],
        heightStep: 16,
        tiles: []
      };
      const result = importFromRCTFormat(data);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
    });
  });

  describe('roundtrip conversion', () => {
    it('preserves terrain types through export/import', () => {
      const layout = [[0, 1, 2], [3, 4, 1]];
      const exported = exportToRCTFormat(layout, undefined);
      const imported = importFromRCTFormat(exported);
      expect(imported.layout).toEqual(layout);
    });
  });
});

describe('getAdjacentPositions', () => {
  it('returns 4 cardinal positions by default', () => {
    const positions = getAdjacentPositions(5, 5);
    expect(positions).toHaveLength(4);
    expect(positions).toContainEqual({ x: 5, y: 4 });
    expect(positions).toContainEqual({ x: 6, y: 5 });
    expect(positions).toContainEqual({ x: 5, y: 6 });
    expect(positions).toContainEqual({ x: 4, y: 5 });
  });

  it('includes diagonal positions when requested', () => {
    const positions = getAdjacentPositions(5, 5, true);
    expect(positions).toHaveLength(8);
    expect(positions).toContainEqual({ x: 4, y: 4 });
    expect(positions).toContainEqual({ x: 6, y: 4 });
    expect(positions).toContainEqual({ x: 6, y: 6 });
    expect(positions).toContainEqual({ x: 4, y: 6 });
  });
});
