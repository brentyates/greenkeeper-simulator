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

  abstract applyEffect(time: number, delta: number): void;

  activate(): void {
    if (this.resourceCurrent <= 0) return;
    this.isActive = true;
    if (this.sprite) {
      this.sprite.setVisible(true);
    }
  }

  deactivate(): void {
    this.isActive = false;
    if (this.emitter) {
      this.emitter.stop();
    }
  }

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

    this.updateSpritePosition();
  }

  protected updateSpritePosition(): void {
    if (this.sprite) {
      const direction = this.player.getDirection();
      const offset = this.getIsoOffset(direction);
      this.sprite.setPosition(this.player.x + offset.x, this.player.y + offset.y);

      const gridPos = this.player.getGridPosition();
      const elevation = this.grassSystem.getElevation(gridPos.x, gridPos.y);
      const depthOffset = this.getDepthOffset(direction);
      this.sprite.setDepth(99 + gridPos.x + gridPos.y + elevation * 100 + depthOffset);
    }

    this.updateEmitterPosition();
  }

  protected updateEmitterPosition(): void {
    if (this.emitter) {
      const direction = this.player.getDirection();
      const offset = this.getEmitterOffset(direction);
      this.emitter.setPosition(this.player.x + offset.x, this.player.y + offset.y);
    }
  }

  protected getEmitterOffset(direction: string): { x: number; y: number } {
    return this.getIsoOffset(direction);
  }

  protected getIsoOffset(direction: string): { x: number; y: number } {
    switch (direction) {
      case 'up': return { x: 16, y: -8 };
      case 'down': return { x: -16, y: 8 };
      case 'left': return { x: -16, y: -8 };
      case 'right': return { x: 16, y: 8 };
      default: return { x: 0, y: 8 };
    }
  }

  protected getDepthOffset(direction: string): number {
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

  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.emitter) {
      this.emitter.destroy();
    }
  }
}
