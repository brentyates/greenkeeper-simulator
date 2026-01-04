import { CellState, calculateHealth, getTerrainMowable, getTerrainWaterable, getTerrainFertilizable } from './terrain';

export interface WeatherEffect {
  readonly type: "sunny" | "cloudy" | "rainy" | "stormy";
  readonly temperature: number;
}

export interface GrowthResult {
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
}

export function getWeatherMoistureEffect(weather?: WeatherEffect): { gainRate: number; lossMultiplier: number } {
  if (!weather) {
    return { gainRate: 0, lossMultiplier: 1.0 };
  }

  let gainRate = 0;
  let lossMultiplier = 1.0;

  switch (weather.type) {
    case "rainy":
      gainRate = 0.15;
      lossMultiplier = 0.3;
      break;
    case "stormy":
      gainRate = 0.25;
      lossMultiplier = 0.2;
      break;
    case "cloudy":
      lossMultiplier = 0.7;
      break;
    case "sunny":
      if (weather.temperature > 90) {
        lossMultiplier = 1.8;
      } else if (weather.temperature > 80) {
        lossMultiplier = 1.3;
      }
      break;
  }

  return { gainRate, lossMultiplier };
}

export function simulateGrowth(
  cell: CellState,
  deltaMinutes: number,
  weather?: WeatherEffect
): GrowthResult {
  if (!getTerrainMowable(cell.type)) {
    return {
      height: cell.height,
      moisture: cell.moisture,
      nutrients: cell.nutrients,
      health: cell.health
    };
  }

  let growthRate = 0.1;
  if (cell.moisture > 50) growthRate += 0.05;
  if (cell.nutrients > 50) growthRate += 0.1;
  if (cell.health < 30) growthRate -= 0.05;

  const weatherEffect = getWeatherMoistureEffect(weather);
  const moistureLoss = 0.05 * deltaMinutes * weatherEffect.lossMultiplier;
  const moistureGain = weatherEffect.gainRate * deltaMinutes;

  const newHeight = Math.min(100, cell.height + growthRate * deltaMinutes);
  const newMoisture = Math.min(100, Math.max(0, cell.moisture - moistureLoss + moistureGain));
  const newNutrients = Math.max(0, cell.nutrients - 0.02 * deltaMinutes);

  const updatedCell = {
    ...cell,
    height: newHeight,
    moisture: newMoisture,
    nutrients: newNutrients
  };
  const newHealth = calculateHealth(updatedCell);

  return {
    height: newHeight,
    moisture: newMoisture,
    nutrients: newNutrients,
    health: newHealth
  };
}

export function applyMowing(cell: CellState): CellState | null {
  if (!getTerrainMowable(cell.type)) {
    return null;
  }

  const newCell = {
    ...cell,
    height: 0
  };
  newCell.health = calculateHealth(newCell);
  return newCell;
}

export function applyWatering(cell: CellState, amount: number): CellState | null {
  if (!getTerrainWaterable(cell.type) && cell.type !== 'bunker') {
    return null;
  }

  let effectiveAmount = amount;
  if (cell.type === 'bunker') {
    effectiveAmount *= 0.5;
  }

  const newCell = {
    ...cell,
    moisture: Math.min(100, cell.moisture + effectiveAmount)
  };
  newCell.health = calculateHealth(newCell);
  return newCell;
}

export function applyFertilizing(cell: CellState, amount: number, effectiveness: number = 1.0): CellState | null {
  if (!getTerrainFertilizable(cell.type)) {
    return null;
  }

  const effectiveAmount = amount * effectiveness;
  const newCell = {
    ...cell,
    nutrients: Math.min(100, cell.nutrients + effectiveAmount)
  };
  newCell.health = calculateHealth(newCell);
  return newCell;
}

export function getAverageStats(cells: CellState[][]): {
  health: number;
  moisture: number;
  nutrients: number;
  height: number;
} {
  let totalHealth = 0;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let totalHeight = 0;
  let count = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (getTerrainMowable(cell.type)) {
        totalHealth += cell.health;
        totalMoisture += cell.moisture;
        totalNutrients += cell.nutrients;
        totalHeight += cell.height;
        count++;
      }
    }
  }

  if (count === 0) {
    return { health: 100, moisture: 100, nutrients: 100, height: 0 };
  }

  return {
    health: totalHealth / count,
    moisture: totalMoisture / count,
    nutrients: totalNutrients / count,
    height: totalHeight / count
  };
}

export function countCellsNeedingMowing(cells: CellState[][]): number {
  let count = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (getTerrainMowable(cell.type) && cell.height > 60) {
        count++;
      }
    }
  }
  return count;
}

export function countCellsNeedingWater(cells: CellState[][]): number {
  let count = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (getTerrainWaterable(cell.type) && cell.moisture < 30) {
        count++;
      }
    }
  }
  return count;
}

export function countCellsNeedingFertilizer(cells: CellState[][]): number {
  let count = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (getTerrainFertilizable(cell.type) && cell.nutrients < 30) {
        count++;
      }
    }
  }
  return count;
}

export function getOverallCondition(averageHealth: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (averageHealth >= 80) return 'Excellent';
  if (averageHealth >= 60) return 'Good';
  if (averageHealth >= 40) return 'Fair';
  return 'Poor';
}
