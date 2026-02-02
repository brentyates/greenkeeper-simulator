import { describe, it, expect } from 'vitest';
import {
  createInitialPlayerState,
  gridToScreen,
  screenToGrid,
  isWithinBounds,
  getTargetPosition,
  canMoveTo,
  startMove,
  completeMove,
  setGridPosition,
  setStamina,
  setEquipment,
  setEquipmentActive,
  setDirection,
  calculateMoveDuration,
  calculateDepth,
  PlayerState,
  MapBounds,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_HEIGHT,
  MOVE_SPEED
} from './movement';

describe('Player State Initialization', () => {
  it('creates player at specified position', () => {
    const state = createInitialPlayerState(5, 10);
    expect(state.gridX).toBe(5);
    expect(state.gridY).toBe(10);
  });

  it('defaults to position (0, 0)', () => {
    const state = createInitialPlayerState();
    expect(state.gridX).toBe(0);
    expect(state.gridY).toBe(0);
  });

  it('starts with full stamina', () => {
    const state = createInitialPlayerState();
    expect(state.stamina).toBe(100);
  });

  it('starts with no equipment', () => {
    const state = createInitialPlayerState();
    expect(state.currentEquipment).toBeNull();
  });

  it('starts with equipment inactive', () => {
    const state = createInitialPlayerState();
    expect(state.isEquipmentActive).toBe(false);
  });

  it('starts facing down', () => {
    const state = createInitialPlayerState();
    expect(state.direction).toBe('down');
  });

  it('starts not moving', () => {
    const state = createInitialPlayerState();
    expect(state.isMoving).toBe(false);
  });
});

describe('Coordinate Conversion', () => {
  const mapWidth = 50;

  describe('gridToScreen', () => {
    it('converts origin to center of screen', () => {
      const screen = gridToScreen(0, 0, mapWidth);
      expect(screen.x).toBe(mapWidth * TILE_WIDTH / 2);
      expect(screen.y).toBe(0);
    });

    it('moving right in grid moves right and down on screen', () => {
      const origin = gridToScreen(0, 0, mapWidth);
      const moved = gridToScreen(1, 0, mapWidth);
      expect(moved.x).toBeGreaterThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('moving down in grid moves left and down on screen', () => {
      const origin = gridToScreen(0, 0, mapWidth);
      const moved = gridToScreen(0, 1, mapWidth);
      expect(moved.x).toBeLessThan(origin.x);
      expect(moved.y).toBeGreaterThan(origin.y);
    });

    it('applies elevation to Y position', () => {
      const flat = gridToScreen(5, 5, mapWidth, 0);
      const elevated = gridToScreen(5, 5, mapWidth, 1);
      expect(elevated.x).toBe(flat.x);
      expect(elevated.y).toBe(flat.y - ELEVATION_HEIGHT);
    });

    it('higher elevation moves sprite up', () => {
      const low = gridToScreen(5, 5, mapWidth, 0);
      const high = gridToScreen(5, 5, mapWidth, 2);
      expect(high.y).toBeLessThan(low.y);
    });
  });

  describe('screenToGrid', () => {
    it('converts center of screen to origin', () => {
      const grid = screenToGrid(mapWidth * TILE_WIDTH / 2, 0, mapWidth);
      expect(grid.x).toBe(0);
      expect(grid.y).toBe(0);
    });

    it('rounds to nearest grid cell', () => {
      const screen = gridToScreen(5, 5, mapWidth);
      const grid = screenToGrid(screen.x + 10, screen.y + 5, mapWidth);
      expect(grid.x).toBe(5);
      expect(grid.y).toBe(5);
    });
  });
});

describe('Bounds Checking', () => {
  const bounds: MapBounds = { width: 50, height: 38 };

  describe('isWithinBounds', () => {
    it('returns true for valid positions', () => {
      expect(isWithinBounds(0, 0, bounds)).toBe(true);
      expect(isWithinBounds(25, 19, bounds)).toBe(true);
      expect(isWithinBounds(49, 37, bounds)).toBe(true);
    });

    it('returns false for negative X', () => {
      expect(isWithinBounds(-1, 0, bounds)).toBe(false);
    });

    it('returns false for negative Y', () => {
      expect(isWithinBounds(0, -1, bounds)).toBe(false);
    });

    it('returns false for X at width', () => {
      expect(isWithinBounds(50, 0, bounds)).toBe(false);
    });

    it('returns false for Y at height', () => {
      expect(isWithinBounds(0, 38, bounds)).toBe(false);
    });
  });
});

describe('Target Position Calculation', () => {
  describe('getTargetPosition', () => {
    const state = createInitialPlayerState(5, 5);

    it('returns position above for up direction', () => {
      const target = getTargetPosition(state, 'up');
      expect(target).toEqual({ x: 5, y: 4 });
    });

    it('returns position below for down direction', () => {
      const target = getTargetPosition(state, 'down');
      expect(target).toEqual({ x: 5, y: 6 });
    });

    it('returns position left for left direction', () => {
      const target = getTargetPosition(state, 'left');
      expect(target).toEqual({ x: 4, y: 5 });
    });

    it('returns position right for right direction', () => {
      const target = getTargetPosition(state, 'right');
      expect(target).toEqual({ x: 6, y: 5 });
    });
  });
});

describe('Movement Validation', () => {
  const bounds: MapBounds = { width: 10, height: 10 };
  const alwaysAllow = () => true;
  const neverAllow = () => false;

  describe('canMoveTo', () => {
    it('returns false when player is moving', () => {
      const state: PlayerState = { ...createInitialPlayerState(5, 5), isMoving: true };
      expect(canMoveTo(state, 6, 5, bounds, alwaysAllow)).toBe(false);
    });

    it('returns false when target is out of bounds', () => {
      const state = createInitialPlayerState(9, 5);
      expect(canMoveTo(state, 10, 5, bounds, alwaysAllow)).toBe(false);
    });

    it('returns false when move checker rejects', () => {
      const state = createInitialPlayerState(5, 5);
      expect(canMoveTo(state, 6, 5, bounds, neverAllow)).toBe(false);
    });

    it('returns true when all conditions pass', () => {
      const state = createInitialPlayerState(5, 5);
      expect(canMoveTo(state, 6, 5, bounds, alwaysAllow)).toBe(true);
    });

    it('passes correct from/to coordinates to move checker', () => {
      const state = createInitialPlayerState(5, 5);
      const checker = (fromX: number, fromY: number, toX: number, toY: number) => {
        return fromX === 5 && fromY === 5 && toX === 6 && toY === 5;
      };
      expect(canMoveTo(state, 6, 5, bounds, checker)).toBe(true);
      expect(canMoveTo(state, 7, 5, bounds, checker)).toBe(false);
    });
  });
});

describe('Movement State', () => {
  describe('startMove', () => {
    it('updates grid position to target', () => {
      const state = createInitialPlayerState(5, 5);
      const moving = startMove(state, 6, 5, 'right');
      expect(moving.gridX).toBe(6);
      expect(moving.gridY).toBe(5);
    });

    it('sets moving flag to true', () => {
      const state = createInitialPlayerState(5, 5);
      const moving = startMove(state, 6, 5, 'right');
      expect(moving.isMoving).toBe(true);
    });

    it('updates direction', () => {
      const state = createInitialPlayerState(5, 5);
      const moving = startMove(state, 4, 5, 'left');
      expect(moving.direction).toBe('left');
    });

    it('does not modify original state', () => {
      const state = createInitialPlayerState(5, 5);
      startMove(state, 6, 5, 'right');
      expect(state.gridX).toBe(5);
      expect(state.isMoving).toBe(false);
    });
  });

  describe('completeMove', () => {
    it('sets moving flag to false', () => {
      const state: PlayerState = { ...createInitialPlayerState(5, 5), isMoving: true };
      const completed = completeMove(state);
      expect(completed.isMoving).toBe(false);
    });

    it('preserves position', () => {
      const state: PlayerState = { ...createInitialPlayerState(6, 7), isMoving: true };
      const completed = completeMove(state);
      expect(completed.gridX).toBe(6);
      expect(completed.gridY).toBe(7);
    });
  });

  describe('setGridPosition', () => {
    it('teleports to new position', () => {
      const state = createInitialPlayerState(0, 0);
      const moved = setGridPosition(state, 10, 15);
      expect(moved.gridX).toBe(10);
      expect(moved.gridY).toBe(15);
    });
  });
});

describe('Player Stats', () => {
  describe('setStamina', () => {
    it('sets stamina to specified value', () => {
      const state = createInitialPlayerState();
      const updated = setStamina(state, 50);
      expect(updated.stamina).toBe(50);
    });

    it('clamps stamina to minimum 0', () => {
      const state = createInitialPlayerState();
      const updated = setStamina(state, -10);
      expect(updated.stamina).toBe(0);
    });

    it('clamps stamina to maximum 100', () => {
      const state = createInitialPlayerState();
      const updated = setStamina(state, 150);
      expect(updated.stamina).toBe(100);
    });
  });

  describe('setEquipment', () => {
    it('sets mower equipment', () => {
      const state = createInitialPlayerState();
      const updated = setEquipment(state, 'mower');
      expect(updated.currentEquipment).toBe('mower');
    });

    it('sets sprinkler equipment', () => {
      const state = createInitialPlayerState();
      const updated = setEquipment(state, 'sprinkler');
      expect(updated.currentEquipment).toBe('sprinkler');
    });

    it('sets spreader equipment', () => {
      const state = createInitialPlayerState();
      const updated = setEquipment(state, 'spreader');
      expect(updated.currentEquipment).toBe('spreader');
    });

    it('clears equipment with null', () => {
      const state = setEquipment(createInitialPlayerState(), 'mower');
      const updated = setEquipment(state, null);
      expect(updated.currentEquipment).toBeNull();
    });
  });

  describe('setEquipmentActive', () => {
    it('activates equipment', () => {
      const state = createInitialPlayerState();
      const updated = setEquipmentActive(state, true);
      expect(updated.isEquipmentActive).toBe(true);
    });

    it('deactivates equipment', () => {
      const state = setEquipmentActive(createInitialPlayerState(), true);
      const updated = setEquipmentActive(state, false);
      expect(updated.isEquipmentActive).toBe(false);
    });
  });

  describe('setDirection', () => {
    it('sets direction to up', () => {
      const state = createInitialPlayerState();
      expect(setDirection(state, 'up').direction).toBe('up');
    });

    it('sets direction to down', () => {
      const state = createInitialPlayerState();
      expect(setDirection(state, 'down').direction).toBe('down');
    });

    it('sets direction to left', () => {
      const state = createInitialPlayerState();
      expect(setDirection(state, 'left').direction).toBe('left');
    });

    it('sets direction to right', () => {
      const state = createInitialPlayerState();
      expect(setDirection(state, 'right').direction).toBe('right');
    });
  });
});

describe('Move Duration Calculation', () => {
  const mapWidth = 50;

  describe('calculateMoveDuration', () => {
    it('returns positive duration', () => {
      const duration = calculateMoveDuration(0, 0, 1, 0, mapWidth);
      expect(duration).toBeGreaterThan(0);
    });

    it('has minimum duration of 80ms', () => {
      const duration = calculateMoveDuration(0, 0, 0, 0, mapWidth);
      expect(duration).toBeGreaterThanOrEqual(80);
    });

    it('moving in X direction differs from moving in Y direction', () => {
      const moveX = calculateMoveDuration(0, 0, 1, 0, mapWidth);
      const moveY = calculateMoveDuration(0, 0, 0, 1, mapWidth);
      expect(moveX).toBeCloseTo(moveY, 0);
    });

    it('is based on MOVE_SPEED', () => {
      const duration = calculateMoveDuration(0, 0, 1, 0, mapWidth);
      const fromScreen = gridToScreen(0, 0, mapWidth);
      const toScreen = gridToScreen(1, 0, mapWidth);
      const distance = Math.sqrt(
        Math.pow(toScreen.x - fromScreen.x, 2) + Math.pow(toScreen.y - fromScreen.y, 2)
      );
      const expectedDuration = (distance / MOVE_SPEED) * 1000;
      expect(duration).toBeCloseTo(Math.max(expectedDuration, 80), 1);
    });
  });
});

describe('Depth Calculation', () => {
  describe('calculateDepth', () => {
    it('uses base depth of 100 by default', () => {
      const depth = calculateDepth(0, 0);
      expect(depth).toBe(100);
    });

    it('increases depth with grid X', () => {
      const d0 = calculateDepth(0, 0);
      const d1 = calculateDepth(1, 0);
      expect(d1).toBeGreaterThan(d0);
    });

    it('increases depth with grid Y', () => {
      const d0 = calculateDepth(0, 0);
      const d1 = calculateDepth(0, 1);
      expect(d1).toBeGreaterThan(d0);
    });

    it('calculates depth as base + x + y', () => {
      expect(calculateDepth(5, 10)).toBe(115);
      expect(calculateDepth(5, 10, 50)).toBe(65);
    });
  });
});

describe('Constants', () => {
  it('TILE_WIDTH is 64', () => {
    expect(TILE_WIDTH).toBe(64);
  });

  it('TILE_HEIGHT is 32', () => {
    expect(TILE_HEIGHT).toBe(32);
  });

  it('ELEVATION_HEIGHT is 4', () => {
    expect(ELEVATION_HEIGHT).toBe(4);
  });

  it('MOVE_SPEED is 150', () => {
    expect(MOVE_SPEED).toBe(150);
  });
});

describe('Movement Workflow', () => {
  it('supports complete movement cycle', () => {
    const bounds: MapBounds = { width: 10, height: 10 };
    const alwaysAllow = () => true;

    let state = createInitialPlayerState(5, 5);

    expect(state.isMoving).toBe(false);

    const target = getTargetPosition(state, 'right');
    expect(canMoveTo(state, target.x, target.y, bounds, alwaysAllow)).toBe(true);

    state = startMove(state, target.x, target.y, 'right');
    expect(state.gridX).toBe(6);
    expect(state.gridY).toBe(5);
    expect(state.isMoving).toBe(true);
    expect(state.direction).toBe('right');

    expect(canMoveTo(state, 7, 5, bounds, alwaysAllow)).toBe(false);

    state = completeMove(state);
    expect(state.isMoving).toBe(false);

    expect(canMoveTo(state, 7, 5, bounds, alwaysAllow)).toBe(true);
  });
});
