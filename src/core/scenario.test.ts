import { describe, it, expect } from 'vitest';
import { ScenarioManager, ScenarioObjective, ScenarioConditions } from './scenario';
import { FaceState, createFaceState } from './face-state';
import { TERRAIN_CODES } from './terrain';

describe('ScenarioManager', () => {
  describe('Economic Objectives', () => {
    it('tracks profit and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addRevenue(8000);
      manager.addExpense(2000);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);

      const progress = manager.getProgress();
      expect(progress.totalRevenue).toBe(8000);
      expect(progress.totalExpenses).toBe(2000);
      expect(progress.currentCash).toBe(16000); // 10000 + 8000 - 2000
    });

    it('tracks revenue and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetRevenue: 10000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 5000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addRevenue(12000);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('fails when running out of money', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 1000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addExpense(2500);

      const result = manager.checkObjective();
      expect(result.failed).toBe(true);
      expect(result.completed).toBe(false);
    });

    it('tracks targetCash and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetCash: 15000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addRevenue(6000);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
      expect(result.message).toBe('Economic objective achieved!');
    });

    it('applies cost and revenue multipliers', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 1000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 5000,
        costMultiplier: 1.5,
        revenueMultiplier: 2.0,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addRevenue(1000); // Actually adds 2000
      manager.addExpense(500);  // Actually subtracts 750

      const progress = manager.getProgress();
      expect(progress.totalRevenue).toBe(2000);
      expect(progress.totalExpenses).toBe(750);
      expect(progress.currentCash).toBe(6250); // 5000 + 2000 - 750
    });

    it('economic objective in progress returns undefined message', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 10000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 5000,
        timeLimitDays: 30,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.addRevenue(1000);

      const result = manager.checkObjective();
      expect(result.completed).toBe(false);
      expect(result.failed).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it('checkObjective handles economic objective with no specific target', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      const result = manager.checkObjective();

      expect(result.completed).toBe(false);
      expect(result.progress).toBe(0);
    });
  });

  describe('Attendance Objectives', () => {
    it('tracks golfers and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 100,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addGolfers(50);
      manager.addGolfers(60);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);

      const progress = manager.getProgress();
      expect(progress.totalGolfers).toBe(110);
    });

    it('tracks rounds and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 100,
        targetRounds: 50,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      for (let i = 0; i < 55; i++) {
        manager.addRound();
      }

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('fails when time limit is exceeded', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 100,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        timeLimitDays: 30,
      };

      const manager = new ScenarioManager(objective, conditions);

      for (let i = 0; i < 31; i++) {
        manager.incrementDay();
      }

      const result = manager.checkObjective();
      expect(result.failed).toBe(true);
    });

    it('checkObjective handles attendance objective with no specific target', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      const result = manager.checkObjective();

      expect(result.completed).toBe(false);
      expect(result.progress).toBe(0);
    });
  });

  describe('Satisfaction Objectives', () => {
    it('tracks rating streak and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
        maintainForDays: 5,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.updateProgress({ currentRating: 85 });

      for (let i = 0; i < 5; i++) {
        manager.checkSatisfactionStreak(80);
        manager.incrementDay();
      }

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('resets streak when rating drops below target', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
        maintainForDays: 5,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.updateProgress({ currentRating: 85 });
      manager.checkSatisfactionStreak(80);
      manager.checkSatisfactionStreak(80);
      manager.checkSatisfactionStreak(80);

      expect(manager.getProgress().daysAtTargetRating).toBe(3);

      manager.updateProgress({ currentRating: 75 });
      manager.checkSatisfactionStreak(80);

      expect(manager.getProgress().daysAtTargetRating).toBe(0);
    });
  });

  describe('Restoration Objectives', () => {
    it('tracks health and detects completion', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.updateProgress({ currentHealth: 85 });

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('updates health from face states', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
      };

      const manager = new ScenarioManager(objective, conditions);

      const faceStates = new Map<number, FaceState>();
      const f1 = createFaceState(0, TERRAIN_CODES.FAIRWAY);
      f1.health = 85;
      faceStates.set(0, f1);
      const f2 = createFaceState(1, TERRAIN_CODES.FAIRWAY);
      f2.health = 80;
      faceStates.set(1, f2);
      const f3 = createFaceState(2, TERRAIN_CODES.FAIRWAY);
      f3.health = 75;
      faceStates.set(2, f3);
      const f4 = createFaceState(3, TERRAIN_CODES.FAIRWAY);
      f4.health = 90;
      faceStates.set(3, f4);

      manager.updateCourseHealthFromFaces(faceStates);

      const progress = manager.getProgress();
      expect(progress.currentHealth).toBeCloseTo(82.5, 1);
      expect(progress.currentRating).toBe(90);
    });
  });

  describe('Objective Descriptions', () => {
    it('generates correct description for economic objective', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Reach $5000 profit');
    });

    it('generates correct description for attendance objective', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 200,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Attract 200 golfers');
    });

    it('generates correct description for satisfaction objective', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 85,
        maintainForDays: 7,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Maintain 85+ rating for 7 days');
    });

    it('generates correct description for restoration objective', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Restore course health to 80+');
    });

    it('generates correct description for targetCash economic objective', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetCash: 25000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Accumulate $25000 in cash');
    });

    it('generates correct description for targetRounds attendance objective', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetRounds: 100,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Host 100 rounds');
    });

    it('generates correct description for targetCondition restoration objective', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
        targetCondition: 'Excellent',
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Restore course to Excellent condition');
    });

    it('generates correct description for targetRevenue economic objective', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetRevenue: 50000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Earn $50000 in revenue');
    });

    it('generates fallback description for economic objective with no specific target', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Economic objective');
    });

    it('generates fallback description for attendance objective with no specific target', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Attendance objective');
    });

    it('generates fallback description for unknown objective type', () => {
      const objective = {
        type: 'mystery',
      } as unknown as ScenarioObjective;
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      expect(manager.getObjectiveDescription()).toBe('Unknown objective');
    });

    it('checkObjective returns default result for unknown objective type', () => {
      const objective = {
        type: 'mystery',
      } as unknown as ScenarioObjective;
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      const result = manager.checkObjective();

      expect(result.completed).toBe(false);
      expect(result.failed).toBe(false);
      expect(result.progress).toBe(0);
    });

    it('getObjectiveDescription uses default days for satisfaction without maintainForDays', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      // maintainForDays defaults to 1
      expect(manager.getObjectiveDescription()).toBe('Maintain 80+ rating for 1 days');
    });
  });

  describe('Reset', () => {
    it('resets all progress to initial state', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 60,
      };

      const manager = new ScenarioManager(objective, conditions);

      manager.addRevenue(3000);
      manager.addExpense(1000);
      manager.addGolfers(50);
      manager.incrementDay();

      manager.reset();

      const progress = manager.getProgress();
      expect(progress.daysElapsed).toBe(0);
      expect(progress.currentCash).toBe(10000);
      expect(progress.totalRevenue).toBe(0);
      expect(progress.totalExpenses).toBe(0);
      expect(progress.totalGolfers).toBe(0);
      expect(progress.currentHealth).toBe(60);
    });

    it('uses default health of 50 when no startingHealth provided', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.reset();

      const progress = manager.getProgress();
      expect(progress.currentHealth).toBe(50);
    });
  });

  describe('Getters', () => {
    it('getObjective returns a copy of the objective', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      const retrieved = manager.getObjective();

      expect(retrieved.type).toBe('economic');
      expect((retrieved as any).targetProfit).toBe(5000);
    });

    it('getConditions returns a copy of the conditions', () => {
      const objective: ScenarioObjective = {
        type: 'economic',
        targetProfit: 5000,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        timeLimitDays: 30,
        costMultiplier: 1.5,
      };

      const manager = new ScenarioManager(objective, conditions);
      const retrieved = manager.getConditions();

      expect(retrieved.startingCash).toBe(10000);
      expect(retrieved.timeLimitDays).toBe(30);
      expect(retrieved.costMultiplier).toBe(1.5);
    });
  });

  describe('Satisfaction Edge Cases', () => {
    it('satisfaction defaults to 1 day when maintainForDays not provided', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.updateProgress({ currentRating: 85 });
      manager.checkSatisfactionStreak(80);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('satisfaction fails when time limit exceeded', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
        maintainForDays: 10,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        timeLimitDays: 5,
      };

      const manager = new ScenarioManager(objective, conditions);

      for (let i = 0; i < 6; i++) {
        manager.incrementDay();
      }

      const result = manager.checkObjective();
      expect(result.failed).toBe(true);
      expect(result.message).toBe('Time limit exceeded!');
    });
  });

  describe('Restoration Edge Cases', () => {
    it('restoration fails when time limit exceeded', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
        timeLimitDays: 10,
      };

      const manager = new ScenarioManager(objective, conditions);

      for (let i = 0; i < 11; i++) {
        manager.incrementDay();
      }

      const result = manager.checkObjective();
      expect(result.failed).toBe(true);
      expect(result.message).toBe('Time limit exceeded!');
    });

    it('restoration shows success message on completion', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.updateProgress({ currentHealth: 85 });

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.message).toBe('Course restored!');
    });
  });

  describe('Attendance Edge Cases', () => {
    it('attendance shows success message on completion', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 50,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.addGolfers(60);

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.message).toBe('Attendance objective achieved!');
    });

    it('attendance returns undefined message when in progress', () => {
      const objective: ScenarioObjective = {
        type: 'attendance',
        targetGolfers: 100,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        timeLimitDays: 30,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.addGolfers(50);

      const result = manager.checkObjective();
      expect(result.completed).toBe(false);
      expect(result.failed).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it('satisfaction returns undefined message when in progress', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
        maintainForDays: 10,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        timeLimitDays: 30,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.updateProgress({ currentRating: 85 });
      manager.checkSatisfactionStreak(80);

      const result = manager.checkObjective();
      expect(result.completed).toBe(false);
      expect(result.failed).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it('satisfaction shows success message on completion', () => {
      const objective: ScenarioObjective = {
        type: 'satisfaction',
        targetRating: 80,
        maintainForDays: 3,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.updateProgress({ currentRating: 85 });

      for (let i = 0; i < 3; i++) {
        manager.checkSatisfactionStreak(80);
        manager.incrementDay();
      }

      const result = manager.checkObjective();
      expect(result.completed).toBe(true);
      expect(result.message).toBe('Satisfaction objective achieved!');
    });

    it('restoration returns undefined message when in progress', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
        timeLimitDays: 30,
      };

      const manager = new ScenarioManager(objective, conditions);
      manager.updateProgress({ currentHealth: 60 });

      const result = manager.checkObjective();
      expect(result.completed).toBe(false);
      expect(result.failed).toBe(false);
      expect(result.message).toBeUndefined();
    });
  });
});
