import Phaser from 'phaser';
import { Equipment } from './Equipment';
import { Player } from './Player';
import { GrassSystem } from '../systems/GrassSystem';

export class Sprinkler extends Equipment {
  constructor(scene: Phaser.Scene, player: Player, grassSystem: GrassSystem) {
    super(scene, player, grassSystem, 100, 1.0, 2);

    this.sprite = scene.add.sprite(player.x, player.y, 'sprinkler');
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
      this.emitter.setPosition(this.player.x, this.player.y - 10);
      this.emitter.start();
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);

    if (this.sprite) {
      this.sprite.setPosition(this.player.x, this.player.y - 8);
    }
  }
}
