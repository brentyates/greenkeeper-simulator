import { EquipmentStats, getUnlockedAutonomousEquipment, ResearchState } from './research';
import { WorkCandidate } from '../babylon/systems/TerrainSystemInterface';
import { TERRAIN_CODES } from './terrain';

export type RobotType = 'mower' | 'sprayer' | 'spreader';
export type RobotState = 'idle' | 'working' | 'moving' | 'charging' | 'broken';

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
  readonly worldX: number;
  readonly worldZ: number;
  readonly efficiency: number;
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

function findNeedsWork(
  candidates: WorkCandidate[],
  type: RobotType,
  currentX: number,
  currentZ: number,
): { x: number; z: number } | null {
  let bestTarget: { x: number; z: number; priority: number; distance: number } | null = null;

  for (const c of candidates) {
    if (c.dominantTerrainCode === TERRAIN_CODES.WATER) continue;

    const distance = Math.abs(c.worldX - currentX) + Math.abs(c.worldZ - currentZ);

    let priority = 0;

    switch (type) {
      case 'mower':
        if (c.avgHealth < 100) {
          priority = 100 - c.avgHealth;
        }
        break;
      case 'sprayer':
        if (c.avgMoisture < 50) {
          priority = 50 - c.avgMoisture;
        }
        break;
      case 'spreader':
        if (c.avgNutrients < 50) {
          priority = 50 - c.avgNutrients;
        }
        break;
    }

    if (priority > 0) {
      if (!bestTarget || priority > bestTarget.priority ||
          (priority === bestTarget.priority && distance < bestTarget.distance)) {
        bestTarget = { x: c.worldX, z: c.worldZ, priority, distance };
      }
    }
  }

  return bestTarget ? { x: bestTarget.x, z: bestTarget.z } : null;
}

function moveToward(
  robot: RobotUnit,
  targetX: number,
  targetZ: number,
  speed: number,
  deltaMinutes: number
): { worldX: number; worldZ: number; arrived: boolean } {
  const moveAmount = speed * (deltaMinutes / 60);
  const dx = targetX - robot.worldX;
  const dz = targetZ - robot.worldZ;
  const distance = Math.abs(dx) + Math.abs(dz);

  if (distance <= moveAmount) {
    return { worldX: targetX, worldZ: targetZ, arrived: true };
  }

  const ratio = moveAmount / distance;
  return {
    worldX: robot.worldX + dx * ratio,
    worldZ: robot.worldZ + dz * ratio,
    arrived: false,
  };
}

function tickRobot(
  robot: RobotUnit,
  candidates: WorkCandidate[],
  chargingX: number,
  chargingZ: number,
  deltaMinutes: number,
  fleetAIActive: boolean
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

  const breakdownRate = fleetAIActive
    ? (robot.stats.breakdownRate ?? 0) * 0.6
    : robot.stats.breakdownRate ?? 0;

  if (breakdownRate > 0 && Math.random() < breakdownRate * hoursElapsed) {
    return {
      robot: {
        ...robot,
        state: 'broken',
        breakdownTimeRemaining: robot.stats.repairTime ?? 60,
        targetX: null,
        targetY: null,
      },
      effect: null,
      operatingCost,
    };
  }

  const resourceConsumption = (robot.stats.fuelEfficiency ?? 1) * deltaMinutes * 0.5;
  const newResource = Math.max(0, robot.resourceCurrent - resourceConsumption);

  if (newResource < robot.resourceMax * 0.1) {
    const { worldX, worldZ, arrived } = moveToward(robot, chargingX, chargingZ, robot.stats.speed, deltaMinutes);

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

  if (robot.targetX === null || robot.targetY === null) {
    const target = findNeedsWork(candidates, robot.type, robot.worldX, robot.worldZ);

    if (!target) {
      return {
        robot: {
          ...robot,
          state: 'idle',
          resourceCurrent: newResource,
        },
        effect: null,
        operatingCost,
      };
    }

    return {
      robot: {
        ...robot,
        state: 'moving',
        resourceCurrent: newResource,
        targetX: target.x,
        targetY: target.z,
      },
      effect: null,
      operatingCost,
    };
  }

  const { worldX, worldZ, arrived } = moveToward(robot, robot.targetX, robot.targetY, robot.stats.speed, deltaMinutes);

  if (arrived) {
    const effect: RobotEffect = {
      type: robot.type,
      worldX,
      worldZ,
      efficiency: robot.stats.efficiency,
    };

    return {
      robot: {
        ...robot,
        worldX,
        worldZ,
        state: 'working',
        resourceCurrent: newResource,
        targetX: null,
        targetY: null,
      },
      effect,
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
    effect: null,
    operatingCost,
  };
}

export function tickAutonomousEquipment(
  state: AutonomousEquipmentState,
  candidates: WorkCandidate[],
  deltaMinutes: number,
  fleetAIActive: boolean = false
): RobotTickResult {
  const effects: RobotEffect[] = [];
  let totalOperatingCost = 0;
  const newRobots: RobotUnit[] = [];

  for (const robot of state.robots) {
    const result = tickRobot(
      robot,
      candidates,
      state.chargingStationX,
      state.chargingStationY,
      deltaMinutes,
      fleetAIActive
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
