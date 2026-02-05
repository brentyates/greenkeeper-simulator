import {
  getTerrainType,
  getInitialValues,
  isGrassTerrain,
  calculateHealth,
} from './terrain';
import { getWeatherMoistureEffect, WeatherEffect } from './grass-simulation';

export interface FaceState {
  faceId: number;
  terrainCode: number;
  moisture: number;
  nutrients: number;
  grassHeight: number;
  health: number;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
  lastRaked: number;
}

export function createFaceState(faceId: number, terrainCode: number): FaceState {
  const terrainType = getTerrainType(terrainCode);
  const initial = getInitialValues(terrainType);
  const health = calculateHealth({
    type: terrainType,
    moisture: initial.moisture,
    nutrients: initial.nutrients,
    height: initial.height,
  });

  return {
    faceId,
    terrainCode,
    moisture: initial.moisture,
    nutrients: initial.nutrients,
    grassHeight: initial.height,
    health,
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
    lastRaked: 0,
  };
}

export function isGrassFace(terrainCode: number): boolean {
  return isGrassTerrain(getTerrainType(terrainCode));
}

export function calculateFaceHealth(state: FaceState): number {
  return calculateHealth({
    type: getTerrainType(state.terrainCode),
    moisture: state.moisture,
    nutrients: state.nutrients,
    height: state.grassHeight,
  });
}

export interface FaceGrowthResult {
  grassHeight: number;
  moisture: number;
  nutrients: number;
  health: number;
}

export function simulateFaceGrowth(
  state: FaceState,
  deltaMinutes: number,
  weather?: WeatherEffect
): FaceGrowthResult {
  const terrainType = getTerrainType(state.terrainCode);
  if (!isGrassTerrain(terrainType)) {
    return {
      grassHeight: state.grassHeight,
      moisture: state.moisture,
      nutrients: state.nutrients,
      health: state.health,
    };
  }

  let growthRate = 0.1;
  if (state.moisture > 50) growthRate += 0.02;
  if (state.nutrients > 50) growthRate += 0.03;

  const weatherEffect = getWeatherMoistureEffect(weather);
  const moistureLoss = 0.05 * deltaMinutes * weatherEffect.lossMultiplier;
  const moistureGain = weatherEffect.gainRate * deltaMinutes;

  const newHeight = Math.min(100, state.grassHeight + growthRate * deltaMinutes);
  const newMoisture = Math.min(100, Math.max(0, state.moisture - moistureLoss + moistureGain));
  const newNutrients = Math.max(0, state.nutrients - 0.003 * deltaMinutes);

  const newHealth = calculateHealth({
    type: terrainType,
    moisture: newMoisture,
    nutrients: newNutrients,
    height: newHeight,
  });

  return {
    grassHeight: newHeight,
    moisture: newMoisture,
    nutrients: newNutrients,
    health: newHealth,
  };
}

export function applyFaceMowing(state: FaceState): boolean {
  if (!isGrassFace(state.terrainCode)) return false;
  state.grassHeight = 0;
  state.health = calculateFaceHealth(state);
  return true;
}

export function applyFaceWatering(state: FaceState, amount: number): boolean {
  const terrainType = getTerrainType(state.terrainCode);
  if (!isGrassTerrain(terrainType) && terrainType !== 'bunker') return false;

  let effectiveAmount = amount;
  if (terrainType === 'bunker') {
    effectiveAmount *= 0.5;
  }

  state.moisture = Math.min(100, state.moisture + effectiveAmount);
  state.health = calculateFaceHealth(state);
  return true;
}

export function applyFaceFertilizing(
  state: FaceState,
  amount: number,
  effectiveness: number = 1.0
): boolean {
  if (!isGrassFace(state.terrainCode)) return false;
  state.moisture = state.moisture;
  state.nutrients = Math.min(100, state.nutrients + amount * effectiveness);
  state.health = calculateFaceHealth(state);
  return true;
}

export function getAverageFaceStats(
  states: Map<number, FaceState>
): { health: number; moisture: number; nutrients: number; height: number } {
  let totalHealth = 0;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let totalHeight = 0;
  let count = 0;

  for (const [, state] of states) {
    if (isGrassFace(state.terrainCode)) {
      totalHealth += state.health;
      totalMoisture += state.moisture;
      totalNutrients += state.nutrients;
      totalHeight += state.grassHeight;
      count++;
    }
  }

  if (count === 0) {
    return { health: 100, moisture: 100, nutrients: 100, height: 0 };
  }

  return {
    health: totalHealth / count,
    moisture: totalMoisture / count,
    nutrients: totalNutrients / count,
    height: totalHeight / count,
  };
}
