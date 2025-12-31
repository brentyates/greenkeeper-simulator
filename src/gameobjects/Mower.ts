import Phaser from 'phaser';
import { Equipment } from './Equipment';
import { Player } from './Player';
import { GrassSystem } from '../systems/GrassSystem';

export class Mower extends Equipment {
  constructor(scene: Phaser.Scene, player: Player, grassSystem: GrassSystem) {
    super(scene, player, grassSystem, 100, 0.5, 1);

    this.sprite = scene.add.sprite(player.x, player.y + 12, 'iso_mower');
    this.sprite.setDepth(9);
    this.sprite.setVisible(false);

    const particles = scene.add.particles(0, 0, 'grass_particle', {
      speed: { min: 50, max: 100 },
      angle: { min: 0, max: 360 },
      lifespan: 1000,
      gravityY: 200,
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 1, end: 0 },
      quantity: 5,
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
    this.grassSystem.mow(pos.x, pos.y);

    this.resourceCurrent = Math.max(0, this.resourceCurrent - (this.resourceUseRate * delta) / 1000);

    if (this.emitter) {
      this.emitter.start();
    }
  }

}
