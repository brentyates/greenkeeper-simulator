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
  getTerrainCode,
  getAdjacentPositions,
  CellState,
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
