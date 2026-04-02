import { describe, it, expect } from 'vitest';
import {
  createEmployeeEntity,
  MOVE_SPEED,
} from './movable-entity';

describe('movable-entity', () => {
  describe('createEmployeeEntity', () => {
    it('creates an employee with default values', () => {
      const employee = createEmployeeEntity('emp1', 15, 25);

      expect(employee.id).toBe('emp1');
      expect(employee.entityType).toBe('employee');
      expect(employee.gridX).toBe(15);
      expect(employee.gridY).toBe(25);
      expect(employee.path).toEqual([]);
      expect(employee.moveProgress).toBe(0);
      expect(employee.efficiency).toBe(1.0);
      expect(employee.currentTask).toBe('idle');
      expect(employee.targetX).toBeNull();
      expect(employee.targetZ).toBeNull();
      expect(employee.workProgress).toBe(0);
      expect(employee.assignedAreaId).toBeNull();
    });
  });

  describe('MOVE_SPEED', () => {
    it('is defined and positive', () => {
      expect(MOVE_SPEED).toBeGreaterThan(0);
    });
  });
});
