import { describe, it, expect } from 'vitest';
import {
  CellState,
  TerrainType,
  getTerrainType,
  getInitialValues,
  calculateHealth,
  isWalkable,
  canMoveFromTo,
  getCellsInRadius
} from './terrain';
import {
  simulateGrowth,
  applyMowing,
  applyWatering,
  applyFertilizing,
  getAverageStats,
  countCellsNeedingMowing,
  getOverallCondition
} from './grass-simulation';
import {
  createEquipmentState,
  activateEquipment,
  consumeResource,
  refillEquipment,
  EQUIPMENT_CONFIGS
} from './equipment-logic';
import {
  createInitialTimeState,
  updateTime,
  getCurrentHour,
  setTimeScale
} from './time-logic';
import {
  createInitialProgressState,
  generateObjective,
  updateScore,
  updateObjectiveProgress,
  processNewDay,
  CourseStats
} from './scoring';
import {
  createInitialPlayerState,
  canMoveTo,
  startMove,
  completeMove,
  getTargetPosition,
  setEquipment,
  setEquipmentActive,
  MapBounds
} from './movement';

function makeCell(overrides: Partial<CellState> = {}): CellState {
  return {
    x: 0, y: 0,
    type: 'fairway',
    height: 50,
    moisture: 50,
    nutrients: 50,
    health: 50,
    elevation: 0,
    obstacle: 'none',
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
    ...overrides
  };
}

function makeCourseGrid(width: number, height: number, cellDefaults: Partial<CellState> = {}): CellState[][] {
  const cells: CellState[][] = [];
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = makeCell({ x, y, ...cellDefaults });
    }
  }
  return cells;
}

describe('Grass System + Equipment Integration', () => {
  describe('Mowing workflow', () => {
    it('mowing a cell sets height to 0 and improves health', () => {
      const cell = makeCell({ height: 80, moisture: 60, nutrients: 60 });
      const initialHealth = calculateHealth(cell);

      const mowed = applyMowing(cell);
      expect(mowed).not.toBeNull();
      expect(mowed!.height).toBe(0);
      expect(mowed!.health).toBeGreaterThan(initialHealth);
    });

    it('mower depletes while mowing', () => {
      let mower = createEquipmentState('mower');
      mower = activateEquipment(mower);

      for (let i = 0; i < 10; i++) {
        mower = consumeResource(mower, 1000);
      }

      expect(mower.resourceCurrent).toBeLessThan(100);
      expect(mower.isActive).toBe(true);
    });

    it('empty mower cannot mow', () => {
      let mower = createEquipmentState('mower');
      mower = activateEquipment(mower);

      for (let i = 0; i < 250; i++) {
        mower = consumeResource(mower, 1000);
      }

      expect(mower.resourceCurrent).toBe(0);
      expect(mower.isActive).toBe(false);
    });

    it('refilled mower can mow again', () => {
      let mower = createEquipmentState('mower');
      mower = activateEquipment(mower);
      for (let i = 0; i < 250; i++) {
        mower = consumeResource(mower, 1000);
      }
      expect(mower.isActive).toBe(false);

      mower = refillEquipment(mower);
      mower = activateEquipment(mower);

      expect(mower.isActive).toBe(true);
      expect(mower.resourceCurrent).toBe(100);
    });
  });

  describe('Watering workflow', () => {
    it('watering increases moisture and health of dry cell', () => {
      const cell = makeCell({ moisture: 20, nutrients: 50, height: 30 });
      const initialHealth = calculateHealth(cell);

      const watered = applyWatering(cell, 30);
      expect(watered).not.toBeNull();
      expect(watered!.moisture).toBe(50);
      expect(watered!.health).toBeGreaterThan(initialHealth);
    });

    it('sprinkler affects cells in radius', () => {
      const cells = getCellsInRadius(5, 5, EQUIPMENT_CONFIGS.sprinkler.effectRadius);
      expect(cells.length).toBeGreaterThan(1);

      const wateringResults = cells.map(({ x, y }) => {
        const cell = makeCell({ x, y, moisture: 20 });
        return applyWatering(cell, 5);
      });

      expect(wateringResults.every(r => r !== null)).toBe(true);
      expect(wateringResults.every(r => r!.moisture > 20)).toBe(true);
    });
  });

  describe('Fertilizing workflow', () => {
    it('fertilizing increases nutrients and health', () => {
      const cell = makeCell({ nutrients: 20, moisture: 50, height: 30 });
      const initialHealth = calculateHealth(cell);

      const fertilized = applyFertilizing(cell, 30);
      expect(fertilized).not.toBeNull();
      expect(fertilized!.nutrients).toBe(50);
      expect(fertilized!.health).toBeGreaterThan(initialHealth);
    });
  });
});

describe('Grass System + Time Integration', () => {
  describe('Growth over time', () => {
    it('grass grows as time passes', () => {
      let cell = makeCell({ height: 10, moisture: 60, nutrients: 60, health: 80 });
      let timeState = createInitialTimeState();

      const oneHourMs = 60 * 60000;
      timeState = updateTime(timeState, oneHourMs);

      const result = simulateGrowth(cell, 60);
      expect(result.height).toBeGreaterThan(10);
    });

    it('grass grows faster with time scale increase', () => {
      const cell = makeCell({ height: 10, moisture: 60, nutrients: 60, health: 80 });

      const normalGrowth = simulateGrowth(cell, 60);

      const fastGrowth = simulateGrowth(cell, 120);

      expect(fastGrowth.height).toBeGreaterThan(normalGrowth.height);
    });

    it('moisture and nutrients deplete over time', () => {
      const cell = makeCell({ moisture: 80, nutrients: 80, height: 20, health: 80 });

      const result = simulateGrowth(cell, 120);

      expect(result.moisture).toBeLessThan(80);
      expect(result.nutrients).toBeLessThan(80);
    });

    it('complete day cycle shows significant growth', () => {
      let cell = makeCell({ height: 0, moisture: 100, nutrients: 100, health: 100 });

      const result = simulateGrowth(cell, 24 * 60);

      expect(result.height).toBeGreaterThan(30);
    });
  });

  describe('Maintenance timing', () => {
    it('mowing then waiting leads to regrowth', () => {
      let cell = makeCell({ height: 80, moisture: 60, nutrients: 60 });
      const mowed = applyMowing(cell);
      expect(mowed!.height).toBe(0);

      const grown = simulateGrowth(mowed!, 4 * 60);
      expect(grown.height).toBeGreaterThan(0);
    });

    it('watering followed by time maintains moisture', () => {
      let cell = makeCell({ moisture: 10, nutrients: 50, height: 30 });
      const watered = applyWatering(cell, 80);
      expect(watered!.moisture).toBe(90);

      const decayed = simulateGrowth(watered!, 60);
      expect(decayed.moisture).toBeGreaterThan(80);
    });
  });
});

describe('Scoring System Integration', () => {
  describe('Health-based scoring', () => {
    it('high health course earns points over time', () => {
      const cells = makeCourseGrid(10, 10, { health: 85 });
      const stats = getAverageStats(cells);

      let progress = createInitialProgressState();
      progress = updateScore(progress, 60000, stats.health);

      expect(progress.score).toBeGreaterThan(0);
    });

    it('low health course loses points over time', () => {
      const cells = makeCourseGrid(10, 10, { health: 40 });
      const stats = getAverageStats(cells);

      let progress = createInitialProgressState();
      progress = { ...progress, score: 100 };
      progress = updateScore(progress, 60000, stats.health);

      expect(progress.score).toBeLessThan(100);
    });
  });

  describe('Objective completion workflow', () => {
    it('completing mowing objective earns bonus', () => {
      let cells = makeCourseGrid(10, 10, { height: 80, moisture: 60, nutrients: 60, health: 70 });
      let stats: CourseStats = {
        averageHealth: 70,
        averageMoisture: 60,
        averageNutrients: 60,
        cellsNeedingMowing: 150,
        cellsNeedingWater: 0,
        cellsNeedingFertilizer: 0
      };

      let progress = createInitialProgressState();
      progress = {
        ...progress,
        currentObjective: generateObjective(stats)
      };

      expect(progress.currentObjective?.type).toBe('MOW_PERCENTAGE');

      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const mowed = applyMowing(cells[y][x]);
          if (mowed) cells[y][x] = mowed;
        }
      }

      stats = {
        ...getAverageStats(cells),
        cellsNeedingMowing: 0,
        cellsNeedingWater: 0,
        cellsNeedingFertilizer: 0
      };

      progress = updateObjectiveProgress(progress, stats);

      expect(progress.currentObjective?.completed).toBe(true);
      expect(progress.score).toBeGreaterThan(0);
    });

    it('consecutive good days increase bonus multiplier', () => {
      const stats: CourseStats = {
        averageHealth: 85,
        averageMoisture: 60,
        averageNutrients: 60,
        cellsNeedingMowing: 0,
        cellsNeedingWater: 0,
        cellsNeedingFertilizer: 0
      };

      let progress = createInitialProgressState();
      progress = {
        ...progress,
        currentObjective: {
          type: 'MAINTAIN_HEALTH',
          description: 'test',
          target: 80,
          progress: 0,
          completed: false
        }
      };

      progress = updateObjectiveProgress(progress, stats);
      const day0Bonus = progress.score;

      progress = {
        ...createInitialProgressState(),
        consecutiveGoodDays: 5,
        currentObjective: {
          type: 'MAINTAIN_HEALTH',
          description: 'test',
          target: 80,
          progress: 0,
          completed: false
        }
      };

      progress = updateObjectiveProgress(progress, stats);
      const day5Bonus = progress.score;

      expect(day5Bonus).toBeGreaterThan(day0Bonus);
    });
  });

  describe('Day transition', () => {
    it('new day resets objective based on current state', () => {
      const stats: CourseStats = {
        averageHealth: 50,
        averageMoisture: 60,
        averageNutrients: 60,
        cellsNeedingMowing: 50,
        cellsNeedingWater: 20,
        cellsNeedingFertilizer: 20
      };

      let progress = createInitialProgressState();
      progress = processNewDay(progress, 50, stats);

      expect(progress.daysPassed).toBe(1);
      expect(progress.currentObjective).not.toBeNull();
      expect(progress.currentObjective?.type).toBe('MAINTAIN_HEALTH');
    });

    it('good day increments streak, bad day resets it', () => {
      const goodStats: CourseStats = {
        averageHealth: 80,
        averageMoisture: 60,
        averageNutrients: 60,
        cellsNeedingMowing: 20,
        cellsNeedingWater: 10,
        cellsNeedingFertilizer: 10
      };

      let progress = createInitialProgressState();

      progress = processNewDay(progress, 75, goodStats);
      expect(progress.consecutiveGoodDays).toBe(1);

      progress = processNewDay(progress, 75, goodStats);
      expect(progress.consecutiveGoodDays).toBe(2);

      const badStats = { ...goodStats, averageHealth: 50 };
      progress = processNewDay(progress, 50, badStats);
      expect(progress.consecutiveGoodDays).toBe(0);
    });
  });
});

describe('Player + Terrain Integration', () => {
  describe('Movement on course', () => {
    it('player can move on walkable terrain', () => {
      const cells = makeCourseGrid(10, 10);
      const bounds: MapBounds = { width: 10, height: 10 };

      const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
        const fromCell = cells[fromY]?.[fromX];
        const toCell = cells[toY]?.[toX];
        return canMoveFromTo(fromCell, toCell);
      };

      let player = createInitialPlayerState(5, 5);
      const target = getTargetPosition(player, 'right');

      expect(canMoveTo(player, target.x, target.y, bounds, moveChecker)).toBe(true);

      player = startMove(player, target.x, target.y, 'right');
      expect(player.gridX).toBe(6);
      expect(player.isMoving).toBe(true);

      player = completeMove(player);
      expect(player.isMoving).toBe(false);
    });

    it('player cannot move onto water', () => {
      const cells = makeCourseGrid(10, 10);
      cells[5][6] = makeCell({ x: 6, y: 5, type: 'water' });

      const bounds: MapBounds = { width: 10, height: 10 };
      const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
        const fromCell = cells[fromY]?.[fromX];
        const toCell = cells[toY]?.[toX];
        return canMoveFromTo(fromCell, toCell);
      };

      const player = createInitialPlayerState(5, 5);
      const target = getTargetPosition(player, 'right');

      expect(canMoveTo(player, target.x, target.y, bounds, moveChecker)).toBe(false);
    });

    it('player cannot move onto tree', () => {
      const cells = makeCourseGrid(10, 10);
      cells[5][6] = makeCell({ x: 6, y: 5, obstacle: 'tree' });

      const bounds: MapBounds = { width: 10, height: 10 };
      const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
        const fromCell = cells[fromY]?.[fromX];
        const toCell = cells[toY]?.[toX];
        return canMoveFromTo(fromCell, toCell);
      };

      const player = createInitialPlayerState(5, 5);
      expect(canMoveTo(player, 6, 5, bounds, moveChecker)).toBe(false);
    });

    it('player can move up ramp (elevation +1)', () => {
      const cells = makeCourseGrid(10, 10);
      cells[5][5] = makeCell({ x: 5, y: 5, elevation: 0 });
      cells[5][6] = makeCell({ x: 6, y: 5, elevation: 1 });

      const bounds: MapBounds = { width: 10, height: 10 };
      const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
        const fromCell = cells[fromY]?.[fromX];
        const toCell = cells[toY]?.[toX];
        return canMoveFromTo(fromCell, toCell);
      };

      const player = createInitialPlayerState(5, 5);
      expect(canMoveTo(player, 6, 5, bounds, moveChecker)).toBe(true);
    });

    it('player cannot climb cliff (elevation +2)', () => {
      const cells = makeCourseGrid(10, 10);
      cells[5][5] = makeCell({ x: 5, y: 5, elevation: 0 });
      cells[5][6] = makeCell({ x: 6, y: 5, elevation: 2 });

      const bounds: MapBounds = { width: 10, height: 10 };
      const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
        const fromCell = cells[fromY]?.[fromX];
        const toCell = cells[toY]?.[toX];
        return canMoveFromTo(fromCell, toCell);
      };

      const player = createInitialPlayerState(5, 5);
      expect(canMoveTo(player, 6, 5, bounds, moveChecker)).toBe(false);
    });
  });

  describe('Player equipment interaction', () => {
    it('player can equip and use mower', () => {
      let player = createInitialPlayerState(5, 5);
      let mower = createEquipmentState('mower');

      player = setEquipment(player, 'mower');
      expect(player.currentEquipment).toBe('mower');

      mower = activateEquipment(mower);
      player = setEquipmentActive(player, true);

      expect(player.isEquipmentActive).toBe(true);
      expect(mower.isActive).toBe(true);
    });

    it('switching equipment deactivates previous', () => {
      let player = setEquipment(createInitialPlayerState(5, 5), 'mower');
      player = setEquipmentActive(player, true);

      player = setEquipment(player, 'sprinkler');
      player = setEquipmentActive(player, false);

      expect(player.currentEquipment).toBe('sprinkler');
      expect(player.isEquipmentActive).toBe(false);
    });
  });
});

describe('Full Game Loop Simulation', () => {
  it('simulates a complete maintenance session', () => {
    let cells = makeCourseGrid(10, 10, {
      height: 70,
      moisture: 30,
      nutrients: 40,
      health: 50
    });

    let time = createInitialTimeState();
    let progress = createInitialProgressState();
    let player = createInitialPlayerState(0, 0);
    let mower = createEquipmentState('mower');
    let sprinkler = createEquipmentState('sprinkler');

    let initialStats = getAverageStats(cells);
    expect(getOverallCondition(initialStats.health)).toBe('Fair');

    progress = {
      ...progress,
      currentObjective: generateObjective({
        ...initialStats,
        cellsNeedingMowing: countCellsNeedingMowing(cells),
        cellsNeedingWater: 50,
        cellsNeedingFertilizer: 30
      })
    };

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const mowed = applyMowing(cells[y][x]);
        if (mowed) cells[y][x] = mowed;
      }
    }
    mower = consumeResource(mower, 10000);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const watered = applyWatering(cells[y][x], 30);
        if (watered) cells[y][x] = watered;
      }
    }
    sprinkler = consumeResource(sprinkler, 10000);

    let finalStats = getAverageStats(cells);

    expect(finalStats.height).toBeLessThan(initialStats.height);
    expect(finalStats.moisture).toBeGreaterThan(initialStats.moisture);
    expect(finalStats.health).toBeGreaterThan(initialStats.health);

    expect(getOverallCondition(finalStats.health)).not.toBe('Poor');

    time = updateTime(time, 60 * 60000);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const grown = simulateGrowth(cells[y][x], 60);
        cells[y][x] = { ...cells[y][x], ...grown };
      }
    }

    const grownStats = getAverageStats(cells);
    expect(grownStats.height).toBeGreaterThan(finalStats.height);
    expect(grownStats.moisture).toBeLessThan(finalStats.moisture);
  });

  it('simulates scoring over multiple days', () => {
    let progress = createInitialProgressState();
    const goodStats: CourseStats = {
      averageHealth: 85,
      averageMoisture: 70,
      averageNutrients: 70,
      cellsNeedingMowing: 10,
      cellsNeedingWater: 5,
      cellsNeedingFertilizer: 5
    };

    for (let minute = 0; minute < 24 * 60; minute++) {
      progress = updateScore(progress, 60000, goodStats.averageHealth);
    }

    expect(progress.score).toBeGreaterThan(0);

    progress = processNewDay(progress, goodStats.averageHealth, goodStats);
    expect(progress.daysPassed).toBe(1);
    expect(progress.consecutiveGoodDays).toBe(1);

    progress = processNewDay(progress, goodStats.averageHealth, goodStats);
    expect(progress.daysPassed).toBe(2);
    expect(progress.consecutiveGoodDays).toBe(2);

    const badStats: CourseStats = { ...goodStats, averageHealth: 40 };
    progress = processNewDay(progress, badStats.averageHealth, badStats);
    expect(progress.consecutiveGoodDays).toBe(0);
  });
});

describe('Edge Cases', () => {
  it('handles boundary cells correctly', () => {
    const cells = makeCourseGrid(5, 5);
    const bounds: MapBounds = { width: 5, height: 5 };

    const moveChecker = (fromX: number, fromY: number, toX: number, toY: number) => {
      const fromCell = cells[fromY]?.[fromX];
      const toCell = cells[toY]?.[toX];
      return canMoveFromTo(fromCell, toCell);
    };

    const playerAtCorner = createInitialPlayerState(0, 0);
    expect(canMoveTo(playerAtCorner, -1, 0, bounds, moveChecker)).toBe(false);
    expect(canMoveTo(playerAtCorner, 0, -1, bounds, moveChecker)).toBe(false);

    const playerAtOtherCorner = createInitialPlayerState(4, 4);
    expect(canMoveTo(playerAtOtherCorner, 5, 4, bounds, moveChecker)).toBe(false);
    expect(canMoveTo(playerAtOtherCorner, 4, 5, bounds, moveChecker)).toBe(false);
  });

  it('handles extreme moisture/nutrient values', () => {
    const driedOut = makeCell({ moisture: 0, nutrients: 0, height: 100 });
    expect(calculateHealth(driedOut)).toBe(0);

    const overwatered = makeCell({ moisture: 100, nutrients: 100, height: 0 });
    expect(calculateHealth(overwatered)).toBe(100);
  });

  it('handles zero-duration time updates', () => {
    const time = createInitialTimeState();
    const updated = updateTime(time, 0);
    expect(updated.gameTime).toBe(0);
    expect(updated.currentHour).toBe(0);
  });

  it('handles equipment with zero resource', () => {
    let equipment = createEquipmentState('mower');
    equipment = { ...equipment, resourceCurrent: 0 };

    const activated = activateEquipment(equipment);
    expect(activated.isActive).toBe(false);
  });
});
