import Phaser from 'phaser';
import { Player } from './Player';
import { GrassSystem } from '../systems/GrassSystem';

export abstract class Equipment {
  protected scene: Phaser.Scene;
  protected player: Player;
  protected grassSystem: GrassSystem;
  protected isActive = false;
  protected resourceCurrent: number;
  protected resourceMax: number;
  protected resourceUseRate: number;
  protected effectRadius: number;
  protected sprite: Phaser.GameObjects.Sprite | null = null;
  protected emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    grassSystem: GrassSystem,
    resourceMax: number,
    resourceUseRate: number,
    effectRadius: number
  ) {
    this.scene = scene;
    this.player = player;
    this.grassSystem = grassSystem;
    this.resourceMax = resourceMax;
    this.resourceCurrent = resourceMax;
    this.resourceUseRate = resourceUseRate;
    this.effectRadius = effectRadius;
  }

  abstract activate(): void;
  abstract deactivate(): void;
  abstract applyEffect(time: number, delta: number): void;

  getResourcePercent(): number {
    return (this.resourceCurrent / this.resourceMax) * 100;
  }

  getResourceCurrent(): number {
    return this.resourceCurrent;
  }

  getResourceMax(): number {
    return this.resourceMax;
  }

  refill(): void {
    this.resourceCurrent = this.resourceMax;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  update(time: number, delta: number): void {
    if (this.isActive) {
      this.applyEffect(time, delta);
    }

    if (this.sprite) {
      this.sprite.setPosition(this.player.x, this.player.y + 12);
    }
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.emitter) {
      this.emitter.destroy();
    }
  }
}
