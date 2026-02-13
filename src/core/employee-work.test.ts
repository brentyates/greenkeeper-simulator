import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialWorkSystemState,
  addWorker,
  removeWorker,
  assignWorkerToArea,
  addArea,
  getWorkerState,
  findBestWorkTarget,
  tickEmployeeWork,
  syncWorkersWithRoster,
  getActiveWorkerCount,
  getWorkerPositions,
  EMPLOYEE_MOVE_SPEED,
  TASK_DURATIONS,
  WORK_THRESHOLDS,
  CourseArea,
} from './employee-work';
import { createEmployeeEntity } from './movable-entity';
import { createEmployee, resetEmployeeCounter } from './employees';
import { TERRAIN_CODES } from './terrain';
import type { TerrainSystem, FaceStateSample, WorkCandidate } from '../babylon/systems/TerrainSystemInterface';

function createMockTerrainSystem(opts?: {
  sampleAt?: Map<string, FaceStateSample>;
  walkable?: boolean;
}): TerrainSystem {
  const walkable = opts?.walkable ?? true;
  const sampleAt = opts?.sampleAt ?? new Map<string, FaceStateSample>();

  const defaultSample: FaceStateSample = {
    avgMoisture: 100,
    avgNutrients: 100,
    avgGrassHeight: 0,
    avgHealth: 100,
    dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
    faceCount: 4,
  };

  return {
    sampleFaceStatesInRadius(worldX: number, worldZ: number, _radius: number): FaceStateSample {
      const key = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
      return sampleAt.get(key) ?? defaultSample;
    },
    isPositionWalkable(_worldX: number, _worldZ: number): boolean {
      return walkable;
    },
    getFacesInBrush(_worldX: number, _worldZ: number, _radius: number): number[] {
      return [0, 1, 2, 3];
    },
    applyWorkEffect(): number[] {
      return [0, 1];
    },
    findWorkCandidates(centerX: number, centerZ: number, maxRadius: number, _cellSize?: number): WorkCandidate[] {
      const candidates: WorkCandidate[] = [];
      for (const [key, sample] of sampleAt) {
        const [gx, gz] = key.split(',').map(Number);
        if (Math.abs(gx - centerX) <= maxRadius && Math.abs(gz - centerZ) <= maxRadius) {
          candidates.push({ ...sample, worldX: gx + 0.5, worldZ: gz + 0.5 });
        }
      }
      return candidates;
    },
    // Stubs for remaining interface methods
    build() {},
    dispose() {},
    update() {},
    getFaceState() { return undefined; },
    getAllFaceStates() { return new Map(); },
    restoreFaceStates() {},
    setAllFaceStates() {},
    getWorldDimensions() { return { width: 100, height: 100 }; },
    getElevationAt() { return 0; },
    setElevationAt() {},
    getTerrainTypeAt() { return 'fairway'; },
    setTerrainTypeAt() {},
    mowAt() { return false; },
    rakeAt() { return false; },
    waterArea() { return 0; },
    fertilizeArea() { return 0; },
    cycleOverlayMode() { return 'normal' as any; },
    getOverlayMode() { return 'normal' as any; },
    setOverlayMode() {},
    getCourseStats() { return { health: 100, moisture: 100, nutrients: 100, height: 0 }; },
    findFaceAtPosition() { return null; },
    getTerrainSpeedAt() { return 1; },
  } as TerrainSystem;
}

function createSampleWithWork(type: 'mow' | 'water' | 'fertilize' | 'bunker'): FaceStateSample {
  switch (type) {
    case 'mow':
      return {
        avgMoisture: 50, avgNutrients: 50, avgGrassHeight: 90,
        avgHealth: 70, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, faceCount: 4,
      };
    case 'water':
      return {
        avgMoisture: 15, avgNutrients: 50, avgGrassHeight: 30,
        avgHealth: 60, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, faceCount: 4,
      };
    case 'fertilize':
      return {
        avgMoisture: 50, avgNutrients: 15, avgGrassHeight: 30,
        avgHealth: 60, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, faceCount: 4,
      };
    case 'bunker':
      return {
        avgMoisture: 20, avgNutrients: 0, avgGrassHeight: 0,
        avgHealth: 50, dominantTerrainCode: TERRAIN_CODES.BUNKER, faceCount: 4,
      };
  }
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
      expect(newState.workers[0].worldX).toBe(5);
      expect(newState.workers[0].worldZ).toBe(5);
    });

    it('initializes worker as idle', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const newState = addWorker(state, employee);

      expect(newState.workers[0].currentTask).toBe('idle');
      expect(newState.workers[0].targetX).toBeNull();
      expect(newState.workers[0].targetZ).toBeNull();
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

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('0,0', createSampleWithWork('mow'));

      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });
      const result = tickEmployeeWork(workState, [workingEmployee], terrain, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).not.toBe('idle');
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 90,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('mow');
      expect(result.effects[0].radius).toBe(1.0);
      expect(result.tasksCompleted).toBe(1);
    });

    it('tracks task completions with world coordinates', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'expert', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 5.5,
          worldZ: 5.5,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5.5,
          targetZ: 5.5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.completions.length).toBe(1);
      expect(result.completions[0].employeeId).toBe(employee.id);
      expect(result.completions[0].task).toBe('mow_grass');
      expect(result.completions[0].worldX).toBe(5.5);
      expect(result.completions[0].worldZ).toBe(5.5);
    });

    it('ignores non-working employees', () => {
      const state = createInitialWorkSystemState();
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const onBreakEmployee = { ...employee, status: 'on_break' as const };
      const workState = addWorker(state, onBreakEmployee);

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('0,0', createSampleWithWork('mow'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });
      const result = tickEmployeeWork(workState, [onBreakEmployee], terrain, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
    });

    it('resets to idle when task has zero duration', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          workProgress: 50,
          targetX: 5,
          targetZ: 5,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
      expect(worker.workProgress).toBe(0);
      expect(worker.targetX).toBeNull();
      expect(worker.targetZ).toBeNull();
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 20,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.workProgress).toBeGreaterThan(20);
      expect(worker.workProgress).toBeLessThan(100);
      expect(result.tasksCompleted).toBe(0);
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'patrol' as const,
          targetX: null,
          targetZ: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
      expect(worker.path).toHaveLength(0);
    });

    it('clears blocked patrol paths so workers can recover and retarget', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 0,
          worldZ: 0,
          gridX: 0,
          gridY: 0,
          currentTask: 'patrol' as const,
          targetX: 5,
          targetZ: 0,
          path: [{ x: 5, y: 0 }],
          moveProgress: 0.5,
          workProgress: 0,
        })),
      };

      const terrain = createMockTerrainSystem();
      const blockedTerrain: TerrainSystem = {
        ...terrain,
        isPositionWalkable: () => false,
      };
      const result = tickEmployeeWork(state, [workingEmployee], blockedTerrain, 1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
      expect(worker.path).toHaveLength(0);
      expect(worker.targetX).toBeNull();
      expect(worker.targetZ).toBeNull();
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

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('5,5', createSampleWithWork('mow'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });
      const result = tickEmployeeWork(state, [workingMechanic], terrain, 1);

      expect(result.state.workers[0].currentTask).toBe('idle');
    });

    it('handles employee not found in roster', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      state = addWorker(state, employee);

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [], terrain, 1);

      expect(result.state.workers[0].currentTask).toBe('idle');
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'rake_bunker' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('rake');
      expect(result.effects[0].radius).toBe(1.5);
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'water_area' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('water');
      expect(result.effects[0].radius).toBe(2.0);
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'fertilize_area' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('fertilize');
      expect(result.effects[0].radius).toBe(2.0);
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
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'patrol' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects).toHaveLength(0);
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
    it('returns all worker positions with world coordinates', () => {
      let state = createInitialWorkSystemState(10, 20);
      const emp = createEmployee('groundskeeper', 'novice', 0);
      state = addWorker(state, emp);

      const positions = getWorkerPositions(state);

      expect(positions).toHaveLength(1);
      expect(positions[0].worldX).toBe(10);
      expect(positions[0].worldZ).toBe(20);
      expect(positions[0].gridX).toBe(10);
      expect(positions[0].gridY).toBe(20);
      expect(positions[0].task).toBe('idle');
      expect(positions[0].isMoving).toBe(false);
    });

    it('reports isMoving when worker has a path', () => {
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
      expect(positions[0].isMoving).toBe(true);
    });
  });

  describe('work target selection', () => {
    it('worker claims work at current location', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'idle' as const,
          targetX: null,
          targetZ: null,
          path: [],
          moveProgress: 0,
          workProgress: 0,
        })),
      };

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('5,5', createSampleWithWork('mow'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('mow_grass');
      expect(worker.workProgress).toBe(0.01);
    });

    it('finds water task when moisture is critically low', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('0,0', createSampleWithWork('water'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('water_area');
    });

    it('finds fertilize task when nutrients are critically low', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('0,0', createSampleWithWork('fertilize'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('fertilize_area');
    });

    it('finds rake task for bunker needing attention', () => {
      let state = createInitialWorkSystemState(0, 0);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('0,0', createSampleWithWork('bunker'));
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1, 1000);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('rake_bunker');
    });

    it('worker stays idle when all areas are well maintained', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'novice', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 0.1);

      const worker = result.state.workers[0];
      expect(worker.currentTask).toBe('idle');
    });

    it('prefers nearby work over slightly higher-need distant work', () => {
      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('11,10', {
        avgMoisture: 100,
        avgNutrients: 100,
        avgGrassHeight: 82,
        avgHealth: 70,
        dominantTerrainCode: TERRAIN_CODES.ROUGH,
        faceCount: 4,
      });
      sampleMap.set('40,10', {
        avgMoisture: 100,
        avgNutrients: 100,
        avgGrassHeight: 85,
        avgHealth: 68,
        dominantTerrainCode: TERRAIN_CODES.ROUGH,
        faceCount: 4,
      });
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const target = findBestWorkTarget(
        terrain,
        10,
        10,
        'groundskeeper',
        null,
        new Set<string>(),
        0,
        100
      );

      expect(target).not.toBeNull();
      expect(target?.task).toBe('mow_grass');
      expect(target?.worldX).toBe(11.5);
      expect(target?.worldZ).toBe(10.5);
    });

    it('still chooses extremely neglected distant bunker work', () => {
      const sampleMap = new Map<string, FaceStateSample>();
      sampleMap.set('11,10', {
        avgMoisture: 20,
        avgNutrients: 0,
        avgGrassHeight: 0,
        avgHealth: 40,
        dominantTerrainCode: TERRAIN_CODES.BUNKER,
        faceCount: 4,
      });
      sampleMap.set('40,10', {
        avgMoisture: 20,
        avgNutrients: 0,
        avgGrassHeight: 0,
        avgHealth: 2,
        dominantTerrainCode: TERRAIN_CODES.BUNKER,
        faceCount: 4,
      });
      const terrain = createMockTerrainSystem({ sampleAt: sampleMap });

      const target = findBestWorkTarget(
        terrain,
        10,
        10,
        'groundskeeper',
        null,
        new Set<string>(),
        0,
        100
      );

      expect(target).not.toBeNull();
      expect(target?.task).toBe('rake_bunker');
      expect(target?.worldX).toBe(40.5);
      expect(target?.worldZ).toBe(10.5);
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

  describe('work effects include radius', () => {
    it('mow effect has radius 1.0', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'expert', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'mow_grass' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects[0].radius).toBe(1.0);
      expect(result.effects[0].worldX).toBe(5);
      expect(result.effects[0].worldZ).toBe(5);
    });

    it('water effect has radius 2.0', () => {
      let state = createInitialWorkSystemState(5, 5);
      const employee = createEmployee('groundskeeper', 'expert', 0);
      const workingEmployee = { ...employee, status: 'working' as const };
      state = addWorker(state, workingEmployee);

      state = {
        ...state,
        workers: state.workers.map(w => ({
          ...w,
          worldX: 5,
          worldZ: 5,
          gridX: 5,
          gridY: 5,
          currentTask: 'water_area' as const,
          targetX: 5,
          targetZ: 5,
          workProgress: 99,
        })),
      };

      const terrain = createMockTerrainSystem();
      const result = tickEmployeeWork(state, [workingEmployee], terrain, 1);

      expect(result.effects[0].radius).toBe(2.0);
    });
  });
});
