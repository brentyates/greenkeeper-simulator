import { GameState } from './GameState';
import { GrassSystem, GrassCell } from './GrassSystem';
import { Player } from '../gameobjects/Player';
import { EquipmentManager } from './EquipmentManager';
import { TimeSystem } from './TimeSystem';
import { GameStateManager } from './GameStateManager';

export class GameStateLoader {
  static loadGrassSystem(grassSystem: GrassSystem, state: GameState): void {
    const cells = grassSystem.getCells();

    for (let y = 0; y < Math.min(state.grassCells.length, grassSystem.getHeight()); y++) {
      for (let x = 0; x < Math.min(state.grassCells[y].length, grassSystem.getWidth()); x++) {
        const savedCell = state.grassCells[y][x];
        const cell = cells[y][x];

        cell.height = savedCell.height;
        cell.moisture = savedCell.moisture;
        cell.nutrients = savedCell.nutrients;
        cell.health = savedCell.health;
        cell.lastMowed = savedCell.lastMowed;
        cell.lastWatered = savedCell.lastWatered;
        cell.lastFertilized = savedCell.lastFertilized;
      }
    }

    grassSystem.setOverlayMode(state.ui.overlayMode);

    for (let y = 0; y < grassSystem.getHeight(); y++) {
      for (let x = 0; x < grassSystem.getWidth(); x++) {
        const cell = cells[y][x];
        (grassSystem as unknown as { updateCellVisual: (cell: GrassCell) => void }).updateCellVisual(cell);
      }
    }
  }

  static loadPlayer(player: Player, state: GameState): void {
    player.setPosition(state.player.x, state.player.y);
    player.syncGridPosition();
    player.setStamina(state.player.stamina);
    player.setCurrentEquipment(state.player.currentEquipment);
    player.setIsEquipmentActive(state.player.isEquipmentActive);
  }

  static loadEquipmentManager(equipmentManager: EquipmentManager, state: GameState): void {
    equipmentManager.loadState({
      currentType: state.equipment.currentType,
      mower: state.equipment.mowerResource,
      sprinkler: state.equipment.sprinklerResource,
      spreader: state.equipment.spreaderResource
    });
  }

  static loadTimeSystem(timeSystem: TimeSystem, state: GameState): void {
    timeSystem.loadState({
      gameTime: state.time.gameTime,
      currentDay: state.time.currentDay,
      timeScale: state.time.timeScale
    });

    if (state.time.isPaused) {
      timeSystem.pause();
    } else {
      timeSystem.resume();
    }
  }

  static loadGameStateManager(gameStateManager: GameStateManager, state: GameState): void {
    gameStateManager.loadState({
      score: state.progress.score,
      daysPassed: state.progress.daysPassed,
      consecutiveGoodDays: state.progress.consecutiveGoodDays,
      currentObjective: state.progress.currentObjective
    });
  }

  static loadCamera(camera: Phaser.Cameras.Scene2D.Camera, state: GameState): void {
    camera.scrollX = state.camera.scrollX;
    camera.scrollY = state.camera.scrollY;
    camera.setZoom(state.camera.zoom);
  }

  static loadFullState(
    grassSystem: GrassSystem,
    player: Player,
    equipmentManager: EquipmentManager,
    timeSystem: TimeSystem,
    gameStateManager: GameStateManager,
    camera: Phaser.Cameras.Scene2D.Camera,
    state: GameState
  ): void {
    this.loadGrassSystem(grassSystem, state);
    this.loadPlayer(player, state);
    this.loadEquipmentManager(equipmentManager, state);
    this.loadTimeSystem(timeSystem, state);
    this.loadGameStateManager(gameStateManager, state);
    this.loadCamera(camera, state);
  }
}
