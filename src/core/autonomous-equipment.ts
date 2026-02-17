import { EquipmentStats, getUnlockedAutonomousEquipment, ResearchState } from './research';
import {
  WorkCandidate,
  type WorkCandidateTerrainStats,
} from '../babylon/systems/TerrainSystemInterface';
import { TERRAIN_CODES } from './terrain';
import {
  isExtremeNeed,
  scoreNeedWithDistance,
} from './work-priority';
import {
  advanceTowardPoint,
  findPath,
  type PathPoint,
  type TraversalRule,
} from './navigation';

export type RobotType = 'mower' | 'sprayer' | 'spreader' | 'raker';
export type RobotState = 'idle' | 'working' | 'moving' | 'charging' | 'broken';

export interface Waypoint {
  readonly x: number;
  readonly z: number;
}

export interface RobotUnit {
  readonly id: string;
  readonly equipmentId: string;
  readonly type: RobotType;
  readonly stats: EquipmentStats;
  readonly worldX: number;
  readonly worldZ: number;
  readonly resourceCurrent: number;
  readonly resourceMax: number;
  readonly state: RobotState;
  readonly targetX: number | null;
  readonly targetY: number | null;
  readonly path: readonly Waypoint[] | null;
  readonly pathIndex: number;
  readonly breakdownTimeRemaining: number;
}

export interface AutonomousEquipmentState {
  readonly robots: readonly RobotUnit[];
  readonly chargingStationX: number;
  readonly chargingStationY: number;
}

export interface RobotTickResult {
  readonly state: AutonomousEquipmentState;
  readonly effects: readonly RobotEffect[];
  readonly operatingCost: number;
}

export interface RobotEffect {
  readonly type: RobotType;
  readonly equipmentId: string;
  readonly worldX: number;
  readonly worldZ: number;
  readonly efficiency: number;
}

export type RobotTraversalRule = TraversalRule<RobotUnit>;

interface RankedRobotTarget {
  readonly x: number;
  readonly z: number;
  readonly urgency: number;
  readonly distance: number;
  readonly score: number;
}

export function createInitialAutonomousState(
  chargingStationX: number = 0,
  chargingStationY: number = 0
): AutonomousEquipmentState {
  return {
    robots: [],
    chargingStationX,
    chargingStationY,
  };
}

export function getRobotTypeFromEquipmentId(equipmentId: string): RobotType {
  if (equipmentId.includes('mower')) return 'mower';
  if (equipmentId.includes('sprayer') || equipmentId.includes('sprinkler')) return 'sprayer';
  if (equipmentId.includes('fertilizer') || equipmentId.includes('spreader')) return 'spreader';
  if (equipmentId.includes('rake') || equipmentId.includes('bunker')) return 'raker';
  return 'mower';
}

export function purchaseRobot(
  state: AutonomousEquipmentState,
  equipmentId: string,
  stats: EquipmentStats
): { state: AutonomousEquipmentState; cost: number } | null {
  if (!stats.isAutonomous) return null;
  if (!stats.purchaseCost) return null;

  const robotType = getRobotTypeFromEquipmentId(equipmentId);
  const existingCount = state.robots.filter(r => r.equipmentId === equipmentId).length;

  const newRobot: RobotUnit = {
    id: `${equipmentId}_${existingCount + 1}`,
    equipmentId,
    type: robotType,
    stats,
    worldX: state.chargingStationX,
    worldZ: state.chargingStationY,
    resourceCurrent: stats.fuelCapacity,
    resourceMax: stats.fuelCapacity,
    state: 'idle',
    targetX: null,
    targetY: null,
    path: null,
    pathIndex: 0,
    breakdownTimeRemaining: 0,
  };

  return {
    state: {
      ...state,
      robots: [...state.robots, newRobot],
    },
    cost: stats.purchaseCost,
  };
}

export function sellRobot(
  state: AutonomousEquipmentState,
  robotId: string
): { state: AutonomousEquipmentState; refund: number } | null {
  const robot = state.robots.find(r => r.id === robotId);
  if (!robot) return null;

  const refund = Math.floor((robot.stats.purchaseCost ?? 0) * 0.5);

  return {
    state: {
      ...state,
      robots: state.robots.filter(r => r.id !== robotId),
    },
    refund,
  };
}

export function countRobotsByType(state: AutonomousEquipmentState, type: RobotType): number {
  return state.robots.filter(r => r.type === type).length;
}

export function countWorkingRobots(state: AutonomousEquipmentState): number {
  return state.robots.filter(r => r.state === 'working' || r.state === 'moving').length;
}

export function countBrokenRobots(state: AutonomousEquipmentState): number {
  return state.robots.filter(r => r.state === 'broken').length;
}

function targetKey(worldX: number, worldZ: number): string {
  return `${Math.floor(worldX)},${Math.floor(worldZ)}`;
}

const MAX_PATH_CHECK_CANDIDATES = 12;
const PARKING_RING_RADII: readonly number[] = [0, 1.25, 2.5, 3.75];
const PARKING_RING_SLOTS = 10;
const BREAKDOWN_RATE_BALANCE_MULTIPLIER = 0.2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBreakdownChanceForElapsedHours(
  hourlyRate: number,
  hoursElapsed: number
): number {
  if (hourlyRate <= 0 || hoursElapsed <= 0) return 0;
  // Poisson process: convert per-hour hazard into per-tick probability.
  return 1 - Math.exp(-hourlyRate * hoursElapsed);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getIdleParkingTarget(
  robot: RobotUnit,
  chargingX: number,
  chargingZ: number,
  canTraverse?: RobotTraversalRule
): { x: number; z: number } {
  if (!canTraverse) {
    return { x: chargingX, z: chargingZ };
  }

  const candidates: Array<{ x: number; z: number }> = [];
  for (const radius of PARKING_RING_RADII) {
    if (radius <= 1e-6) {
      candidates.push({ x: chargingX, z: chargingZ });
      continue;
    }
    for (let i = 0; i < PARKING_RING_SLOTS; i++) {
      const angle = (Math.PI * 2 * i) / PARKING_RING_SLOTS;
      candidates.push({
        x: chargingX + Math.cos(angle) * radius,
        z: chargingZ + Math.sin(angle) * radius,
      });
    }
  }

  const preferredSlot = hashString(robot.id) % candidates.length;
  let bestCandidate: { x: number; z: number; score: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!canTraverse(robot, candidate.x, candidate.z)) continue;

    const dist =
      Math.abs(candidate.x - robot.worldX) + Math.abs(candidate.z - robot.worldZ);
    const cyclicOffset = Math.abs(i - preferredSlot);
    const slotDistance = Math.min(cyclicOffset, candidates.length - cyclicOffset);
    const score = dist + slotDistance * 0.2;

    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { x: candidate.x, z: candidate.z, score };
    }
  }

  if (bestCandidate) {
    return { x: bestCandidate.x, z: bestCandidate.z };
  }

  return { x: chargingX, z: chargingZ };
}

function getActionUrgency(type: RobotType, candidate: WorkCandidate): number {
  switch (type) {
    case 'mower': {
      const maxGrassHeight = candidate.maxGrassHeight ?? candidate.avgGrassHeight;
      const avgGrassUrgency = clamp(candidate.avgGrassHeight - 1, 0, 100);
      const hotspotGrassUrgency = clamp(maxGrassHeight - 1, 0, 100);
      const grassUrgency = avgGrassUrgency * 0.7 + hotspotGrassUrgency * 0.3;
      if (grassUrgency <= 0) {
        // Once turf is already cut, mowers should stop and park instead of chasing health alone.
        return 0;
      }
      const healthUrgency = clamp(100 - candidate.avgHealth, 0, 100);
      // Use health only as a mild tie-breaker while there is actual overgrowth to mow.
      return grassUrgency * 0.9 + Math.min(healthUrgency, grassUrgency) * 0.1;
    }
    case 'sprayer': {
      const minMoisture = candidate.minMoisture ?? candidate.avgMoisture;
      const avgDeficit = clamp(50 - candidate.avgMoisture, 0, 50);
      const hotspotDeficit = clamp(50 - minMoisture, 0, 50);
      // Keep reacting to localized dry pockets even if a larger bucket average looks acceptable.
      return avgDeficit * 1.4 + hotspotDeficit * 0.6;
    }
    case 'spreader': {
      const minNutrients = candidate.minNutrients ?? candidate.avgNutrients;
      const avgDeficit = clamp(50 - candidate.avgNutrients, 0, 50);
      const hotspotDeficit = clamp(50 - minNutrients, 0, 50);
      return avgDeficit * 1.4 + hotspotDeficit * 0.6;
    }
    case 'raker':
      if (candidate.dominantTerrainCode !== TERRAIN_CODES.BUNKER) return 0;
      return clamp(100 - candidate.avgHealth, 0, 100);
  }
}

interface CandidateFocus {
  readonly targetX: number;
  readonly targetZ: number;
  readonly urgencyCandidate: WorkCandidate;
}

function isWaterOnlyCandidate(candidate: WorkCandidate): boolean {
  const terrainCodesPresent = candidate.terrainCodesPresent;
  if (!terrainCodesPresent || terrainCodesPresent.length === 0) {
    return candidate.dominantTerrainCode === TERRAIN_CODES.WATER;
  }
  return terrainCodesPresent.every(code => code === TERRAIN_CODES.WATER);
}

function buildTerrainScopedCandidate(
  candidate: WorkCandidate,
  terrainCode: number,
  stats: WorkCandidateTerrainStats
): WorkCandidate {
  return {
    ...candidate,
    worldX: stats.worldX,
    worldZ: stats.worldZ,
    avgMoisture: stats.avgMoisture,
    avgNutrients: stats.avgNutrients,
    avgGrassHeight: stats.avgGrassHeight,
    maxGrassHeight: stats.maxGrassHeight,
    avgHealth: stats.avgHealth,
    dominantTerrainCode: terrainCode,
    terrainCodesPresent: [terrainCode],
    faceCount: stats.faceCount,
    minMoisture: stats.minMoisture,
    minNutrients: stats.minNutrients,
  };
}

function projectCandidateForRobot(
  candidate: WorkCandidate,
  type: RobotType,
  allowedTerrainCodes: readonly number[] | null
): CandidateFocus | null {
  if (!allowedTerrainCodes || allowedTerrainCodes.length === 0) {
    return {
      targetX: candidate.worldX,
      targetZ: candidate.worldZ,
      urgencyCandidate: candidate,
    };
  }

  const allowedTerrainSet = new Set(allowedTerrainCodes);
  const terrainStatsByCode = candidate.terrainStatsByCode;

  if (!terrainStatsByCode) {
    const terrainCodesPresent = candidate.terrainCodesPresent;
    const canAffectAnyAllowedTerrain = terrainCodesPresent
      ? terrainCodesPresent.some(code => allowedTerrainSet.has(code))
      : allowedTerrainSet.has(candidate.dominantTerrainCode);
    if (!canAffectAnyAllowedTerrain) return null;

    return {
      targetX: candidate.worldX,
      targetZ: candidate.worldZ,
      urgencyCandidate: candidate,
    };
  }

  const allowedTerrainStats: Array<{
    terrainCode: number;
    stats: WorkCandidateTerrainStats;
  }> = [];
  for (const terrainCode of allowedTerrainCodes) {
    const terrainStats = terrainStatsByCode[terrainCode];
    if (!terrainStats) continue;
    allowedTerrainStats.push({ terrainCode, stats: terrainStats });
  }
  if (allowedTerrainStats.length === 0) return null;

  let totalFaces = 0;
  let sumX = 0;
  let sumZ = 0;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let totalGrassHeight = 0;
  let totalHealth = 0;
  let maxGrassHeight = 0;
  let minMoisture = Number.POSITIVE_INFINITY;
  let minNutrients = Number.POSITIVE_INFINITY;
  let dominantTerrainCode = allowedTerrainStats[0].terrainCode;
  let dominantFaceCount = 0;
  let bestTarget = allowedTerrainStats[0];
  let bestTargetUrgency = Number.NEGATIVE_INFINITY;

  for (const entry of allowedTerrainStats) {
    const { terrainCode, stats } = entry;
    const terrainFaceCount = Math.max(1, stats.faceCount);

    totalFaces += terrainFaceCount;
    sumX += stats.worldX * terrainFaceCount;
    sumZ += stats.worldZ * terrainFaceCount;
    totalMoisture += stats.avgMoisture * terrainFaceCount;
    totalNutrients += stats.avgNutrients * terrainFaceCount;
    totalGrassHeight += stats.avgGrassHeight * terrainFaceCount;
    totalHealth += stats.avgHealth * terrainFaceCount;
    maxGrassHeight = Math.max(maxGrassHeight, stats.maxGrassHeight);
    minMoisture = Math.min(minMoisture, stats.minMoisture);
    minNutrients = Math.min(minNutrients, stats.minNutrients);

    if (terrainFaceCount > dominantFaceCount) {
      dominantFaceCount = terrainFaceCount;
      dominantTerrainCode = terrainCode;
    }

    const terrainScopedCandidate = buildTerrainScopedCandidate(
      candidate,
      terrainCode,
      stats
    );
    const terrainUrgency = getActionUrgency(type, terrainScopedCandidate);
    if (
      terrainUrgency > bestTargetUrgency ||
      (terrainUrgency === bestTargetUrgency &&
        terrainFaceCount > bestTarget.stats.faceCount)
    ) {
      bestTarget = entry;
      bestTargetUrgency = terrainUrgency;
    }
  }

  if (totalFaces <= 0) return null;

  const urgencyCandidate: WorkCandidate = {
    ...candidate,
    worldX: sumX / totalFaces,
    worldZ: sumZ / totalFaces,
    avgMoisture: totalMoisture / totalFaces,
    avgNutrients: totalNutrients / totalFaces,
    avgGrassHeight: totalGrassHeight / totalFaces,
    maxGrassHeight,
    avgHealth: totalHealth / totalFaces,
    dominantTerrainCode,
    terrainCodesPresent: allowedTerrainStats.map(entry => entry.terrainCode),
    faceCount: totalFaces,
    minMoisture,
    minNutrients,
  };

  return {
    targetX: bestTarget.stats.worldX,
    targetZ: bestTarget.stats.worldZ,
    urgencyCandidate,
  };
}

export function getAllowedTerrainCodesForRobotEquipment(
  equipmentId: string,
  type: RobotType
): readonly number[] | null {
  if (type === 'mower') {
    if (equipmentId.includes('mower_fairway')) {
      return [TERRAIN_CODES.FAIRWAY, TERRAIN_CODES.TEE];
    }
    if (equipmentId.includes('mower_greens')) {
      return [TERRAIN_CODES.GREEN];
    }
    if (equipmentId.includes('mower_rough')) {
      return [TERRAIN_CODES.ROUGH];
    }
    return [
      TERRAIN_CODES.FAIRWAY,
      TERRAIN_CODES.ROUGH,
      TERRAIN_CODES.GREEN,
      TERRAIN_CODES.TEE,
    ];
  }
  if (type === 'raker') {
    return [TERRAIN_CODES.BUNKER];
  }
  return null;
}

function insertRankedTarget(
  rankedTargets: RankedRobotTarget[],
  candidate: RankedRobotTarget,
  comparator: (a: RankedRobotTarget, b: RankedRobotTarget) => number
): void {
  let insertAt = rankedTargets.findIndex(existing => comparator(candidate, existing) < 0);
  if (insertAt === -1) {
    insertAt = rankedTargets.length;
  }
  rankedTargets.splice(insertAt, 0, candidate);
  if (rankedTargets.length > MAX_PATH_CHECK_CANDIDATES) {
    rankedTargets.length = MAX_PATH_CHECK_CANDIDATES;
  }
}

function findNeedsWork(
  candidates: WorkCandidate[],
  robot: RobotUnit,
  currentX: number,
  currentZ: number,
  claimedTargets: Set<string>,
): { x: number; z: number } | null {
  const pool = rankWorkCandidates(candidates, robot, currentX, currentZ, claimedTargets);
  return pool.length > 0 ? { x: pool[0].x, z: pool[0].z } : null;
}

const LONG_RANGE_DISTANCE = 30;
const LONG_RANGE_GRID_STEP = 2;

function findReachableWork(
  candidates: WorkCandidate[],
  robot: RobotUnit,
  currentX: number,
  currentZ: number,
  claimedTargets: Set<string>,
  canTraverse: RobotTraversalRule
): { x: number; z: number; path: readonly PathPoint[] } | null {
  const pool = rankWorkCandidates(candidates, robot, currentX, currentZ, claimedTargets);
  const limit = pool.length;
  for (let i = 0; i < limit; i++) {
    const target = pool[i];
    const gridStep = target.distance > LONG_RANGE_DISTANCE ? LONG_RANGE_GRID_STEP : undefined;
    const path = findPath(robot, currentX, currentZ, target.x, target.z, canTraverse, gridStep);
    if (path) return { x: target.x, z: target.z, path };
  }
  return null;
}

function rankWorkCandidates(
  candidates: WorkCandidate[],
  robot: RobotUnit,
  currentX: number,
  currentZ: number,
  claimedTargets: Set<string>,
): RankedRobotTarget[] {
  const type = robot.type;
  const allowedTerrainCodes = getAllowedTerrainCodesForRobotEquipment(robot.equipmentId, type);
  const rankedTargets: RankedRobotTarget[] = [];
  const rankedExtremeTargets: RankedRobotTarget[] = [];

  for (const c of candidates) {
    if (isWaterOnlyCandidate(c)) continue;

    const focusedCandidate = projectCandidateForRobot(c, type, allowedTerrainCodes);
    if (!focusedCandidate) continue;
    if (claimedTargets.has(targetKey(focusedCandidate.targetX, focusedCandidate.targetZ))) continue;

    const distance =
      Math.abs(focusedCandidate.targetX - currentX) +
      Math.abs(focusedCandidate.targetZ - currentZ);
    const urgency = getActionUrgency(type, focusedCandidate.urgencyCandidate);
    if (urgency < 1) continue;
    const scoredCandidate: RankedRobotTarget = {
      x: focusedCandidate.targetX,
      z: focusedCandidate.targetZ,
      urgency,
      distance,
      score: scoreNeedWithDistance(urgency, distance),
    };

    if (isExtremeNeed(urgency)) {
      insertRankedTarget(
        rankedExtremeTargets,
        scoredCandidate,
        (a, b) => (b.urgency - a.urgency) || (a.distance - b.distance)
      );
      continue;
    }
    insertRankedTarget(
      rankedTargets,
      scoredCandidate,
      (a, b) => (b.score - a.score) || (b.urgency - a.urgency) || (a.distance - b.distance)
    );
  }

  return rankedExtremeTargets.length > 0 ? rankedExtremeTargets : rankedTargets;
}

function hasWorkAtPosition(
  candidates: WorkCandidate[],
  robot: RobotUnit,
  worldX: number,
  worldZ: number,
): boolean {
  const type = robot.type;
  const allowedTerrainCodes = getAllowedTerrainCodesForRobotEquipment(robot.equipmentId, type);
  const key = targetKey(worldX, worldZ);
  for (const c of candidates) {
    if (isWaterOnlyCandidate(c)) continue;
    const focused = projectCandidateForRobot(c, type, allowedTerrainCodes);
    if (!focused) continue;
    if (targetKey(focused.targetX, focused.targetZ) !== key) continue;
    const urgency = getActionUrgency(type, focused.urgencyCandidate);
    if (urgency >= 1) return true;
  }
  return false;
}

function moveToward(
  robot: RobotUnit,
  targetX: number,
  targetZ: number,
  speed: number,
  deltaMinutes: number,
  canTraverse?: RobotTraversalRule
): { worldX: number; worldZ: number; arrived: boolean; blocked: boolean } {
  return advanceTowardPoint(
    robot,
    robot.worldX,
    robot.worldZ,
    targetX,
    targetZ,
    speed * deltaMinutes,
    canTraverse
  );
}

function followPath(
  robot: RobotUnit,
  speed: number,
  deltaMinutes: number,
  canTraverse?: RobotTraversalRule
): { worldX: number; worldZ: number; arrived: boolean; blocked: boolean; newPathIndex: number } {
  const path = robot.path!;
  let idx = robot.pathIndex;
  let cx = robot.worldX;
  let cz = robot.worldZ;
  let remaining = speed * deltaMinutes;

  while (remaining > 1e-6 && idx < path.length) {
    const wp = path[idx];
    const dx = wp.x - cx;
    const dz = wp.z - cz;
    const dist = Math.hypot(dx, dz);

    if (dist <= 1e-6) {
      idx++;
      continue;
    }

    const stepDistance = Math.min(dist, remaining);
    const t = stepDistance / dist;
    const nextX = cx + dx * t;
    const nextZ = cz + dz * t;
    if (canTraverse && !canTraverse(robot, nextX, nextZ)) {
      return {
        worldX: cx,
        worldZ: cz,
        arrived: false,
        blocked: true,
        newPathIndex: idx,
      };
    }
    cx = nextX;
    cz = nextZ;
    remaining -= stepDistance;
    if (stepDistance + 1e-6 >= dist) {
      idx++;
    }
  }

  const arrived = idx >= path.length;
  return { worldX: cx, worldZ: cz, arrived, blocked: false, newPathIndex: idx };
}

function findAlternateTargetAfterBlock(
  robot: RobotUnit,
  candidates: WorkCandidate[],
  worldX: number,
  worldZ: number,
  claimedTargets: Set<string>,
  blockedKey: string,
  canTraverse?: RobotTraversalRule
): { x: number; z: number; path?: readonly PathPoint[] } | null {
  const blockedClaims = new Set(claimedTargets);
  blockedClaims.add(blockedKey);
  blockedClaims.add(targetKey(worldX, worldZ));
  if (canTraverse) {
    const alternate = findReachableWork(
      candidates,
      robot,
      worldX,
      worldZ,
      blockedClaims,
      canTraverse
    );
    if (alternate) return alternate;
  } else {
    const alternate = findNeedsWork(
      candidates,
      robot,
      worldX,
      worldZ,
      blockedClaims
    );
    if (alternate) return alternate;
  }
  return null;
}

function tickRobot(
  robot: RobotUnit,
  candidates: WorkCandidate[],
  chargingX: number,
  chargingZ: number,
  deltaMinutes: number,
  fleetAIActive: boolean,
  claimedTargets: Set<string>,
  canTraverse?: RobotTraversalRule
): { robot: RobotUnit; effect: RobotEffect | null; operatingCost: number } {
  let operatingCost = 0;

  if (robot.state === 'broken') {
    const remaining = robot.breakdownTimeRemaining - deltaMinutes;

    if (remaining <= 0) {
      return {
        robot: {
          ...robot,
          state: 'idle',
          breakdownTimeRemaining: 0,
        },
        effect: null,
        operatingCost: 0,
      };
    }

    return {
      robot: {
        ...robot,
        breakdownTimeRemaining: remaining,
      },
      effect: null,
      operatingCost: 0,
    };
  }

  const hoursElapsed = deltaMinutes / 60;
  operatingCost = (robot.stats.operatingCostPerHour ?? 0) * hoursElapsed;

  const baseBreakdownRate = robot.stats.breakdownRate ?? 0;
  const fleetAIMultiplier = fleetAIActive ? 0.6 : 1;
  const effectiveBreakdownRate =
    baseBreakdownRate *
    fleetAIMultiplier *
    BREAKDOWN_RATE_BALANCE_MULTIPLIER;
  const breakdownChance = getBreakdownChanceForElapsedHours(
    effectiveBreakdownRate,
    hoursElapsed
  );

  if (breakdownChance > 0 && Math.random() < breakdownChance) {
    return {
      robot: {
        ...robot,
        state: 'broken',
        breakdownTimeRemaining: robot.stats.repairTime ?? 60,
        targetX: null,
        targetY: null,
        path: null,
        pathIndex: 0,
      },
      effect: null,
      operatingCost,
    };
  }

  const resourceConsumption = (robot.stats.fuelEfficiency ?? 1) * deltaMinutes * 0.5;
  const newResource = Math.max(0, robot.resourceCurrent - resourceConsumption);

  if (newResource < robot.resourceMax * 0.1) {
    let chargePath = robot.path;
    let chargePathIndex = robot.pathIndex;
    const isChargingTarget = robot.targetX === chargingX && robot.targetY === chargingZ;

    if (!chargePath && canTraverse) {
      const found = findPath(robot, robot.worldX, robot.worldZ, chargingX, chargingZ, canTraverse);
      if (found) {
        chargePath = found;
        chargePathIndex = 0;
      }
    }

    if (chargePath && chargePathIndex < chargePath.length) {
      const tempRobot = isChargingTarget ? robot : {
        ...robot,
        path: chargePath,
        pathIndex: chargePathIndex,
        targetX: chargingX,
        targetY: chargingZ,
      };
      const result = followPath(
        tempRobot,
        robot.stats.speed,
        deltaMinutes,
        canTraverse
      );

      if (result.arrived) {
        return {
          robot: {
            ...robot,
            worldX: result.worldX,
            worldZ: result.worldZ,
            state: 'charging',
            resourceCurrent: Math.min(robot.resourceMax, newResource + deltaMinutes * 5),
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
          },
          effect: null,
          operatingCost,
        };
      }

      if (result.blocked) {
        chargePath = null;
        chargePathIndex = 0;
      } else {
        return {
          robot: {
            ...robot,
            worldX: result.worldX,
            worldZ: result.worldZ,
            state: 'moving',
            resourceCurrent: newResource,
            targetX: chargingX,
            targetY: chargingZ,
            path: chargePath,
            pathIndex: result.newPathIndex,
          },
          effect: null,
          operatingCost,
        };
      }
    }

    const { worldX, worldZ, arrived, blocked } = moveToward(
      robot,
      chargingX,
      chargingZ,
      robot.stats.speed,
      deltaMinutes,
      canTraverse
    );

    if (arrived) {
      return {
        robot: {
          ...robot,
          worldX,
          worldZ,
          state: 'charging',
          resourceCurrent: Math.min(robot.resourceMax, newResource + deltaMinutes * 5),
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: null,
        operatingCost,
      };
    }
    if (blocked) {
      return {
        robot: {
          ...robot,
          worldX,
          worldZ,
          state: 'idle',
          resourceCurrent: newResource,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: null,
        operatingCost,
      };
    }

    return {
      robot: {
        ...robot,
        worldX,
        worldZ,
        state: 'moving',
        resourceCurrent: newResource,
        targetX: chargingX,
        targetY: chargingZ,
      },
      effect: null,
      operatingCost,
    };
  }

  if (robot.state === 'charging') {
    const chargeAmount = deltaMinutes * 5;
    const charged = Math.min(robot.resourceMax, robot.resourceCurrent + chargeAmount);

    if (charged >= robot.resourceMax * 0.9) {
      return {
        robot: {
          ...robot,
          state: 'idle',
          resourceCurrent: charged,
        },
        effect: null,
        operatingCost: 0,
      };
    }

    return {
      robot: {
        ...robot,
        resourceCurrent: charged,
      },
      effect: null,
      operatingCost: 0,
    };
  }

  if (robot.targetX !== null && robot.targetY !== null) {
    const distanceToTarget = Math.hypot(
      robot.targetX - robot.worldX,
      robot.targetY - robot.worldZ
    );
    if (distanceToTarget <= 0.05) {
      const currentCellNeedsWork = hasWorkAtPosition(
        candidates,
        robot,
        robot.worldX,
        robot.worldZ
      );
      const settledEffect: RobotEffect | null = currentCellNeedsWork
        ? {
            type: robot.type,
            equipmentId: robot.equipmentId,
            worldX: robot.worldX,
            worldZ: robot.worldZ,
            efficiency: robot.stats.efficiency,
          }
        : null;
      return {
        robot: {
          ...robot,
          state: currentCellNeedsWork ? 'working' : 'idle',
          resourceCurrent: newResource,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: settledEffect,
        operatingCost,
      };
    }
  }

  if (robot.targetX === null || robot.targetY === null) {
    let target: { x: number; z: number; path?: readonly PathPoint[] } | null = null;

    const currentKey = targetKey(robot.worldX, robot.worldZ);
    const selectionClaims = new Set(claimedTargets);
    selectionClaims.add(currentKey);

    if (canTraverse) {
      const reachable = findReachableWork(
        candidates,
        robot,
        robot.worldX,
        robot.worldZ,
        selectionClaims,
        canTraverse
      );
      if (reachable) target = { x: reachable.x, z: reachable.z, path: reachable.path };
    } else {
      target = findNeedsWork(
        candidates,
        robot,
        robot.worldX,
        robot.worldZ,
        selectionClaims
      );
    }

    const currentCellNeedsWork = hasWorkAtPosition(candidates, robot, robot.worldX, robot.worldZ);
    const localEffect: RobotEffect | null = currentCellNeedsWork ? {
      type: robot.type,
      equipmentId: robot.equipmentId,
      worldX: robot.worldX,
      worldZ: robot.worldZ,
      efficiency: robot.stats.efficiency,
    } : null;

    if (!target) {
      if (localEffect) {
        return {
          robot: {
            ...robot,
            state: 'working',
            resourceCurrent: newResource,
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
          },
          effect: localEffect,
          operatingCost,
        };
      }

      const parkingTarget = getIdleParkingTarget(
        robot,
        chargingX,
        chargingZ,
        canTraverse
      );
      const {
        worldX: parkX,
        worldZ: parkZ,
        arrived: parked,
        blocked: parkingBlocked,
      } = moveToward(
        robot,
        parkingTarget.x,
        parkingTarget.z,
        robot.stats.speed,
        deltaMinutes,
        canTraverse
      );

      if (parkingBlocked) {
        return {
          robot: {
            ...robot,
            state: 'idle',
            resourceCurrent: newResource,
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
          },
          effect: null,
          operatingCost,
        };
      }

      return {
        robot: {
          ...robot,
          worldX: parkX,
          worldZ: parkZ,
          state: parked ? 'idle' : 'moving',
          resourceCurrent: newResource,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: null,
        operatingCost,
      };
    }

    claimedTargets.add(targetKey(target.x, target.z));

    return {
      robot: {
        ...robot,
        state: 'moving',
        resourceCurrent: newResource,
        targetX: target.x,
        targetY: target.z,
        path: target.path ?? null,
        pathIndex: 0,
      },
      effect: localEffect,
      operatingCost,
    };
  }

  if (robot.path && robot.pathIndex < robot.path.length) {
    const result = followPath(robot, robot.stats.speed, deltaMinutes, canTraverse);

    const movedThisStep =
      Math.abs(result.worldX - robot.worldX) > 1e-6 ||
      Math.abs(result.worldZ - robot.worldZ) > 1e-6;
    const movementEffect: RobotEffect = {
      type: robot.type,
      equipmentId: robot.equipmentId,
      worldX: result.worldX,
      worldZ: result.worldZ,
      efficiency: robot.stats.efficiency,
    };

    if (result.blocked) {
      const blockedTargetX = robot.targetX ?? result.worldX;
      const blockedTargetY = robot.targetY ?? result.worldZ;
      const blockedKey = targetKey(blockedTargetX, blockedTargetY);
      claimedTargets.delete(blockedKey);
      const alternateTarget = findAlternateTargetAfterBlock(
        robot,
        candidates,
        result.worldX,
        result.worldZ,
        claimedTargets,
        blockedKey,
        canTraverse
      );
      if (alternateTarget) {
        claimedTargets.add(targetKey(alternateTarget.x, alternateTarget.z));
        return {
          robot: {
            ...robot,
            worldX: result.worldX,
            worldZ: result.worldZ,
            state: 'moving',
            resourceCurrent: newResource,
            targetX: alternateTarget.x,
            targetY: alternateTarget.z,
            path: alternateTarget.path ?? null,
            pathIndex: 0,
          },
          effect: movedThisStep ? movementEffect : null,
          operatingCost,
        };
      }
      return {
        robot: {
          ...robot,
          worldX: result.worldX,
          worldZ: result.worldZ,
          state: 'idle',
          resourceCurrent: newResource,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: movedThisStep ? movementEffect : null,
        operatingCost,
      };
    }

    if (result.arrived) {
      return {
        robot: {
          ...robot,
          worldX: result.worldX,
          worldZ: result.worldZ,
          state: 'working',
          resourceCurrent: newResource,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
        },
        effect: movementEffect,
        operatingCost,
      };
    }

    return {
      robot: {
        ...robot,
        worldX: result.worldX,
        worldZ: result.worldZ,
        state: 'moving',
        resourceCurrent: newResource,
        pathIndex: result.newPathIndex,
      },
      effect: movementEffect,
      operatingCost,
    };
  }

  if (canTraverse) {
    const repath = findPath(robot, robot.worldX, robot.worldZ, robot.targetX, robot.targetY, canTraverse);
    if (repath) {
      const repathedRobot: RobotUnit = { ...robot, path: repath, pathIndex: 0 };
      const result = followPath(
        repathedRobot,
        robot.stats.speed,
        deltaMinutes,
        canTraverse
      );
      const movementEffect: RobotEffect = {
        type: robot.type,
        equipmentId: robot.equipmentId,
        worldX: result.worldX,
        worldZ: result.worldZ,
        efficiency: robot.stats.efficiency,
      };
      if (result.blocked) {
        const blockedTargetX = robot.targetX ?? result.worldX;
        const blockedTargetY = robot.targetY ?? result.worldZ;
        const blockedKey = targetKey(blockedTargetX, blockedTargetY);
        claimedTargets.delete(blockedKey);
        const alternateTarget = findAlternateTargetAfterBlock(
          robot,
          candidates,
          result.worldX,
          result.worldZ,
          claimedTargets,
          blockedKey,
          canTraverse
        );
        if (alternateTarget) {
          claimedTargets.add(targetKey(alternateTarget.x, alternateTarget.z));
          return {
            robot: {
              ...robot,
              worldX: result.worldX,
              worldZ: result.worldZ,
              state: 'moving',
              resourceCurrent: newResource,
              targetX: alternateTarget.x,
              targetY: alternateTarget.z,
              path: alternateTarget.path ?? null,
              pathIndex: 0,
            },
            effect: null,
            operatingCost,
          };
        }
        return {
          robot: {
            ...robot,
            worldX: result.worldX,
            worldZ: result.worldZ,
            state: 'idle',
            resourceCurrent: newResource,
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
          },
          effect: null,
          operatingCost,
        };
      }
      if (result.arrived) {
        return {
          robot: {
            ...robot,
            worldX: result.worldX,
            worldZ: result.worldZ,
            state: 'working',
            resourceCurrent: newResource,
            targetX: null,
            targetY: null,
            path: null,
            pathIndex: 0,
          },
          effect: movementEffect,
          operatingCost,
        };
      }
      return {
        robot: {
          ...robot,
          worldX: result.worldX,
          worldZ: result.worldZ,
          state: 'moving',
          resourceCurrent: newResource,
          path: repath,
          pathIndex: result.newPathIndex,
        },
        effect: movementEffect,
        operatingCost,
      };
    }
    return {
      robot: {
        ...robot,
        state: 'idle',
        resourceCurrent: newResource,
        targetX: null,
        targetY: null,
        path: null,
        pathIndex: 0,
      },
      effect: null,
      operatingCost,
    };
  }

  const { worldX, worldZ, arrived } = moveToward(
    robot,
    robot.targetX,
    robot.targetY,
    robot.stats.speed,
    deltaMinutes
  );
  const movementEffect: RobotEffect = {
    type: robot.type,
    equipmentId: robot.equipmentId,
    worldX,
    worldZ,
    efficiency: robot.stats.efficiency,
  };

  if (arrived) {
    return {
      robot: {
        ...robot,
        worldX,
        worldZ,
        state: 'working',
        resourceCurrent: newResource,
        targetX: null,
        targetY: null,
        path: null,
        pathIndex: 0,
      },
      effect: movementEffect,
      operatingCost,
    };
  }

  return {
    robot: {
      ...robot,
      worldX,
      worldZ,
      state: 'moving',
      resourceCurrent: newResource,
    },
    effect: movementEffect,
    operatingCost,
  };
}

export function tickAutonomousEquipment(
  state: AutonomousEquipmentState,
  candidates: WorkCandidate[],
  deltaMinutes: number,
  fleetAIActive: boolean = false,
  canTraverse?: RobotTraversalRule
): RobotTickResult {
  const effects: RobotEffect[] = [];
  let totalOperatingCost = 0;
  const newRobots: RobotUnit[] = [];
  const claimedTargets = new Set<string>();

  for (const robot of state.robots) {
    let updatedRobot = robot;
    if (updatedRobot.targetX !== null && updatedRobot.targetY !== null) {
      const key = targetKey(updatedRobot.targetX, updatedRobot.targetY);
      if (claimedTargets.has(key)) {
        updatedRobot = {
          ...updatedRobot,
          targetX: null,
          targetY: null,
          path: null,
          pathIndex: 0,
          state: updatedRobot.state === 'moving' || updatedRobot.state === 'working' ? 'idle' : updatedRobot.state,
        };
      } else {
        claimedTargets.add(key);
      }
    }
    const result = tickRobot(
      updatedRobot,
      candidates,
      state.chargingStationX,
      state.chargingStationY,
      deltaMinutes,
      fleetAIActive,
      claimedTargets,
      canTraverse
    );

    newRobots.push(result.robot);
    if (result.effect) {
      effects.push(result.effect);
    }
    totalOperatingCost += result.operatingCost;
  }

  return {
    state: {
      ...state,
      robots: newRobots,
    },
    effects,
    operatingCost: totalOperatingCost,
  };
}

export function getAvailableRobotsToPurchase(
  researchState: ResearchState,
  currentState: AutonomousEquipmentState
): Array<{ equipmentId: string; stats: EquipmentStats; ownedCount: number }> {
  const unlocked = getUnlockedAutonomousEquipment(researchState);

  return unlocked.map(item => ({
    equipmentId: item.equipmentId,
    stats: item.stats,
    ownedCount: currentState.robots.filter(r => r.equipmentId === item.equipmentId).length,
  }));
}

export function getRobotStatus(state: AutonomousEquipmentState): {
  total: number;
  working: number;
  idle: number;
  charging: number;
  broken: number;
} {
  return {
    total: state.robots.length,
    working: state.robots.filter(r => r.state === 'working' || r.state === 'moving').length,
    idle: state.robots.filter(r => r.state === 'idle').length,
    charging: state.robots.filter(r => r.state === 'charging').length,
    broken: state.robots.filter(r => r.state === 'broken').length,
  };
}
