import { GameState, createDefaultGameState, GrassCellState } from '../systems/GameState';
import { COURSE_HOLE_1, getTerrainType } from './courseData';

interface CellModification extends Partial<GrassCellState> {
  elevation?: number;
}

function createGrassCells(modifier: (x: number, y: number, type: string) => CellModification): GrassCellState[][] {
  const cells: GrassCellState[][] = [];

  for (let y = 0; y < COURSE_HOLE_1.height; y++) {
    cells[y] = [];
    for (let x = 0; x < COURSE_HOLE_1.width; x++) {
      const terrainCode = COURSE_HOLE_1.layout[y]?.[x] ?? 1;
      const type = getTerrainType(terrainCode);
      const mods = modifier(x, y, type);
      const defaultElevation = COURSE_HOLE_1.elevation[y]?.[x] ?? 0;

      cells[y][x] = {
        x,
        y,
        type,
        height: mods.height ?? 50,
        moisture: mods.moisture ?? 50,
        nutrients: mods.nutrients ?? 50,
        health: mods.health ?? 100,
        elevation: mods.elevation ?? defaultElevation,
        lastMowed: mods.lastMowed ?? 0,
        lastWatered: mods.lastWatered ?? 0,
        lastFertilized: mods.lastFertilized ?? 0
      };
    }
  }

  return cells;
}

export function presetAllGrassMown(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });

  state.player = { x: 1280, y: 928, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };

  return state;
}

export function presetAllGrassUnmown(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 100, moisture: 50, nutrients: 50, health: 60 };
  });

  state.player = { x: 1280, y: 928, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };

  return state;
}

export function presetMixedMowingPattern(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    const isMown = (x + y) % 2 === 0;
    return { height: isMown ? 0 : 100, moisture: 60, nutrients: 60, health: isMown ? 100 : 60 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };

  return state;
}

export function presetStripeTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    const isMown = y % 3 === 0;
    return { height: isMown ? 0 : 80, moisture: 60, nutrients: 60, health: isMown ? 100 : 70 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };

  return state;
}

export function presetHealthGradient(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    const healthPct = x / COURSE_HOLE_1.width;
    const health = Math.floor(healthPct * 100);
    const moisture = Math.floor(healthPct * 100);
    const nutrients = Math.floor(healthPct * 100);
    return { height: 30, moisture, nutrients, health };
  });

  state.player = { x: 100, y: 400, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'right' };

  return state;
}

export function presetMoistureGradient(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    const moisture = Math.floor((x / COURSE_HOLE_1.width) * 100);
    return { height: 30, moisture, nutrients: 70, health: 80 };
  });

  state.player = { x: 100, y: 400, stamina: 100, currentEquipment: 'sprinkler', isEquipmentActive: false, direction: 'right' };
  state.ui.overlayMode = 'moisture';

  return state;
}

export function presetNutrientGradient(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    const nutrients = Math.floor((x / COURSE_HOLE_1.width) * 100);
    return { height: 30, moisture: 70, nutrients, health: 80 };
  });

  state.player = { x: 100, y: 400, stamina: 100, currentEquipment: 'spreader', isEquipmentActive: false, direction: 'right' };
  state.ui.overlayMode = 'nutrients';

  return state;
}

export function presetAllTerrainStates(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }

    const col = x % 3;
    let height: number;
    if (col === 0) height = 0;
    else if (col === 1) height = 40;
    else height = 100;

    return { height, moisture: 60, nutrients: 60, health: col === 0 ? 100 : col === 1 ? 80 : 60 };
  });

  state.player = { x: 800, y: 400, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };

  return state;
}

export function presetEquipmentTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 50, moisture: 50, nutrients: 50, health: 80 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: 'mower', isEquipmentActive: true, direction: 'down' };
  state.equipment = { currentType: 'mower', mowerResource: 100, sprinklerResource: 100, spreaderResource: 100 };

  return state;
}

export function presetDepthTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 30, moisture: 60, nutrients: 70, health: 100 };
  });

  state.player = { x: 800, y: 300, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };

  return state;
}

export function presetEdgeCaseDying(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }

    const col = x % 5;
    let health: number;
    if (col === 0) health = 15;
    else if (col === 1) health = 20;
    else if (col === 2) health = 35;
    else if (col === 3) health = 40;
    else health = 45;

    return { height: 50, moisture: health, nutrients: health, health };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };

  return state;
}

export function presetTimeMorning(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 30, moisture: 70, nutrients: 70, health: 100 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 7, timeScale: 1, isPaused: true };

  return state;
}

export function presetTimeNoon(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 30, moisture: 70, nutrients: 70, health: 100 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 360, currentDay: 1, currentHour: 12, timeScale: 1, isPaused: true };

  return state;
}

export function presetTimeEvening(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 30, moisture: 70, nutrients: 70, health: 100 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 780, currentDay: 1, currentHour: 19, timeScale: 1, isPaused: true };

  return state;
}

export function presetTimeNight(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 30, moisture: 70, nutrients: 70, health: 100 };
  });

  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 1020, currentDay: 1, currentHour: 23, timeScale: 1, isPaused: true };

  return state;
}

export function presetWaterCollisionTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });

  // Position player at grid (17, 11) - right next to water at (16, 11)
  // Screen coords: x = (17-11)*32 + 1600 = 1792, y = (17+11)*16 = 448
  state.player = { x: 1792, y: 448, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'left' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };

  return state;
}

export function presetCornerTopLeft(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });
  // Grid (0, 0): screenX = (0-0)*32 + 1600 = 1600, screenY = 0
  state.player = { x: 1600, y: 0, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetCornerTopRight(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });
  // Grid (49, 0): screenX = (49-0)*32 + 1600 = 3168, screenY = 49*16 = 784
  state.player = { x: 3168, y: 784, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetCornerBottomLeft(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });
  // Grid (0, 37): screenX = (0-37)*32 + 1600 = 416, screenY = 37*16 = 592
  state.player = { x: 416, y: 592, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetCornerBottomRight(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });
  // Grid (49, 37): screenX = (49-37)*32 + 1600 = 1984, screenY = (49+37)*16 = 1376
  state.player = { x: 1984, y: 1376, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetResourceTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 80, moisture: 30, nutrients: 30, health: 70 };
  });
  state.player = { x: 800, y: 544, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };
  state.equipment = { currentType: 'mower', mowerResource: 50, sprinklerResource: 50, spreaderResource: 50 };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetRefillTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 50, moisture: 50, nutrients: 50, health: 80 };
  });
  // Position at grid (25, 35) - next to refill station at (24, 35)
  // screenX = (25-35)*32 + 1600 = 1280, screenY = (25+35)*16 = 960
  state.player = { x: 1280, y: 960, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'left' };
  state.equipment = { currentType: 'mower', mowerResource: 10, sprinklerResource: 10, spreaderResource: 10 };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetRefillTestFarFromStation(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 50, moisture: 50, nutrients: 50, health: 80 };
  });
  // Position far from any refill station - grid (5, 5)
  // screenX = (5-5)*32 + 1600 = 1600, screenY = (5+5)*16 = 160
  state.player = { x: 1600, y: 160, stamina: 100, currentEquipment: 'mower', isEquipmentActive: false, direction: 'down' };
  state.equipment = { currentType: 'mower', mowerResource: 10, sprinklerResource: 10, spreaderResource: 10 };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetTreeCollisionTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((_x, _y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0 };
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100 };
  });
  // Position next to tree at (2, 2) - player at grid (3, 2)
  // screenX = (3-2)*32 + 1600 = 1632, screenY = (3+2)*16 = 80
  state.player = { x: 1632, y: 80, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'left' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetElevationTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0, elevation: -1 };
    }
    const gridSize = 5;
    const gridX = Math.floor(x / gridSize) % 4;
    const gridY = Math.floor(y / gridSize) % 3;
    const elevation = (gridX + gridY) % 4;
    return { height: 0, moisture: 60, nutrients: 70, health: 100, elevation };
  });
  state.player = { x: 1600, y: 160, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetRampTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0, elevation: 0 };
    }
    const centerX = 25;
    const centerY = 19;
    let elevation = 0;
    if (x >= centerX - 2 && x <= centerX + 2 && y >= centerY - 2 && y <= centerY + 2) {
      elevation = 2;
    } else if (x >= centerX - 3 && x <= centerX + 3 && y >= centerY - 3 && y <= centerY + 3) {
      elevation = 1;
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100, elevation };
  });
  state.player = { x: 1600, y: 448, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'down' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export function presetCliffTest(): GameState {
  const state = createDefaultGameState();
  state.grassCells = createGrassCells((x, y, type) => {
    if (type === 'bunker' || type === 'water') {
      return { height: 0, moisture: type === 'water' ? 100 : 20, nutrients: 0, elevation: 0 };
    }
    let elevation = 0;
    if (x >= 20 && x <= 30) {
      if (y < 15) {
        elevation = 3;
      } else if (y < 25) {
        elevation = 1;
      }
    }
    return { height: 0, moisture: 60, nutrients: 70, health: 100, elevation };
  });
  state.player = { x: 1600, y: 640, stamina: 100, currentEquipment: null, isEquipmentActive: false, direction: 'up' };
  state.time = { gameTime: 0, currentDay: 1, currentHour: 10, timeScale: 1, isPaused: true };
  return state;
}

export const TEST_PRESETS: Record<string, () => GameState> = {
  all_grass_mown: presetAllGrassMown,
  all_grass_unmown: presetAllGrassUnmown,
  mixed_mowing_pattern: presetMixedMowingPattern,
  stripe_test: presetStripeTest,
  health_gradient: presetHealthGradient,
  moisture_gradient: presetMoistureGradient,
  nutrient_gradient: presetNutrientGradient,
  all_terrain_states: presetAllTerrainStates,
  equipment_test: presetEquipmentTest,
  depth_test: presetDepthTest,
  edge_case_dying: presetEdgeCaseDying,
  time_morning: presetTimeMorning,
  time_noon: presetTimeNoon,
  time_evening: presetTimeEvening,
  time_night: presetTimeNight,
  water_collision_test: presetWaterCollisionTest,
  corner_top_left: presetCornerTopLeft,
  corner_top_right: presetCornerTopRight,
  corner_bottom_left: presetCornerBottomLeft,
  corner_bottom_right: presetCornerBottomRight,
  resource_test: presetResourceTest,
  refill_test: presetRefillTest,
  refill_test_far: presetRefillTestFarFromStation,
  tree_collision_test: presetTreeCollisionTest,
  elevation_test: presetElevationTest,
  ramp_test: presetRampTest,
  cliff_test: presetCliffTest
};

export function getPreset(name: string): GameState | null {
  const presetFn = TEST_PRESETS[name];
  return presetFn ? presetFn() : null;
}

export function listPresets(): string[] {
  return Object.keys(TEST_PRESETS);
}
