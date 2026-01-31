import type { EquipmentType } from './equipment-logic';

export interface EquipmentSelectionState {
  selected: EquipmentType | null;
}

export function createInitialSelectionState(): EquipmentSelectionState {
  return { selected: null };
}

export function handleEquipmentButton(
  state: EquipmentSelectionState,
  pressed: EquipmentType
): EquipmentSelectionState {
  if (state.selected === pressed) {
    return { selected: null };
  }
  return { selected: pressed };
}

export function slotToEquipmentType(slot: 1 | 2 | 3): EquipmentType {
  const map: Record<number, EquipmentType> = {
    1: "mower",
    2: "sprinkler",
    3: "spreader",
  };
  return map[slot];
}

export function isEquipmentActive(state: EquipmentSelectionState): boolean {
  return state.selected !== null;
}

export function isMowerActive(state: EquipmentSelectionState): boolean {
  return state.selected === "mower";
}
