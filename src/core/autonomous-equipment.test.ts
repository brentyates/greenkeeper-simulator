import { describe, it, expect } from 'vitest';
import {
  createInitialAutonomousState,
  purchaseRobot,
  sellRobot,
  countRobotsByType,
  countWorkingRobots,
  countBrokenRobots,
  tickAutonomousEquipment,
  getRobotTypeFromEquipmentId,
  getAvailableRobotsToPurchase,
  getRobotStatus,
  AutonomousEquipmentState,
  RobotUnit,
} from './autonomous-equipment';
import { EquipmentStats, createInitialResearchState, ResearchState } from './research';
import { WorkCandidate } from '../babylon/systems/TerrainSystemInterface';
import { TERRAIN_CODES } from './terrain';

function createMockRobotStats(overrides: Partial<EquipmentStats> = {}): EquipmentStats {
  return {
    efficiency: 2.5,
    speed: 1.5,
    fuelCapacity: 300,
    fuelEfficiency: 0.5,
    durability: 400,
    isAutonomous: true,
    purchaseCost: 45000,
    operatingCostPerHour: 2.50,
    breakdownRate: 0.02,
    repairTime: 60,
    ...overrides,
  };
}

function createMockCandidate(overrides: Partial<WorkCandidate> = {}): WorkCandidate {
  return {
    worldX: 5,
    worldZ: 5,
    avgMoisture: 50,
    avgNutrients: 50,
    avgGrassHeight: 0.5,
    avgHealth: 80,
    dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
    faceCount: 4,
    ...overrides,
  };
}

function createMockCandidates(health: number = 80, moisture: number = 50, nutrients: number = 50): WorkCandidate[] {
  const candidates: WorkCandidate[] = [];
  for (let z = 0; z < 10; z++) {
    for (let x = 0; x < 10; x++) {
      candidates.push(createMockCandidate({
        worldX: x,
        worldZ: z,
        avgHealth: health,
        avgMoisture: moisture,
        avgNutrients: nutrients,
      }));
    }
  }
  return candidates;
}

describe('autonomous-equipment', () => {
  describe('createInitialAutonomousState', () => {
    it('creates empty state with default charging station', () => {
      const state = createInitialAutonomousState();
      expect(state.robots).toHaveLength(0);
      expect(state.chargingStationX).toBe(0);
      expect(state.chargingStationY).toBe(0);
    });

    it('creates state with custom charging station location', () => {
      const state = createInitialAutonomousState(10, 15);
      expect(state.chargingStationX).toBe(10);
      expect(state.chargingStationY).toBe(15);
    });
  });

  describe('getRobotTypeFromEquipmentId', () => {
    it('returns mower for mower equipment', () => {
      expect(getRobotTypeFromEquipmentId('robot_mower_fairway')).toBe('mower');
      expect(getRobotTypeFromEquipmentId('robot_mower_greens')).toBe('mower');
    });

    it('returns sprayer for sprayer equipment', () => {
      expect(getRobotTypeFromEquipmentId('robot_sprayer')).toBe('sprayer');
      expect(getRobotTypeFromEquipmentId('robot_sprinkler')).toBe('sprayer');
    });

    it('returns spreader for fertilizer equipment', () => {
      expect(getRobotTypeFromEquipmentId('robot_fertilizer')).toBe('spreader');
      expect(getRobotTypeFromEquipmentId('robot_spreader')).toBe('spreader');
    });

    it('returns raker for bunker rake equipment', () => {
      expect(getRobotTypeFromEquipmentId('robot_bunker_rake')).toBe('raker');
    });

    it('defaults to mower for unknown equipment', () => {
      expect(getRobotTypeFromEquipmentId('unknown')).toBe('mower');
    });
  });

  describe('purchaseRobot', () => {
    it('adds robot to state when purchasing', () => {
      const state = createInitialAutonomousState(5, 5);
      const stats = createMockRobotStats();

      const result = purchaseRobot(state, 'robot_mower_fairway', stats);

      expect(result).not.toBeNull();
      expect(result!.state.robots).toHaveLength(1);
      expect(result!.cost).toBe(45000);
    });

    it('places robot at charging station', () => {
      const state = createInitialAutonomousState(10, 15);
      const stats = createMockRobotStats();

      const result = purchaseRobot(state, 'robot_mower_fairway', stats);

      expect(result!.state.robots[0].worldX).toBe(10);
      expect(result!.state.robots[0].worldZ).toBe(15);
    });

    it('initializes robot with full resources', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats({ fuelCapacity: 500 });

      const result = purchaseRobot(state, 'robot_mower_fairway', stats);

      expect(result!.state.robots[0].resourceCurrent).toBe(500);
      expect(result!.state.robots[0].resourceMax).toBe(500);
    });

    it('initializes robot as idle', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats();

      const result = purchaseRobot(state, 'robot_mower_fairway', stats);

      expect(result!.state.robots[0].state).toBe('idle');
    });

    it('assigns correct robot type', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats();

      const mowerResult = purchaseRobot(state, 'robot_mower_fairway', stats);
      expect(mowerResult!.state.robots[0].type).toBe('mower');

      const sprayerResult = purchaseRobot(state, 'robot_sprayer', stats);
      expect(sprayerResult!.state.robots[0].type).toBe('sprayer');

      const rakerResult = purchaseRobot(state, 'robot_bunker_rake', stats);
      expect(rakerResult!.state.robots[0].type).toBe('raker');
    });

    it('returns null for non-autonomous equipment', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats({ isAutonomous: false });

      const result = purchaseRobot(state, 'regular_mower', stats);

      expect(result).toBeNull();
    });

    it('returns null for equipment without purchase cost', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats({ purchaseCost: undefined });

      const result = purchaseRobot(state, 'robot_mower', stats);

      expect(result).toBeNull();
    });

    it('generates unique IDs for multiple robots of same type', () => {
      let state = createInitialAutonomousState();
      const stats = createMockRobotStats();

      const result1 = purchaseRobot(state, 'robot_mower_fairway', stats);
      state = result1!.state;

      const result2 = purchaseRobot(state, 'robot_mower_fairway', stats);

      expect(result2!.state.robots[0].id).toBe('robot_mower_fairway_1');
      expect(result2!.state.robots[1].id).toBe('robot_mower_fairway_2');
    });
  });

  describe('sellRobot', () => {
    it('removes robot from state', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats();
      const { state: stateWithRobot } = purchaseRobot(state, 'robot_mower', stats)!;

      const result = sellRobot(stateWithRobot, 'robot_mower_1');

      expect(result).not.toBeNull();
      expect(result!.state.robots).toHaveLength(0);
    });

    it('returns 50% refund', () => {
      const state = createInitialAutonomousState();
      const stats = createMockRobotStats({ purchaseCost: 40000 });
      const { state: stateWithRobot } = purchaseRobot(state, 'robot_mower', stats)!;

      const result = sellRobot(stateWithRobot, 'robot_mower_1');

      expect(result!.refund).toBe(20000);
    });

    it('returns null for non-existent robot', () => {
      const state = createInitialAutonomousState();

      const result = sellRobot(state, 'nonexistent_robot');

      expect(result).toBeNull();
    });

    it('returns 0 refund when purchaseCost is undefined', () => {
      const stats = createMockRobotStats();
      delete (stats as any).purchaseCost;

      const robot: RobotUnit = {
        id: 'robot_test_1',
        equipmentId: 'robot_test',
        type: 'mower',
        stats,
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 100,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const result = sellRobot(state, 'robot_test_1');

      expect(result).not.toBeNull();
      expect(result!.refund).toBe(0);
    });
  });

  describe('counting functions', () => {
    it('countRobotsByType counts correctly', () => {
      let state = createInitialAutonomousState();
      const mowerStats = createMockRobotStats();
      const sprayerStats = createMockRobotStats();
      const rakerStats = createMockRobotStats();

      state = purchaseRobot(state, 'robot_mower_1', mowerStats)!.state;
      state = purchaseRobot(state, 'robot_mower_2', mowerStats)!.state;
      state = purchaseRobot(state, 'robot_sprayer', sprayerStats)!.state;
      state = purchaseRobot(state, 'robot_bunker_rake', rakerStats)!.state;

      expect(countRobotsByType(state, 'mower')).toBe(2);
      expect(countRobotsByType(state, 'sprayer')).toBe(1);
      expect(countRobotsByType(state, 'spreader')).toBe(0);
      expect(countRobotsByType(state, 'raker')).toBe(1);
    });

    it('countWorkingRobots counts working and moving robots', () => {
      const robot1: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats(),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 100,
        resourceMax: 300,
        state: 'working',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };
      const robot2: RobotUnit = { ...robot1, id: 'r2', state: 'moving' };
      const robot3: RobotUnit = { ...robot1, id: 'r3', state: 'idle' };

      const state: AutonomousEquipmentState = {
        robots: [robot1, robot2, robot3],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      expect(countWorkingRobots(state)).toBe(2);
    });

    it('countBrokenRobots counts broken robots', () => {
      const robot1: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats(),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 100,
        resourceMax: 300,
        state: 'broken',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 30,
      };
      const robot2: RobotUnit = { ...robot1, id: 'r2', state: 'working' };

      const state: AutonomousEquipmentState = {
        robots: [robot1, robot2],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      expect(countBrokenRobots(state)).toBe(1);
    });
  });

  describe('getRobotStatus', () => {
    it('returns status breakdown', () => {
      const makeRobot = (id: string, state: RobotUnit['state']): RobotUnit => ({
        id,
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats(),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 100,
        resourceMax: 300,
        state,
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      });

      const state: AutonomousEquipmentState = {
        robots: [
          makeRobot('r1', 'working'),
          makeRobot('r2', 'working'),
          makeRobot('r3', 'idle'),
          makeRobot('r4', 'charging'),
          makeRobot('r5', 'broken'),
        ],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const status = getRobotStatus(state);

      expect(status.total).toBe(5);
      expect(status.working).toBe(2);
      expect(status.idle).toBe(1);
      expect(status.charging).toBe(1);
      expect(status.broken).toBe(1);
    });
  });

  describe('tickAutonomousEquipment', () => {
    it('returns empty effects for empty state', () => {
      const state = createInitialAutonomousState();
      const candidates = createMockCandidates();

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.effects).toHaveLength(0);
      expect(result.operatingCost).toBe(0);
    });

    it('calculates operating costs', () => {
      let state = createInitialAutonomousState();
      const stats = createMockRobotStats({ operatingCostPerHour: 10 });
      state = purchaseRobot(state, 'robot_mower', stats)!.state;

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60);

      expect(result.operatingCost).toBeCloseTo(10, 1);
    });

    it('robot finds work when idle', () => {
      let state = createInitialAutonomousState(5, 5);
      const stats = createMockRobotStats({ breakdownRate: 0 });
      state = purchaseRobot(state, 'robot_mower', stats)!.state;

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 1, false);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).not.toBeNull();
    });

    it('robot stays idle when no work needed', () => {
      let state = createInitialAutonomousState(5, 5);
      const stats = createMockRobotStats({ breakdownRate: 0 });
      state = purchaseRobot(state, 'robot_mower', stats)!.state;

      const candidates = createMockCandidates(100);
      const result = tickAutonomousEquipment(state, candidates, 1, false);

      expect(result.state.robots[0].state).toBe('idle');
    });

    it('robot returns to charging station when no work needed and away from station', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 1.5, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 5,
        chargingStationY: 5,
      };

      const candidates = createMockCandidates(100);
      const result = tickAutonomousEquipment(state, candidates, 1, false);
      const updated = result.state.robots[0];
      const startDistance =
        Math.abs(robot.worldX - state.chargingStationX) +
        Math.abs(robot.worldZ - state.chargingStationY);
      const updatedDistance =
        Math.abs(updated.worldX - state.chargingStationX) +
        Math.abs(updated.worldZ - state.chargingStationY);

      expect(updated.state).toBe('moving');
      expect(updated.targetX).toBeNull();
      expect(updated.targetY).toBeNull();
      expect(updatedDistance).toBeLessThan(startDistance);
    });

    it('robot becomes idle after parking at charging station when no work exists', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 2, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 250,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      let state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 5,
        chargingStationY: 5,
      };

      const candidates = createMockCandidates(100);
      for (let i = 0; i < 10; i++) {
        state = tickAutonomousEquipment(state, candidates, 1, false).state;
      }

      const parked = state.robots[0];
      const parkedDistance =
        Math.abs(parked.worldX - state.chargingStationX) +
        Math.abs(parked.worldZ - state.chargingStationY);
      expect(parked.state).toBe('idle');
      expect(parkedDistance).toBeLessThanOrEqual(4);
    });

    it('parks near station when exact charging tile is non-traversable', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ speed: 2.0, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 250,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      let state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 5,
        chargingStationY: 5,
      };

      const candidates = createMockCandidates(100);
      const canTraverse = (_robot: RobotUnit, worldX: number, worldZ: number) => {
        const dx = worldX - 5;
        const dz = worldZ - 5;
        const dist = Math.hypot(dx, dz);
        return dist >= 0.7;
      };

      for (let i = 0; i < 20; i++) {
        state = tickAutonomousEquipment(state, candidates, 1, false, canTraverse).state;
      }

      const parked = state.robots[0];
      const distToStation = Math.hypot(parked.worldX - 5, parked.worldZ - 5);
      expect(parked.state).toBe('idle');
      expect(distToStation).toBeGreaterThanOrEqual(0.7);
      expect(distToStation).toBeLessThanOrEqual(4.1);
    });

    it('robot generates effect when arriving at target', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 100, breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 5,
        targetY: 6,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60);

      expect(result.effects.length).toBeGreaterThan(0);
      expect(result.effects[0].type).toBe('mower');
    });

    it('broken robot repairs over time', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ repairTime: 60 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'broken',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 30,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates();
      const result = tickAutonomousEquipment(state, candidates, 30);

      expect(result.state.robots[0].state).toBe('idle');
      expect(result.state.robots[0].breakdownTimeRemaining).toBe(0);
    });

    it('robot goes to charge when low on resources', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 20,
        resourceMax: 300,
        state: 'working',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(0);
      expect(result.state.robots[0].targetY).toBe(0);
    });

    it('fleet AI reduces breakdown rate', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 1.0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'working',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);

      let breakdownsWithoutAI = 0;
      let breakdownsWithAI = 0;
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const result = tickAutonomousEquipment({ ...state }, candidates, 60, false);
        if (result.state.robots[0].state === 'broken') breakdownsWithoutAI++;
      }

      for (let i = 0; i < trials; i++) {
        const result = tickAutonomousEquipment({ ...state }, candidates, 60, true);
        if (result.state.robots[0].state === 'broken') breakdownsWithAI++;
      }

      expect(breakdownsWithAI).toBeLessThan(breakdownsWithoutAI);
    });

    it('charging robot becomes idle when fully charged', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 250,
        resourceMax: 300,
        state: 'charging',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(100);
      const result = tickAutonomousEquipment(state, candidates, 10);

      expect(result.state.robots[0].state).toBe('idle');
      expect(result.state.robots[0].resourceCurrent).toBeGreaterThanOrEqual(270);
    });

    it('charging robot continues charging when not fully charged', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 50,
        resourceMax: 300,
        state: 'charging',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(100);
      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('charging');
      expect(result.state.robots[0].resourceCurrent).toBe(55);
    });

    it('robot continues moving when not arrived at target', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 1, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 50,
        targetY: 50,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].worldX).toBeGreaterThan(0);
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].type).toBe('mower');
      expect(result.effects[0].equipmentId).toBe('robot_mower');
    });

    it('does not move through blocked terrain from traversal callback', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 2, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 5,
        targetY: 0,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const canTraverse = (_robot: RobotUnit, worldX: number) => worldX < 1;
      const result = tickAutonomousEquipment(state, candidates, 1, false, canTraverse);

      expect(result.state.robots[0].worldX).toBeLessThan(1);
      expect(result.effects.every(effect => effect.worldX < 1)).toBe(true);
    });

    it('detours around a narrow blocked strip instead of idling immediately', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 2, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 4,
        targetY: 0,
        breakdownTimeRemaining: 0,
      };

      let currentState: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const canTraverse = (_robot: RobotUnit, worldX: number, worldZ: number) =>
        !(worldX > 0.8 && worldX < 1.4 && Math.abs(worldZ) < 0.35);

      let sawLateralDetour = false;
      for (let i = 0; i < 4; i++) {
        const result = tickAutonomousEquipment(currentState, candidates, 1, false, canTraverse);
        const updatedRobot = result.state.robots[0];
        if (Math.abs(updatedRobot.worldZ) > 0.2) {
          sawLateralDetour = true;
        }
        currentState = result.state;
      }

      const finalRobot = currentState.robots[0];
      expect(sawLateralDetour).toBe(true);
      expect(finalRobot.state).not.toBe('idle');
      expect(finalRobot.worldX).toBeGreaterThan(0.7);
    });

    it('escapes a non-traversable pocket instead of idling permanently', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ speed: 2, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 4,
        targetY: 0,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const canTraverse = (_robot: RobotUnit, worldX: number, worldZ: number) =>
        Math.abs(worldX) >= 0.56 || Math.abs(worldZ) >= 0.56;

      const result = tickAutonomousEquipment(state, candidates, 1, false, canTraverse);
      const updatedRobot = result.state.robots[0];

      expect(updatedRobot.state).toBe('moving');
      expect(
        Math.max(Math.abs(updatedRobot.worldX), Math.abs(updatedRobot.worldZ))
      ).toBeGreaterThan(0.55);
    });

    it('sprayer robot finds dry areas to water', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_sprayer',
        type: 'sprayer',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(100, 60, 50);
      candidates.push(createMockCandidate({ worldX: 3, worldZ: 3, avgMoisture: 20 }));

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).not.toBeNull();
    });

    it('sprayer robot targets dry hotspots even when bucket average moisture looks healthy', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_sprayer',
        type: 'sprayer',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 8, worldZ: 8, avgMoisture: 58, minMoisture: 20 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).toBe(8);
      expect(result.state.robots[0].targetY).toBe(8);
    });

    it('mower still targets growth hotspots when average grass height is low', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({
          worldX: 2,
          worldZ: 2,
          avgGrassHeight: 0.6,
          maxGrassHeight: 20,
          avgHealth: 100,
        }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).toBe(2);
      expect(result.state.robots[0].targetY).toBe(2);
    });

    it('mower prioritizes longest grass over lower-health grass', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 1, worldZ: 1, avgGrassHeight: 90, avgHealth: 95 }),
        createMockCandidate({ worldX: 2, worldZ: 2, avgGrassHeight: 10, avgHealth: 10 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(1);
      expect(result.state.robots[0].targetY).toBe(1);
    });

    it('mower favors nearby work over slightly worse distant work', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_rough',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 10,
        worldZ: 10,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 11, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.ROUGH, avgGrassHeight: 55, avgHealth: 70 }),
        createMockCandidate({ worldX: 40, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.ROUGH, avgGrassHeight: 62, avgHealth: 68 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(11);
      expect(result.state.robots[0].targetY).toBe(10);
    });

    it('raker still chooses extremely neglected distant bunker work', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_bunker_rake',
        type: 'raker',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 10,
        worldZ: 10,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 11, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.BUNKER, avgHealth: 60 }),
        createMockCandidate({ worldX: 40, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.BUNKER, avgHealth: 2 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(40);
      expect(result.state.robots[0].targetY).toBe(10);
    });

    it('raker favors nearby bunker work over slightly worse distant bunker work', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_bunker_rake',
        type: 'raker',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 10,
        worldZ: 10,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 11, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.BUNKER, avgHealth: 55 }),
        createMockCandidate({ worldX: 40, worldZ: 10, dominantTerrainCode: TERRAIN_CODES.BUNKER, avgHealth: 45 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(11);
      expect(result.state.robots[0].targetY).toBe(10);
    });

    it('skips blocked candidates using traversal callback', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 1, worldZ: 1, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 90, avgHealth: 90 }),
        createMockCandidate({ worldX: 4, worldZ: 0, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 20, avgHealth: 90 }),
      ];

      const canTraverse = (_robot: RobotUnit, worldX: number, worldZ: number) =>
        !(Math.floor(worldX) === 1 && Math.floor(worldZ) === 1 && Math.abs(worldX - 1) < 0.05 && Math.abs(worldZ - 1) < 0.05);

      const result = tickAutonomousEquipment(state, candidates, 1, false, canTraverse);

      expect(result.state.robots[0].targetX).toBe(4);
      expect(result.state.robots[0].targetY).toBe(0);
    });

    it('skips targets with blocked path segments even when endpoint is walkable', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 4, worldZ: 0, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 90, avgHealth: 90 }),
        createMockCandidate({ worldX: 0, worldZ: 4, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 20, avgHealth: 90 }),
      ];

      const canTraverse = (_robot: RobotUnit, worldX: number, worldZ: number) => {
        const blockedBand = worldX > 1.5 && worldX < 2.5 && Math.abs(worldZ) < 1;
        return !blockedBand;
      };

      const result = tickAutonomousEquipment(state, candidates, 1, false, canTraverse);

      expect(result.state.robots[0].targetX).toBe(0);
      expect(result.state.robots[0].targetY).toBe(4);
    });

    it('fairway mower ignores rough and targets fairway', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 2, worldZ: 2, dominantTerrainCode: TERRAIN_CODES.ROUGH, avgGrassHeight: 90, avgHealth: 90 }),
        createMockCandidate({ worldX: 4, worldZ: 4, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 20, avgHealth: 90 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(4);
      expect(result.state.robots[0].targetY).toBe(4);
    });

    it('rough mower can target mixed buckets that include rough terrain', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_rough',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({
          worldX: 3,
          worldZ: 3,
          dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
          terrainCodesPresent: [TERRAIN_CODES.FAIRWAY, TERRAIN_CODES.ROUGH],
          avgGrassHeight: 0.8,
          maxGrassHeight: 16,
          avgHealth: 100,
        }),
        createMockCandidate({
          worldX: 5,
          worldZ: 5,
          dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
          terrainCodesPresent: [TERRAIN_CODES.FAIRWAY],
          avgGrassHeight: 20,
          maxGrassHeight: 20,
          avgHealth: 90,
        }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(3);
      expect(result.state.robots[0].targetY).toBe(3);
    });

    it('greens mower ignores fairway and rough and targets green', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_greens',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 1, worldZ: 1, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 80, avgHealth: 85 }),
        createMockCandidate({ worldX: 2, worldZ: 2, dominantTerrainCode: TERRAIN_CODES.ROUGH, avgGrassHeight: 80, avgHealth: 85 }),
        createMockCandidate({ worldX: 5, worldZ: 5, dominantTerrainCode: TERRAIN_CODES.GREEN, avgGrassHeight: 30, avgHealth: 85 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(5);
      expect(result.state.robots[0].targetY).toBe(5);
    });

    it('rough mower ignores fairway and targets rough', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_rough',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 2, worldZ: 2, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgGrassHeight: 80, avgHealth: 85 }),
        createMockCandidate({ worldX: 6, worldZ: 6, dominantTerrainCode: TERRAIN_CODES.ROUGH, avgGrassHeight: 25, avgHealth: 85 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].targetX).toBe(6);
      expect(result.state.robots[0].targetY).toBe(6);
    });

    it('robots do not claim the same target square', () => {
      const robot1: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };
      const robot2: RobotUnit = {
        ...robot1,
        id: 'r2',
      };

      const state: AutonomousEquipmentState = {
        robots: [robot1, robot2],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 3.2, worldZ: 3.2, avgGrassHeight: 80, avgHealth: 85 }),
        createMockCandidate({ worldX: 4.2, worldZ: 4.2, avgGrassHeight: 70, avgHealth: 80 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);
      const t1 = `${Math.floor(result.state.robots[0].targetX ?? -1)},${Math.floor(result.state.robots[0].targetY ?? -1)}`;
      const t2 = `${Math.floor(result.state.robots[1].targetX ?? -1)},${Math.floor(result.state.robots[1].targetY ?? -1)}`;

      expect(result.state.robots[0].targetX).not.toBeNull();
      expect(result.state.robots[1].targetX).not.toBeNull();
      expect(t1).not.toBe(t2);
    });

    it('reassigns duplicate existing targets so robots stop competing', () => {
      const robot1: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower_fairway',
        type: 'mower',
        stats: createMockRobotStats({ speed: 0, breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'moving',
        targetX: 3.2,
        targetY: 3.2,
        breakdownTimeRemaining: 0,
      };
      const robot2: RobotUnit = {
        ...robot1,
        id: 'r2',
        worldX: 1,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot1, robot2],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 3.2, worldZ: 3.2, avgGrassHeight: 80, avgHealth: 85 }),
        createMockCandidate({ worldX: 4.2, worldZ: 4.2, avgGrassHeight: 70, avgHealth: 80 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);
      const t1 = `${Math.floor(result.state.robots[0].targetX ?? -1)},${Math.floor(result.state.robots[0].targetY ?? -1)}`;
      const t2 = `${Math.floor(result.state.robots[1].targetX ?? -1)},${Math.floor(result.state.robots[1].targetY ?? -1)}`;

      expect(t1).not.toBe(t2);
      expect(t1).toBe('3,3');
      expect(t2).toBe('4,4');
    });

    it('spreader robot finds low nutrient areas', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_fertilizer',
        type: 'spreader',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(100, 50, 60);
      candidates.push(createMockCandidate({ worldX: 3, worldZ: 3, avgNutrients: 20 }));

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).not.toBeNull();
    });

    it('raker robot prioritizes bunker areas needing work', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_bunker_rake',
        type: 'raker',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [
        createMockCandidate({ worldX: 3, worldZ: 3, dominantTerrainCode: TERRAIN_CODES.FAIRWAY, avgHealth: 20 }),
        createMockCandidate({ worldX: 7, worldZ: 8, dominantTerrainCode: TERRAIN_CODES.BUNKER, avgHealth: 70 }),
      ];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).toBe(7);
      expect(result.state.robots[0].targetY).toBe(8);
    });

    it('broken robot continues repairing when time remaining', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ repairTime: 60 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'broken',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 60,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates();
      const result = tickAutonomousEquipment(state, candidates, 10);

      expect(result.state.robots[0].state).toBe('broken');
      expect(result.state.robots[0].breakdownTimeRemaining).toBe(50);
    });

    it('robot arrives at charging station when low on resources', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ speed: 100, breakdownRate: 0 }),
        worldX: 1,
        worldZ: 0,
        resourceCurrent: 10,
        resourceMax: 300,
        state: 'working',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60);

      expect(result.state.robots[0].state).toBe('charging');
      expect(result.state.robots[0].worldX).toBe(0);
      expect(result.state.robots[0].worldZ).toBe(0);
    });

    it('fleetAIActive reduces breakdown rate for working robot', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60, true);

      expect(result.state.robots[0].state).toBe('moving');
    });

    it('handles undefined breakdownRate with fleetAI active', () => {
      const stats = createMockRobotStats();
      delete (stats as any).breakdownRate;

      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats,
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60, true);

      expect(result.state.robots[0].state).not.toBe('broken');
    });

    it('handles undefined repairTime when breakdown occurs', () => {
      const stats = createMockRobotStats({ breakdownRate: 1000 });
      delete (stats as any).repairTime;

      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats,
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);

      let broken = false;
      for (let i = 0; i < 100 && !broken; i++) {
        const result = tickAutonomousEquipment({ ...state, robots: [{ ...robot }] }, candidates, 60, false);
        if (result.state.robots[0].state === 'broken') {
          expect(result.state.robots[0].breakdownTimeRemaining).toBe(60);
          broken = true;
        }
      }
      expect(broken).toBe(true);
    });

    it('handles undefined operatingCostPerHour', () => {
      const stats = createMockRobotStats({ breakdownRate: 0 });
      delete (stats as any).operatingCostPerHour;

      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats,
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60, false);

      expect(result.operatingCost).toBe(0);
    });

    it('handles undefined fuelEfficiency', () => {
      const stats = createMockRobotStats({ breakdownRate: 0 });
      delete (stats as any).fuelEfficiency;

      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats,
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60, false);

      expect(result.state.robots[0].resourceCurrent).toBe(200 - 30);
    });

    it('robot stays idle when candidates are all water terrain', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 0,
        worldZ: 0,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = [createMockCandidate({
        worldX: 6,
        worldZ: 6,
        avgHealth: 20,
        dominantTerrainCode: TERRAIN_CODES.WATER,
      })];

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('idle');
    });

    it('robot skips water candidates when finding work', () => {
      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats: createMockRobotStats({ breakdownRate: 0 }),
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(100);
      candidates.push(createMockCandidate({
        worldX: 6, worldZ: 6, avgHealth: 20,
        dominantTerrainCode: TERRAIN_CODES.WATER,
      }));

      const result = tickAutonomousEquipment(state, candidates, 1);

      expect(result.state.robots[0].state).toBe('moving');
      expect(result.state.robots[0].targetX).toBeNull();
      expect(result.state.robots[0].targetY).toBeNull();
      expect(result.state.robots[0].worldX).toBeLessThan(robot.worldX);
      expect(result.state.robots[0].worldZ).toBeLessThan(robot.worldZ);
    });

    it('handles undefined breakdownRate without fleetAI', () => {
      const stats = createMockRobotStats();
      delete (stats as any).breakdownRate;

      const robot: RobotUnit = {
        id: 'r1',
        equipmentId: 'robot_mower',
        type: 'mower',
        stats,
        worldX: 5,
        worldZ: 5,
        resourceCurrent: 200,
        resourceMax: 300,
        state: 'idle',
        targetX: null,
        targetY: null,
        breakdownTimeRemaining: 0,
      };

      const state: AutonomousEquipmentState = {
        robots: [robot],
        chargingStationX: 0,
        chargingStationY: 0,
      };

      const candidates = createMockCandidates(50);
      const result = tickAutonomousEquipment(state, candidates, 60, false);

      expect(result.state.robots[0].state).not.toBe('broken');
    });
  });

  describe('getAvailableRobotsToPurchase', () => {
    it('returns empty for no research', () => {
      const researchState = createInitialResearchState();
      const autoState = createInitialAutonomousState();

      const available = getAvailableRobotsToPurchase(researchState, autoState);

      expect(available).toHaveLength(0);
    });

    it('returns unlocked autonomous equipment', () => {
      const researchState: ResearchState = {
        ...createInitialResearchState(),
        completedResearch: ['basic_push_mower', 'robot_mower_fairway'],
      };
      const autoState = createInitialAutonomousState();

      const available = getAvailableRobotsToPurchase(researchState, autoState);

      expect(available.length).toBeGreaterThan(0);
      expect(available.some(a => a.equipmentId === 'robot_mower_fairway')).toBe(true);
    });

    it('includes owned count', () => {
      const researchState: ResearchState = {
        ...createInitialResearchState(),
        completedResearch: ['basic_push_mower', 'robot_mower_fairway'],
      };
      let autoState = createInitialAutonomousState();

      const stats = createMockRobotStats();
      autoState = purchaseRobot(autoState, 'robot_mower_fairway', stats)!.state;
      autoState = purchaseRobot(autoState, 'robot_mower_fairway', stats)!.state;

      const available = getAvailableRobotsToPurchase(researchState, autoState);
      const mower = available.find(a => a.equipmentId === 'robot_mower_fairway');

      expect(mower?.ownedCount).toBe(2);
    });
  });
});
