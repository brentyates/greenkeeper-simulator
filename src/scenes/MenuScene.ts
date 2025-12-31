import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  private currentScreen: 'main' | 'help' | 'settings' = 'main';
  private buttonsContainer!: Phaser.GameObjects.Container;
  private backgroundElements!: Phaser.GameObjects.Container;
  private animatedGrass: Phaser.GameObjects.Rectangle[] = [];
  private menuButtons: { container: Phaser.GameObjects.Container; callback: () => void; bg: Phaser.GameObjects.Rectangle }[] = [];
  private selectedIndex = 0;
  private keyboardEnabled = true;
  private audioContext: AudioContext | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.initAudio();
    this.createAnimatedBackground();
    this.createMainMenu();
    this.setupKeyboardNavigation();
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      this.audioContext = null;
    }
  }

  private playHoverSound(): void {
    if (!this.audioContext) return;
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.5');
    if (sfxVolume === 0) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1 * sfxVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  private playClickSound(): void {
    if (!this.audioContext) return;
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.5');
    if (sfxVolume === 0) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 660;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.15 * sfxVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  private playNavigateSound(): void {
    if (!this.audioContext) return;
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.5');
    if (sfxVolume === 0) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 330;
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.08 * sfxVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.08);
  }

  private setupKeyboardNavigation(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown-UP', () => {
      if (!this.keyboardEnabled || this.menuButtons.length === 0) return;
      this.selectButton((this.selectedIndex - 1 + this.menuButtons.length) % this.menuButtons.length);
    });

    this.input.keyboard.on('keydown-DOWN', () => {
      if (!this.keyboardEnabled || this.menuButtons.length === 0) return;
      this.selectButton((this.selectedIndex + 1) % this.menuButtons.length);
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      if (!this.keyboardEnabled || this.menuButtons.length === 0) return;
      this.activateButton(this.selectedIndex);
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.keyboardEnabled || this.menuButtons.length === 0) return;
      this.activateButton(this.selectedIndex);
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.currentScreen !== 'main') {
        this.createMainMenu();
      }
    });
  }

  private selectButton(index: number): void {
    if (index !== this.selectedIndex) {
      this.playNavigateSound();
    }
    this.menuButtons.forEach((btn, i) => {
      if (i === index) {
        btn.bg.setFillStyle(0x3d7a4f);
        btn.bg.setStrokeStyle(3, 0x7FFF7F);
        this.tweens.add({
          targets: btn.container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100
        });
      } else {
        btn.bg.setFillStyle(0x2a5a3a);
        btn.bg.setStrokeStyle(2, 0x4a8a5a);
        this.tweens.add({
          targets: btn.container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      }
    });
    this.selectedIndex = index;
  }

  private activateButton(index: number): void {
    const btn = this.menuButtons[index];
    if (!btn) return;

    this.playClickSound();
    this.tweens.add({
      targets: btn.container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
      yoyo: true,
      onComplete: btn.callback
    });
  }

  private createAnimatedBackground(): void {
    this.backgroundElements = this.add.container(0, 0);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x1a472a, 0x1a472a, 0x2d5a3f, 0x2d5a3f, 1);
    gradient.fillRect(0, 0, width, height);
    this.backgroundElements.add(gradient);

    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(height * 0.6, height);
      const grassHeight = Phaser.Math.Between(8, 20);
      const grass = this.add.rectangle(x, y, 3, grassHeight, 0x3d7a4f);
      grass.setOrigin(0.5, 1);
      this.backgroundElements.add(grass);
      this.animatedGrass.push(grass);
    }

    this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 3000,
      repeat: -1,
      onUpdate: (tween) => {
        const value = tween.getValue();
        this.animatedGrass.forEach((grass, index) => {
          const offset = index * 15;
          grass.setRotation(Math.sin((value + offset) * Math.PI / 180) * 0.1);
        });
      }
    });

    const fairwayStripes = this.add.graphics();
    for (let i = 0; i < 20; i++) {
      const y = height * 0.55 + i * 12;
      fairwayStripes.fillStyle(i % 2 === 0 ? 0x2a6b3a : 0x327a45, 0.3);
      fairwayStripes.fillRect(0, y, width, 12);
    }
    this.backgroundElements.add(fairwayStripes);

    this.createDecorations();
  }

  private createDecorations(): void {
    const width = this.cameras.main.width;

    this.drawTree(80, 180);
    this.drawTree(720, 200);
    this.drawTree(50, 320);
    this.drawTree(750, 340);

    this.drawFlag(680, 420);

    this.drawBunker(150, 480);
    this.drawBunker(620, 500);

    this.drawGolfBall(200, 520);
    this.drawGolfBall(580, 490);
  }

  private drawTree(x: number, y: number): void {
    const tree = this.add.container(x, y);

    const trunk = this.add.rectangle(0, 20, 12, 40, 0x5c3d2e);
    trunk.setOrigin(0.5, 0);

    const shadow = this.add.ellipse(0, 60, 50, 15, 0x000000, 0.2);

    const foliage1 = this.add.circle(0, -10, 30, 0x2d5a3f);
    const foliage2 = this.add.circle(-15, 5, 22, 0x3d7a4f);
    const foliage3 = this.add.circle(15, 5, 22, 0x3d7a4f);
    const foliage4 = this.add.circle(0, -30, 20, 0x4a8a5a);

    tree.add([shadow, trunk, foliage1, foliage2, foliage3, foliage4]);
    this.backgroundElements.add(tree);
  }

  private drawFlag(x: number, y: number): void {
    const flag = this.add.container(x, y);

    const pole = this.add.rectangle(0, -40, 3, 80, 0xcccccc);
    pole.setOrigin(0.5, 1);

    const flagCloth = this.add.triangle(2, -75, 0, 0, 30, 10, 0, 20, 0xff4444);

    const hole = this.add.ellipse(0, 0, 20, 8, 0x111111);

    flag.add([hole, pole, flagCloth]);
    this.backgroundElements.add(flag);

    this.tweens.add({
      targets: flagCloth,
      scaleX: 0.9,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private drawBunker(x: number, y: number): void {
    const bunker = this.add.container(x, y);

    const sand = this.add.ellipse(0, 0, 60, 25, 0xd4b896);
    const sandHighlight = this.add.ellipse(-5, -3, 40, 15, 0xe8d4b8, 0.5);

    bunker.add([sand, sandHighlight]);
    this.backgroundElements.add(bunker);
  }

  private drawGolfBall(x: number, y: number): void {
    const ball = this.add.container(x, y);

    const shadow = this.add.ellipse(2, 3, 10, 4, 0x000000, 0.3);
    const ballBody = this.add.circle(0, 0, 6, 0xffffff);
    const highlight = this.add.circle(-2, -2, 2, 0xffffff);

    ball.add([shadow, ballBody, highlight]);
    this.backgroundElements.add(ball);
  }

  private createMainMenu(): void {
    this.clearScreen();
    this.currentScreen = 'main';

    const centerX = this.cameras.main.width / 2;

    const titleContainer = this.add.container(centerX, 100);

    const titleShadow = this.add.text(3, 3, 'GREENKEEPER', {
      fontSize: '52px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#000000'
    }).setOrigin(0.5).setAlpha(0.3);

    const title = this.add.text(0, 0, 'GREENKEEPER', {
      fontSize: '52px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    const subtitleShadow = this.add.text(2, 52, 'SIMULATOR', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#000000'
    }).setOrigin(0.5).setAlpha(0.3);

    const subtitle = this.add.text(0, 50, 'SIMULATOR', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#7FFF7F'
    }).setOrigin(0.5);

    titleContainer.add([titleShadow, title, subtitleShadow, subtitle]);

    this.tweens.add({
      targets: titleContainer,
      y: 105,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.buttonsContainer = this.add.container(centerX, 280);

    const hasSave = localStorage.getItem('greenkeeper_save') !== null;
    const buttons: { text: string; callback: () => void; icon?: string }[] = [];

    if (hasSave) {
      buttons.push({ text: 'Continue', callback: () => this.loadAndStartGame(), icon: '▶' });
    }
    buttons.push({ text: 'New Game', callback: () => this.startGame(), icon: '🌱' });
    buttons.push({ text: 'How to Play', callback: () => this.showHowToPlay(), icon: '📖' });
    buttons.push({ text: 'Settings', callback: () => this.showSettings(), icon: '⚙' });

    buttons.forEach((btn, index) => {
      const button = this.createMenuButton(0, index * 65, btn.text, btn.callback, btn.icon);
      this.buttonsContainer.add(button);

      button.setAlpha(0);
      button.y += 20;
      this.tweens.add({
        targets: button,
        alpha: 1,
        y: button.y - 20,
        duration: 300,
        delay: index * 100,
        ease: 'Back.easeOut'
      });
    });

    const versionText = this.add.text(10, this.cameras.main.height - 25, 'v1.0.0', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#6a9c6a'
    });

    const credits = this.add.text(this.cameras.main.width - 10, this.cameras.main.height - 25, '© 2024 Greenkeeper Studios', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#6a9c6a'
    }).setOrigin(1, 0);

    this.time.delayedCall(buttons.length * 100 + 100, () => {
      if (this.menuButtons.length > 0) {
        this.selectButton(0);
      }
    });
  }

  private createMenuButton(x: number, y: number, text: string, callback: () => void, icon?: string, registerForKeyboard = true): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const width = 220;
    const height = 50;

    const shadow = this.add.rectangle(3, 3, width, height, 0x000000, 0.3);
    shadow.setStrokeStyle(0);

    const bg = this.add.rectangle(0, 0, width, height, 0x2a5a3a);
    bg.setStrokeStyle(2, 0x4a8a5a);

    const highlight = this.add.rectangle(0, -height / 4, width - 4, height / 2 - 2, 0x3d7a4f, 0.3);

    const displayText = icon ? `${icon}  ${text}` : text;
    const label = this.add.text(0, 0, displayText, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([shadow, bg, highlight, label]);

    if (registerForKeyboard) {
      this.menuButtons.push({ container, callback, bg });
    }

    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.playHoverSound();
        bg.setFillStyle(0x3d7a4f);
        bg.setStrokeStyle(3, 0x7FFF7F);
        this.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100
        });
        if (registerForKeyboard) {
          const index = this.menuButtons.findIndex(btn => btn.container === container);
          if (index !== -1) {
            this.selectedIndex = index;
          }
        }
      })
      .on('pointerout', () => {
        bg.setFillStyle(0x2a5a3a);
        bg.setStrokeStyle(2, 0x4a8a5a);
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      })
      .on('pointerdown', () => {
        this.playClickSound();
        this.tweens.add({
          targets: container,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 50,
          yoyo: true,
          onComplete: callback
        });
      });

    return container;
  }

  private clearScreen(): void {
    this.menuButtons = [];
    this.selectedIndex = 0;

    if (this.buttonsContainer) {
      this.buttonsContainer.destroy();
    }
    this.children.list
      .filter(child => child !== this.backgroundElements && !this.backgroundElements.list.includes(child))
      .forEach(child => {
        if (child !== this.backgroundElements) {
          child.destroy();
        }
      });
  }

  private startGame(): void {
    this.keyboardEnabled = false;
    this.playClickSound();

    if (this.buttonsContainer) {
      this.tweens.add({
        targets: this.buttonsContainer,
        y: this.buttonsContainer.y + 50,
        alpha: 0,
        duration: 300,
        ease: 'Power2'
      });
    }

    this.time.delayedCall(200, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
      });
    });
  }

  private loadAndStartGame(): void {
    this.keyboardEnabled = false;
    this.playClickSound();

    if (this.buttonsContainer) {
      this.tweens.add({
        targets: this.buttonsContainer,
        y: this.buttonsContainer.y + 50,
        alpha: 0,
        duration: 300,
        ease: 'Power2'
      });
    }

    this.time.delayedCall(200, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        this.scene.start('GameScene', { loadSave: true });
        this.scene.launch('UIScene');
      });
    });
  }

  private showHowToPlay(): void {
    this.clearScreen();
    this.currentScreen = 'help';

    const centerX = this.cameras.main.width / 2;
    const panelWidth = 600;
    const panelHeight = 480;

    const panel = this.createPanel(centerX, 280, panelWidth, panelHeight, 'HOW TO PLAY');

    const controlGroups = [
      {
        title: 'MOVEMENT',
        controls: [
          { key: 'WASD / ↑↓←→', action: 'Move around the course' }
        ]
      },
      {
        title: 'EQUIPMENT',
        controls: [
          { key: '1', action: 'Mower - Cut grass to proper height' },
          { key: '2', action: 'Sprinkler - Water dry areas' },
          { key: '3', action: 'Spreader - Apply fertilizer' },
          { key: 'SPACE', action: 'Use selected equipment' },
          { key: 'E', action: 'Refill at stations' }
        ]
      },
      {
        title: 'OTHER',
        controls: [
          { key: 'TAB', action: 'Toggle overlay view' },
          { key: '+/-', action: 'Change time speed' },
          { key: 'P / ESC', action: 'Pause game' },
          { key: 'M', action: 'Toggle sound' }
        ]
      }
    ];

    let yOffset = -panelHeight / 2 + 70;

    controlGroups.forEach(group => {
      const groupTitle = this.add.text(0, yOffset, group.title, {
        fontSize: '16px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#7FFF7F'
      }).setOrigin(0.5);
      panel.add(groupTitle);
      yOffset += 25;

      group.controls.forEach(control => {
        const keyBg = this.add.rectangle(-panelWidth / 4, yOffset, 120, 24, 0x1a472a);
        keyBg.setStrokeStyle(1, 0x4a8a5a);

        const keyText = this.add.text(-panelWidth / 4, yOffset, control.key, {
          fontSize: '12px',
          fontFamily: 'Courier New, monospace',
          color: '#ffffff'
        }).setOrigin(0.5);

        const actionText = this.add.text(20, yOffset, control.action, {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          color: '#cccccc'
        }).setOrigin(0, 0.5);

        panel.add([keyBg, keyText, actionText]);
        yOffset += 28;
      });
      yOffset += 10;
    });

    const tipBox = this.add.rectangle(0, panelHeight / 2 - 60, panelWidth - 40, 50, 0x1a5a2a, 0.8);
    tipBox.setStrokeStyle(2, 0x4a8a5a);
    const tipText = this.add.text(0, panelHeight / 2 - 60, '💡 TIP: Keep grass at optimal height and ensure proper moisture for best course health!', {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaffaa',
      wordWrap: { width: panelWidth - 60 },
      align: 'center'
    }).setOrigin(0.5);
    panel.add([tipBox, tipText]);

    const backBtn = this.createMenuButton(0, panelHeight / 2 - 10, '← Back', () => this.createMainMenu(), undefined, true);
    panel.add(backBtn);

    if (this.menuButtons.length > 0) {
      this.selectButton(0);
    }
  }

  private showSettings(): void {
    this.clearScreen();
    this.currentScreen = 'settings';

    const centerX = this.cameras.main.width / 2;
    const panelWidth = 500;
    const panelHeight = 400;

    const panel = this.createPanel(centerX, 280, panelWidth, panelHeight, 'SETTINGS');

    const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.5');
    const sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.5');

    const musicLabel = this.add.text(-panelWidth / 4 + 20, -80, '🎵 Music Volume', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    panel.add(musicLabel);

    const musicSlider = this.createSlider(60, -80, 180, musicVolume, (value) => {
      localStorage.setItem('musicVolume', value.toString());
    });
    panel.add(musicSlider);

    const sfxLabel = this.add.text(-panelWidth / 4 + 20, -20, '🔊 SFX Volume', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    panel.add(sfxLabel);

    const sfxSlider = this.createSlider(60, -20, 180, sfxVolume, (value) => {
      localStorage.setItem('sfxVolume', value.toString());
    });
    panel.add(sfxSlider);

    const fullscreenBtn = this.createMenuButton(0, 60, '⛶ Fullscreen', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    });
    panel.add(fullscreenBtn);

    const clearSaveBtn = this.createMenuButton(0, 130, '🗑 Clear Save Data', () => {
      localStorage.removeItem('greenkeeper_save');
      this.showNotification('Save data cleared!');
    });
    panel.add(clearSaveBtn);

    const backBtn = this.createMenuButton(0, panelHeight / 2 - 35, '← Back', () => this.createMainMenu(), undefined, true);
    panel.add(backBtn);

    if (this.menuButtons.length > 0) {
      this.selectButton(0);
    }
  }

  private createPanel(x: number, y: number, width: number, height: number, title: string): Phaser.GameObjects.Container {
    const panel = this.add.container(x, y);

    const shadowBg = this.add.rectangle(5, 5, width, height, 0x000000, 0.4);
    shadowBg.setStrokeStyle(0);

    const bg = this.add.rectangle(0, 0, width, height, 0x1a3a2a, 0.95);
    bg.setStrokeStyle(3, 0x4a8a5a);

    const headerBg = this.add.rectangle(0, -height / 2 + 30, width - 4, 50, 0x2a5a3a);

    const titleText = this.add.text(0, -height / 2 + 30, title, {
      fontSize: '24px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    panel.add([shadowBg, bg, headerBg, titleText]);

    panel.setAlpha(0);
    panel.setScale(0.9);
    this.tweens.add({
      targets: panel,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    return panel;
  }

  private createSlider(x: number, y: number, width: number, initialValue: number, onChange: (value: number) => void): Phaser.GameObjects.Container {
    const slider = this.add.container(x, y);
    const height = 8;
    const handleRadius = 14;

    const trackBg = this.add.rectangle(width / 2, 0, width, height, 0x1a472a);
    trackBg.setStrokeStyle(1, 0x2a5a3a);

    const fill = this.add.rectangle(0, 0, width * initialValue, height, 0x4a8a5a);
    fill.setOrigin(0, 0.5);

    const handleShadow = this.add.circle(width * initialValue + 2, 2, handleRadius, 0x000000, 0.3);
    const handle = this.add.circle(width * initialValue, 0, handleRadius, 0x7FFF7F);
    handle.setStrokeStyle(2, 0xffffff);

    const valueText = this.add.text(width + 25, 0, `${Math.round(initialValue * 100)}%`, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa'
    }).setOrigin(0, 0.5);

    slider.add([trackBg, fill, handleShadow, handle, valueText]);

    const hitArea = this.add.rectangle(width / 2, 0, width + 30, 40, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true, draggable: true });
    slider.add(hitArea);

    hitArea.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const localX = dragX - x;
      const clampedX = Phaser.Math.Clamp(localX, 0, width);
      const value = clampedX / width;

      handle.x = clampedX;
      handleShadow.x = clampedX + 2;
      fill.width = width * value;
      valueText.setText(`${Math.round(value * 100)}%`);
      onChange(value);
    });

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - slider.x - (slider.parentContainer?.x || 0);
      const clampedX = Phaser.Math.Clamp(localX, 0, width);
      const value = clampedX / width;

      handle.x = clampedX;
      handleShadow.x = clampedX + 2;
      fill.width = width * value;
      valueText.setText(`${Math.round(value * 100)}%`);
      onChange(value);
    });

    return slider;
  }

  private showNotification(message: string): void {
    const notification = this.add.container(this.cameras.main.width / 2, 550);

    const bg = this.add.rectangle(0, 0, 200, 40, 0x2a5a3a, 0.9);
    bg.setStrokeStyle(2, 0x7FFF7F);

    const text = this.add.text(0, 0, message, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);

    notification.add([bg, text]);

    this.tweens.add({
      targets: notification,
      y: 500,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }
}
