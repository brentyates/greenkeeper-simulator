/**
 * Unit tests for irrigation system
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  getSprinklerCoveragePattern,
  getPipeAt,
  getSprinklerHeadAt,
  setSprinklerActive,
  resetCounters,
  addWaterSource,
  createWaterSource,
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
  });
});

