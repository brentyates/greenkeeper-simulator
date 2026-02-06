import { Employee, EmployeeRole, calculateEffectiveEfficiency } from './employees';
import {
  EmployeeEntity,
  EmployeeTask,
  GridPosition,
  MOVE_SPEED,
  createEmployeeEntity,
  moveEmployeeTowardWithNavigation,
} from './movable-entity';
import { isGrassTerrain, getTerrainType } from './terrain';
import {
  isExtremeNeed,
  scoreNeedWithDistance,
} from './work-priority';
import { findPath } from './navigation';
import type { FaceStateSample, TerrainSystem } from '../babylon/systems/TerrainSystemInterface';

export type { EmployeeTask } from './movable-entity';

export interface WorkTarget {
  readonly worldX: number;
  readonly worldZ: number;
  readonly task: EmployeeTask;
  readonly priority: number;
}

export type EmployeeWorkState = EmployeeEntity & {
  readonly employeeId: string;
};

export interface CourseArea {
  readonly id: string;
  readonly name: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface EmployeeWorkSystemState {
  readonly workers: readonly EmployeeWorkState[];
  readonly areas: readonly CourseArea[];
  readonly maintenanceShedX: number;
  readonly maintenanceShedY: number;
}

export interface WorkEffect {
  readonly worldX: number;
  readonly worldZ: number;
  readonly radius: number;
  readonly type: 'mow' | 'water' | 'fertilize' | 'rake';
  readonly efficiency: number;
}

export interface TaskCompletion {
  readonly employeeId: string;
  readonly task: EmployeeTask;
  readonly worldX: number;
  readonly worldZ: number;
}

export interface EmployeeWorkTickResult {
  readonly state: EmployeeWorkSystemState;
  readonly effects: readonly WorkEffect[];
  readonly tasksCompleted: number;
  readonly completions: readonly TaskCompletion[];
}

export const TASK_DURATIONS: Record<EmployeeTask, number> = {
  mow_grass: 0.5,
  water_area: 0.25,
  fertilize_area: 0.3,
  rake_bunker: 1.0,
  patrol: 0.1,
  return_to_base: 0,
  idle: 0,
};

export const EMPLOYEE_MOVE_SPEED = MOVE_SPEED;

export const TASK_EXPERIENCE_REWARDS: Record<EmployeeTask, number> = {
  mow_grass: 10,
  water_area: 5,
  fertilize_area: 8,
  rake_bunker: 15,
  patrol: 2,
  return_to_base: 0,
  idle: 0,
};

export const TASK_SUPPLY_COSTS: Record<EmployeeTask, number> = {
  mow_grass: 0.25,
  water_area: 0.10,
  fertilize_area: 0.50,
  rake_bunker: 0.05,
  patrol: 0,
  return_to_base: 0,
  idle: 0,
};

export const WORK_THRESHOLDS = {
  heightCritical: 80,
  heightStandard: 60,
  waterCritical: 20,
  waterStandard: 40,
  fertilizeCritical: 20,
  fertilizeStandard: 30,
};

const TASK_ORDER_BONUS_STEP = 6;

export function createInitialWorkSystemState(
  maintenanceShedX: number = 0,
  maintenanceShedY: number = 0
): EmployeeWorkSystemState {
  return {
    workers: [],
    areas: [],
    maintenanceShedX,
    maintenanceShedY,
  };
}

export function addWorker(
  state: EmployeeWorkSystemState,
  employee: Employee
): EmployeeWorkSystemState {
  const existingWorker = state.workers.find(w => w.employeeId === employee.id);
  if (existingWorker) return state;

  const baseEntity = createEmployeeEntity(
    employee.id,
    state.maintenanceShedX,
    state.maintenanceShedY,
    calculateEffectiveEfficiency(employee)
  );
  const newWorker: EmployeeWorkState = {
    ...baseEntity,
    employeeId: employee.id,
  };

  return {
    ...state,
    workers: [...state.workers, newWorker],
  };
}

export function removeWorker(
  state: EmployeeWorkSystemState,
  employeeId: string
): EmployeeWorkSystemState {
  return {
    ...state,
    workers: state.workers.filter(w => w.employeeId !== employeeId),
  };
}

export function assignWorkerToArea(
  state: EmployeeWorkSystemState,
  employeeId: string,
  areaId: string | null
): EmployeeWorkSystemState {
  return {
    ...state,
    workers: state.workers.map(w =>
      w.employeeId === employeeId ? { ...w, assignedAreaId: areaId } : w
    ),
  };
}

export function addArea(
  state: EmployeeWorkSystemState,
  area: CourseArea
): EmployeeWorkSystemState {
  const existing = state.areas.find(a => a.id === area.id);
  if (existing) return state;

  return {
    ...state,
    areas: [...state.areas, area],
  };
}

export function getWorkerState(
  state: EmployeeWorkSystemState,
  employeeId: string
): EmployeeWorkState | null {
  return state.workers.find(w => w.employeeId === employeeId) ?? null;
}

function isInArea(x: number, y: number, area: CourseArea | null): boolean {
  if (!area) return true;
  return x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY;
}

function getTaskPriorityForRole(role: EmployeeRole): EmployeeTask[] {
  switch (role) {
    case 'mechanic':
      // Mechanics prioritize bunker raking (equipment-adjacent) and patrol
      // Their main value comes from passive effects in employee-roles.ts
      // but they can help with rake and patrol when idle
      return ['rake_bunker', 'patrol'];
    case 'groundskeeper':
    default:
      return ['mow_grass', 'water_area', 'fertilize_area', 'rake_bunker', 'patrol'];
  }
}

function getTaskNeedFromSample(
  task: EmployeeTask,
  sample: FaceStateSample,
  _gameTime: number
): number {
  const terrainType = getTerrainType(sample.dominantTerrainCode);

  switch (task) {
    case 'mow_grass':
      if (!isGrassTerrain(terrainType)) return 0;
      if (sample.avgGrassHeight > WORK_THRESHOLDS.heightCritical) {
        return sample.avgGrassHeight - WORK_THRESHOLDS.heightCritical + 50;
      }
      if (sample.avgGrassHeight > WORK_THRESHOLDS.heightStandard) {
        return sample.avgGrassHeight - WORK_THRESHOLDS.heightStandard;
      }
      return 0;

    case 'water_area':
      if (!isGrassTerrain(terrainType)) return 0;
      if (sample.avgMoisture < WORK_THRESHOLDS.waterCritical) {
        return WORK_THRESHOLDS.waterCritical - sample.avgMoisture + 50;
      }
      if (sample.avgMoisture < WORK_THRESHOLDS.waterStandard) {
        return WORK_THRESHOLDS.waterStandard - sample.avgMoisture;
      }
      return 0;

    case 'fertilize_area':
      if (!isGrassTerrain(terrainType)) return 0;
      if (sample.avgNutrients < WORK_THRESHOLDS.fertilizeCritical) {
        return WORK_THRESHOLDS.fertilizeCritical - sample.avgNutrients + 50;
      }
      if (sample.avgNutrients < WORK_THRESHOLDS.fertilizeStandard) {
        return WORK_THRESHOLDS.fertilizeStandard - sample.avgNutrients;
      }
      return 0;

    case 'rake_bunker':
      if (terrainType !== 'bunker') return 0;
      return sample.avgHealth < 80 ? 100 - sample.avgHealth : 0;

    default:
      return 0;
  }
}

export function findBestWorkTarget(
  terrainSystem: TerrainSystem,
  currentWorldX: number,
  currentWorldZ: number,
  role: EmployeeRole,
  assignedArea: CourseArea | null,
  claimedTargets: ReadonlySet<string>,
  gameTime: number = 0,
  maxDistance: number = 100
): WorkTarget | null {
  const priorities = getTaskPriorityForRole(role);
  const candidates = terrainSystem.findWorkCandidates(currentWorldX, currentWorldZ, maxDistance);

  let bestTarget: WorkTarget | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestNeed = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  let bestExtremeTarget: WorkTarget | null = null;
  let bestExtremeNeed = 0;
  let bestExtremeDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.faceCount === 0) continue;
    if (!isInArea(candidate.worldX, candidate.worldZ, assignedArea)) continue;

    const key = `${Math.floor(candidate.worldX)},${Math.floor(candidate.worldZ)}`;
    if (claimedTargets.has(key)) continue;

    for (let priorityIndex = 0; priorityIndex < priorities.length; priorityIndex++) {
      const task = priorities[priorityIndex];
      const need = getTaskNeedFromSample(task, candidate, gameTime);

      if (need > 0) {
        const dx = candidate.worldX - currentWorldX;
        const dz = candidate.worldZ - currentWorldZ;
        const distance = Math.abs(dx) + Math.abs(dz);

        if (isExtremeNeed(need)) {
          if (
            !bestExtremeTarget ||
            need > bestExtremeNeed ||
            (need === bestExtremeNeed && distance < bestExtremeDistance)
          ) {
            bestExtremeNeed = need;
            bestExtremeDistance = distance;
            bestExtremeTarget = {
              worldX: candidate.worldX,
              worldZ: candidate.worldZ,
              task,
              priority: need,
            };
          }
          continue;
        }

        const taskOrderBonus = (priorities.length - priorityIndex) * TASK_ORDER_BONUS_STEP;
        const score = scoreNeedWithDistance(need, distance, taskOrderBonus);

        if (
          score > bestScore ||
          (score === bestScore && need > bestNeed) ||
          (score === bestScore && need === bestNeed && distance < bestDistance)
        ) {
          bestScore = score;
          bestNeed = need;
          bestDistance = distance;
          bestTarget = {
            worldX: candidate.worldX,
            worldZ: candidate.worldZ,
            task,
            priority: need,
          };
        }
      }
    }
  }

  if (bestExtremeTarget) {
    return bestExtremeTarget;
  }
  return bestTarget;
}

export function generateWaypointsToTarget(
  startWorldX: number,
  startWorldZ: number,
  targetWorldX: number,
  targetWorldZ: number,
  terrainSystem: TerrainSystem
): GridPosition[] {
  const dx = targetWorldX - startWorldX;
  const dz = targetWorldZ - startWorldZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.5) {
    return [];
  }

  const entity = {};
  const canWalk = (_e: unknown, x: number, z: number) => terrainSystem.isPositionWalkable(x, z);
  const pathPoints = findPath(entity, startWorldX, startWorldZ, targetWorldX, targetWorldZ, canWalk);

  if (pathPoints) {
    return pathPoints.map(p => ({ x: p.x, y: p.z }));
  }

  return [];
}

function getWorkEffect(task: EmployeeTask): 'mow' | 'water' | 'fertilize' | 'rake' | null {
  switch (task) {
    case 'mow_grass':
      return 'mow';
    case 'water_area':
      return 'water';
    case 'fertilize_area':
      return 'fertilize';
    case 'rake_bunker':
      return 'rake';
    default:
      return null;
  }
}

function getTaskEquipmentRadius(task: EmployeeTask): number {
  switch (task) {
    case 'mow_grass': return 1.0;
    case 'water_area': return 2.0;
    case 'fertilize_area': return 2.0;
    case 'rake_bunker': return 1.5;
    default: return 1.0;
  }
}

function isAtTarget(entity: EmployeeWorkState, targetX: number, targetZ: number): boolean {
  const dx = targetX - entity.worldX;
  const dz = targetZ - entity.worldZ;
  return Math.sqrt(dx * dx + dz * dz) < 0.3;
}

export function tickEmployeeWork(
  state: EmployeeWorkSystemState,
  employees: readonly Employee[],
  terrainSystem: TerrainSystem,
  deltaMinutes: number,
  gameTime: number = 0
): EmployeeWorkTickResult {
  const effects: WorkEffect[] = [];
  const completions: TaskCompletion[] = [];
  let tasksCompleted = 0;

  const claimedTargets = new Set<string>();
  for (const worker of state.workers) {
    if (worker.targetX !== null && worker.targetZ !== null) {
      claimedTargets.add(`${Math.floor(worker.targetX)},${Math.floor(worker.targetZ)}`);
    }
  }

  const updatedWorkers = state.workers.map(worker => {
    const employee = employees.find(e => e.id === worker.employeeId);
    if (!employee) return worker;

    if (employee.status !== 'working') {
      return { ...worker, currentTask: 'idle' as EmployeeTask, path: [], moveProgress: 0 };
    }

    // Only groundskeepers and mechanics have autonomous field work
    if (employee.role !== 'groundskeeper' && employee.role !== 'mechanic') {
      return worker;
    }

    const assignedArea = worker.assignedAreaId
      ? state.areas.find(a => a.id === worker.assignedAreaId) ?? null
      : null;

    const efficiency = calculateEffectiveEfficiency(employee);

    // Continue work in progress
    if (worker.workProgress > 0 && worker.workProgress < 100) {
      const taskDuration = TASK_DURATIONS[worker.currentTask];
      if (taskDuration === 0) {
        return { ...worker, currentTask: 'idle' as EmployeeTask, workProgress: 0, path: [], targetX: null, targetZ: null };
      }

      const progressPerMinute = 100 / taskDuration;
      const newProgress = worker.workProgress + progressPerMinute * deltaMinutes * efficiency;

      if (newProgress >= 100) {
        const effectType = getWorkEffect(worker.currentTask);
        if (effectType) {
          effects.push({
            worldX: worker.worldX,
            worldZ: worker.worldZ,
            radius: getTaskEquipmentRadius(worker.currentTask),
            type: effectType,
            efficiency,
          });
        }
        completions.push({
          employeeId: worker.employeeId,
          task: worker.currentTask,
          worldX: worker.worldX,
          worldZ: worker.worldZ,
        });
        tasksCompleted++;

        claimedTargets.delete(`${Math.floor(worker.targetX ?? 0)},${Math.floor(worker.targetZ ?? 0)}`);

        return {
          ...worker,
          workProgress: 0,
          targetX: null,
          targetZ: null,
        };
      }

      return { ...worker, workProgress: newProgress };
    }

    // Movement along waypoints
    if (worker.path.length > 0 && worker.moveProgress > 0) {
      const nextWaypoint = worker.path[0];
      const wpX = nextWaypoint.x;
      const wpZ = nextWaypoint.y;

      const moveSpeed = MOVE_SPEED;
      const distanceThisFrame = moveSpeed * deltaMinutes;
      const moveResult = moveEmployeeTowardWithNavigation(
        worker,
        wpX,
        wpZ,
        distanceThisFrame,
        (_worker, worldX, worldZ) => terrainSystem.isPositionWalkable(worldX, worldZ)
      );
      const moved = moveResult.entity;

      if (moveResult.blocked) {
        if (worker.targetX !== null && worker.targetZ !== null) {
          claimedTargets.delete(`${Math.floor(worker.targetX)},${Math.floor(worker.targetZ)}`);
        }
        return {
          ...worker,
          currentTask: 'idle' as EmployeeTask,
          path: [],
          moveProgress: 0,
          targetX: null,
          targetZ: null,
          workProgress: 0,
        };
      }

      if (isAtTarget(moved as EmployeeWorkState, wpX, wpZ)) {
        const newPath = worker.path.slice(1);
        const atFinalTarget = worker.targetX !== null && worker.targetZ !== null &&
          newPath.length === 0 && isAtTarget(moved as EmployeeWorkState, worker.targetX, worker.targetZ);

        if (atFinalTarget) {
          // Arrived at work target, check for work at this location
          const sample = terrainSystem.sampleFaceStatesInRadius(moved.worldX, moved.worldZ, 2.0);
          if (sample.faceCount > 0) {
            const priorities = getTaskPriorityForRole(employee.role);
            for (const task of priorities) {
              const need = getTaskNeedFromSample(task, sample, gameTime);
              if (need > 0) {
                return {
                  ...moved,
                  employeeId: worker.employeeId,
                  path: [],
                  moveProgress: 0,
                  currentTask: task,
                  workProgress: 0.01,
                } as EmployeeWorkState;
              }
            }
          }
          return {
            ...moved,
            employeeId: worker.employeeId,
            path: [],
            moveProgress: 0,
            currentTask: 'idle' as EmployeeTask,
            targetX: null,
            targetZ: null,
          } as EmployeeWorkState;
        }

        return {
          ...moved,
          employeeId: worker.employeeId,
          path: newPath,
          moveProgress: newPath.length > 0 ? 0.01 : 0,
        } as EmployeeWorkState;
      }

      return { ...moved, employeeId: worker.employeeId } as EmployeeWorkState;
    }

    // Check for work at current position
    const currentSample = terrainSystem.sampleFaceStatesInRadius(worker.worldX, worker.worldZ, 2.0);
    const workerOwnsClaim = worker.targetX !== null && worker.targetZ !== null &&
      isAtTarget(worker, worker.targetX, worker.targetZ);
    const currentKey = `${Math.floor(worker.worldX)},${Math.floor(worker.worldZ)}`;

    if (currentSample.faceCount > 0 && (workerOwnsClaim || !claimedTargets.has(currentKey))) {
      const priorities = getTaskPriorityForRole(employee.role);
      for (const task of priorities) {
        const need = getTaskNeedFromSample(task, currentSample, gameTime);
        if (need > 0) {
          claimedTargets.add(currentKey);
          return {
            ...worker,
            currentTask: task,
            targetX: worker.worldX,
            targetZ: worker.worldZ,
            workProgress: 0.01,
          };
        }
      }
    }

    // Start movement if we have a path but haven't started
    if (worker.path.length > 0) {
      return { ...worker, moveProgress: 0.01, currentTask: 'patrol' as EmployeeTask };
    }

    // Find new work target
    const target = findBestWorkTarget(
      terrainSystem,
      worker.worldX,
      worker.worldZ,
      employee.role,
      assignedArea,
      claimedTargets,
      gameTime
    );

    if (target) {
      const waypoints = generateWaypointsToTarget(
        worker.worldX,
        worker.worldZ,
        target.worldX,
        target.worldZ,
        terrainSystem
      );
      if (waypoints.length > 0) {
        claimedTargets.add(`${Math.floor(target.worldX)},${Math.floor(target.worldZ)}`);
        return {
          ...worker,
          currentTask: 'patrol' as EmployeeTask,
          targetX: target.worldX,
          targetZ: target.worldZ,
          path: waypoints,
          moveProgress: 0.01,
        };
      }
    }

    return { ...worker, currentTask: 'idle' as EmployeeTask, path: [], targetX: null, targetZ: null };
  });

  return {
    state: { ...state, workers: updatedWorkers },
    effects,
    tasksCompleted,
    completions,
  };
}

/** Roles that have autonomous field work (pathfinding-based) */
const FIELD_WORK_ROLES: readonly EmployeeRole[] = ['groundskeeper', 'mechanic'];

export function syncWorkersWithRoster(
  state: EmployeeWorkSystemState,
  employees: readonly Employee[]
): EmployeeWorkSystemState {
  const fieldWorkers = employees.filter(
    e => FIELD_WORK_ROLES.includes(e.role)
  );

  let newState = state;

  for (const emp of fieldWorkers) {
    if (!state.workers.find(w => w.employeeId === emp.id)) {
      newState = addWorker(newState, emp);
    }
  }

  const validIds = new Set(fieldWorkers.map(e => e.id));
  newState = {
    ...newState,
    workers: newState.workers.filter(w => validIds.has(w.employeeId)),
  };

  return newState;
}

export function getActiveWorkerCount(state: EmployeeWorkSystemState): number {
  return state.workers.filter(w => w.currentTask !== 'idle').length;
}

export function getWorkerPositions(
  state: EmployeeWorkSystemState
): readonly {
  employeeId: string;
  worldX: number;
  worldZ: number;
  gridX: number;
  gridY: number;
  task: EmployeeTask;
  isMoving: boolean;
}[] {
  return state.workers.map(w => ({
    employeeId: w.employeeId,
    worldX: w.worldX,
    worldZ: w.worldZ,
    gridX: w.gridX,
    gridY: w.gridY,
    task: w.currentTask,
    isMoving: w.path.length > 0,
  }));
}
