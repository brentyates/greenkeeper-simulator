export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export interface MovableEntity {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly path: readonly GridPosition[];
  readonly moveProgress: number;
}

export type EntityType = 'player' | 'employee' | 'golfer';

export interface PlayerEntity extends MovableEntity {
  readonly entityType: 'player';
  readonly efficiency: number;
  readonly pendingDirection: 'up' | 'down' | 'left' | 'right' | null;
  readonly equipmentSlot: number;
  readonly equipmentActive: boolean;
  readonly worldX: number;
  readonly worldZ: number;
}

export type EmployeeTask =
  | 'mow_grass'
  | 'water_area'
  | 'fertilize_area'
  | 'rake_bunker'
  | 'patrol'
  | 'return_to_base'
  | 'idle';

export interface EmployeeEntity extends MovableEntity {
  readonly entityType: 'employee';
  readonly efficiency: number;
  readonly currentTask: EmployeeTask;
  readonly targetX: number | null;
  readonly targetY: number | null;
  readonly workProgress: number;
  readonly assignedAreaId: string | null;
}

export interface GolferEntity extends MovableEntity {
  readonly entityType: 'golfer';
  readonly currentHole: number;
  readonly satisfaction: number;
  readonly isWalking: boolean;
}

export type AnyEntity = PlayerEntity | EmployeeEntity | GolferEntity;

export function isPlayer(entity: MovableEntity & { entityType?: EntityType }): entity is PlayerEntity {
  return (entity as PlayerEntity).entityType === 'player';
}

export function isEmployee(entity: MovableEntity & { entityType?: EntityType }): entity is EmployeeEntity {
  return (entity as EmployeeEntity).entityType === 'employee';
}

export function isGolfer(entity: MovableEntity & { entityType?: EntityType }): entity is GolferEntity {
  return (entity as GolferEntity).entityType === 'golfer';
}

export function createPlayerEntity(
  id: string,
  gridX: number,
  gridY: number,
  efficiency: number = 1.0
): PlayerEntity {
  return {
    id,
    entityType: 'player',
    gridX,
    gridY,
    path: [],
    moveProgress: 0,
    efficiency,
    pendingDirection: null,
    equipmentSlot: 0,
    equipmentActive: false,
    worldX: gridX + 0.5,
    worldZ: gridY + 0.5,
  };
}

export function createEmployeeEntity(
  id: string,
  gridX: number,
  gridY: number,
  efficiency: number = 1.0
): EmployeeEntity {
  return {
    id,
    entityType: 'employee',
    gridX,
    gridY,
    path: [],
    moveProgress: 0,
    efficiency,
    currentTask: 'idle',
    targetX: null,
    targetY: null,
    workProgress: 0,
    assignedAreaId: null,
  };
}

export function createGolferEntity(
  id: string,
  gridX: number,
  gridY: number,
  currentHole: number = 1
): GolferEntity {
  return {
    id,
    entityType: 'golfer',
    gridX,
    gridY,
    path: [],
    moveProgress: 0,
    currentHole,
    satisfaction: 100,
    isWalking: true,
  };
}

export const MOVE_SPEED = 3.0;
export const MOVE_DURATION_MS = 150;
export const PLAYER_BASE_SPEED = 6.5;

export function getNextPosition(entity: MovableEntity): GridPosition | null {
  return entity.path.length > 0 ? entity.path[0] : null;
}

export function getVisualPosition(entity: MovableEntity): {
  gridX: number;
  gridY: number;
  nextX: number | null;
  nextY: number | null;
  moveProgress: number;
} {
  const next = getNextPosition(entity);
  return {
    gridX: entity.gridX,
    gridY: entity.gridY,
    nextX: next?.x ?? null,
    nextY: next?.y ?? null,
    moveProgress: entity.moveProgress,
  };
}

export function moveEntityAlongPath<T extends MovableEntity>(
  entity: T,
  deltaMinutes: number
): T {
  if (entity.path.length === 0) {
    return entity;
  }

  const moveAmount = MOVE_SPEED * deltaMinutes;
  const newMoveProgress = entity.moveProgress + moveAmount;

  if (newMoveProgress >= 1) {
    const nextTile = entity.path[0];
    return {
      ...entity,
      gridX: nextTile.x,
      gridY: nextTile.y,
      path: entity.path.slice(1),
      moveProgress: 0,
    };
  }

  return {
    ...entity,
    moveProgress: newMoveProgress,
  };
}

export function setEntityPath<T extends MovableEntity>(
  entity: T,
  path: readonly GridPosition[]
): T {
  return {
    ...entity,
    path,
    moveProgress: path.length > 0 ? 0.01 : 0,
  };
}

export function teleportEntity<T extends MovableEntity>(
  entity: T,
  gridX: number,
  gridY: number
): T {
  return {
    ...entity,
    gridX,
    gridY,
    path: [],
    moveProgress: 0,
  };
}
