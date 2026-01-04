import { CellState, isWalkable } from './terrain';
import { Employee, EmployeeRole, calculateEffectiveEfficiency } from './employees';

export type EmployeeTask =
  | 'mow_grass'
  | 'water_area'
  | 'fertilize_area'
  | 'rake_bunker'
  | 'patrol'
  | 'return_to_base'
  | 'idle';

export interface WorkTarget {
  readonly gridX: number;
  readonly gridY: number;
  readonly task: EmployeeTask;
  readonly priority: number;
}

export interface EmployeeWorkState {
  readonly employeeId: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly currentTask: EmployeeTask;
  readonly targetX: number | null;
  readonly targetY: number | null;
  readonly workProgress: number;
  readonly assignedAreaId: string | null;
}

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
  readonly type: 'mow' | 'water' | 'fertilize';
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

export const EMPLOYEE_MOVE_SPEED = 12.0;

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

  const newWorker: EmployeeWorkState = {
    employeeId: employee.id,
    gridX: state.maintenanceShedX,
    gridY: state.maintenanceShedY,
    currentTask: 'idle',
    targetX: null,
    targetY: null,
    workProgress: 0,
    assignedAreaId: null,
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
    case 'groundskeeper':
      return ['mow_grass', 'water_area', 'fertilize_area', 'rake_bunker', 'patrol'];
    case 'irrigator':
      return ['water_area', 'patrol'];
    default:
      return ['patrol'];
  }
}

function findBestWorkTarget(
  cells: CellState[][],
  currentX: number,
  currentY: number,
  role: EmployeeRole,
  assignedArea: CourseArea | null,
  maxDistance: number = 100
): WorkTarget | null {
  const priorities = getTaskPriorityForRole(role);
  let bestTarget: WorkTarget | null = null;
  let bestScore = -1;

  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (!isInArea(x, y, assignedArea)) continue;

      const cell = cells[y][x];
      if (!isWalkable(cell)) continue;

      const distance = Math.abs(x - currentX) + Math.abs(y - currentY);
      if (distance > maxDistance) continue;

      for (let priorityIndex = 0; priorityIndex < priorities.length; priorityIndex++) {
        const task = priorities[priorityIndex];
        const need = getTaskNeed(cell, task);

        if (need > 0) {
          const score = (priorities.length - priorityIndex) * 1000 + need * 10 - distance;

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

function getTaskNeed(cell: CellState, task: EmployeeTask): number {
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
        return 10;
      }
      return 0;

    default:
      return 0;
  }
}

function moveToward(
  worker: EmployeeWorkState,
  targetX: number,
  targetY: number,
  deltaMinutes: number
): { gridX: number; gridY: number; arrived: boolean } {
  const dx = targetX - worker.gridX;
  const dy = targetY - worker.gridY;
  const distance = Math.abs(dx) + Math.abs(dy);

  if (distance < 0.5) {
    return { gridX: targetX, gridY: targetY, arrived: true };
  }

  const moveAmount = EMPLOYEE_MOVE_SPEED * deltaMinutes;

  if (moveAmount >= distance) {
    return { gridX: targetX, gridY: targetY, arrived: true };
  }

  const ratio = moveAmount / distance;
  const newX = worker.gridX + dx * ratio;
  const newY = worker.gridY + dy * ratio;

  return { gridX: newX, gridY: newY, arrived: false };
}

function getWorkEffect(task: EmployeeTask): 'mow' | 'water' | 'fertilize' | null {
  switch (task) {
    case 'mow_grass':
      return 'mow';
    case 'water_area':
      return 'water';
    case 'fertilize_area':
      return 'fertilize';
    default:
      return null;
  }
}

export function tickEmployeeWork(
  state: EmployeeWorkSystemState,
  employees: readonly Employee[],
  cells: CellState[][],
  deltaMinutes: number
): EmployeeWorkTickResult {
  const effects: WorkEffect[] = [];
  const completions: TaskCompletion[] = [];
  let tasksCompleted = 0;

  const updatedWorkers = state.workers.map(worker => {
    const employee = employees.find(e => e.id === worker.employeeId);
    if (!employee) return worker;

    if (employee.status !== 'working') {
      return { ...worker, currentTask: 'idle' as EmployeeTask };
    }

    if (employee.role !== 'groundskeeper' && employee.role !== 'irrigator') {
      return worker;
    }

    const assignedArea = worker.assignedAreaId
      ? state.areas.find(a => a.id === worker.assignedAreaId) ?? null
      : null;

    const efficiency = calculateEffectiveEfficiency(employee);

    if (worker.currentTask === 'idle' || worker.targetX === null) {
      const target = findBestWorkTarget(
        cells,
        worker.gridX,
        worker.gridY,
        employee.role,
        assignedArea
      );

      if (target) {
        return {
          ...worker,
          currentTask: target.task,
          targetX: target.gridX,
          targetY: target.gridY,
          workProgress: 0,
        };
      }

      return { ...worker, currentTask: 'patrol' as EmployeeTask };
    }

    const distanceToTarget = Math.abs(worker.gridX - worker.targetX!) + Math.abs(worker.gridY - worker.targetY!);
    if (distanceToTarget >= 0.5) {
      const movement = moveToward(worker, worker.targetX!, worker.targetY!, deltaMinutes);
      return {
        ...worker,
        gridX: movement.gridX,
        gridY: movement.gridY,
      };
    }

    const taskDuration = TASK_DURATIONS[worker.currentTask];
    if (taskDuration === 0) {
      return { ...worker, currentTask: 'idle' as EmployeeTask, targetX: null, targetY: null };
    }

    const progressPerMinute = 100 / taskDuration;
    const newProgress = worker.workProgress + progressPerMinute * deltaMinutes * efficiency;

    if (newProgress >= 100) {
      const effectType = getWorkEffect(worker.currentTask);
      if (effectType) {
        effects.push({
          gridX: worker.targetX!,
          gridY: worker.targetY!,
          type: effectType,
          efficiency,
        });
      }
      completions.push({
        employeeId: worker.employeeId,
        task: worker.currentTask,
        gridX: worker.targetX!,
        gridY: worker.targetY!,
      });
      tasksCompleted++;

      return {
        ...worker,
        currentTask: 'idle' as EmployeeTask,
        targetX: null,
        targetY: null,
        workProgress: 0,
      };
    }

    return { ...worker, workProgress: newProgress };
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
    e => e.role === 'groundskeeper' || e.role === 'irrigator'
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
): readonly { employeeId: string; gridX: number; gridY: number; task: EmployeeTask }[] {
  return state.workers.map(w => ({
    employeeId: w.employeeId,
    gridX: w.gridX,
    gridY: w.gridY,
    task: w.currentTask,
  }));
}
