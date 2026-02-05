import { CellState, isWalkable, canMoveFromTo } from './terrain';
import { Employee, EmployeeRole, calculateEffectiveEfficiency } from './employees';
import {
  EmployeeEntity,
  EmployeeTask,
  GridPosition,
  MOVE_SPEED,
  moveEntityAlongPath,
  createEmployeeEntity,
} from './movable-entity';

export type { EmployeeTask, GridPosition } from './movable-entity';

export interface WorkTarget {
  readonly gridX: number;
  readonly gridY: number;
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
  readonly gridX: number;
  readonly gridY: number;
  readonly type: 'mow' | 'water' | 'fertilize' | 'rake';
  readonly efficiency: number;
}

export interface TaskCompletion {
  readonly employeeId: string;
  readonly task: EmployeeTask;
  readonly gridX: number;
  readonly gridY: number;
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

function getTaskPriorityForRole(_role: EmployeeRole): EmployeeTask[] {
  return ['mow_grass', 'water_area', 'fertilize_area', 'rake_bunker', 'patrol'];
}

export function findBestWorkTarget(
  cells: CellState[][],
  currentX: number,
  currentY: number,
  role: EmployeeRole,
  assignedArea: CourseArea | null,
  claimedTargets: ReadonlySet<string>,
  gameTime: number = 0,
  maxDistance: number = 100
): WorkTarget | null {
  const priorities = getTaskPriorityForRole(role);
  let bestTarget: WorkTarget | null = null;
  let bestScore = -1;

  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (!isInArea(x, y, assignedArea)) continue;
      if (claimedTargets.has(`${x},${y}`)) continue;

      const cell = cells[y][x];
      if (!isWalkable(cell)) continue;

      const distance = Math.abs(x - currentX) + Math.abs(y - currentY);
      if (distance > maxDistance) continue;

      for (let priorityIndex = 0; priorityIndex < priorities.length; priorityIndex++) {
        const task = priorities[priorityIndex];
        const need = getTaskNeed(cell, task, gameTime);

        if (need > 0) {
          const isCritical = need > 50;
          const priorityBonus = isCritical ? 5000 : (priorities.length - priorityIndex) * 100;
          const score = priorityBonus + need * 10 - distance;

          if (score > bestScore) {
            bestScore = score;
            bestTarget = { gridX: x, gridY: y, task, priority: need };
          }
        }
      }
    }
  }

  return bestTarget;
}

function getTaskNeed(cell: CellState, task: EmployeeTask, gameTime: number = 0): number {
  switch (task) {
    case 'mow_grass':
      if (cell.type === 'fairway' || cell.type === 'green' || cell.type === 'rough') {
        if (cell.height > WORK_THRESHOLDS.heightCritical) {
          return cell.height - WORK_THRESHOLDS.heightCritical + 50;
        }
        if (cell.height > WORK_THRESHOLDS.heightStandard) {
          return cell.height - WORK_THRESHOLDS.heightStandard;
        }
      }
      return 0;

    case 'water_area':
      if (cell.type === 'fairway' || cell.type === 'green' || cell.type === 'rough') {
        if (cell.moisture < WORK_THRESHOLDS.waterCritical) {
          return WORK_THRESHOLDS.waterCritical - cell.moisture + 50;
        }
        if (cell.moisture < WORK_THRESHOLDS.waterStandard) {
          return WORK_THRESHOLDS.waterStandard - cell.moisture;
        }
      }
      return 0;

    case 'fertilize_area':
      if (cell.type === 'fairway' || cell.type === 'green' || cell.type === 'rough') {
        if (cell.nutrients < WORK_THRESHOLDS.fertilizeCritical) {
          return WORK_THRESHOLDS.fertilizeCritical - cell.nutrients + 50;
        }
        if (cell.nutrients < WORK_THRESHOLDS.fertilizeStandard) {
          return WORK_THRESHOLDS.fertilizeStandard - cell.nutrients;
        }
      }
      return 0;

    case 'rake_bunker':
      if (cell.type === 'bunker') {
        const timeSinceRake = gameTime - cell.lastMowed;
        if (cell.lastMowed === 0 || timeSinceRake >= BUNKER_RAKE_COOLDOWN) {
          return 10;
        }
      }
      return 0;

    default:
      return 0;
  }
}

export function findPath(
  cells: CellState[][],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  slopeChecker?: (x: number, y: number) => boolean
): GridPosition[] {
  interface PathNode {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: PathNode | null;
  }

  const height = cells.length;
  const width = cells[0]?.length ?? 0;

  if (startX === endX && startY === endY) return [];
  if (endX < 0 || endX >= width || endY < 0 || endY >= height) return [];

  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();

  const heuristic = (x: number, y: number) =>
    Math.abs(x - endX) + Math.abs(y - endY);

  openSet.push({
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY),
    f: heuristic(startX, startY),
    parent: null,
  });

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.x === endX && current.y === endY) {
      const path: GridPosition[] = [];
      let node: PathNode | null = current;
      while (node?.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(`${current.x},${current.y}`);

    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

      const fromCell = cells[current.y]?.[current.x];
      const toCell = cells[neighbor.y]?.[neighbor.x];
      if (!fromCell || !toCell || !canMoveFromTo(fromCell, toCell, slopeChecker)) continue;

      const alreadyInOpenSet = openSet.some(n => n.x === neighbor.x && n.y === neighbor.y);
      if (alreadyInOpenSet) continue;

      const g = current.g + 1;
      const h = heuristic(neighbor.x, neighbor.y);
      const f = g + h;
      openSet.push({ x: neighbor.x, y: neighbor.y, g, h, f, parent: current });
    }
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

const BUNKER_RAKE_COOLDOWN = 60;

export function tickEmployeeWork(
  state: EmployeeWorkSystemState,
  employees: readonly Employee[],
  cells: CellState[][],
  deltaMinutes: number,
  gameTime: number = 0,
  slopeChecker?: (x: number, y: number) => boolean
): EmployeeWorkTickResult {
  const effects: WorkEffect[] = [];
  const completions: TaskCompletion[] = [];
  let tasksCompleted = 0;

  const claimedTargets = new Set<string>();
  for (const worker of state.workers) {
    if (worker.targetX !== null && worker.targetY !== null) {
      claimedTargets.add(`${worker.targetX},${worker.targetY}`);
    }
  }

  const updatedWorkers = state.workers.map(worker => {
    const employee = employees.find(e => e.id === worker.employeeId);
    if (!employee) return worker;

    if (employee.status !== 'working') {
      return { ...worker, currentTask: 'idle' as EmployeeTask, path: [], moveProgress: 0 };
    }

    if (employee.role !== 'groundskeeper') {
      return worker;
    }

    const assignedArea = worker.assignedAreaId
      ? state.areas.find(a => a.id === worker.assignedAreaId) ?? null
      : null;

    const efficiency = calculateEffectiveEfficiency(employee);
    const currentX = worker.gridX;
    const currentY = worker.gridY;
    const currentCell = cells[currentY]?.[currentX];

    if (worker.moveProgress > 0 && worker.moveProgress < 1 && worker.path.length > 0) {
      return moveEntityAlongPath(worker, deltaMinutes);
    }

    if (worker.workProgress > 0 && worker.workProgress < 100) {
      const taskDuration = TASK_DURATIONS[worker.currentTask];
      if (taskDuration === 0) {
        return { ...worker, currentTask: 'idle' as EmployeeTask, workProgress: 0, path: [], targetX: null, targetY: null };
      }

      const progressPerMinute = 100 / taskDuration;
      const newProgress = worker.workProgress + progressPerMinute * deltaMinutes * efficiency;

      if (newProgress >= 100) {
        const effectType = getWorkEffect(worker.currentTask);
        if (effectType) {
          effects.push({
            gridX: currentX,
            gridY: currentY,
            type: effectType,
            efficiency,
          });
        }
        completions.push({
          employeeId: worker.employeeId,
          task: worker.currentTask,
          gridX: currentX,
          gridY: currentY,
        });
        tasksCompleted++;

        claimedTargets.delete(`${worker.targetX},${worker.targetY}`);

        return {
          ...worker,
          workProgress: 0,
          targetX: null,
          targetY: null,
        };
      }

      return { ...worker, workProgress: newProgress };
    }

    const workerOwnsClaim = worker.targetX === currentX && worker.targetY === currentY;
    if (currentCell && (workerOwnsClaim || !claimedTargets.has(`${currentX},${currentY}`))) {
      const priorities = getTaskPriorityForRole(employee.role);
      for (const task of priorities) {
        const need = getTaskNeed(currentCell, task, gameTime);
        if (need > 0) {
          claimedTargets.add(`${currentX},${currentY}`);
          return {
            ...worker,
            currentTask: task,
            targetX: currentX,
            targetY: currentY,
            workProgress: 0.01,
          };
        }
      }
    }

    if (worker.path.length > 0) {
      return { ...worker, moveProgress: 0.01, currentTask: 'patrol' as EmployeeTask };
    }

    const target = findBestWorkTarget(
      cells,
      currentX,
      currentY,
      employee.role,
      assignedArea,
      claimedTargets,
      gameTime
    );

    if (target) {
      const path = findPath(cells, currentX, currentY, target.gridX, target.gridY, slopeChecker);
      if (path.length > 0) {
        claimedTargets.add(`${target.gridX},${target.gridY}`);
        return {
          ...worker,
          currentTask: 'patrol' as EmployeeTask,
          targetX: target.gridX,
          targetY: target.gridY,
          path,
          moveProgress: 0.01,
        };
      }
    }

    return { ...worker, currentTask: 'idle' as EmployeeTask, path: [], targetX: null, targetY: null };
  });

  return {
    state: { ...state, workers: updatedWorkers },
    effects,
    tasksCompleted,
    completions,
  };
}

export function syncWorkersWithRoster(
  state: EmployeeWorkSystemState,
  employees: readonly Employee[]
): EmployeeWorkSystemState {
  const groundskeepers = employees.filter(
    e => e.role === 'groundskeeper'
  );

  let newState = state;

  for (const emp of groundskeepers) {
    if (!state.workers.find(w => w.employeeId === emp.id)) {
      newState = addWorker(newState, emp);
    }
  }

  const validIds = new Set(groundskeepers.map(e => e.id));
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
): readonly { employeeId: string; gridX: number; gridY: number; task: EmployeeTask; nextX: number | null; nextY: number | null; moveProgress: number }[] {
  return state.workers.map(w => ({
    employeeId: w.employeeId,
    gridX: w.gridX,
    gridY: w.gridY,
    task: w.currentTask,
    nextX: w.path.length > 0 ? w.path[0].x : null,
    nextY: w.path.length > 0 ? w.path[0].y : null,
    moveProgress: w.moveProgress,
  }));
}
