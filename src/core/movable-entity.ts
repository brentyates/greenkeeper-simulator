import {
  advanceTowardPoint,
  type TraversalRule,
} from './navigation';

export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

interface MovableEntity {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly path: readonly GridPosition[];
  readonly moveProgress: number;
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
  readonly worldX: number;
  readonly worldZ: number;
  readonly efficiency: number;
  readonly currentTask: EmployeeTask;
  readonly targetX: number | null;
  readonly targetZ: number | null;
  readonly workProgress: number;
  readonly assignedAreaId: string | null;
}

export function createEmployeeEntity(
  id: string,
  worldX: number,
  worldZ: number,
  efficiency: number = 1.0
): EmployeeEntity {
  return {
    id,
    entityType: 'employee',
    worldX,
    worldZ,
    gridX: Math.floor(worldX),
    gridY: Math.floor(worldZ),
    path: [],
    moveProgress: 0,
    efficiency,
    currentTask: 'idle',
    targetX: null,
    targetZ: null,
    workProgress: 0,
    assignedAreaId: null,
  };
}

export function moveEmployeeTowardWithNavigation(
  employee: EmployeeEntity,
  targetWorldX: number,
  targetWorldZ: number,
  distanceThisFrame: number,
  canTraverse?: TraversalRule<EmployeeEntity>
) {
  const navigation = advanceTowardPoint(
    employee,
    employee.worldX,
    employee.worldZ,
    targetWorldX,
    targetWorldZ,
    distanceThisFrame,
    canTraverse
  );

  const updated: EmployeeEntity = {
    ...employee,
    worldX: navigation.worldX,
    worldZ: navigation.worldZ,
    gridX: Math.floor(navigation.worldX),
    gridY: Math.floor(navigation.worldZ),
    moveProgress: navigation.arrived ? 0 : employee.moveProgress,
  };

  return {
    entity: updated,
    arrived: navigation.arrived,
    blocked: navigation.blocked,
  };
}

export const MOVE_SPEED = 3.0;
export const MOVE_DURATION_MS = 150;
