import Phaser from 'phaser';
import { SpriteGenerator } from '../utils/SpriteGenerator';
import type { StartupParams } from '../main';

export class TestBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TestBootScene' });
  }

  create(): void {
    const generator = new SpriteGenerator(this);
    generator.generateAll();

    const startupParams = (window as unknown as { startupParams?: StartupParams }).startupParams;

    if (startupParams?.scene === 'TestHarnessScene') {
      this.scene.start('TestHarnessScene');
    } else {
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    }
  }
}
