import Phaser from 'phaser';
import { SpriteGenerator } from '../utils/SpriteGenerator';

export class BootScene extends Phaser.Scene {
  private loadingBarBg!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;
  private spinnerAngle = 0;
  private spinner!: Phaser.GameObjects.Graphics;
  private grassBlades: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingScreen();
    this.simulateLoading();
  }

  private createLoadingScreen(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a472a, 0x1a472a, 0x0d2818, 0x0d2818, 1);
    bg.fillRect(0, 0, width, height);

    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(height * 0.7, height);
      const grassHeight = Phaser.Math.Between(10, 25);
      const grass = this.add.rectangle(x, y, 3, grassHeight, 0x2d5a3f);
      grass.setOrigin(0.5, 1);
      this.grassBlades.push(grass);
    }

    this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 2500,
      repeat: -1,
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        this.grassBlades.forEach((grass, index) => {
          const offset = index * 12;
          grass.setRotation(Math.sin((value + offset) * Math.PI / 180) * 0.15);
        });
      }
    });

    const logoContainer = this.add.container(width / 2, height / 2 - 100);

    const logoIcon = this.add.graphics();
    logoIcon.fillStyle(0x2d5a3f, 1);
    logoIcon.fillCircle(0, 0, 45);
    logoIcon.fillStyle(0x4a8a5a, 1);
    logoIcon.fillCircle(0, 0, 38);

    logoIcon.fillStyle(0x7FFF7F, 1);
    logoIcon.fillTriangle(-8, 10, 0, -20, 8, 10);
    logoIcon.fillRect(-3, 10, 6, 15);

    logoContainer.add(logoIcon);

    const titleShadow = this.add.text(3, 53, 'GREENKEEPER', {
      fontSize: '42px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#000000'
    }).setOrigin(0.5).setAlpha(0.3);
    logoContainer.add(titleShadow);

    const title = this.add.text(0, 50, 'GREENKEEPER', {
      fontSize: '42px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);
    logoContainer.add(title);

    const subtitleShadow = this.add.text(2, 92, 'SIMULATOR', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#000000'
    }).setOrigin(0.5).setAlpha(0.3);
    logoContainer.add(subtitleShadow);

    const subtitle = this.add.text(0, 90, 'SIMULATOR', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#7FFF7F'
    }).setOrigin(0.5);
    logoContainer.add(subtitle);

    this.tweens.add({
      targets: logoContainer,
      y: height / 2 - 95,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const barWidth = 320;
    const barHeight = 24;
    const barX = (width - barWidth) / 2;
    const barY = height / 2 + 80;

    this.loadingBarBg = this.add.graphics();
    this.loadingBarBg.fillStyle(0x0d2818, 0.9);
    this.loadingBarBg.fillRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);
    this.loadingBarBg.lineStyle(2, 0x3d7a4f, 1);
    this.loadingBarBg.strokeRoundedRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 8);

    this.loadingBarBg.fillStyle(0x1a3a2a, 1);
    this.loadingBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, 6);

    this.progressBar = this.add.graphics();

    this.spinner = this.add.graphics();
    this.spinner.setPosition(width / 2, barY + barHeight + 40);

    this.loadingText = this.add.text(width / 2, barY + barHeight + 70, 'Initializing...', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#7a9a7a'
    }).setOrigin(0.5);

    this.percentText = this.add.text(width / 2, barY + barHeight / 2, '0%', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 30, '© 2024 Greenkeeper Studios', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#3d5a4f'
    }).setOrigin(0.5);
  }

  private simulateLoading(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const barWidth = 320;
    const barHeight = 24;
    const barX = (width - barWidth) / 2;
    const barY = height / 2 + 80;

    const loadingSteps = [
      { progress: 0.08, text: '🌍 Generating terrain...' },
      { progress: 0.20, text: '🌿 Creating grass textures...' },
      { progress: 0.35, text: '💧 Adding water features...' },
      { progress: 0.50, text: '🚜 Building equipment...' },
      { progress: 0.65, text: '👤 Preparing player...' },
      { progress: 0.80, text: '🏌️ Setting up course...' },
      { progress: 0.92, text: '✨ Applying polish...' },
      { progress: 1.0, text: '✅ Ready to play!' }
    ];

    let stepIndex = 0;
    let currentProgress = 0;

    const updateSpinner = () => {
      this.spinnerAngle += 8;
      this.spinner.clear();

      for (let i = 0; i < 8; i++) {
        const angle = (this.spinnerAngle + i * 45) * Math.PI / 180;
        const alpha = (8 - i) / 8;
        const radius = 12;
        const dotX = Math.cos(angle) * radius;
        const dotY = Math.sin(angle) * radius;

        this.spinner.fillStyle(0x7FFF7F, alpha);
        this.spinner.fillCircle(dotX, dotY, 3);
      }
    };

    const spinnerTimer = this.time.addEvent({
      delay: 50,
      callback: updateSpinner,
      loop: true
    });

    const updateProgress = () => {
      if (stepIndex >= loadingSteps.length) {
        spinnerTimer.destroy();
        this.spinner.clear();

        this.createSprites();

        this.tweens.add({
          targets: [this.loadingText, this.percentText, this.loadingBarBg, this.progressBar],
          alpha: 0,
          duration: 300
        });

        this.time.delayedCall(500, () => {
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(400, () => {
            this.scene.start('MenuScene');
          });
        });
        return;
      }

      const step = loadingSteps[stepIndex];
      const targetProgress = step.progress;

      this.tweens.addCounter({
        from: currentProgress,
        to: targetProgress,
        duration: 150,
        onUpdate: (tween) => {
          const progress = tween.getValue() ?? 0;
          this.progressBar.clear();

          const gradient = this.progressBar;
          const fillWidth = (barWidth - 4) * progress;

          gradient.fillStyle(0x2d7a3f, 1);
          gradient.fillRoundedRect(barX + 2, barY + 2, fillWidth, barHeight - 4, 4);

          gradient.fillStyle(0x4a9a5a, 0.6);
          gradient.fillRoundedRect(barX + 2, barY + 2, fillWidth, (barHeight - 4) / 2, { tl: 4, tr: 4, bl: 0, br: 0 });

          this.percentText.setText(`${Math.floor(progress * 100)}%`);
        },
        onComplete: () => {
          currentProgress = targetProgress;
        }
      });

      this.loadingText.setText(step.text);

      stepIndex++;
      this.time.delayedCall(220, updateProgress);
    };

    this.time.delayedCall(300, updateProgress);
  }

  private createSprites(): void {
    const generator = new SpriteGenerator(this);
    generator.generateAll();
  }

  create(): void {
  }
}
