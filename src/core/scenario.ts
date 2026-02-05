import { CellState } from './terrain';
import { getAverageStats, getOverallCondition } from './grass-simulation';
import { FaceState, getAverageFaceStats } from './face-state';

export type ScenarioType = 'economic' | 'attendance' | 'satisfaction' | 'restoration';

export interface EconomicObjective {
  type: 'economic';
  targetProfit?: number;
  targetRevenue?: number;
  targetCash?: number;
}

export interface AttendanceObjective {
  type: 'attendance';
  targetGolfers?: number;
  targetRounds?: number;
}

export interface SatisfactionObjective {
  type: 'satisfaction';
  targetRating: number;
  maintainForDays?: number;
}

export interface RestorationObjective {
  type: 'restoration';
  targetHealth: number;
  targetCondition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export type ScenarioObjective =
  | EconomicObjective
  | AttendanceObjective
  | SatisfactionObjective
  | RestorationObjective;

export interface ScenarioConditions {
  startingCash: number;
  startingHealth?: number;
  timeLimitDays?: number;
  grassGrowthRate?: number;
  costMultiplier?: number;
  revenueMultiplier?: number;
}

export interface ScenarioProgress {
  daysElapsed: number;
  currentCash: number;
  totalRevenue: number;
  totalExpenses: number;
  totalGolfers: number;
  totalRounds: number;
  currentHealth: number;
  currentRating: number;
  daysAtTargetRating: number;
}

export interface ScenarioResult {
  completed: boolean;
  failed: boolean;
  message?: string;
  progress: number;
}

export class ScenarioManager {
  private objective: ScenarioObjective;
  private conditions: ScenarioConditions;
  private progress: ScenarioProgress;

  constructor(objective: ScenarioObjective, conditions: ScenarioConditions) {
    this.objective = objective;
    this.conditions = conditions;
    this.progress = {
      daysElapsed: 0,
      currentCash: conditions.startingCash,
      totalRevenue: 0,
      totalExpenses: 0,
      totalGolfers: 0,
      totalRounds: 0,
      currentHealth: conditions.startingHealth || 50,
      currentRating: 0,
      daysAtTargetRating: 0,
    };
  }

  public getProgress(): ScenarioProgress {
    return { ...this.progress };
  }

  public getObjective(): ScenarioObjective {
    return { ...this.objective };
  }

  public getConditions(): ScenarioConditions {
    return { ...this.conditions };
  }

  public updateProgress(updates: Partial<ScenarioProgress>): void {
    this.progress = {
      ...this.progress,
      ...updates,
    };
  }

  public incrementDay(): void {
    this.progress.daysElapsed++;
  }

  public addRevenue(amount: number): void {
    const adjusted = amount * (this.conditions.revenueMultiplier || 1);
    this.progress.totalRevenue += adjusted;
    this.progress.currentCash += adjusted;
  }

  public addExpense(amount: number): void {
    const adjusted = amount * (this.conditions.costMultiplier || 1);
    this.progress.totalExpenses += adjusted;
    this.progress.currentCash -= adjusted;
  }

  public addGolfers(count: number): void {
    this.progress.totalGolfers += count;
  }

  public addRound(): void {
    this.progress.totalRounds++;
  }

  public updateCourseHealth(cells: CellState[][]): void {
    const stats = getAverageStats(cells);
    this.progress.currentHealth = stats.health;

    const condition = getOverallCondition(stats.health);
    const conditionToRating: Record<'Excellent' | 'Good' | 'Fair' | 'Poor', number> = {
      'Excellent': 90,
      'Good': 70,
      'Fair': 50,
      'Poor': 30,
    };
    this.progress.currentRating = conditionToRating[condition];
  }

  public updateCourseHealthFromFaces(faceStates: Map<number, FaceState>): void {
    const stats = getAverageFaceStats(faceStates);
    this.progress.currentHealth = stats.health;

    const condition = getOverallCondition(stats.health);
    const conditionToRating: Record<'Excellent' | 'Good' | 'Fair' | 'Poor', number> = {
      'Excellent': 90,
      'Good': 70,
      'Fair': 50,
      'Poor': 30,
    };
    this.progress.currentRating = conditionToRating[condition];
  }

  public checkSatisfactionStreak(targetRating: number): void {
    if (this.progress.currentRating >= targetRating) {
      this.progress.daysAtTargetRating++;
    } else {
      this.progress.daysAtTargetRating = 0;
    }
  }

  public checkObjective(): ScenarioResult {
    switch (this.objective.type) {
      case 'economic':
        return this.checkEconomicObjective();
      case 'attendance':
        return this.checkAttendanceObjective();
      case 'satisfaction':
        return this.checkSatisfactionObjective();
      case 'restoration':
        return this.checkRestorationObjective();
      default:
        return { completed: false, failed: false, progress: 0 };
    }
  }

  private checkEconomicObjective(): ScenarioResult {
    const obj = this.objective as EconomicObjective;
    let completed = false;
    let progress = 0;

    if (obj.targetProfit !== undefined) {
      const currentProfit = this.progress.totalRevenue - this.progress.totalExpenses;
      progress = Math.min(100, (currentProfit / obj.targetProfit) * 100);
      completed = currentProfit >= obj.targetProfit;
    } else if (obj.targetRevenue !== undefined) {
      progress = Math.min(100, (this.progress.totalRevenue / obj.targetRevenue) * 100);
      completed = this.progress.totalRevenue >= obj.targetRevenue;
    } else if (obj.targetCash !== undefined) {
      progress = Math.min(100, (this.progress.currentCash / obj.targetCash) * 100);
      completed = this.progress.currentCash >= obj.targetCash;
    }

    const failed = this.checkTimeLimitFailed() || (this.progress.currentCash < -1000);

    return {
      completed,
      failed,
      progress,
      message: completed ? 'Economic objective achieved!' : failed ? 'Out of money or time!' : undefined,
    };
  }

  private checkAttendanceObjective(): ScenarioResult {
    const obj = this.objective as AttendanceObjective;
    let completed = false;
    let progress = 0;

    if (obj.targetRounds !== undefined) {
      progress = Math.min(100, (this.progress.totalRounds / obj.targetRounds) * 100);
      completed = this.progress.totalRounds >= obj.targetRounds;
    } else if (obj.targetGolfers !== undefined) {
      progress = Math.min(100, (this.progress.totalGolfers / obj.targetGolfers) * 100);
      completed = this.progress.totalGolfers >= obj.targetGolfers;
    }

    const failed = this.checkTimeLimitFailed();

    return {
      completed,
      failed,
      progress,
      message: completed ? 'Attendance objective achieved!' : failed ? 'Time limit exceeded!' : undefined,
    };
  }

  private checkSatisfactionObjective(): ScenarioResult {
    const obj = this.objective as SatisfactionObjective;
    const daysRequired = obj.maintainForDays || 1;

    const progress = Math.min(100, (this.progress.daysAtTargetRating / daysRequired) * 100);
    const completed = this.progress.daysAtTargetRating >= daysRequired;
    const failed = this.checkTimeLimitFailed();

    return {
      completed,
      failed,
      progress,
      message: completed ? 'Satisfaction objective achieved!' : failed ? 'Time limit exceeded!' : undefined,
    };
  }

  private checkRestorationObjective(): ScenarioResult {
    const obj = this.objective as RestorationObjective;

    const progress = Math.min(100, (this.progress.currentHealth / obj.targetHealth) * 100);
    const completed = this.progress.currentHealth >= obj.targetHealth;
    const failed = this.checkTimeLimitFailed();

    return {
      completed,
      failed,
      progress,
      message: completed ? 'Course restored!' : failed ? 'Time limit exceeded!' : undefined,
    };
  }

  private checkTimeLimitFailed(): boolean {
    if (this.conditions.timeLimitDays !== undefined) {
      return this.progress.daysElapsed >= this.conditions.timeLimitDays;
    }
    return false;
  }

  public getObjectiveDescription(): string {
    switch (this.objective.type) {
      case 'economic': {
        const obj = this.objective as EconomicObjective;
        if (obj.targetProfit !== undefined) {
          return `Reach $${obj.targetProfit} profit`;
        } else if (obj.targetRevenue !== undefined) {
          return `Earn $${obj.targetRevenue} in revenue`;
        } else if (obj.targetCash !== undefined) {
          return `Accumulate $${obj.targetCash} in cash`;
        }
        return 'Economic objective';
      }
      case 'attendance': {
        const obj = this.objective as AttendanceObjective;
        if (obj.targetRounds !== undefined) {
          return `Host ${obj.targetRounds} rounds`;
        }
        if (obj.targetGolfers !== undefined) {
          return `Attract ${obj.targetGolfers} golfers`;
        }
        return 'Attendance objective';
      }
      case 'satisfaction': {
        const obj = this.objective as SatisfactionObjective;
        const days = obj.maintainForDays || 1;
        return `Maintain ${obj.targetRating}+ rating for ${days} days`;
      }
      case 'restoration': {
        const obj = this.objective as RestorationObjective;
        if (obj.targetCondition) {
          return `Restore course to ${obj.targetCondition} condition`;
        }
        return `Restore course health to ${obj.targetHealth}+`;
      }
      default:
        return 'Unknown objective';
    }
  }

  public reset(): void {
    this.progress = {
      daysElapsed: 0,
      currentCash: this.conditions.startingCash,
      totalRevenue: 0,
      totalExpenses: 0,
      totalGolfers: 0,
      totalRounds: 0,
      currentHealth: this.conditions.startingHealth || 50,
      currentRating: 0,
      daysAtTargetRating: 0,
    };
  }
}
