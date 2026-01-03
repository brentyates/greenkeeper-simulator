import { SCENARIOS, ScenarioDefinition, getUnlockedScenarios } from '../data/scenarioData';

const STORAGE_KEY = 'greenkeeper_progress';

export interface ProgressData {
  completedScenarios: string[];
  bestScores: Record<string, number>;
  lastPlayedScenario: string | null;
}

const DEFAULT_PROGRESS: ProgressData = {
  completedScenarios: [],
  bestScores: {},
  lastPlayedScenario: null,
};

export class ProgressManager {
  private progress: ProgressData;

  constructor() {
    this.progress = this.loadProgress();
  }

  private loadProgress(): ProgressData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_PROGRESS,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Failed to load progress from localStorage:', e);
    }
    return { ...DEFAULT_PROGRESS };
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.warn('Failed to save progress to localStorage:', e);
    }
  }

  public getCompletedScenarios(): string[] {
    return [...this.progress.completedScenarios];
  }

  public getUnlockedScenarios(): ScenarioDefinition[] {
    return getUnlockedScenarios(this.progress.completedScenarios);
  }

  public isScenarioUnlocked(scenarioId: string): boolean {
    const unlocked = this.getUnlockedScenarios();
    return unlocked.some(s => s.id === scenarioId);
  }

  public isScenarioCompleted(scenarioId: string): boolean {
    return this.progress.completedScenarios.includes(scenarioId);
  }

  public completeScenario(scenarioId: string, score?: number): void {
    if (!this.progress.completedScenarios.includes(scenarioId)) {
      this.progress.completedScenarios.push(scenarioId);
    }

    if (score !== undefined) {
      const currentBest = this.progress.bestScores[scenarioId] ?? 0;
      if (score > currentBest) {
        this.progress.bestScores[scenarioId] = score;
      }
    }

    this.saveProgress();
  }

  public getBestScore(scenarioId: string): number | null {
    return this.progress.bestScores[scenarioId] ?? null;
  }

  public setLastPlayedScenario(scenarioId: string): void {
    this.progress.lastPlayedScenario = scenarioId;
    this.saveProgress();
  }

  public getLastPlayedScenario(): string | null {
    return this.progress.lastPlayedScenario;
  }

  public getAllScenarios(): ScenarioDefinition[] {
    return [...SCENARIOS];
  }

  public getScenarioStatus(scenarioId: string): 'locked' | 'unlocked' | 'completed' {
    if (this.isScenarioCompleted(scenarioId)) {
      return 'completed';
    }
    if (this.isScenarioUnlocked(scenarioId)) {
      return 'unlocked';
    }
    return 'locked';
  }

  public resetProgress(): void {
    this.progress = { ...DEFAULT_PROGRESS };
    this.saveProgress();
  }

  // Debug: unlock all scenarios
  public unlockAll(): void {
    this.progress.completedScenarios = SCENARIOS.map(s => s.id);
    this.saveProgress();
  }
}

// Singleton instance for global access
let progressManagerInstance: ProgressManager | null = null;

export function getProgressManager(): ProgressManager {
  if (!progressManagerInstance) {
    progressManagerInstance = new ProgressManager();
  }
  return progressManagerInstance;
}
