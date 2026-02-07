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

      state = purchaseRobot(state, 'robot_mower_1', mowerStats)!.state;
      state = purchaseRobot(state, 'robot_mower_2', mowerStats)!.state;
      state = purchaseRobot(state, 'robot_sprayer', sprayerStats)!.state;

      expect(countRobotsByType(state, 'mower')).toBe(2);
      expect(countRobotsByType(state, 'sprayer')).toBe(1);
      expect(countRobotsByType(state, 'spreader')).toBe(0);
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
      expect(result.effects).toHaveLength(0);
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

      expect(result.state.robots[0].state).toBe('idle');
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
