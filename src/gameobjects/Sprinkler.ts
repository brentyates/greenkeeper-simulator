import Phaser from 'phaser';
import { Equipment } from './Equipment';
import { Player } from './Player';
import { GrassSystem } from '../systems/GrassSystem';

export class Sprinkler extends Equipment {
  constructor(scene: Phaser.Scene, player: Player, grassSystem: GrassSystem) {
    super(scene, player, grassSystem, 100, 1.0, 2);

    this.sprite = scene.add.sprite(player.x, player.y, 'iso_sprinkler');
    this.sprite.setDepth(9);
    this.sprite.setVisible(false);

    const particles = scene.add.particles(0, 0, 'water_particle', {
      speed: { min: 100, max: 200 },
      angle: { min: -45, max: 45 },
      lifespan: 800,
      gravityY: 300,
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x00BFFF, 0xFFFFFF],
      emitting: false
    });
    particles.setDepth(11);
    this.emitter = particles;
  }

  applyEffect(_time: number, delta: number): void {
    if (this.resourceCurrent <= 0) {
      this.deactivate();
      return;
    }

    const pos = this.player.getGridPosition();
    const waterAmount = 2;
    this.grassSystem.waterArea(pos.x, pos.y, this.effectRadius, waterAmount);

    this.resourceCurrent = Math.max(0, this.resourceCurrent - (this.resourceUseRate * delta) / 1000);

    if (this.emitter) {
      this.emitter.start();
    }
  }

  protected getEmitterOffset(direction: string): { x: number; y: number } {
    const offset = this.getIsoOffset(direction);
    return { x: offset.x, y: offset.y - 10 };
  }

  protected getIsoOffset(direction: string): { x: number; y: number } {
    const base = super.getIsoOffset(direction);
    return { x: base.x, y: base.y - 12 };
  }
}
