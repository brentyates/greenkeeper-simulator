/**
 * Irrigation System - Piped irrigation infrastructure for automated watering
 *
 * SimCity-style piped irrigation system that replaces manual irrigation:
 * - Pipe network with water flow and pressure calculation
 * - Sprinkler heads with coverage patterns
 * - Water sources (municipal, wells, ponds)
 * - Leak detection and repair system
 * - Scheduled watering automation
 */

import { WeatherEffect } from './grass-simulation';

// ============================================================================
// Types
// ============================================================================

export type PipeType = 'pvc' | 'metal' | 'industrial';
export type SprinklerType = 'fixed' | 'rotary' | 'impact' | 'precision';
export type WaterSourceType = 'municipal' | 'well_shallow' | 'well_deep' | 'pond';
export type PressureLevel = 'good' | 'low' | 'none';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface PipeTile {
  readonly gridX: number;
  readonly gridY: number;
  readonly pipeType: PipeType;
  readonly installDate: number;
  readonly durability: number;
  readonly isLeaking: boolean;
  readonly pressureLevel: number;
  readonly connectedTo: readonly Direction[];
}

export interface SprinklerHead {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly sprinklerType: SprinklerType;
  readonly installDate: number;
  readonly isActive: boolean;
  readonly schedule: WateringSchedule;
  readonly coverageTiles: readonly { x: number; y: number; efficiency: number }[];
  readonly connectedToPipe: boolean;
}

export interface WateringSchedule {
  readonly enabled: boolean;
  readonly timeRanges: readonly { start: number; end: number }[];
  readonly skipRain: boolean;
  readonly zone: string;
}

export interface WaterSource {
  readonly id: string;
  readonly type: WaterSourceType;
  readonly gridX: number;
  readonly gridY: number;
  readonly capacityPerDay: number;
  readonly usedToday: number;
  readonly costPer1000Gal: number;
  readonly monthlyFixedCost: number;
}

export interface IrrigationSystem {
  readonly pipes: readonly PipeTile[];
  readonly sprinklerHeads: readonly SprinklerHead[];
  readonly waterSources: readonly WaterSource[];
  readonly totalWaterUsedToday: number;
  readonly lastTickTime: number;
  readonly pressureCache: Map<string, number>;
  readonly flowPaths: Map<string, readonly string[]>;
}

export interface CoverageTile {
  readonly x: number;
  readonly y: number;
  readonly efficiency: number;
}

// ============================================================================
// Constants
// ============================================================================

export const PIPE_CONFIGS: Record<PipeType, {
  cost: number;
  maxPressure: number;
  capacity: number;
  durability: number;
  leakRate: number;
  warrantyDays: number;
}> = {
  pvc: {
    cost: 50,
    maxPressure: 60,
    capacity: 10,
    durability: 100,
    leakRate: 0.02,
    warrantyDays: 30
  },
  metal: {
    cost: 120,
    maxPressure: 80,
    capacity: 25,
    durability: 100,
    leakRate: 0.005,
    warrantyDays: 90
  },
  industrial: {
    cost: 250,
    maxPressure: 100,
    capacity: 50,
    durability: 100,
    leakRate: 0.001,
    warrantyDays: 180
  }
};

export const SPRINKLER_CONFIGS: Record<SprinklerType, {
  cost: number;
  waterRate: number;
  coverageRadius: number;
  operatingCostPerHour: number;
}> = {
  fixed: {
    cost: 100,
    waterRate: 15,
    coverageRadius: 1,
    operatingCostPerHour: 0
  },
  rotary: {
    cost: 200,
    waterRate: 10,
    coverageRadius: 2,
    operatingCostPerHour: 0
  },
  impact: {
    cost: 350,
    waterRate: 12,
    coverageRadius: 3,
    operatingCostPerHour: 0
  },
  precision: {
    cost: 500,
    waterRate: 8,
    coverageRadius: 0,
    operatingCostPerHour: 2.0
  }
};

export const WATER_SOURCE_CONFIGS: Record<WaterSourceType, {
  capacityPerDay: number;
  cost: number;
  costPer1000Gal: number;
  monthlyFixedCost: number;
}> = {
  municipal: {
    capacityPerDay: Infinity,
    cost: 0,
    costPer1000Gal: 0.10,
    monthlyFixedCost: 0
  },
  well_shallow: {
    capacityPerDay: 5000,
    cost: 5000,
    costPer1000Gal: 0.02,
    monthlyFixedCost: 50
  },
  well_deep: {
    capacityPerDay: 15000,
    cost: 15000,
    costPer1000Gal: 0.01,
    monthlyFixedCost: 120
  },
  pond: {
    capacityPerDay: Infinity,
    cost: 0,
    costPer1000Gal: 0.05,
    monthlyFixedCost: 0
  }
};

export const DEFAULT_SCHEDULE: WateringSchedule = {
  enabled: true,
  timeRanges: [
    { start: 5 * 60, end: 7 * 60 },
    { start: 18 * 60, end: 20 * 60 }
  ],
  skipRain: false,
  zone: 'default'
};

// ============================================================================
// Factory Functions
// ============================================================================

let sprinklerIdCounter = 0;
let waterSourceIdCounter = 0;

export function createInitialIrrigationSystem(): IrrigationSystem {
  return {
    pipes: [],
    sprinklerHeads: [],
    waterSources: [],
    totalWaterUsedToday: 0,
    lastTickTime: 0,
    pressureCache: new Map(),
    flowPaths: new Map()
  };
}

export function createPipeTile(
  gridX: number,
  gridY: number,
  pipeType: PipeType,
  installDate: number,
  connectedTo: readonly Direction[] = []
): PipeTile {
  return {
    gridX,
    gridY,
    pipeType,
    installDate,
    durability: 100,
    isLeaking: false,
    pressureLevel: 0,
    connectedTo
  };
}

export function createSprinklerHead(
  gridX: number,
  gridY: number,
  sprinklerType: SprinklerType,
  installDate: number,
  connectedToPipe: boolean = false,
  schedule?: WateringSchedule
): SprinklerHead {
  const coverage = getSprinklerCoveragePattern(gridX, gridY, sprinklerType, 100);
  return {
    id: `sprinkler_${++sprinklerIdCounter}`,
    gridX,
    gridY,
    sprinklerType,
    installDate,
    isActive: false,
    schedule: schedule ?? DEFAULT_SCHEDULE,
    coverageTiles: coverage,
    connectedToPipe
  };
}

export function createWaterSource(
  type: WaterSourceType,
  gridX: number,
  gridY: number
): WaterSource {
  return {
    id: `source_${++waterSourceIdCounter}`,
    type,
    gridX,
    gridY,
    capacityPerDay: WATER_SOURCE_CONFIGS[type].capacityPerDay,
    usedToday: 0,
    costPer1000Gal: WATER_SOURCE_CONFIGS[type].costPer1000Gal,
    monthlyFixedCost: WATER_SOURCE_CONFIGS[type].monthlyFixedCost
  };
}

// ============================================================================
// Coverage Pattern Functions
// ============================================================================

export function getSprinklerCoveragePattern(
  centerX: number,
  centerY: number,
  sprinklerType: SprinklerType,
  pressure: number
): CoverageTile[] {
  const pressureMultiplier = pressure / 100;
  const tiles: CoverageTile[] = [];

  switch (sprinklerType) {
    case 'fixed': {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = centerX + dx;
          const y = centerY + dy;
          const distance = Math.abs(dx) + Math.abs(dy);
          const efficiency = distance === 0 ? 1.0 : distance === 1 ? 0.7 : 0.5;
          tiles.push({ x, y, efficiency: efficiency * pressureMultiplier });
        }
      }
      break;
    }
    case 'rotary': {
      const radius = 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const x = centerX + dx;
            const y = centerY + dy;
            let efficiency = 1.0;
            if (distance > 1.5) {
              efficiency = 0.8;
            }
            tiles.push({ x, y, efficiency: efficiency * pressureMultiplier });
          }
        }
      }
      break;
    }
    case 'impact': {
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const x = centerX + dx;
            const y = centerY + dy;
            let efficiency = 1.0;
            if (distance > 2.5) {
              efficiency = 0.6;
            }
            tiles.push({ x, y, efficiency: efficiency * pressureMultiplier });
          }
        }
      }
      break;
    }
    case 'precision': {
      const maxTiles = 25;
      for (let i = 0; i < maxTiles; i++) {
        tiles.push({ x: centerX, y: centerY, efficiency: 1.0 * pressureMultiplier });
      }
      break;
    }
  }

  return tiles;
}

// ============================================================================
// Connectivity Functions
// ============================================================================

export function getAdjacentPipes(
  system: IrrigationSystem,
  pipe: PipeTile
): PipeTile[] {
  const adjacent: PipeTile[] = [];
  const directions: Array<{ dx: number; dy: number }> = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 }
  ];

  for (const { dx, dy } of directions) {
    const x = pipe.gridX + dx;
    const y = pipe.gridY + dy;
    const adjacentPipe = system.pipes.find(p => p.gridX === x && p.gridY === y);
    if (adjacentPipe) {
      adjacent.push(adjacentPipe);
    }
  }

  return adjacent;
}

export function updatePipeConnections(
  system: IrrigationSystem,
  pipe: PipeTile
): PipeTile {
  const adjacent = getAdjacentPipes(system, pipe);
  const connectedTo: Direction[] = [];

  for (const adj of adjacent) {
    if (adj.gridY < pipe.gridY) connectedTo.push('north');
    else if (adj.gridY > pipe.gridY) connectedTo.push('south');
    else if (adj.gridX > pipe.gridX) connectedTo.push('east');
    else if (adj.gridX < pipe.gridX) connectedTo.push('west');
  }

  return { ...pipe, connectedTo };
}

export function findNearestWaterSource(
  pipe: PipeTile,
  system: IrrigationSystem
): WaterSource | null {
  if (system.waterSources.length === 0) return null;

  let nearest: WaterSource | null = null;
  let minDistance = Infinity;

  for (const source of system.waterSources) {
    const distance = Math.abs(pipe.gridX - source.gridX) + Math.abs(pipe.gridY - source.gridY);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = source;
    }
  }

  return nearest;
}

export function calculatePipeDistance(
  pipe: PipeTile,
  source: WaterSource,
  system: IrrigationSystem
): number {
  const cacheKey = `${pipe.gridX},${pipe.gridY}:${source.id}`;
  const cached = system.flowPaths.get(cacheKey);
  if (cached) {
    return cached.length;
  }

  const path = findPipePath(pipe, source, system);
  if (path) {
    return path.length;
  }

  return Infinity;
}

function findPipePath(
  pipe: PipeTile,
  source: WaterSource,
  system: IrrigationSystem
): string[] | null {
  const visited = new Set<string>();
  const queue: Array<{ pipe: PipeTile; path: string[] }> = [{ pipe, path: [] }];

  while (queue.length > 0) {
    const { pipe: current, path } = queue.shift()!;
    const key = `${current.gridX},${current.gridY}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (current.gridX === source.gridX && current.gridY === source.gridY) {
      return path;
    }

    const adjacent = getAdjacentPipes(system, current);
    for (const adj of adjacent) {
      if (!visited.has(`${adj.gridX},${adj.gridY}`)) {
        queue.push({
          pipe: adj,
          path: [...path, `${adj.gridX},${adj.gridY}`]
        });
      }
    }
  }

  return null;
}

// ============================================================================
// Pressure Calculation
// ============================================================================

export function calculatePressure(
  pipe: PipeTile,
  system: IrrigationSystem
): number {
  const source = findNearestWaterSource(pipe, system);
  if (!source) return 0;

  const distance = calculatePipeDistance(pipe, source, system);
  if (distance === Infinity) return 0;

  const config = PIPE_CONFIGS[pipe.pipeType];
  const maxDistance = config.maxPressure;
  const basePressure = Math.max(0, 100 - (distance / maxDistance) * 100);

  const headCount = countDownstreamHeads(pipe, system);
  const capacity = config.capacity;
  const capacityPenalty = Math.max(0, (headCount - capacity) * 2);

  let finalPressure = Math.max(0, basePressure - capacityPenalty);

  if (pipe.isLeaking) {
    finalPressure *= 0.5;
  }

  return Math.min(100, finalPressure);
}

function countDownstreamHeads(pipe: PipeTile, system: IrrigationSystem): number {
  const visited = new Set<string>();
  const queue: PipeTile[] = [pipe];
  let headCount = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.gridX},${current.gridY}`;

    if (visited.has(key)) continue;
    visited.add(key);

    const heads = system.sprinklerHeads.filter(
      h => h.gridX === current.gridX && h.gridY === current.gridY
    );
    headCount += heads.length;

    const adjacent = getAdjacentPipes(system, current);
    for (const adj of adjacent) {
      if (!visited.has(`${adj.gridX},${adj.gridY}`)) {
        queue.push(adj);
      }
    }
  }

  return headCount;
}

export function updatePipePressures(system: IrrigationSystem): IrrigationSystem {
  const updatedPipes = system.pipes.map(pipe => {
    const pressure = calculatePressure(pipe, system);

    return {
      ...pipe,
      pressureLevel: pressure,
      connectedTo: updatePipeConnections(system, pipe).connectedTo
    };
  });

  return {
    ...system,
    pipes: updatedPipes
  };
}

// ============================================================================
// Leak System
// ============================================================================

export function calculateLeakChance(
  pipe: PipeTile,
  currentTime: number,
  weather?: WeatherEffect
): number {
  const config = PIPE_CONFIGS[pipe.pipeType];
  const age = currentTime - pipe.installDate;
  const ageInDays = age / (60 * 24);

  let chance = 0;
  if (ageInDays > config.warrantyDays) {
    const daysOverWarranty = ageInDays - config.warrantyDays;
    chance = config.leakRate * daysOverWarranty;
  }

  if (weather?.type === 'stormy') chance *= 1.5;
  if (weather?.temperature !== undefined && weather.temperature < 32) chance *= 2.0;

  const durabilityFactor = (100 - pipe.durability) / 100;
  chance *= (1 + durabilityFactor);

  return Math.min(chance, 0.5);
}

export function checkForLeaks(
  system: IrrigationSystem,
  currentTime: number,
  weather?: WeatherEffect
): IrrigationSystem {
  const updatedPipes = system.pipes.map(pipe => {
    if (pipe.isLeaking) return pipe;

    const leakChance = calculateLeakChance(pipe, currentTime, weather);
    const shouldLeak = Math.random() < leakChance;

    if (shouldLeak) {
      return {
        ...pipe,
        isLeaking: true,
        durability: Math.max(0, pipe.durability - 10)
      };
    }

    return pipe;
  });

  return {
    ...system,
    pipes: updatedPipes
  };
}

export function repairLeak(
  system: IrrigationSystem,
  gridX: number,
  gridY: number
): IrrigationSystem | null {
  const pipeIndex = system.pipes.findIndex(p => p.gridX === gridX && p.gridY === gridY);
  if (pipeIndex === -1) return null;

  const pipe = system.pipes[pipeIndex];
  if (!pipe.isLeaking) return null;

  const updatedPipes = [...system.pipes];
  updatedPipes[pipeIndex] = {
    ...pipe,
    isLeaking: false,
    durability: Math.min(100, pipe.durability + 20)
  };

  return {
    ...system,
    pipes: updatedPipes
  };
}

// ============================================================================
// Water Consumption
// ============================================================================

export function calculateWaterUsage(
  sprinklerHeads: readonly SprinklerHead[],
  runtimeMinutes: number,
  system: IrrigationSystem
): number {
  let totalGallons = 0;

  for (const head of sprinklerHeads) {
    if (!head.isActive) continue;

    const pipe = system.pipes.find(
      p => p.gridX === head.gridX && p.gridY === head.gridY
    );
    const pressure = pipe ? calculatePressure(pipe, system) : 0;
    const efficiency = pressure / 100;

    const config = SPRINKLER_CONFIGS[head.sprinklerType];
    const gallonsPerMinute = config.waterRate;
    totalGallons += gallonsPerMinute * runtimeMinutes * efficiency;
  }

  return totalGallons;
}

export function calculateWaterCost(
  gallons: number,
  source: WaterSource
): number {
  const thousandsOfGallons = gallons / 1000;
  return thousandsOfGallons * source.costPer1000Gal;
}

// ============================================================================
// State Transformation Functions
// ============================================================================

export function addPipe(
  system: IrrigationSystem,
  gridX: number,
  gridY: number,
  pipeType: PipeType,
  installDate: number
): IrrigationSystem {
  const newPipe = createPipeTile(gridX, gridY, pipeType, installDate);
  const updatedSystem = {
    ...system,
    pipes: [...system.pipes, newPipe]
  };
  return updatePipePressures(updatedSystem);
}

export function removePipe(
  system: IrrigationSystem,
  gridX: number,
  gridY: number
): IrrigationSystem {
  const updatedPipes = system.pipes.filter(p => !(p.gridX === gridX && p.gridY === gridY));
  const updatedSystem = {
    ...system,
    pipes: updatedPipes
  };
  return updatePipePressures(updatedSystem);
}

export function addSprinklerHead(
  system: IrrigationSystem,
  gridX: number,
  gridY: number,
  sprinklerType: SprinklerType,
  installDate: number
): IrrigationSystem {
  const hasPipe = system.pipes.some(p => p.gridX === gridX && p.gridY === gridY);
  const newHead = createSprinklerHead(gridX, gridY, sprinklerType, installDate, hasPipe);
  return {
    ...system,
    sprinklerHeads: [...system.sprinklerHeads, newHead]
  };
}

export function removeSprinklerHead(
  system: IrrigationSystem,
  headId: string
): IrrigationSystem {
  return {
    ...system,
    sprinklerHeads: system.sprinklerHeads.filter(h => h.id !== headId)
  };
}

export function addWaterSource(
  system: IrrigationSystem,
  type: WaterSourceType,
  gridX: number,
  gridY: number
): IrrigationSystem {
  const newSource = createWaterSource(type, gridX, gridY);
  const updatedSystem = {
    ...system,
    waterSources: [...system.waterSources, newSource]
  };
  return updatePipePressures(updatedSystem);
}

export function updateSprinklerSchedule(
  system: IrrigationSystem,
  headId: string,
  schedule: WateringSchedule
): IrrigationSystem {
  return {
    ...system,
    sprinklerHeads: system.sprinklerHeads.map(h =>
      h.id === headId ? { ...h, schedule } : h
    )
  };
}

export function setSprinklerActive(
  system: IrrigationSystem,
  headId: string,
  isActive: boolean
): IrrigationSystem {
  return {
    ...system,
    sprinklerHeads: system.sprinklerHeads.map(h =>
      h.id === headId ? { ...h, isActive } : h
    )
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getPipeAt(
  system: IrrigationSystem,
  gridX: number,
  gridY: number
): PipeTile | null {
  return system.pipes.find(p => p.gridX === gridX && p.gridY === gridY) ?? null;
}

export function getSprinklerHeadAt(
  system: IrrigationSystem,
  gridX: number,
  gridY: number
): SprinklerHead | null {
  return system.sprinklerHeads.find(h => h.gridX === gridX && h.gridY === gridY) ?? null;
}

export function getWaterSourceAt(
  system: IrrigationSystem,
  gridX: number,
  gridY: number
): WaterSource | null {
  return system.waterSources.find(s => s.gridX === gridX && s.gridY === gridY) ?? null;
}

export function resetCounters(): void {
  sprinklerIdCounter = 0;
  waterSourceIdCounter = 0;
}

