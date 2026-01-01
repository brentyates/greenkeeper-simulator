export type Direction = 'up' | 'down' | 'left' | 'right';
export type EquipmentType = 'mower' | 'sprinkler' | 'spreader' | null;

export interface PlayerState {
  gridX: number;
  gridY: number;
  stamina: number;
  currentEquipment: EquipmentType;
  isEquipmentActive: boolean;
  direction: Direction;
  isMoving: boolean;
}

export interface MapBounds {
  width: number;
  height: number;
}

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const ELEVATION_HEIGHT = 16;
export const MOVE_SPEED = 150;

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

export function gridToScreen(
  gridX: number,
  gridY: number,
  mapWidth: number,
  elevation: number = 0
): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + (mapWidth * TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) - elevation * ELEVATION_HEIGHT;
  return { x: screenX, y: screenY };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  mapWidth: number
): { x: number; y: number } {
  const offsetX = screenX - (mapWidth * TILE_WIDTH / 2);
  const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.round(isoX), y: Math.round(isoY) };
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

export function setEquipment(state: PlayerState, equipment: EquipmentType): PlayerState {
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

export function shouldFlipSprite(direction: Direction): boolean {
  return direction === 'left' || direction === 'up';
}

export function calculateDepth(gridX: number, gridY: number, baseDepth: number = 100): number {
  return baseDepth + gridX + gridY;
}
