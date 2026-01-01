import { CellState, TerrainType, calculateHealth } from './terrain';

export interface GrowthResult {
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
}

export function simulateGrowth(
  cell: CellState,
  deltaMinutes: number
): GrowthResult {
  if (cell.type === 'bunker' || cell.type === 'water') {
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

  const newHeight = Math.min(100, cell.height + growthRate * deltaMinutes);
  const newMoisture = Math.max(0, cell.moisture - 0.05 * deltaMinutes);
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
  if (cell.type === 'bunker' || cell.type === 'water') {
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
  if (cell.type === 'water') {
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

export function applyFertilizing(cell: CellState, amount: number): CellState | null {
  if (cell.type === 'bunker' || cell.type === 'water') {
    return null;
  }

  const newCell = {
    ...cell,
    nutrients: Math.min(100, cell.nutrients + amount)
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
      if (cell.type !== 'bunker' && cell.type !== 'water') {
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
      if (cell.type !== 'bunker' && cell.type !== 'water' && cell.height > 60) {
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
      if (cell.type !== 'bunker' && cell.type !== 'water' && cell.moisture < 30) {
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
      if (cell.type !== 'bunker' && cell.type !== 'water' && cell.nutrients < 30) {
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
