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
  getTextureForCell,
  getCellsInRadius,
  CellState,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_HEIGHT
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
});

describe('Coordinate Conversion', () => {
  const mapWidth = 50;

  describe('gridToScreen', () => {
    it('converts origin (0,0) to center-top of screen', () => {
      const screen = gridToScreen(0, 0, 0, mapWidth);
      expect(screen.x).toBe(mapWidth * TILE_WIDTH / 2);
      expect(screen.y).toBe(0);
    });

    it('moving right in grid moves right-down on screen', () => {
      const origin = gridToScreen(0, 0, 0, mapWidth);
      const moved = gridToScreen(1, 0, 0, mapWidth);
      expect(moved.x).toBeGreaterThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('moving down in grid moves left-down on screen', () => {
      const origin = gridToScreen(0, 0, 0, mapWidth);
      const moved = gridToScreen(0, 1, 0, mapWidth);
      expect(moved.x).toBeLessThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('applies elevation offset to Y position', () => {
      const flat = gridToScreen(5, 5, 0, mapWidth);
      const elevated = gridToScreen(5, 5, 1, mapWidth);
      expect(elevated.x).toBe(flat.x);
      expect(elevated.y).toBe(flat.y - ELEVATION_HEIGHT);
    });

    it('higher elevation moves sprite higher on screen', () => {
      const low = gridToScreen(5, 5, 0, mapWidth);
      const high = gridToScreen(5, 5, 2, mapWidth);
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
          const screen = gridToScreen(x, y, 0, mapWidth);
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

  it('moisture contributes 30% to health', () => {
    const high = makeCell({ moisture: 100, nutrients: 0, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(30);
  });

  it('nutrients contribute 30% to health', () => {
    const high = makeCell({ moisture: 0, nutrients: 100, height: 100 });
    const low = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(high) - calculateHealth(low)).toBe(30);
  });

  it('height contributes 40% to health (inverted)', () => {
    const short = makeCell({ moisture: 0, nutrients: 0, height: 0 });
    const tall = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(short) - calculateHealth(tall)).toBe(40);
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
});

describe('Texture Selection', () => {
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

  it('uses ramp texture when ramp direction is set', () => {
    const cell = makeCell({});
    expect(getTextureForCell(cell, 'north')).toBe('iso_ramp_north');
    expect(getTextureForCell(cell, 'south')).toBe('iso_ramp_south');
    expect(getTextureForCell(cell, 'east')).toBe('iso_ramp_east');
    expect(getTextureForCell(cell, 'west')).toBe('iso_ramp_west');
  });

  it('ignores ramp direction for bunker', () => {
    const cell = makeCell({ type: 'bunker' });
    expect(getTextureForCell(cell, 'north')).toBe('iso_bunker');
  });

  it('ignores ramp direction for water', () => {
    const cell = makeCell({ type: 'water' });
    expect(getTextureForCell(cell, 'north')).toBe('iso_water');
  });

  it('uses dead texture when health < 20', () => {
    const cell = makeCell({ health: 15 });
    expect(getTextureForCell(cell, null)).toBe('iso_grass_dead');
  });

  it('uses dry texture when health < 40', () => {
    const cell = makeCell({ health: 35 });
    expect(getTextureForCell(cell, null)).toBe('iso_grass_dry');
  });

  describe('fairway textures', () => {
    it('uses mown texture when height <= 20', () => {
      const cell = makeCell({ type: 'fairway', height: 20, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_fairway_mown');
    });

    it('uses growing texture when height <= 45', () => {
      const cell = makeCell({ type: 'fairway', height: 45, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_fairway_growing');
    });

    it('uses unmown texture when height > 45', () => {
      const cell = makeCell({ type: 'fairway', height: 46, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_fairway_unmown');
    });
  });

  describe('rough textures', () => {
    it('uses mown texture when height <= 30', () => {
      const cell = makeCell({ type: 'rough', height: 30, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_rough_mown');
    });

    it('uses growing texture when height <= 60', () => {
      const cell = makeCell({ type: 'rough', height: 60, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_rough_growing');
    });

    it('uses unmown texture when height > 60', () => {
      const cell = makeCell({ type: 'rough', height: 61, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_rough_unmown');
    });
  });

  describe('green textures', () => {
    it('uses mown texture when height <= 10', () => {
      const cell = makeCell({ type: 'green', height: 10, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_green_mown');
    });

    it('uses growing texture when height <= 22', () => {
      const cell = makeCell({ type: 'green', height: 22, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_green_growing');
    });

    it('uses unmown texture when height > 22', () => {
      const cell = makeCell({ type: 'green', height: 23, health: 80 });
      expect(getTextureForCell(cell, null)).toBe('iso_green_unmown');
    });
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
});
