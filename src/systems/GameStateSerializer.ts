import { GameState, GrassCellState } from './GameState';
import { GrassSystem, GrassCell } from './GrassSystem';
import { Player } from '../gameobjects/Player';
import { EquipmentManager } from './EquipmentManager';
import { TimeSystem } from './TimeSystem';
import { GameStateManager } from './GameStateManager';

export class GameStateSerializer {
  static serializeGrassSystem(grassSystem: GrassSystem): GrassCellState[][] {
    const cells = grassSystem.getCells();
    const result: GrassCellState[][] = [];

    for (let y = 0; y < grassSystem.getHeight(); y++) {
      result[y] = [];
      for (let x = 0; x < grassSystem.getWidth(); x++) {
        const cell: GrassCell = cells[y][x];
        result[y][x] = {
          x: cell.x,
          y: cell.y,
          type: cell.type,
          height: cell.height,
          moisture: cell.moisture,
          nutrients: cell.nutrients,
          health: cell.health,
          lastMowed: cell.lastMowed,
          lastWatered: cell.lastWatered,
          lastFertilized: cell.lastFertilized
        };
      }
    }

    return result;
  }

  static serializeFullState(
    grassSystem: GrassSystem,
    player: Player,
    equipmentManager: EquipmentManager,
    timeSystem: TimeSystem,
    gameStateManager: GameStateManager,
    camera: Phaser.Cameras.Scene2D.Camera
  ): GameState {
    const timeState = timeSystem.getSerializableState() as { gameTime: number; currentDay: number; timeScale: number };
    const equipState = equipmentManager.getSerializableState() as { currentType: string | null; mower: number; sprinkler: number; spreader: number };
    const progressState = gameStateManager.getSerializableState() as { score: number; daysPassed: number; consecutiveGoodDays: number; currentObjective: GameState['progress']['currentObjective'] };

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      courseId: 'hole_1',

      grassCells: this.serializeGrassSystem(grassSystem),

      player: {
        x: player.x,
        y: player.y,
        stamina: player.getStamina(),
        currentEquipment: player.getCurrentEquipment(),
        isEquipmentActive: player.getIsEquipmentActive(),
        direction: player.getDirection()
      },

      equipment: {
        currentType: equipState.currentType as GameState['equipment']['currentType'],
        mowerResource: equipState.mower,
        sprinklerResource: equipState.sprinkler,
        spreaderResource: equipState.spreader
      },

      time: {
        gameTime: timeState.gameTime,
        currentDay: timeState.currentDay,
        currentHour: Math.floor((timeState.gameTime / 60) % 24),
        timeScale: timeState.timeScale,
        isPaused: timeSystem.getIsPaused()
      },

      camera: {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom
      },

      progress: {
        score: progressState.score,
        daysPassed: progressState.daysPassed,
        consecutiveGoodDays: progressState.consecutiveGoodDays,
        currentObjective: progressState.currentObjective
      },

      ui: {
        overlayMode: grassSystem.getOverlayMode(),
        isPaused: timeSystem.getIsPaused()
      }
    };
  }

  static toJSON(state: GameState): string {
    return JSON.stringify(state, null, 2);
  }

  static toBase64(state: GameState): string {
    return btoa(JSON.stringify(state));
  }

  static fromJSON(json: string): GameState {
    return JSON.parse(json) as GameState;
  }

  static fromBase64(base64: string): GameState {
    return JSON.parse(atob(base64)) as GameState;
  }
}
