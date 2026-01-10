/**
 * Unit tests for irrigation system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInitialIrrigationSystem,
  addPipe,
  removePipe,
  addSprinklerHead,
  removeSprinklerHead,
  updatePipePressures,
  checkForLeaks,
  repairLeak,
  calculateWaterUsage,
  calculateWaterCost,
  calculateLeakChance,
  getSprinklerCoveragePattern,
  getPipeAt,
  getSprinklerHeadAt,
  getWaterSourceAt,
  setSprinklerActive,
  updateSprinklerSchedule,
  resetCounters,
  addWaterSource,
  createWaterSource,
  createPipeTile,
  updatePipeConnections,
  WateringSchedule,
} from './irrigation';

describe('irrigation system', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('pipe management', () => {
    it('should create initial system', () => {
      const system = createInitialIrrigationSystem();
      expect(system.pipes.length).toBe(0);
      expect(system.sprinklerHeads.length).toBe(0);
      expect(system.waterSources.length).toBe(0);
    });

    it('should add pipe', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      
      expect(system.pipes.length).toBe(1);
      const pipe = system.pipes[0];
      expect(pipe.gridX).toBe(10);
      expect(pipe.gridY).toBe(10);
      expect(pipe.pipeType).toBe('pvc');
    });

    it('should remove pipe', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      system = removePipe(system, 10, 10);
      
      expect(system.pipes.length).toBe(0);
    });

    it('should get pipe at position', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe).not.toBeNull();
      expect(pipe?.pipeType).toBe('pvc');
    });

    it('should return null for non-existent pipe', () => {
      const system = createInitialIrrigationSystem();
      const pipe = getPipeAt(system, 99, 99);
      expect(pipe).toBeNull();
    });
  });

  describe('sprinkler head management', () => {
    it('should add sprinkler head', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      
      expect(system.sprinklerHeads.length).toBe(1);
      const head = system.sprinklerHeads[0];
      expect(head.gridX).toBe(10);
      expect(head.gridY).toBe(10);
      expect(head.sprinklerType).toBe('fixed');
    });

    it('should remove sprinkler head', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      const head = system.sprinklerHeads[0];
      system = removeSprinklerHead(system, head.id);
      
      expect(system.sprinklerHeads.length).toBe(0);
    });

    it('should get sprinkler head at position', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);

      const head = getSprinklerHeadAt(system, 10, 10);
      expect(head).not.toBeNull();
      expect(head?.sprinklerType).toBe('fixed');
    });

    it('should return null for non-existent sprinkler head', () => {
      const system = createInitialIrrigationSystem();
      const head = getSprinklerHeadAt(system, 99, 99);
      expect(head).toBeNull();
    });
  });

  describe('coverage patterns', () => {
    it('should generate fixed spray coverage', () => {
      const coverage = getSprinklerCoveragePattern(10, 10, 'fixed', 100);
      expect(coverage.length).toBe(9);

      const center = coverage.find(t => t.x === 10 && t.y === 10);
      expect(center).toBeDefined();
      expect(center?.efficiency).toBe(1.0);
    });

    it('should generate rotary coverage', () => {
      const coverage = getSprinklerCoveragePattern(10, 10, 'rotary', 100);
      expect(coverage.length).toBeGreaterThan(9);

      const center = coverage.find(t => t.x === 10 && t.y === 10);
      expect(center).toBeDefined();
    });

    it('should generate impact coverage with reduced efficiency at edges', () => {
      const coverage = getSprinklerCoveragePattern(10, 10, 'impact', 100);
      expect(coverage.length).toBeGreaterThan(20);

      const edgeTile = coverage.find(t => {
        const distance = Math.sqrt(Math.pow(t.x - 10, 2) + Math.pow(t.y - 10, 2));
        return distance > 2.5 && distance <= 3;
      });
      expect(edgeTile).toBeDefined();
      expect(edgeTile?.efficiency).toBe(0.6);
    });

    it('should generate impact coverage with full efficiency for inner tiles', () => {
      const coverage = getSprinklerCoveragePattern(10, 10, 'impact', 100);

      const innerTile = coverage.find(t => {
        const distance = Math.sqrt(Math.pow(t.x - 10, 2) + Math.pow(t.y - 10, 2));
        return distance > 0 && distance <= 2.5;
      });
      expect(innerTile).toBeDefined();
      expect(innerTile?.efficiency).toBe(1.0);
    });

    it('should generate precision coverage', () => {
      const coverage = getSprinklerCoveragePattern(10, 10, 'precision', 100);
      expect(coverage.length).toBe(25);

      coverage.forEach(tile => {
        expect(tile.x).toBe(10);
        expect(tile.y).toBe(10);
        expect(tile.efficiency).toBe(1.0);
      });
    });

    it('should reduce coverage with low pressure', () => {
      const fullCoverage = getSprinklerCoveragePattern(10, 10, 'fixed', 100);
      const lowCoverage = getSprinklerCoveragePattern(10, 10, 'fixed', 50);

      expect(fullCoverage[0].efficiency).toBeGreaterThan(lowCoverage[0].efficiency);
    });
  });

  describe('pressure calculation', () => {
    it('should calculate pressure with water source', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 5, 5);
      system = addPipe(system, 5, 5, 'pvc', 0);
      system = addPipe(system, 6, 5, 'pvc', 0);
      system = addPipe(system, 7, 5, 'pvc', 0);

      system = updatePipePressures(system);

      const pipe1 = getPipeAt(system, 5, 5);
      const pipe2 = getPipeAt(system, 7, 5);

      expect(pipe1?.pressureLevel).toBeGreaterThan(0);
      expect(pipe2?.pressureLevel).toBeGreaterThan(0);
      if (pipe1 && pipe2) {
        expect(pipe1.pressureLevel).toBeGreaterThan(pipe2.pressureLevel);
      }
    });

    it('should have zero pressure without water source', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      system = updatePipePressures(system);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe?.pressureLevel).toBe(0);
    });

    it('should reduce pressure for leaking pipes', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 5, 5);
      system = addPipe(system, 5, 5, 'pvc', 0);
      system = addPipe(system, 6, 5, 'pvc', 0);

      system = updatePipePressures(system);
      const normalPressure = getPipeAt(system, 6, 5)?.pressureLevel ?? 0;

      const leakyPipe = { ...system.pipes[1], isLeaking: true };
      system = { ...system, pipes: [system.pipes[0], leakyPipe] };
      system = updatePipePressures(system);

      const leakPressure = getPipeAt(system, 6, 5)?.pressureLevel ?? 0;
      expect(leakPressure).toBeLessThan(normalPressure);
      expect(leakPressure).toBe(normalPressure * 0.5);
    });

    it('should have zero pressure for disconnected pipe', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 0, 0);
      system = addPipe(system, 0, 0, 'pvc', 0);
      system = addPipe(system, 10, 10, 'pvc', 0);

      system = updatePipePressures(system);

      const disconnectedPipe = getPipeAt(system, 10, 10);
      expect(disconnectedPipe?.pressureLevel).toBe(0);
    });

    it('should connect pipes in all directions', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 5, 5);
      system = addPipe(system, 5, 5, 'pvc', 0);
      system = addPipe(system, 5, 4, 'pvc', 0);
      system = addPipe(system, 5, 6, 'pvc', 0);
      system = addPipe(system, 6, 5, 'pvc', 0);
      system = addPipe(system, 4, 5, 'pvc', 0);

      system = updatePipePressures(system);

      const centerPipe = getPipeAt(system, 5, 5);
      expect(centerPipe?.connectedTo).toContain('north');
      expect(centerPipe?.connectedTo).toContain('south');
      expect(centerPipe?.connectedTo).toContain('east');
      expect(centerPipe?.connectedTo).toContain('west');
    });

    it('should handle pipe network with loops', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 0, 0);
      system = addPipe(system, 0, 0, 'pvc', 0);
      system = addPipe(system, 1, 0, 'pvc', 0);
      system = addPipe(system, 1, 1, 'pvc', 0);
      system = addPipe(system, 0, 1, 'pvc', 0);

      system = updatePipePressures(system);

      const pipe1 = getPipeAt(system, 0, 0);
      const pipe2 = getPipeAt(system, 1, 1);
      expect(pipe1?.pressureLevel).toBeGreaterThan(0);
      expect(pipe2?.pressureLevel).toBeGreaterThan(0);
    });

    it('should find nearest water source among multiple', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 0, 0);
      system = addWaterSource(system, 'well_shallow', 10, 0);
      system = addPipe(system, 0, 0, 'pvc', 0);
      system = addPipe(system, 1, 0, 'pvc', 0);
      system = addPipe(system, 2, 0, 'pvc', 0);

      system = updatePipePressures(system);

      const pipe = getPipeAt(system, 2, 0);
      expect(pipe?.pressureLevel).toBeGreaterThan(0);
    });

    it('should connect east-west pipes on same row', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 0, 0);
      system = addPipe(system, 0, 0, 'pvc', 0);
      system = addPipe(system, 1, 0, 'pvc', 0);

      system = updatePipePressures(system);

      const leftPipe = getPipeAt(system, 0, 0);
      const rightPipe = getPipeAt(system, 1, 0);
      expect(leftPipe?.connectedTo).toContain('east');
      expect(rightPipe?.connectedTo).toContain('west');
    });

    it('should handle loop with sprinkler heads', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 0, 0);
      system = addPipe(system, 0, 0, 'pvc', 0);
      system = addPipe(system, 1, 0, 'pvc', 0);
      system = addPipe(system, 2, 0, 'pvc', 0);
      system = addPipe(system, 2, 1, 'pvc', 0);
      system = addPipe(system, 1, 1, 'pvc', 0);
      system = addPipe(system, 0, 1, 'pvc', 0);
      system = addSprinklerHead(system, 1, 0, 'fixed', 0);
      system = addSprinklerHead(system, 1, 1, 'fixed', 0);

      system = updatePipePressures(system);

      const pipe = getPipeAt(system, 0, 0);
      expect(pipe?.pressureLevel).toBeGreaterThan(0);
    });
  });

  describe('leak system', () => {
    it('should detect leaks over time', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const newTime = 60 * 24 * 35;

      system = checkForLeaks(system, newTime);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe?.isLeaking).toBeDefined();
    });

    it('should create leak when random triggers it', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const newTime = 60 * 24 * 100;

      system = checkForLeaks(system, newTime);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe?.isLeaking).toBe(true);
      expect(pipe?.durability).toBe(90);

      vi.restoreAllMocks();
    });

    it('should not leak when random value is high', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);

      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const newTime = 60 * 24 * 100;
      system = checkForLeaks(system, newTime);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe?.isLeaking).toBe(false);
      expect(pipe?.durability).toBe(100);

      vi.restoreAllMocks();
    });

    it('should not leak if pipe is already leaking', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const leakyPipe = { ...system.pipes[0], isLeaking: true, durability: 50 };
      system = { ...system, pipes: [leakyPipe] };

      const newTime = 60 * 24 * 100;
      system = checkForLeaks(system, newTime);

      const pipe = getPipeAt(system, 10, 10);
      expect(pipe?.isLeaking).toBe(true);
      expect(pipe?.durability).toBe(50);
    });

    it('should repair leak', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);

      const pipe = getPipeAt(system, 10, 10);
      if (pipe) {
        const leakyPipe = { ...pipe, isLeaking: true };
        system = { ...system, pipes: [leakyPipe] };

        const result = repairLeak(system, 10, 10);
        expect(result).not.toBeNull();
        if (result) {
          const repaired = getPipeAt(result, 10, 10);
          expect(repaired?.isLeaking).toBe(false);
        }
      }
    });

    it('should return null when repairing non-existent pipe', () => {
      const system = createInitialIrrigationSystem();
      const result = repairLeak(system, 99, 99);
      expect(result).toBeNull();
    });

    it('should return null when repairing non-leaking pipe', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      const result = repairLeak(system, 10, 10);
      expect(result).toBeNull();
    });
  });

  describe('leak chance calculation', () => {
    it('should have zero chance during warranty period', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const withinWarrantyTime = 60 * 24 * 20;

      const chance = calculateLeakChance(pipe, withinWarrantyTime);
      expect(chance).toBe(0);
    });

    it('should increase chance during stormy weather', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const oldTime = 60 * 24 * 40;

      const normalChance = calculateLeakChance(pipe, oldTime);
      const stormyChance = calculateLeakChance(pipe, oldTime, { type: 'stormy', temperature: 70 });

      expect(normalChance).toBeGreaterThan(0);
      expect(stormyChance).toBeGreaterThan(normalChance);
    });

    it('should increase chance during freezing weather', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const oldTime = 60 * 24 * 40;

      const normalChance = calculateLeakChance(pipe, oldTime);
      const freezingChance = calculateLeakChance(pipe, oldTime, { type: 'sunny', temperature: 20 });

      expect(normalChance).toBeGreaterThan(0);
      expect(freezingChance).toBeGreaterThan(normalChance);
    });

    it('should combine stormy and freezing effects', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const oldTime = 60 * 24 * 40;

      const stormyOnly = calculateLeakChance(pipe, oldTime, { type: 'stormy', temperature: 70 });
      const freezingOnly = calculateLeakChance(pipe, oldTime, { type: 'sunny', temperature: 20 });
      const combinedChance = calculateLeakChance(pipe, oldTime, { type: 'stormy', temperature: 20 });

      expect(combinedChance).toBeGreaterThanOrEqual(stormyOnly);
      expect(combinedChance).toBeGreaterThanOrEqual(freezingOnly);
    });

    it('should not increase chance when temperature is above freezing', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const oldTime = 60 * 24 * 40;

      const normalChance = calculateLeakChance(pipe, oldTime);
      const warmChance = calculateLeakChance(pipe, oldTime, { type: 'sunny', temperature: 70 });

      expect(warmChance).toBe(normalChance);
    });

    it('should cap leak chance at 0.5', () => {
      const pipe = createPipeTile(0, 0, 'pvc', 0);
      const veryOldTime = 60 * 24 * 1000;

      const chance = calculateLeakChance(pipe, veryOldTime, { type: 'stormy', temperature: 20 });
      expect(chance).toBeLessThanOrEqual(0.5);
    });
  });

  describe('water consumption', () => {
    it('should calculate water usage', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 5, 5);
      system = addPipe(system, 5, 5, 'pvc', 0);
      system = addPipe(system, 6, 5, 'pvc', 0);
      system = addPipe(system, 7, 5, 'pvc', 0);
      system = addPipe(system, 8, 5, 'pvc', 0);
      system = addPipe(system, 9, 5, 'pvc', 0);
      system = addPipe(system, 10, 5, 'pvc', 0);
      system = addPipe(system, 10, 6, 'pvc', 0);
      system = addPipe(system, 10, 7, 'pvc', 0);
      system = addPipe(system, 10, 8, 'pvc', 0);
      system = addPipe(system, 10, 9, 'pvc', 0);
      system = addPipe(system, 10, 10, 'pvc', 0);
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      system = updatePipePressures(system);
      const head = system.sprinklerHeads[0];
      system = setSprinklerActive(system, head.id, true);
      
      const activeHead = system.sprinklerHeads.find(h => h.id === head.id && h.isActive);
      expect(activeHead).toBeDefined();
      expect(activeHead?.isActive).toBe(true);
      
      if (activeHead) {
        const usage = calculateWaterUsage([activeHead], 10, system);
        expect(usage).toBeGreaterThan(0);
      }
    });

    it('should calculate water cost', () => {
      const source = createWaterSource('municipal', 0, 0);
      const cost = calculateWaterCost(1000, source);
      expect(cost).toBe(0.1);
    });

    it('should calculate zero usage for sprinkler without pipe', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      const head = system.sprinklerHeads[0];
      system = setSprinklerActive(system, head.id, true);

      const activeHead = system.sprinklerHeads.find(h => h.id === head.id);
      expect(activeHead).toBeDefined();

      if (activeHead) {
        const usage = calculateWaterUsage([activeHead], 10, system);
        expect(usage).toBe(0);
      }
    });

    it('should skip inactive sprinklers in water usage calculation', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      const inactiveHead = system.sprinklerHeads[0];

      expect(inactiveHead.isActive).toBe(false);

      const usage = calculateWaterUsage([inactiveHead], 10, system);
      expect(usage).toBe(0);
    });
  });

  describe('water source management', () => {
    it('should get water source at position', () => {
      let system = createInitialIrrigationSystem();
      system = addWaterSource(system, 'municipal', 5, 5);

      const source = getWaterSourceAt(system, 5, 5);
      expect(source).not.toBeNull();
      expect(source?.type).toBe('municipal');
    });

    it('should return null for non-existent water source', () => {
      const system = createInitialIrrigationSystem();
      const source = getWaterSourceAt(system, 99, 99);
      expect(source).toBeNull();
    });
  });

  describe('sprinkler schedule', () => {
    it('should update sprinkler schedule', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      const head = system.sprinklerHeads[0];

      const newSchedule: WateringSchedule = {
        enabled: true,
        timeRanges: [{ start: 6, end: 8 }],
        skipRain: true,
        zone: 'front'
      };

      system = updateSprinklerSchedule(system, head.id, newSchedule);

      const updatedHead = system.sprinklerHeads.find(h => h.id === head.id);
      expect(updatedHead?.schedule).toEqual(newSchedule);
    });

    it('should not affect other sprinklers when updating schedule', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      system = addSprinklerHead(system, 20, 20, 'rotary', 0);
      const head1 = system.sprinklerHeads[0];
      const head2 = system.sprinklerHeads[1];

      const newSchedule: WateringSchedule = {
        enabled: true,
        timeRanges: [{ start: 6, end: 8 }],
        skipRain: true,
        zone: 'front'
      };

      system = updateSprinklerSchedule(system, head1.id, newSchedule);

      const updatedHead2 = system.sprinklerHeads.find(h => h.id === head2.id);
      expect(updatedHead2?.schedule).not.toEqual(newSchedule);
    });

    it('should not affect other sprinklers when setting active', () => {
      let system = createInitialIrrigationSystem();
      system = addSprinklerHead(system, 10, 10, 'fixed', 0);
      system = addSprinklerHead(system, 20, 20, 'rotary', 0);
      const head1 = system.sprinklerHeads[0];
      const head2 = system.sprinklerHeads[1];

      system = setSprinklerActive(system, head1.id, true);

      const updatedHead1 = system.sprinklerHeads.find(h => h.id === head1.id);
      const updatedHead2 = system.sprinklerHeads.find(h => h.id === head2.id);
      expect(updatedHead1?.isActive).toBe(true);
      expect(updatedHead2?.isActive).toBe(false);
    });
  });

  describe('updatePipeConnections', () => {
    it('should detect east connection', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      system = addPipe(system, 11, 10, 'pvc', 0);

      const pipe = getPipeAt(system, 10, 10)!;
      const updated = updatePipeConnections(system, pipe);

      expect(updated.connectedTo).toContain('east');
    });

    it('should detect west connection', () => {
      let system = createInitialIrrigationSystem();
      system = addPipe(system, 10, 10, 'pvc', 0);
      system = addPipe(system, 9, 10, 'pvc', 0);

      const pipe = getPipeAt(system, 10, 10)!;
      const updated = updatePipeConnections(system, pipe);

      expect(updated.connectedTo).toContain('west');
    });
  });
});

