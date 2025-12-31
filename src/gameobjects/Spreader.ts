import Phaser from 'phaser';
import { Equipment } from './Equipment';
import { Player } from './Player';
import { GrassSystem } from '../systems/GrassSystem';

export class Spreader extends Equipment {
  constructor(scene: Phaser.Scene, player: Player, grassSystem: GrassSystem) {
    super(scene, player, grassSystem, 100, 0.8, 2);

    this.sprite = scene.add.sprite(player.x, player.y + 12, 'iso_spreader');
    this.sprite.setDepth(9);
    this.sprite.setVisible(false);

    const particles = scene.add.particles(0, 0, 'fertilizer_particle', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 1500,
      gravityY: 50,
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xD2B48C, 0x8B4513, 0xCD853F],
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
    const fertilizeAmount = 2;
    this.grassSystem.fertilizeArea(pos.x, pos.y, this.effectRadius, fertilizeAmount);

    this.resourceCurrent = Math.max(0, this.resourceCurrent - (this.resourceUseRate * delta) / 1000);

    if (this.emitter) {
      this.emitter.start();
    }
  }
}
