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
  findPath,
  findBestWorkTarget,
  EMPLOYEE_MOVE_SPEED,
  TASK_DURATIONS,
  WORK_THRESHOLDS,
  CourseArea,
} from './employee-work';
import { createEmployeeEntity } from './movable-entity';
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

    it('only assigns specified worker when multiple workers exist', () => {
      const state = createInitialWorkSystemState();
      const emp1 = createEmployee('groundskeeper', 'novice', 0);
      const emp2 = createEmployee('groundskeeper', 'novice', 0);
      let newState = addWorker(state, emp1);
      newState = addWorker(newState, emp2);
      newState = assignWorkerToArea(newState, emp1.id, 'front-9');

      const worker1 = newState.workers.find(w => w.employeeId === emp1.id);
      const worker2 = newState.workers.find(w => w.employeeId === emp2.id);
      expect(worker1?.assignedAreaId).toBe('front-9');
      expect(worker2?.assignedAreaId).toBeNull();
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
      expect(positions[0].nextX).toBeNull();
      expect(positions[0].nextY).toBeNull();
    });

    it('returns next position when worker has a path', () => {
      let state = createInitialWorkSystemState(5, 5);
      const emp = createEmployee('groundskeeper', 'novice', 0);
      state = addWorker(state, emp);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          path: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
        })),
      };

      const positions = getWorkerPositions(state);

      expect(positions[0].nextX).toBe(6);
      expect(positions[0].nextY).toBe(5);
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

  describe('tickEmployeeWork - branch coverage', () => {
    it('resets to idle when task has zero duration', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          currentTask: 'idle' as const,
          workProgress: 50,
          targetX: 5,
          targetY: 5,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
      expect(worker.workProgress).toBe(0);
      expect(worker.targetX).toBeNull();
      expect(worker.targetY).toBeNull();
    });

    it('continues work in progress correctly', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
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
          workProgress: 20,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.workProgress).toBeGreaterThan(20);
      expect(worker.workProgress).toBeLessThan(100);
      expect(result.tasksCompleted).toBe(0);
    });

    it('starts movement when path exists but moveProgress is zero', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          currentTask: 'idle' as const,
          targetX: null,
          targetY: null,
          path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, () => createTestCell('fairway', 100, 100, 100, 0));
      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.moveProgress).toBe(0.01);
      expect(worker.currentTask).toBe('patrol');
    });

    it('falls back to idle when no work target is found', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'patrol' as const,
          targetX: null,
          targetY: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, () => createTestCell('fairway', 100, 100, 100, 0));
      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
      expect(worker.path).toHaveLength(0);
    });

    it('skips non-groundskeeper employees in tick', () => {
      let state = createInitialWorkSystemState(5, 5);
      const mechanic = createEmployee('mechanic', 'novice', 0);
      const workingMechanic = { ...mechanic, status: 'working' as const };

      state = {
        ...state,
        workers: [{
          ...createEmployeeEntity(mechanic.id, 5, 5, 1.0),
          employeeId: mechanic.id,
        }],
      };

      const cells = createTestGrid(10, 10, () => createTestCell('fairway', 100, 100, 100, 90));
      const result = tickEmployeeWork(state, [workingMechanic], cells, 1);

      expect(result.state.workers[0].currentTask).toBe('idle');
    });

    it('handles employee not found in roster', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      state = addWorker(state, employee);

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [], cells, 1);

      expect(result.state.workers[0].currentTask).toBe('idle');
    });

    it('handles worker with non-existent assigned area', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          assignedAreaId: 'non-existent-area',
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 6 && y === 5) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0].currentTask).not.toBe('idle');
    });

    it('worker claims current position when at target', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          targetX: 5,
          targetY: 5,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0].currentTask).toBe('mow_grass');
    });

    it('generates rake effect for bunker work', () => {
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
          currentTask: 'rake_bunker' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 99,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return { ...createTestCell('bunker'), lastMowed: 0 };
        }
        return createTestCell('fairway');
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('rake');
    });

    it('generates water effect for watering work', () => {
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
          currentTask: 'water_area' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 99,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('water');
    });

    it('generates fertilize effect for fertilizing work', () => {
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
          currentTask: 'fertilize_area' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 99,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('fertilize');
    });

    it('patrol task generates no work effect', () => {
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
          currentTask: 'patrol' as const,
          targetX: 5,
          targetY: 5,
          workProgress: 99,
        })),
      };

      const cells = createTestGrid(10, 10);
      const result = tickEmployeeWork(state, [workingEmployee], cells, 1);

      expect(result.effects).toHaveLength(0);
    });
  });

  describe('work target selection', () => {
    it('worker claims work at current location if no one else claimed', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          targetX: null,
          targetY: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('mow_grass');
      expect(worker.targetX).toBe(5);
      expect(worker.targetY).toBe(5);
      expect(worker.workProgress).toBe(0.01);
    });

    it('finds water task when moisture is critically low', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 1 && y === 0) {
          return createTestCell('fairway', 100, 15, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(1);
      expect(worker.targetY).toBe(0);
    });

    it('finds fertilize task when nutrients are critically low', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 1 && y === 0) {
          return createTestCell('fairway', 100, 100, 15, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(1);
      expect(worker.targetY).toBe(0);
    });

    it('finds rake task for bunker needing attention', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 1 && y === 0) {
          return { ...createTestCell('bunker', 100, 100, 100, 0), lastMowed: 0 };
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1, 1000);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(1);
      expect(worker.targetY).toBe(0);
    });

    it('respects assigned area boundaries', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const area: CourseArea = { id: 'left-side', name: 'Left Side', minX: 0, maxX: 3, minY: 0, maxY: 9 };
      state = addArea(state, area);
      state = assignWorkerToArea(state, employee.id, 'left-side');

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 95);
        }
        if (x === 2 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 70);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(2);
      expect(worker.targetY).toBe(0);
    });
  });

  describe('pathfinding edge cases', () => {
    it('handles unreachable target gracefully', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 2 && y === 0) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        if (x === 3 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0]).toBeDefined();
    });

    it('worker stays idle when all cells are well maintained', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(10, 10, () =>
        createTestCell('fairway', 100, 100, 100, 0)
      );

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
    });

    it('finds path through complex grid with multiple routes', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(5, 5, (x, y) => {
        if (x === 1 && y === 0) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        if (x === 2 && y === 2) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(2);
      expect(worker.targetY).toBe(2);
      expect(worker.path.length).toBeGreaterThan(0);
    });

    it('returns empty path when destination is completely blocked', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(5, 5, (x, y) => {
        if (x === 4 && y === 4) {
          return createTestCell('fairway', 100, 100, 100, 99);
        }
        if ((x === 3 && y >= 3) || (y === 3 && x >= 3)) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0]).toBeDefined();
      expect(result.state.workers[0].currentTask).toBe('idle');
    });

    it('finds path around obstacles requiring exploration of alternate routes', () => {
      let state = createInitialWorkSystemState(0, 2);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(6, 6, (x, y) => {
        if (x === 5 && y === 2) {
          return createTestCell('fairway', 100, 100, 100, 95);
        }
        if ((x === 1 && y === 1) || (x === 1 && y === 2) || (x === 1 && y === 3)) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        if ((x === 3 && y === 1) || (x === 3 && y === 2) || (x === 3 && y === 3)) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(5);
      expect(worker.targetY).toBe(2);
      expect(worker.path.length).toBeGreaterThan(0);
    });

    it('handles path with dead ends requiring backtracking', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(5, 5, (x, y) => {
        if (x === 2 && y === 4) {
          return createTestCell('fairway', 100, 100, 100, 95);
        }
        if (x === 1 && y >= 0 && y <= 3) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        if (x === 3 && y >= 1 && y <= 4) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0]).toBeDefined();
    });

    it('explores converging paths triggering A* node update', () => {
      let state = createInitialWorkSystemState(2, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(5, 4, (x, y) => {
        if (x === 2 && y === 3) {
          return createTestCell('fairway', 100, 100, 100, 95);
        }
        if (x === 2 && y === 1) {
          return createTestCell('water', 100, 100, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.targetX).toBe(2);
      expect(worker.targetY).toBe(3);
    });
  });

  describe('task need thresholds', () => {
    it('detects standard fertilize need when nutrients between critical and standard', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          targetX: null,
          targetY: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 100, 25, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('fertilize_area');
    });

    it('detects standard water need when moisture between critical and standard', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          targetX: null,
          targetY: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 35, 100, 0);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('water_area');
    });

    it('detects standard mow need when height between standard and critical', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          targetX: null,
          targetY: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('fairway', 100, 100, 100, 65);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('mow_grass');
    });

    it('bunker is not raked if recently raked', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const cells = createTestGrid(3, 3, (x, y) => {
        if (x === 1 && y === 0) {
          return { ...createTestCell('bunker', 100, 100, 100, 0), lastMowed: 100 };
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1, 110);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
    });

    it('ignores non-grass terrain types for mowing', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          gridX: 5,
          gridY: 5,
        })),
      };

      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 5 && y === 5) {
          return createTestCell('bunker', 100, 100, 100, 90);
        }
        return createTestCell('bunker', 100, 100, 100, 0);
      });

      const result = tickEmployeeWork(state, [workingEmployee], cells, 0.1);
      expect(result.state.workers[0].currentTask).not.toBe('mow_grass');
    });
  });

  describe('findPath', () => {
    it('returns empty array for empty grid', () => {
      const result = findPath([], 0, 0, 5, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when grid has empty first row', () => {
      const result = findPath([[]], 0, 0, 5, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when start equals end', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, 5, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when end is out of bounds (negative x)', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, -1, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when end is out of bounds (x >= width)', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, 10, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when end is out of bounds (negative y)', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, 5, -1);
      expect(result).toEqual([]);
    });

    it('returns empty array when end is out of bounds (y >= height)', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, 5, 10);
      expect(result).toEqual([]);
    });

    it('finds path between adjacent cells', () => {
      const cells = createTestGrid(10, 10);
      const result = findPath(cells, 5, 5, 6, 5);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ x: 6, y: 5 });
    });
  });

  describe('findBestWorkTarget', () => {
    it('ignores targets beyond maxDistance', () => {
      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 9 && y === 9) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = findBestWorkTarget(
        cells,
        0, 0,
        'groundskeeper',
        null,
        new Set(),
        0,
        5
      );

      expect(result).toBeNull();
    });

    it('finds target within maxDistance', () => {
      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 3 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const result = findBestWorkTarget(
        cells,
        0, 0,
        'groundskeeper',
        null,
        new Set(),
        0,
        5
      );

      expect(result).not.toBeNull();
      expect(result?.gridX).toBe(3);
      expect(result?.gridY).toBe(0);
    });

    it('skips claimed targets', () => {
      const cells = createTestGrid(10, 10, (x, y) => {
        if (x === 1 && y === 0) {
          return createTestCell('fairway', 100, 100, 100, 90);
        }
        return createTestCell('fairway', 100, 100, 100, 0);
      });

      const claimed = new Set(['1,0']);
      const result = findBestWorkTarget(
        cells,
        0, 0,
        'groundskeeper',
        null,
        claimed,
        0,
        100
      );

      expect(result).toBeNull();
    });
  });
});
