export type ObjectiveType = 'MAINTAIN_HEALTH' | 'MOW_PERCENTAGE' | 'WATER_DRY' | 'FERTILIZE_POOR';

export interface Objective {
  type: ObjectiveType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface ProgressState {
  score: number;
  highScore: number;
  daysPassed: number;
  consecutiveGoodDays: number;
  currentObjective: Objective | null;
}

export interface CourseStats {
  averageHealth: number;
  averageMoisture: number;
  averageNutrients: number;
  cellsNeedingMowing: number;
  cellsNeedingWater: number;
  cellsNeedingFertilizer: number;
}

export function createInitialProgressState(savedHighScore: number = 0): ProgressState {
  return {
    score: 0,
    highScore: savedHighScore,
    daysPassed: 0,
    consecutiveGoodDays: 0,
    currentObjective: null
  };
}

export function generateObjective(stats: CourseStats): Objective {
  const { averageHealth, averageMoisture, averageNutrients, cellsNeedingMowing, cellsNeedingWater, cellsNeedingFertilizer } = stats;

  let type: ObjectiveType;
  let description: string;
  let target: number;

  if (averageHealth < 60) {
    type = 'MAINTAIN_HEALTH';
    description = 'Improve course health to 70%';
    target = 70;
  } else if (cellsNeedingMowing > 100) {
    type = 'MOW_PERCENTAGE';
    description = 'Mow overgrown areas';
    target = cellsNeedingMowing;
  } else if (averageMoisture < 40) {
    type = 'WATER_DRY';
    description = 'Water dry areas';
    target = cellsNeedingWater;
  } else if (averageNutrients < 40) {
    type = 'FERTILIZE_POOR';
    description = 'Fertilize nutrient-poor areas';
    target = cellsNeedingFertilizer;
  } else {
    type = 'MAINTAIN_HEALTH';
    description = 'Maintain excellent course health';
    target = 80;
  }

  return {
    type,
    description,
    target,
    progress: 0,
    completed: false
  };
}

export function updateScore(state: ProgressState, deltaMs: number, averageHealth: number): ProgressState {
  let newScore = state.score;

  if (averageHealth >= 80) {
    newScore += Math.floor(10 * (deltaMs / 60000));
  }

  if (averageHealth < 50) {
    newScore = Math.max(0, newScore - Math.floor(10 * (deltaMs / 60000)));
  }

  const newHighScore = Math.max(state.highScore, newScore);

  return {
    ...state,
    score: newScore,
    highScore: newHighScore
  };
}

export function updateObjectiveProgress(state: ProgressState, stats: CourseStats): ProgressState {
  if (!state.currentObjective || state.currentObjective.completed) {
    return state;
  }

  const objective = state.currentObjective;
  let newProgress = objective.progress;
  let completed = false;

  switch (objective.type) {
    case 'MAINTAIN_HEALTH':
      newProgress = stats.averageHealth;
      if (stats.averageHealth >= objective.target) {
        completed = true;
      }
      break;
    case 'MOW_PERCENTAGE':
      newProgress = objective.target - stats.cellsNeedingMowing;
      if (stats.cellsNeedingMowing === 0) {
        completed = true;
      }
      break;
    case 'WATER_DRY':
      newProgress = objective.target - stats.cellsNeedingWater;
      if (stats.cellsNeedingWater === 0) {
        completed = true;
      }
      break;
    case 'FERTILIZE_POOR':
      newProgress = objective.target - stats.cellsNeedingFertilizer;
      if (stats.cellsNeedingFertilizer === 0) {
        completed = true;
      }
      break;
  }

  if (completed && !objective.completed) {
    const bonusMultiplier = 1 + state.consecutiveGoodDays * 0.1;
    const bonus = Math.floor(100 * bonusMultiplier);
    return {
      ...state,
      score: state.score + bonus,
      highScore: Math.max(state.highScore, state.score + bonus),
      currentObjective: {
        ...objective,
        progress: newProgress,
        completed: true
      }
    };
  }

  return {
    ...state,
    currentObjective: {
      ...objective,
      progress: newProgress
    }
  };
}

export function processNewDay(state: ProgressState, averageHealth: number, newStats: CourseStats): ProgressState {
  let newConsecutiveGoodDays = state.consecutiveGoodDays;

  if (averageHealth >= 70) {
    newConsecutiveGoodDays = state.consecutiveGoodDays + 1;
  } else {
    newConsecutiveGoodDays = 0;
  }

  const newObjective = generateObjective(newStats);

  return {
    ...state,
    daysPassed: state.daysPassed + 1,
    consecutiveGoodDays: newConsecutiveGoodDays,
    currentObjective: newObjective
  };
}

export function serializeProgressState(state: ProgressState): object {
  return {
    score: state.score,
    daysPassed: state.daysPassed,
    consecutiveGoodDays: state.consecutiveGoodDays,
    currentObjective: state.currentObjective
  };
}

export function loadProgressState(
  saved: {
    score: number;
    daysPassed: number;
    consecutiveGoodDays: number;
    currentObjective: Objective | null;
  },
  highScore: number
): ProgressState {
  return {
    score: saved.score,
    highScore,
    daysPassed: saved.daysPassed,
    consecutiveGoodDays: saved.consecutiveGoodDays,
    currentObjective: saved.currentObjective
  };
}
