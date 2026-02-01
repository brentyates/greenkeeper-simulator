import {
  gridToScreen,
  screenToGrid,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_HEIGHT,
} from './terrain';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type MovementEquipmentType = 'mower' | 'sprinkler' | 'spreader' | null;
export type EquipmentType = MovementEquipmentType;

export interface PlayerState {
  gridX: number;
  gridY: number;
  stamina: number;
  currentEquipment: MovementEquipmentType;
  isEquipmentActive: boolean;
  direction: Direction;
  isMoving: boolean;
}

export interface MapBounds {
  width: number;
  height: number;
}

export const MOVE_SPEED = 150;

export { gridToScreen, screenToGrid, TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT };

export function createInitialPlayerState(gridX: number = 0, gridY: number = 0): PlayerState {
  return {
    gridX,
    gridY,
    stamina: 100,
    currentEquipment: null,
    isEquipmentActive: false,
    direction: 'down',
    isMoving: false
  };
}

export function isWithinBounds(x: number, y: number, bounds: MapBounds): boolean {
  return x >= 0 && x < bounds.width && y >= 0 && y < bounds.height;
}

export function getTargetPosition(
  state: PlayerState,
  direction: Direction
): { x: number; y: number } {
  let dx = 0;
  let dy = 0;

  switch (direction) {
    case 'up':
      dy = -1;
      break;
    case 'down':
      dy = 1;
      break;
    case 'left':
      dx = -1;
      break;
    case 'right':
      dx = 1;
      break;
  }

  return { x: state.gridX + dx, y: state.gridY + dy };
}

export function canMoveTo(
  state: PlayerState,
  targetX: number,
  targetY: number,
  bounds: MapBounds,
  canMoveFromTo: (fromX: number, fromY: number, toX: number, toY: number) => boolean
): boolean {
  if (state.isMoving) return false;
  if (!isWithinBounds(targetX, targetY, bounds)) return false;
  return canMoveFromTo(state.gridX, state.gridY, targetX, targetY);
}

export function startMove(
  state: PlayerState,
  targetX: number,
  targetY: number,
  direction: Direction
): PlayerState {
  return {
    ...state,
    gridX: targetX,
    gridY: targetY,
    direction,
    isMoving: true
  };
}

export function completeMove(state: PlayerState): PlayerState {
  return {
    ...state,
    isMoving: false
  };
}

export function setGridPosition(state: PlayerState, x: number, y: number): PlayerState {
  return {
    ...state,
    gridX: x,
    gridY: y
  };
}

export function setStamina(state: PlayerState, stamina: number): PlayerState {
  return {
    ...state,
    stamina: Math.max(0, Math.min(100, stamina))
  };
}

export function setEquipment(state: PlayerState, equipment: MovementEquipmentType): PlayerState {
  return {
    ...state,
    currentEquipment: equipment
  };
}

export function setEquipmentActive(state: PlayerState, active: boolean): PlayerState {
  return {
    ...state,
    isEquipmentActive: active
  };
}

export function setDirection(state: PlayerState, direction: Direction): PlayerState {
  return {
    ...state,
    direction
  };
}

export function calculateMoveDuration(fromX: number, fromY: number, toX: number, toY: number, mapWidth: number, elevation: number = 0): number {
  const fromScreen = gridToScreen(fromX, fromY, mapWidth, 0);
  const toScreen = gridToScreen(toX, toY, mapWidth, elevation);
  const dx = toScreen.x - fromScreen.x;
  const dy = toScreen.y - fromScreen.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.max((distance / MOVE_SPEED) * 1000, 80);
}

export function calculateDepth(gridX: number, gridY: number, baseDepth: number = 100): number {
  return baseDepth + gridX + gridY;
}
