import { describe, it, expect } from 'vitest';
import {
  createPlayerEntity,
  createEmployeeEntity,
  createGolferEntity,
  isPlayer,
  isEmployee,
  isGolfer,
  getNextPosition,
  getVisualPosition,
  moveEntityAlongPath,
  setEntityPath,
  teleportEntity,
  PlayerEntity,
  EmployeeEntity,
  GolferEntity,
  MOVE_SPEED,
  PLAYER_BASE_SPEED,
} from './movable-entity';

describe('movable-entity', () => {
  describe('createPlayerEntity', () => {
    it('creates a player with default values', () => {
      const player = createPlayerEntity('player1', 10, 20);

      expect(player.id).toBe('player1');
      expect(player.entityType).toBe('player');
      expect(player.gridX).toBe(10);
      expect(player.gridY).toBe(20);
      expect(player.path).toEqual([]);
      expect(player.moveProgress).toBe(0);
      expect(player.efficiency).toBe(1.0);
      expect(player.pendingDirection).toBeNull();
      expect(player.equipmentSlot).toBe(0);
      expect(player.equipmentActive).toBe(false);
      expect(player.worldX).toBe(10.5);
      expect(player.worldZ).toBe(20.5);
    });

    it('creates a player with custom efficiency', () => {
      const player = createPlayerEntity('player1', 5, 5, 1.5);
      expect(player.efficiency).toBe(1.5);
    });
  });

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

  describe('createGolferEntity', () => {
    it('creates a golfer with default values', () => {
      const golfer = createGolferEntity('golfer1', 5, 10);

      expect(golfer.id).toBe('golfer1');
      expect(golfer.entityType).toBe('golfer');
      expect(golfer.gridX).toBe(5);
      expect(golfer.gridY).toBe(10);
      expect(golfer.path).toEqual([]);
      expect(golfer.moveProgress).toBe(0);
      expect(golfer.currentHole).toBe(1);
      expect(golfer.satisfaction).toBe(100);
      expect(golfer.isWalking).toBe(true);
    });

    it('creates a golfer with custom hole', () => {
      const golfer = createGolferEntity('golfer1', 5, 10, 9);
      expect(golfer.currentHole).toBe(9);
    });
  });

  describe('type guards', () => {
    it('isPlayer returns true for player entities', () => {
      const player = createPlayerEntity('player1', 0, 0);
      expect(isPlayer(player)).toBe(true);
      expect(isEmployee(player)).toBe(false);
      expect(isGolfer(player)).toBe(false);
    });

    it('isEmployee returns true for employee entities', () => {
      const employee = createEmployeeEntity('emp1', 0, 0);
      expect(isPlayer(employee)).toBe(false);
      expect(isEmployee(employee)).toBe(true);
      expect(isGolfer(employee)).toBe(false);
    });

    it('isGolfer returns true for golfer entities', () => {
      const golfer = createGolferEntity('golfer1', 0, 0);
      expect(isPlayer(golfer)).toBe(false);
      expect(isEmployee(golfer)).toBe(false);
      expect(isGolfer(golfer)).toBe(true);
    });
  });

  describe('getNextPosition', () => {
    it('returns null for empty path', () => {
      const entity = createPlayerEntity('player1', 0, 0);
      expect(getNextPosition(entity)).toBeNull();
    });

    it('returns first path position', () => {
      const entity: PlayerEntity = {
        ...createPlayerEntity('player1', 0, 0),
        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
      };
      expect(getNextPosition(entity)).toEqual({ x: 1, y: 0 });
    });
  });

  describe('getVisualPosition', () => {
    it('returns current position with no next when path empty', () => {
      const entity = createEmployeeEntity('emp1', 5, 10);
      const visual = getVisualPosition(entity);

      expect(visual.gridX).toBe(5);
      expect(visual.gridY).toBe(10);
      expect(visual.nextX).toBeNull();
      expect(visual.nextY).toBeNull();
      expect(visual.moveProgress).toBe(0);
    });

    it('returns current and next positions when path exists', () => {
      const entity: EmployeeEntity = {
        ...createEmployeeEntity('emp1', 5, 10),
        path: [{ x: 6, y: 10 }, { x: 7, y: 10 }],
        moveProgress: 0.5,
      };
      const visual = getVisualPosition(entity);

      expect(visual.gridX).toBe(5);
      expect(visual.gridY).toBe(10);
      expect(visual.nextX).toBe(6);
      expect(visual.nextY).toBe(10);
      expect(visual.moveProgress).toBe(0.5);
    });
  });

  describe('moveEntityAlongPath', () => {
    it('does nothing for empty path', () => {
      const entity = createPlayerEntity('player1', 5, 5);
      const moved = moveEntityAlongPath(entity, 0.1);

      expect(moved.gridX).toBe(5);
      expect(moved.gridY).toBe(5);
      expect(moved.moveProgress).toBe(0);
    });

    it('increases move progress during movement', () => {
      const entity: PlayerEntity = {
        ...createPlayerEntity('player1', 0, 0),
        path: [{ x: 1, y: 0 }],
        moveProgress: 0.01,
      };

      const deltaMinutes = 0.01;
      const moved = moveEntityAlongPath(entity, deltaMinutes);

      expect(moved.moveProgress).toBeGreaterThan(0.01);
      expect(moved.gridX).toBe(0);
      expect(moved.path.length).toBe(1);
    });

    it('moves to next tile when progress reaches 1', () => {
      const entity: EmployeeEntity = {
        ...createEmployeeEntity('emp1', 0, 0),
        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
        moveProgress: 0.9,
      };

      const deltaMinutes = 1;
      const moved = moveEntityAlongPath(entity, deltaMinutes);

      expect(moved.gridX).toBe(1);
      expect(moved.gridY).toBe(0);
      expect(moved.path.length).toBe(1);
      expect(moved.moveProgress).toBe(0);
    });
  });

  describe('setEntityPath', () => {
    it('sets path and initializes moveProgress', () => {
      const entity = createGolferEntity('golfer1', 5, 5);
      const path = [{ x: 6, y: 5 }, { x: 7, y: 5 }];
      const updated = setEntityPath(entity, path);

      expect(updated.path).toEqual(path);
      expect(updated.moveProgress).toBe(0.01);
    });

    it('clears moveProgress for empty path', () => {
      const entity: GolferEntity = {
        ...createGolferEntity('golfer1', 5, 5),
        path: [{ x: 6, y: 5 }],
        moveProgress: 0.5,
      };
      const updated = setEntityPath(entity, []);

      expect(updated.path).toEqual([]);
      expect(updated.moveProgress).toBe(0);
    });
  });

  describe('teleportEntity', () => {
    it('moves entity to new position and clears path', () => {
      const entity: PlayerEntity = {
        ...createPlayerEntity('player1', 0, 0),
        path: [{ x: 1, y: 0 }],
        moveProgress: 0.5,
      };

      const teleported = teleportEntity(entity, 10, 20);

      expect(teleported.gridX).toBe(10);
      expect(teleported.gridY).toBe(20);
      expect(teleported.path).toEqual([]);
      expect(teleported.moveProgress).toBe(0);
    });
  });

  describe('MOVE_SPEED', () => {
    it('is defined and positive', () => {
      expect(MOVE_SPEED).toBeGreaterThan(0);
    });
  });

  describe('PLAYER_BASE_SPEED', () => {
    it('is defined and positive', () => {
      expect(PLAYER_BASE_SPEED).toBeGreaterThan(0);
    });
  });

  describe('world coordinates', () => {
    it('creates player with cell-center world coordinates', () => {
      const player = createPlayerEntity('player1', 3, 7);
      expect(player.worldX).toBe(3.5);
      expect(player.worldZ).toBe(7.5);
    });
  });
});
