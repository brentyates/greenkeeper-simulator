export type EquipmentType = 'mower' | 'sprinkler' | 'spreader';

export interface EquipmentState {
  type: EquipmentType;
  resourceCurrent: number;
  resourceMax: number;
  resourceUseRate: number;
  effectRadius: number;
  isActive: boolean;
}

export interface EquipmentConfig {
  resourceMax: number;
  resourceUseRate: number;
  effectRadius: number;
}

export const EQUIPMENT_CONFIGS: Record<EquipmentType, EquipmentConfig> = {
  mower: {
    resourceMax: 100,
    resourceUseRate: 0.5,
    effectRadius: 1
  },
  sprinkler: {
    resourceMax: 100,
    resourceUseRate: 1.0,
    effectRadius: 2
  },
  spreader: {
    resourceMax: 100,
    resourceUseRate: 0.8,
    effectRadius: 2
  }
};

export function createEquipmentState(type: EquipmentType): EquipmentState {
  const config = EQUIPMENT_CONFIGS[type];
  return {
    type,
    resourceCurrent: config.resourceMax,
    resourceMax: config.resourceMax,
    resourceUseRate: config.resourceUseRate,
    effectRadius: config.effectRadius,
    isActive: false
  };
}

export function activateEquipment(state: EquipmentState): EquipmentState {
  if (state.resourceCurrent <= 0) {
    return state;
  }
  return { ...state, isActive: true };
}

export function deactivateEquipment(state: EquipmentState): EquipmentState {
  return { ...state, isActive: false };
}

export function refillEquipment(state: EquipmentState): EquipmentState {
  return { ...state, resourceCurrent: state.resourceMax };
}

export function getResourcePercent(state: EquipmentState): number {
  return (state.resourceCurrent / state.resourceMax) * 100;
}

export function consumeResource(state: EquipmentState, deltaMs: number): EquipmentState {
  if (!state.isActive || state.resourceCurrent <= 0) {
    return state;
  }

  const consumed = (state.resourceUseRate * deltaMs) / 1000;
  const newResource = Math.max(0, state.resourceCurrent - consumed);

  if (newResource <= 0) {
    return { ...state, resourceCurrent: 0, isActive: false };
  }

  return { ...state, resourceCurrent: newResource };
}

export function canActivate(state: EquipmentState): boolean {
  return state.resourceCurrent > 0;
}

export function isEmpty(state: EquipmentState): boolean {
  return state.resourceCurrent <= 0;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export function getIsoOffset(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: 16, y: -8 };
    case 'down':
      return { x: -16, y: 8 };
    case 'left':
      return { x: -16, y: -8 };
    case 'right':
      return { x: 16, y: 8 };
    default:
      return { x: 0, y: 8 };
  }
}

export function getDepthOffset(direction: Direction): number {
  switch (direction) {
    case 'up':
    case 'left':
      return -1;
    case 'down':
    case 'right':
      return 1;
    default:
      return 0;
  }
}
