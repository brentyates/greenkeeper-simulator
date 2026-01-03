import { describe, it, expect } from 'vitest';
import { ScenarioManager, ScenarioObjective, ScenarioConditions } from './scenario';
import { CellState } from './terrain';

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

    it('updates health from cell states', () => {
      const objective: ScenarioObjective = {
        type: 'restoration',
        targetHealth: 80,
      };
      const conditions: ScenarioConditions = {
        startingCash: 10000,
        startingHealth: 30,
      };

      const manager = new ScenarioManager(objective, conditions);

      const cells: CellState[][] = [
        [
          { x: 0, y: 0, type: 'fairway', height: 20, moisture: 70, nutrients: 80, health: 85, elevation: 0, obstacle: 'none', lastMowed: 0, lastWatered: 0, lastFertilized: 0 },
          { x: 1, y: 0, type: 'fairway', height: 15, moisture: 65, nutrients: 75, health: 80, elevation: 0, obstacle: 'none', lastMowed: 0, lastWatered: 0, lastFertilized: 0 },
        ],
        [
          { x: 0, y: 1, type: 'fairway', height: 25, moisture: 60, nutrients: 70, health: 75, elevation: 0, obstacle: 'none', lastMowed: 0, lastWatered: 0, lastFertilized: 0 },
          { x: 1, y: 1, type: 'fairway', height: 18, moisture: 75, nutrients: 85, health: 90, elevation: 0, obstacle: 'none', lastMowed: 0, lastWatered: 0, lastFertilized: 0 },
        ],
      ];

      manager.updateCourseHealth(cells);

      const progress = manager.getProgress();
      expect(progress.currentHealth).toBeCloseTo(82.5, 1);
      expect(progress.currentRating).toBe(90); // Excellent condition
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
  });
});
