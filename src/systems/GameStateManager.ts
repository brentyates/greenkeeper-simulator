import { GrassSystem } from './GrassSystem';

export type ObjectiveType = 'MAINTAIN_HEALTH' | 'MOW_PERCENTAGE' | 'WATER_DRY' | 'FERTILIZE_POOR';

export interface Objective {
  type: ObjectiveType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
}

export class GameStateManager {
  private grassSystem: GrassSystem;
  private score = 0;
  private daysPassed = 0;
  private currentObjective: Objective | null = null;
  private consecutiveGoodDays = 0;
  private highScore: number;

  constructor(grassSystem: GrassSystem) {
    this.grassSystem = grassSystem;
    this.highScore = parseInt(localStorage.getItem('greenkeeper_highscore') || '0');
    this.generateDailyObjective();
  }

  generateDailyObjective(): void {
    const health = this.grassSystem.getAverageHealth();
    const moisture = this.grassSystem.getAverageMoisture();
    const nutrients = this.grassSystem.getAverageNutrients();
    const needsMowing = this.grassSystem.getCellsNeedingMowing();

    let type: ObjectiveType;
    let description: string;
    let target: number;

    if (health < 60) {
      type = 'MAINTAIN_HEALTH';
      description = 'Improve course health to 70%';
      target = 70;
    } else if (needsMowing > 100) {
      type = 'MOW_PERCENTAGE';
      description = 'Mow overgrown areas';
      target = needsMowing;
    } else if (moisture < 40) {
      type = 'WATER_DRY';
      description = 'Water dry areas';
      target = this.grassSystem.getCellsNeedingWater();
    } else if (nutrients < 40) {
      type = 'FERTILIZE_POOR';
      description = 'Fertilize nutrient-poor areas';
      target = this.grassSystem.getCellsNeedingFertilizer();
    } else {
      type = 'MAINTAIN_HEALTH';
      description = 'Maintain excellent course health';
      target = 80;
    }

    this.currentObjective = {
      type,
      description,
      target,
      progress: 0,
      completed: false
    };
  }

  update(delta: number): void {
    const health = this.grassSystem.getAverageHealth();

    if (health >= 80) {
      this.score += Math.floor(10 * (delta / 60000));
    }

    if (health < 50) {
      this.score = Math.max(0, this.score - Math.floor(10 * (delta / 60000)));
    }

    this.updateObjectiveProgress();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('greenkeeper_highscore', this.highScore.toString());
    }
  }

  private updateObjectiveProgress(): void {
    if (!this.currentObjective || this.currentObjective.completed) return;

    const health = this.grassSystem.getAverageHealth();

    switch (this.currentObjective.type) {
      case 'MAINTAIN_HEALTH':
        this.currentObjective.progress = health;
        if (health >= this.currentObjective.target) {
          this.completeObjective();
        }
        break;
      case 'MOW_PERCENTAGE':
        const currentNeedsMowing = this.grassSystem.getCellsNeedingMowing();
        this.currentObjective.progress = this.currentObjective.target - currentNeedsMowing;
        if (currentNeedsMowing === 0) {
          this.completeObjective();
        }
        break;
      case 'WATER_DRY':
        const currentNeedsWater = this.grassSystem.getCellsNeedingWater();
        this.currentObjective.progress = this.currentObjective.target - currentNeedsWater;
        if (currentNeedsWater === 0) {
          this.completeObjective();
        }
        break;
      case 'FERTILIZE_POOR':
        const currentNeedsFertilizer = this.grassSystem.getCellsNeedingFertilizer();
        this.currentObjective.progress = this.currentObjective.target - currentNeedsFertilizer;
        if (currentNeedsFertilizer === 0) {
          this.completeObjective();
        }
        break;
    }
  }

  private completeObjective(): void {
    if (!this.currentObjective) return;

    this.currentObjective.completed = true;
    const bonusMultiplier = 1 + (this.consecutiveGoodDays * 0.1);
    this.score += Math.floor(100 * bonusMultiplier);
  }

  onNewDay(): void {
    this.daysPassed++;

    const health = this.grassSystem.getAverageHealth();
    if (health >= 70) {
      this.consecutiveGoodDays++;
    } else {
      this.consecutiveGoodDays = 0;
    }

    this.generateDailyObjective();
  }

  getScore(): number {
    return this.score;
  }

  getHighScore(): number {
    return this.highScore;
  }

  getDaysPassed(): number {
    return this.daysPassed;
  }

  getCurrentObjective(): Objective | null {
    return this.currentObjective;
  }

  getConsecutiveGoodDays(): number {
    return this.consecutiveGoodDays;
  }

  getSerializableState(): object {
    return {
      score: this.score,
      daysPassed: this.daysPassed,
      consecutiveGoodDays: this.consecutiveGoodDays,
      currentObjective: this.currentObjective
    };
  }

  loadState(state: { score: number; daysPassed: number; consecutiveGoodDays: number; currentObjective: Objective | null }): void {
    this.score = state.score;
    this.daysPassed = state.daysPassed;
    this.consecutiveGoodDays = state.consecutiveGoodDays;
    this.currentObjective = state.currentObjective;
  }
}
