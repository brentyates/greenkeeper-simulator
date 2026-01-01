import { describe, it, expect } from 'vitest';
import {
  createInitialProgressState,
  generateObjective,
  updateScore,
  updateObjectiveProgress,
  processNewDay,
  serializeProgressState,
  loadProgressState,
  CourseStats,
  ProgressState,
  Objective
} from './scoring';

function makeStats(overrides: Partial<CourseStats> = {}): CourseStats {
  return {
    averageHealth: 70,
    averageMoisture: 60,
    averageNutrients: 60,
    cellsNeedingMowing: 50,
    cellsNeedingWater: 20,
    cellsNeedingFertilizer: 20,
    ...overrides
  };
}

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    type: 'MAINTAIN_HEALTH',
    description: 'Test objective',
    target: 80,
    progress: 0,
    completed: false,
    ...overrides
  };
}

describe('Progress State Initialization', () => {
  it('starts with score of 0', () => {
    const state = createInitialProgressState();
    expect(state.score).toBe(0);
  });

  it('starts with no days passed', () => {
    const state = createInitialProgressState();
    expect(state.daysPassed).toBe(0);
  });

  it('starts with no consecutive good days', () => {
    const state = createInitialProgressState();
    expect(state.consecutiveGoodDays).toBe(0);
  });

  it('starts with no objective', () => {
    const state = createInitialProgressState();
    expect(state.currentObjective).toBeNull();
  });

  it('uses saved high score if provided', () => {
    const state = createInitialProgressState(500);
    expect(state.highScore).toBe(500);
  });

  it('defaults high score to 0', () => {
    const state = createInitialProgressState();
    expect(state.highScore).toBe(0);
  });
});

describe('Objective Generation', () => {
  describe('generateObjective', () => {
    it('generates MAINTAIN_HEALTH when health < 60', () => {
      const stats = makeStats({ averageHealth: 50 });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('MAINTAIN_HEALTH');
      expect(objective.target).toBe(70);
      expect(objective.description).toBe('Improve course health to 70%');
    });

    it('generates MOW_PERCENTAGE when many cells need mowing', () => {
      const stats = makeStats({
        averageHealth: 70,
        cellsNeedingMowing: 150
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('MOW_PERCENTAGE');
      expect(objective.target).toBe(150);
    });

    it('generates WATER_DRY when moisture is low', () => {
      const stats = makeStats({
        averageHealth: 70,
        averageMoisture: 30,
        cellsNeedingMowing: 50,
        cellsNeedingWater: 100
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('WATER_DRY');
      expect(objective.target).toBe(100);
    });

    it('generates FERTILIZE_POOR when nutrients are low', () => {
      const stats = makeStats({
        averageHealth: 70,
        averageMoisture: 60,
        averageNutrients: 30,
        cellsNeedingMowing: 50,
        cellsNeedingFertilizer: 80
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('FERTILIZE_POOR');
      expect(objective.target).toBe(80);
    });

    it('generates maintenance objective when all is well', () => {
      const stats = makeStats({
        averageHealth: 85,
        averageMoisture: 70,
        averageNutrients: 70,
        cellsNeedingMowing: 20
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('MAINTAIN_HEALTH');
      expect(objective.target).toBe(80);
      expect(objective.description).toBe('Maintain excellent course health');
    });

    it('starts with progress of 0', () => {
      const stats = makeStats();
      const objective = generateObjective(stats);
      expect(objective.progress).toBe(0);
    });

    it('starts not completed', () => {
      const stats = makeStats();
      const objective = generateObjective(stats);
      expect(objective.completed).toBe(false);
    });

    it('prioritizes health over mowing', () => {
      const stats = makeStats({
        averageHealth: 50,
        cellsNeedingMowing: 200
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('MAINTAIN_HEALTH');
    });

    it('prioritizes mowing over watering', () => {
      const stats = makeStats({
        averageHealth: 70,
        cellsNeedingMowing: 150,
        averageMoisture: 30
      });
      const objective = generateObjective(stats);
      expect(objective.type).toBe('MOW_PERCENTAGE');
    });
  });
});

describe('Score Updates', () => {
  describe('updateScore', () => {
    it('adds 10 points per minute when health >= 80', () => {
      const state = createInitialProgressState();
      const updated = updateScore(state, 60000, 85);
      expect(updated.score).toBe(10);
    });

    it('subtracts 10 points per minute when health < 50', () => {
      const state: ProgressState = { ...createInitialProgressState(), score: 100 };
      const updated = updateScore(state, 60000, 40);
      expect(updated.score).toBe(90);
    });

    it('does not change score when health is between 50 and 80', () => {
      const state: ProgressState = { ...createInitialProgressState(), score: 50 };
      const updated = updateScore(state, 60000, 65);
      expect(updated.score).toBe(50);
    });

    it('does not go below 0', () => {
      const state: ProgressState = { ...createInitialProgressState(), score: 5 };
      const updated = updateScore(state, 60000, 30);
      expect(updated.score).toBe(0);
    });

    it('updates high score when score exceeds it', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        score: 90,
        highScore: 95
      };
      const updated = updateScore(state, 60000, 85);
      expect(updated.score).toBe(100);
      expect(updated.highScore).toBe(100);
    });

    it('does not update high score when score is lower', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        score: 50,
        highScore: 100
      };
      const updated = updateScore(state, 60000, 85);
      expect(updated.highScore).toBe(100);
    });

    it('scales score change with delta time', () => {
      const state = createInitialProgressState();
      const updated = updateScore(state, 120000, 85);
      expect(updated.score).toBe(20);
    });

    it('does not modify original state', () => {
      const state = createInitialProgressState();
      updateScore(state, 60000, 85);
      expect(state.score).toBe(0);
    });
  });
});

describe('Objective Progress', () => {
  describe('updateObjectiveProgress', () => {
    it('returns state unchanged when no objective', () => {
      const state = createInitialProgressState();
      const updated = updateObjectiveProgress(state, makeStats());
      expect(updated).toEqual(state);
    });

    it('returns state unchanged when objective is completed', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        currentObjective: makeObjective({ completed: true })
      };
      const updated = updateObjectiveProgress(state, makeStats());
      expect(updated.currentObjective?.progress).toBe(0);
    });

    describe('MAINTAIN_HEALTH objective', () => {
      it('updates progress to current health', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
        };
        const stats = makeStats({ averageHealth: 75 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.progress).toBe(75);
      });

      it('completes when health reaches target', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
        };
        const stats = makeStats({ averageHealth: 85 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.completed).toBe(true);
      });
    });

    describe('MOW_PERCENTAGE objective', () => {
      it('updates progress based on cells mowed', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({
            type: 'MOW_PERCENTAGE',
            target: 100
          })
        };
        const stats = makeStats({ cellsNeedingMowing: 40 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.progress).toBe(60);
      });

      it('completes when no cells need mowing', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'MOW_PERCENTAGE', target: 100 })
        };
        const stats = makeStats({ cellsNeedingMowing: 0 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.completed).toBe(true);
      });
    });

    describe('WATER_DRY objective', () => {
      it('updates progress based on cells watered', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'WATER_DRY', target: 50 })
        };
        const stats = makeStats({ cellsNeedingWater: 20 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.progress).toBe(30);
      });

      it('completes when no cells need water', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'WATER_DRY', target: 50 })
        };
        const stats = makeStats({ cellsNeedingWater: 0 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.completed).toBe(true);
      });
    });

    describe('FERTILIZE_POOR objective', () => {
      it('updates progress based on cells fertilized', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'FERTILIZE_POOR', target: 40 })
        };
        const stats = makeStats({ cellsNeedingFertilizer: 15 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.progress).toBe(25);
      });

      it('completes when no cells need fertilizer', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          currentObjective: makeObjective({ type: 'FERTILIZE_POOR', target: 40 })
        };
        const stats = makeStats({ cellsNeedingFertilizer: 0 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.currentObjective?.completed).toBe(true);
      });
    });

    describe('Completion bonus', () => {
      it('awards 100 points on completion', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          score: 50,
          currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
        };
        const stats = makeStats({ averageHealth: 85 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.score).toBe(150);
      });

      it('applies multiplier based on consecutive good days', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          score: 0,
          consecutiveGoodDays: 3,
          currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
        };
        const stats = makeStats({ averageHealth: 85 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.score).toBe(130);
      });

      it('updates high score on completion bonus', () => {
        const state: ProgressState = {
          ...createInitialProgressState(),
          score: 50,
          highScore: 50,
          currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
        };
        const stats = makeStats({ averageHealth: 85 });
        const updated = updateObjectiveProgress(state, stats);
        expect(updated.highScore).toBe(150);
      });
    });
  });
});

describe('New Day Processing', () => {
  describe('processNewDay', () => {
    it('increments days passed', () => {
      const state: ProgressState = { ...createInitialProgressState(), daysPassed: 2 };
      const updated = processNewDay(state, 80, makeStats());
      expect(updated.daysPassed).toBe(3);
    });

    it('increments consecutive good days when health >= 70', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        consecutiveGoodDays: 2
      };
      const updated = processNewDay(state, 75, makeStats());
      expect(updated.consecutiveGoodDays).toBe(3);
    });

    it('resets consecutive good days when health < 70', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        consecutiveGoodDays: 5
      };
      const updated = processNewDay(state, 60, makeStats());
      expect(updated.consecutiveGoodDays).toBe(0);
    });

    it('generates new objective', () => {
      const state = createInitialProgressState();
      const stats = makeStats({ averageHealth: 50 });
      const updated = processNewDay(state, 50, stats);
      expect(updated.currentObjective).not.toBeNull();
      expect(updated.currentObjective?.type).toBe('MAINTAIN_HEALTH');
    });

    it('replaces previous objective', () => {
      const state: ProgressState = {
        ...createInitialProgressState(),
        currentObjective: makeObjective({ type: 'MOW_PERCENTAGE' })
      };
      const stats = makeStats({ averageHealth: 50 });
      const updated = processNewDay(state, 50, stats);
      expect(updated.currentObjective?.type).toBe('MAINTAIN_HEALTH');
    });
  });
});

describe('Serialization', () => {
  describe('serializeProgressState', () => {
    it('serializes score', () => {
      const state: ProgressState = { ...createInitialProgressState(), score: 500 };
      const serialized = serializeProgressState(state);
      expect(serialized).toHaveProperty('score', 500);
    });

    it('serializes days passed', () => {
      const state: ProgressState = { ...createInitialProgressState(), daysPassed: 3 };
      const serialized = serializeProgressState(state);
      expect(serialized).toHaveProperty('daysPassed', 3);
    });

    it('serializes consecutive good days', () => {
      const state: ProgressState = { ...createInitialProgressState(), consecutiveGoodDays: 5 };
      const serialized = serializeProgressState(state);
      expect(serialized).toHaveProperty('consecutiveGoodDays', 5);
    });

    it('serializes current objective', () => {
      const objective = makeObjective({ progress: 50 });
      const state: ProgressState = {
        ...createInitialProgressState(),
        currentObjective: objective
      };
      const serialized = serializeProgressState(state);
      expect(serialized).toHaveProperty('currentObjective', objective);
    });

    it('does not serialize high score (stored separately)', () => {
      const state: ProgressState = { ...createInitialProgressState(), highScore: 1000 };
      const serialized = serializeProgressState(state);
      expect(serialized).not.toHaveProperty('highScore');
    });
  });

  describe('loadProgressState', () => {
    it('restores score', () => {
      const saved = { score: 500, daysPassed: 0, consecutiveGoodDays: 0, currentObjective: null };
      const loaded = loadProgressState(saved, 0);
      expect(loaded.score).toBe(500);
    });

    it('restores days passed', () => {
      const saved = { score: 0, daysPassed: 5, consecutiveGoodDays: 0, currentObjective: null };
      const loaded = loadProgressState(saved, 0);
      expect(loaded.daysPassed).toBe(5);
    });

    it('restores consecutive good days', () => {
      const saved = { score: 0, daysPassed: 0, consecutiveGoodDays: 3, currentObjective: null };
      const loaded = loadProgressState(saved, 0);
      expect(loaded.consecutiveGoodDays).toBe(3);
    });

    it('restores objective', () => {
      const objective = makeObjective({ progress: 50, completed: true });
      const saved = { score: 0, daysPassed: 0, consecutiveGoodDays: 0, currentObjective: objective };
      const loaded = loadProgressState(saved, 0);
      expect(loaded.currentObjective).toEqual(objective);
    });

    it('uses provided high score', () => {
      const saved = { score: 100, daysPassed: 0, consecutiveGoodDays: 0, currentObjective: null };
      const loaded = loadProgressState(saved, 500);
      expect(loaded.highScore).toBe(500);
    });
  });

  it('round-trips correctly', () => {
    const original: ProgressState = {
      score: 250,
      highScore: 500,
      daysPassed: 7,
      consecutiveGoodDays: 3,
      currentObjective: makeObjective({ progress: 65 })
    };

    const serialized = serializeProgressState(original);
    const loaded = loadProgressState(
      serialized as { score: number; daysPassed: number; consecutiveGoodDays: number; currentObjective: Objective | null },
      original.highScore
    );

    expect(loaded.score).toBe(original.score);
    expect(loaded.highScore).toBe(original.highScore);
    expect(loaded.daysPassed).toBe(original.daysPassed);
    expect(loaded.consecutiveGoodDays).toBe(original.consecutiveGoodDays);
    expect(loaded.currentObjective).toEqual(original.currentObjective);
  });
});

describe('Scoring Formula Verification', () => {
  it('consecutive good days multiplier increases by 10% per day', () => {
    const stats = makeStats({ averageHealth: 85 });

    const state0: ProgressState = {
      ...createInitialProgressState(),
      consecutiveGoodDays: 0,
      currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
    };
    const state1: ProgressState = { ...state0, consecutiveGoodDays: 1 };
    const state2: ProgressState = { ...state0, consecutiveGoodDays: 2 };

    const updated0 = updateObjectiveProgress(state0, stats);
    const updated1 = updateObjectiveProgress(state1, stats);
    const updated2 = updateObjectiveProgress(state2, stats);

    expect(updated0.score).toBe(100);
    expect(updated1.score).toBe(110);
    expect(updated2.score).toBe(120);
  });

  it('10 consecutive good days gives 2x bonus', () => {
    const stats = makeStats({ averageHealth: 85 });
    const state: ProgressState = {
      ...createInitialProgressState(),
      consecutiveGoodDays: 10,
      currentObjective: makeObjective({ type: 'MAINTAIN_HEALTH', target: 80 })
    };
    const updated = updateObjectiveProgress(state, stats);
    expect(updated.score).toBe(200);
  });
});
