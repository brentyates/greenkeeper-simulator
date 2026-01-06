import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialWorkSystemState,
  addWorker,
  removeWorker,
  assignWorkerToArea,
  addArea,
  getWorkerState,
  tickEmployeeWork,
  syncWorkersWithRoster,
  getActiveWorkerCount,
  getWorkerPositions,
  EMPLOYEE_MOVE_SPEED,
  TASK_DURATIONS,
  WORK_THRESHOLDS,
  CourseArea,
} from './employee-work';
import { createEmployee, resetEmployeeCounter } from './employees';
import { CellState, TerrainType } from './terrain';

function createTestCell(
  type: TerrainType = 'fairway',
  health: number = 100,
  moisture: number = 50,
  nutrients: number = 50,
  height: number = 0
): CellState {
  return {
    x: 0,
    y: 0,
    type,
    height,
    health,
    moisture,
    nutrients,
    elevation: 0,
    obstacle: 'none',
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
  };
}

function createTestGrid(width: number, height: number, cellFn?: (x: number, y: number) => CellState): CellState[][] {
  const grid: CellState[][] = [];
  for (let y = 0; y < height; y++) {
    const row: CellState[] = [];
    for (let x = 0; x < width; x++) {
      row.push(cellFn ? cellFn(x, y) : createTestCell());
    }
    grid.push(row);
  }
  return grid;
}

describe('employee-work', () => {
  beforeEach(() => {
    resetEmployeeCounter();
  });

  describe('createInitialWorkSystemState', () => {
    it('creates empty state with maintenance shed position', () => {
      const state = createInitialWorkSystemState(5, 10);
      expect(state.workers).toHaveLength(0);
      expect(state.areas).toHaveLength(0);
      expect(state.maintenanceShedX).toBe(5);
      expect(state.maintenanceShedY).toBe(10);
    });

    it('defaults to origin if no position specified', () => {
      const state = createInitialWorkSystemState();
      expect(state.maintenanceShedX).toBe(0);
      expect(state.maintenanceShedY).toBe(0);
    });
  });

  describe('addWorker', () => {
    it('adds worker to state', () => {
      const state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const newState = addWorker(state, employee);

      expect(newState.workers).toHaveLength(1);
      expect(newState.workers[0].employeeId).toBe(employee.id);
      expect(newState.workers[0].gridX).toBe(5);
      expect(newState.workers[0].gridY).toBe(5);
    });

    it('initializes worker as idle', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const newState = addWorker(state, employee);

      expect(newState.workers[0].currentTask).toBe('idle');
      expect(newState.workers[0].targetX).toBeNull();
      expect(newState.workers[0].targetY).toBeNull();
    });

    it('does not duplicate existing worker', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      let newState = addWorker(state, employee);
      newState = addWorker(newState, employee);

      expect(newState.workers).toHaveLength(1);
    });
  });

  describe('removeWorker', () => {
    it('removes worker from state', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      let newState = addWorker(state, employee);
      newState = removeWorker(newState, employee.id);

      expect(newState.workers).toHaveLength(0);
    });

    it('keeps other workers when removing one', () => {
      const state = createInitialWorkSystemState();
      const emp1 = createEmployee('groundskeeper', 'novice', 0);
      const emp2 = createEmployee('groundskeeper', 'trained', 0);

      let newState = addWorker(state, emp1);
      newState = addWorker(newState, emp2);
      newState = removeWorker(newState, emp1.id);

      expect(newState.workers).toHaveLength(1);
      expect(newState.workers[0].employeeId).toBe(emp2.id);
    });
  });

  describe('assignWorkerToArea', () => {
    it('assigns worker to area', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      let newState = addWorker(state, employee);
      newState = assignWorkerToArea(newState, employee.id, 'front-9');

      expect(newState.workers[0].assignedAreaId).toBe('front-9');
    });

    it('clears area assignment when null', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      let newState = addWorker(state, employee);
      newState = assignWorkerToArea(newState, employee.id, 'front-9');
      newState = assignWorkerToArea(newState, employee.id, null);

      expect(newState.workers[0].assignedAreaId).toBeNull();
    });
  });

  describe('addArea', () => {
    it('adds area to state', () => {
      const state = createInitialWorkSystemState();
      const area: CourseArea = { id: 'front-9', name: 'Front 9', minX: 0, maxX: 50, minY: 0, maxY: 50 };
      const newState = addArea(state, area);

      expect(newState.areas).toHaveLength(1);
      expect(newState.areas[0].id).toBe('front-9');
    });

    it('does not duplicate existing area', () => {
      const state = createInitialWorkSystemState();
      const area: CourseArea = { id: 'front-9', name: 'Front 9', minX: 0, maxX: 50, minY: 0, maxY: 50 };
      let newState = addArea(state, area);
      newState = addArea(newState, area);

      expect(newState.areas).toHaveLength(1);
    });
  });

  describe('getWorkerState', () => {
    it('returns worker state by id', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const newState = addWorker(state, employee);

      const workerState = getWorkerState(newState, employee.id);
      expect(workerState).not.toBeNull();
      expect(workerState?.employeeId).toBe(employee.id);
    });

    it('returns null for unknown worker', () => {
      const state = createInitialWorkSystemState();
      expect(getWorkerState(state, 'unknown')).toBeNull();
    });
  });

  describe('tickEmployeeWork', () => {
    it('finds work target for idle worker', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0, 'Test Worker');
      const workingEmployee = { ...employee, status: 'working' as const };
      let workState = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 50, 50, 70);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(workState, [workingEmployee], cells, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).not.toBe('idle');
      expect(worker.targetX).not.toBeNull();
      expect(worker.targetY).not.toBeNull();
    });

    it('moves worker toward target using path', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          currentTask: 'patrol' as const,
          targetX: 10,
          targetY: 0,
          path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
          moveProgress: 0.01,
        })),
      };

      const cells = createTestGrid(20, 20);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      const worker = result.state.workers[0];
      expect(worker.gridX).toBe(1);
      expect(worker.path.length).toBe(1);
    });

    it('completes work and generates effect', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'expert', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 90,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('mow');
      expect(result.tasksCompleted).toBe(1);
    });

    it('tracks task completions for experience awards', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'expert', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 99,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.completions.length).toBe(1);
      expect(result.completions[0].employeeId).toBe(employee.id);
      expect(result.completions[0].task).toBe('mow_grass');
      expect(result.completions[0].gridX).toBe(5);
      expect(result.completions[0].gridY).toBe(5);
    });

    it('ignores non-working employees', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const onBreakEmployee = { ...employee, status: 'on_break' as const };
      const workState = addWorker(state, onBreakEmployee);

      const cells = createTestGrid(10, 10, () => createTestCell('fairway', 40, 20, 20));
      const result = tickEmployeeWork(workState, [onBreakEmployee], cells, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
    });
  });

  describe('syncWorkersWithRoster', () => {
    it('adds new groundskeepers to work system', () => {
      const state = createInitialWorkSystemState();
      const emp1 = createEmployee('groundskeeper', 'novice', 0);
      const emp2 = createEmployee('groundskeeper', 'trained', 0);

      const newState = syncWorkersWithRoster(state, [emp1, emp2]);

      expect(newState.workers).toHaveLength(2);
    });

    it('removes workers for fired employees', () => {
      let state = createInitialWorkSystemState();
      const emp1 = createEmployee('groundskeeper', 'novice', 0);
      const emp2 = createEmployee('groundskeeper', 'trained', 0);

      state = addWorker(state, emp1);
      state = addWorker(state, emp2);

      const newState = syncWorkersWithRoster(state, [emp1]);

      expect(newState.workers).toHaveLength(1);
      expect(newState.workers[0].employeeId).toBe(emp1.id);
    });

    it('ignores non-maintenance employees', () => {
      const state = createInitialWorkSystemState();
      const mechanic = createEmployee('mechanic', 'novice', 0);
      const manager = createEmployee('manager', 'novice', 0);

      const newState = syncWorkersWithRoster(state, [mechanic, manager]);

      expect(newState.workers).toHaveLength(0);
    });
  });

  describe('getActiveWorkerCount', () => {
    it('counts workers not idle', () => {
      let state = createInitialWorkSystemState();
      const emp1 = createEmployee('groundskeeper', 'novice', 0);
      const emp2 = createEmployee('groundskeeper', 'novice', 0);

      state = addWorker(state, emp1);
      state = addWorker(state, emp2);

      state = {
        ...state,
        workers: [
          { ...state.workers[0], currentTask: 'mow_grass' as const },
          state.workers[1],
        ],
      };

      expect(getActiveWorkerCount(state)).toBe(1);
    });
  });

  describe('getWorkerPositions', () => {
    it('returns all worker positions and tasks', () => {
      let state = createInitialWorkSystemState(10, 20);
      const emp = createEmployee('groundskeeper', 'novice', 0);
      state = addWorker(state, emp);

      const positions = getWorkerPositions(state);

      expect(positions).toHaveLength(1);
      expect(positions[0].gridX).toBe(10);
      expect(positions[0].gridY).toBe(20);
      expect(positions[0].task).toBe('idle');
    });
  });

  describe('work priorities', () => {
    it('prioritizes critical mowing over standard watering', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 2 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        if (x === 3 && y === 0) {
          return createTestCell('fairway', 100, 35, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      const worker = result.state.workers[0];

      expect(worker.targetX).toBe(2);
      expect(worker.path.length).toBeGreaterThan(0);
    });

    it('prevents multiple workers from claiming the same tile when at same location', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee1 = createEmployee('groundskeeper', 'novice', 0);
      const employee2 = createEmployee('groundskeeper', 'novice', 0);
      const working1 = { ...employee1, status: 'working' as const };
      const working2 = { ...employee2, status: 'working' as const };
      state = addWorker(state, working1);
      state = addWorker(state, working2);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 0 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        if (x === 1 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 85);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [working1, working2], cells, 0.1);
      const worker1 = result.state.workers[0];
      const worker2 = result.state.workers[1];

      const target1 = `${worker1.targetX},${worker1.targetY}`;
      const target2 = `${worker2.targetX},${worker2.targetY}`;
      expect(target1).not.toBe(target2);
    });
  });

  describe('constants', () => {
    it('has positive move speed', () => {
      expect(EMPLOYEE_MOVE_SPEED).toBeGreaterThan(0);
    });

    it('has task durations for all tasks', () => {
      expect(TASK_DURATIONS.mow_grass).toBeGreaterThan(0);
      expect(TASK_DURATIONS.water_area).toBeGreaterThan(0);
      expect(TASK_DURATIONS.fertilize_area).toBeGreaterThan(0);
    });

    it('has sensible work thresholds', () => {
      expect(WORK_THRESHOLDS.heightCritical).toBeGreaterThan(WORK_THRESHOLDS.heightStandard);
      expect(WORK_THRESHOLDS.waterStandard).toBeGreaterThan(WORK_THRESHOLDS.waterCritical);
    });
  });
});
