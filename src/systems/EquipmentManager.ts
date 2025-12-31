import Phaser from 'phaser';
import { Player, EquipmentType } from '../gameobjects/Player';
import { Equipment } from '../gameobjects/Equipment';
import { Mower } from '../gameobjects/Mower';
import { Sprinkler } from '../gameobjects/Sprinkler';
import { Spreader } from '../gameobjects/Spreader';
import { GrassSystem } from './GrassSystem';

export class EquipmentManager {
  private player: Player;
  private currentEquipment: Equipment | null = null;
  private currentType: EquipmentType = null;
  private mower: Mower;
  private sprinkler: Sprinkler;
  private spreader: Spreader;

  constructor(scene: Phaser.Scene, player: Player, grassSystem: GrassSystem) {
    this.player = player;

    this.mower = new Mower(scene, player, grassSystem);
    this.sprinkler = new Sprinkler(scene, player, grassSystem);
    this.spreader = new Spreader(scene, player, grassSystem);
  }

  switchTo(type: EquipmentType): void {
    if (this.currentEquipment) {
      this.currentEquipment.deactivate();
    }

    this.mower.deactivate();
    this.sprinkler.deactivate();
    this.spreader.deactivate();

    this.currentType = type;
    this.player.setCurrentEquipment(type);

    switch (type) {
      case 'mower':
        this.currentEquipment = this.mower;
        break;
      case 'sprinkler':
        this.currentEquipment = this.sprinkler;
        break;
      case 'spreader':
        this.currentEquipment = this.spreader;
        break;
      default:
        this.currentEquipment = null;
    }
  }

  activateCurrent(): void {
    if (this.currentEquipment) {
      this.currentEquipment.activate();
      this.player.setIsEquipmentActive(true);
    }
  }

  deactivateCurrent(): void {
    if (this.currentEquipment) {
      this.currentEquipment.deactivate();
      this.player.setIsEquipmentActive(false);
    }
  }

  getCurrentType(): EquipmentType {
    return this.currentType;
  }

  getCurrentEquipment(): Equipment | null {
    return this.currentEquipment;
  }

  getMower(): Mower {
    return this.mower;
  }

  getSprinkler(): Sprinkler {
    return this.sprinkler;
  }

  getSpreader(): Spreader {
    return this.spreader;
  }

  refillCurrent(): boolean {
    if (this.currentEquipment) {
      this.currentEquipment.refill();
      return true;
    }
    return false;
  }

  refillAll(): void {
    this.mower.refill();
    this.sprinkler.refill();
    this.spreader.refill();
  }

  update(time: number, delta: number): void {
    this.mower.update(time, delta);
    this.sprinkler.update(time, delta);
    this.spreader.update(time, delta);
  }

  getSerializableState(): object {
    return {
      currentType: this.currentType,
      mower: this.mower.getResourceCurrent(),
      sprinkler: this.sprinkler.getResourceCurrent(),
      spreader: this.spreader.getResourceCurrent()
    };
  }

  loadState(state: { currentType: EquipmentType; mower: number; sprinkler: number; spreader: number }): void {
    (this.mower as unknown as { resourceCurrent: number }).resourceCurrent = state.mower;
    (this.sprinkler as unknown as { resourceCurrent: number }).resourceCurrent = state.sprinkler;
    (this.spreader as unknown as { resourceCurrent: number }).resourceCurrent = state.spreader;
    this.switchTo(state.currentType);
  }
}
