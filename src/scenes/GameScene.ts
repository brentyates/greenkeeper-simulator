import Phaser from 'phaser';
import { Player } from '../gameobjects/Player';
import { GrassSystem } from '../systems/GrassSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { EquipmentManager } from '../systems/EquipmentManager';
import { GameStateManager } from '../systems/GameStateManager';
import { AudioManager } from '../systems/AudioManager';
import { COURSE_HOLE_1, REFILL_STATIONS } from '../data/courseData';
import { GameStateLoader } from '../systems/GameStateLoader';
import type { StartupParams } from '../main';

interface SaveData {
  version: string;
  timestamp: number;
  timeSystem: object;
  grassCells: object;
  equipment: object;
  gameState: object;
  playerPosition: { x: number; y: number };
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private grassSystem!: GrassSystem;
  private timeSystem!: TimeSystem;
  private equipmentManager!: EquipmentManager;
  private gameStateManager!: GameStateManager;
  private audioManager!: AudioManager;

  private cursors!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyTab!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyPlus!: Phaser.Input.Keyboard.Key;
  private keyMinus!: Phaser.Input.Keyboard.Key;
  private key1!: Phaser.Input.Keyboard.Key;
  private key2!: Phaser.Input.Keyboard.Key;
  private key3!: Phaser.Input.Keyboard.Key;
  private keyF5!: Phaser.Input.Keyboard.Key;
  private keyF6!: Phaser.Input.Keyboard.Key;
  private keyF12!: Phaser.Input.Keyboard.Key;
  private keyBracketLeft!: Phaser.Input.Keyboard.Key;
  private keyBracketRight!: Phaser.Input.Keyboard.Key;

  private refillStationSprites: Phaser.GameObjects.Sprite[] = [];
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private daylightOverlay!: Phaser.GameObjects.Rectangle;
  private isPaused = false;
  private lastAutoSave = 0;
  private previousDay = 1;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { loadSave?: boolean }): void {
    if (data.loadSave) {
      this.events.once('create', () => this.loadGame());
    }
  }

  create(): void {
    const startupParams = (window as unknown as { startupParams?: StartupParams }).startupParams;
    const isTestMode = startupParams?.testMode === true;
    if (!isTestMode) {
      this.cameras.main.fadeIn(500, 0, 0, 0);
    }
    this.grassSystem = new GrassSystem(this, COURSE_HOLE_1);

    const tileSize = this.grassSystem.getTileSize();

    const bottomLeft = this.grassSystem.gridToScreen(0, COURSE_HOLE_1.height - 1);
    const topRight = this.grassSystem.gridToScreen(COURSE_HOLE_1.width - 1, 0);
    const bottomRight = this.grassSystem.gridToScreen(COURSE_HOLE_1.width - 1, COURSE_HOLE_1.height - 1);

    const padding = 64;
    const minX = bottomLeft.x - tileSize.width / 2 - padding;
    const maxX = topRight.x + tileSize.width / 2 + padding;
    const minY = -tileSize.height / 2 - padding;
    const maxY = bottomRight.y + tileSize.height / 2 + padding;

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    this.physics.world.setBounds(minX, minY, worldWidth, worldHeight);
    this.cameras.main.setBounds(minX, minY, worldWidth, worldHeight);

    const startGridX = 24;
    const startGridY = 34;
    const startPos = this.grassSystem.gridToScreen(startGridX, startGridY);

    this.player = new Player(this, startPos.x, startPos.y);
    this.player.setMapSize(COURSE_HOLE_1.width, COURSE_HOLE_1.height);
    this.player.setMoveChecker((fromX, fromY, toX, toY) => this.grassSystem.canMoveFromTo(fromX, fromY, toX, toY));
    this.player.setElevationGetter((x, y) => this.grassSystem.getElevation(x, y));

    this.cameras.main.centerOn(startPos.x, startPos.y);
    const lerpAmount = isTestMode ? 1.0 : 0.1;
    this.cameras.main.startFollow(this.player, true, lerpAmount, lerpAmount);
    if (!isTestMode) {
      this.cameras.main.setDeadzone(100, 75);
    }

    this.timeSystem = new TimeSystem();
    this.equipmentManager = new EquipmentManager(this, this.player, this.grassSystem);
    this.gameStateManager = new GameStateManager(this.grassSystem);
    this.audioManager = new AudioManager();

    this.createRefillStations();
    this.setupInput();
    this.createPauseOverlay();
    this.createDaylightOverlay();

    this.loadStartupState();
    this.signalGameReady();
  }

  private signalGameReady(): void {
    (window as unknown as { __gameReady: boolean }).__gameReady = true;

    const readyElement = document.createElement('div');
    readyElement.id = 'game-ready';
    document.body.appendChild(readyElement);
  }

  private loadStartupState(): void {
    const startupParams = (window as unknown as { startupParams?: StartupParams }).startupParams;
    if (startupParams?.state) {
      GameStateLoader.loadFullState(
        this.grassSystem,
        this.player,
        this.equipmentManager,
        this.timeSystem,
        this.gameStateManager,
        this.cameras.main,
        startupParams.state
      );
      console.log('Loaded state from startup params');
    }
  }

  private createDaylightOverlay(): void {
    const tileSize = this.grassSystem.getTileSize();

    const bottomLeft = this.grassSystem.gridToScreen(0, COURSE_HOLE_1.height - 1);
    const topRight = this.grassSystem.gridToScreen(COURSE_HOLE_1.width - 1, 0);
    const bottomRight = this.grassSystem.gridToScreen(COURSE_HOLE_1.width - 1, COURSE_HOLE_1.height - 1);

    const padding = 128;
    const minX = bottomLeft.x - tileSize.width / 2 - padding;
    const maxX = topRight.x + tileSize.width / 2 + padding;
    const minY = -tileSize.height / 2 - padding;
    const maxY = bottomRight.y + tileSize.height / 2 + padding;

    const overlayWidth = maxX - minX;
    const overlayHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.daylightOverlay = this.add.rectangle(
      centerX,
      centerY,
      overlayWidth,
      overlayHeight,
      0xffffff,
      0
    );
    this.daylightOverlay.setDepth(50);
    this.daylightOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private createRefillStations(): void {
    REFILL_STATIONS.forEach(station => {
      const pos = this.grassSystem.gridToScreen(station.x, station.y);
      const sprite = this.add.sprite(pos.x, pos.y, 'iso_refill_station');
      sprite.setDepth(station.x + station.y + 5);
      this.refillStationSprites.push(sprite);
    });
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;

    const arrows = this.input.keyboard.createCursorKeys();
    this.cursors = {
      up: arrows.up!,
      down: arrows.down!,
      left: arrows.left!,
      right: arrows.right!,
      w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyTab = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keyM = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyPlus = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    this.keyMinus = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
    this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keyF5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.keyF6 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F6);
    this.keyF12 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F12);
    this.keyBracketLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
    this.keyBracketRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);

    this.keyTab.on('down', () => {
      const mode = this.grassSystem.cycleOverlayMode();
      this.showNotification(`Overlay: ${mode}`);
    });

    this.keyP.on('down', () => this.togglePause());
    this.keyEsc.on('down', () => this.togglePause());

    this.keyM.on('down', () => {
      const muted = this.audioManager.toggleMute();
      this.showNotification(muted ? 'Muted' : 'Unmuted');
    });

    this.keyPlus.on('down', () => {
      this.timeSystem.increaseTimeScale();
      this.showNotification(`Time: ${this.timeSystem.getTimeScale()}x`);
    });

    this.keyMinus.on('down', () => {
      this.timeSystem.decreaseTimeScale();
      this.showNotification(`Time: ${this.timeSystem.getTimeScale()}x`);
    });

    this.key1.on('down', () => {
      this.equipmentManager.switchTo('mower');
      this.showNotification('Mower selected');
    });

    this.key2.on('down', () => {
      this.equipmentManager.switchTo('sprinkler');
      this.showNotification('Sprinkler selected');
    });

    this.key3.on('down', () => {
      this.equipmentManager.switchTo('spreader');
      this.showNotification('Spreader selected');
    });

    this.keyE.on('down', () => this.tryRefill());

    this.keyF5.on('down', () => {
      const startupParams = (window as unknown as { startupParams?: StartupParams }).startupParams;
      if (startupParams?.state) {
        GameStateLoader.loadFullState(
          this.grassSystem,
          this.player,
          this.equipmentManager,
          this.timeSystem,
          this.gameStateManager,
          this.cameras.main,
          startupParams.state
        );
        this.showNotification('State reloaded');
      } else {
        this.showNotification('No state to reload');
      }
    });

    this.keyF6.on('down', () => {
      if ((window as unknown as { exportGameState?: () => void }).exportGameState) {
        (window as unknown as { exportGameState: () => void }).exportGameState();
        this.showNotification('State exported to console');
      }
    });

    this.keyF12.on('down', () => {
      if ((window as unknown as { captureScreenshot?: () => Promise<string> }).captureScreenshot) {
        (window as unknown as { captureScreenshot: () => Promise<string> }).captureScreenshot()
          .then(() => this.showNotification('Screenshot saved'))
          .catch(() => this.showNotification('Screenshot failed'));
      }
    });

    this.keyBracketLeft.on('down', () => {
      const newZoom = Math.max(0.5, this.cameras.main.zoom - 0.25);
      this.cameras.main.setZoom(newZoom);
      this.showNotification(`Zoom: ${(newZoom * 100).toFixed(0)}%`);
    });

    this.keyBracketRight.on('down', () => {
      const newZoom = Math.min(2, this.cameras.main.zoom + 0.25);
      this.cameras.main.setZoom(newZoom);
      this.showNotification(`Zoom: ${(newZoom * 100).toFixed(0)}%`);
    });
  }

  private createPauseOverlay(): void {
    this.pauseOverlay = this.add.container(400, 300);
    this.pauseOverlay.setScrollFactor(0);
    this.pauseOverlay.setDepth(100);
    this.pauseOverlay.setVisible(false);

    const bgOverlay = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.75);
    this.pauseOverlay.add(bgOverlay);

    const panelShadow = this.add.rectangle(5, 5, 320, 380, 0x000000, 0.4);
    this.pauseOverlay.add(panelShadow);

    const panel = this.add.rectangle(0, 0, 320, 380, 0x1a3a2a, 0.98);
    panel.setStrokeStyle(3, 0x4a8a5a);
    this.pauseOverlay.add(panel);

    const headerBg = this.add.rectangle(0, -155, 316, 50, 0x2a5a3a);
    this.pauseOverlay.add(headerBg);

    const pauseIcon = this.add.text(-60, -155, '⏸️', { fontSize: '28px' }).setOrigin(0.5);
    this.pauseOverlay.add(pauseIcon);

    const title = this.add.text(10, -155, 'PAUSED', {
      fontSize: '32px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.pauseOverlay.add(title);

    const divider = this.add.rectangle(0, -115, 280, 2, 0x4a8a5a, 0.5);
    this.pauseOverlay.add(divider);

    const tipText = this.add.text(0, -80, '💡 Press P or ESC to resume', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#7a9a7a'
    }).setOrigin(0.5);
    this.pauseOverlay.add(tipText);

    const buttons = [
      { text: '▶️  Resume', y: -20, callback: () => this.togglePause() },
      { text: '🔄  Restart', y: 55, callback: () => this.restartGame() },
      { text: '🏠  Main Menu', y: 130, callback: () => this.goToMainMenu() }
    ];

    buttons.forEach(btn => {
      const buttonContainer = this.add.container(0, btn.y);

      const btnShadow = this.add.rectangle(2, 2, 220, 50, 0x000000, 0.3);
      buttonContainer.add(btnShadow);

      const btnBg = this.add.rectangle(0, 0, 220, 50, 0x2a5a3a);
      btnBg.setStrokeStyle(2, 0x4a8a5a);
      buttonContainer.add(btnBg);

      const btnHighlight = this.add.rectangle(0, -12, 216, 23, 0x3d7a4f, 0.3);
      buttonContainer.add(btnHighlight);

      const btnText = this.add.text(0, 0, btn.text, {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      buttonContainer.add(btnText);

      btnBg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          btnBg.setFillStyle(0x3d7a4f);
          btnBg.setStrokeStyle(3, 0x7FFF7F);
          this.tweens.add({
            targets: buttonContainer,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 100
          });
        })
        .on('pointerout', () => {
          btnBg.setFillStyle(0x2a5a3a);
          btnBg.setStrokeStyle(2, 0x4a8a5a);
          this.tweens.add({
            targets: buttonContainer,
            scaleX: 1,
            scaleY: 1,
            duration: 100
          });
        })
        .on('pointerdown', () => {
          this.tweens.add({
            targets: buttonContainer,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 50,
            yoyo: true,
            onComplete: btn.callback
          });
        });

      this.pauseOverlay!.add(buttonContainer);
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.timeSystem.togglePause();
    this.pauseOverlay?.setVisible(this.isPaused);

    if (this.isPaused) {
      this.equipmentManager.deactivateCurrent();
      this.audioManager.mute();
    } else {
      this.audioManager.unmute();
    }
  }

  private restartGame(): void {
    this.audioManager.destroy();
    this.scene.restart();
  }

  private goToMainMenu(): void {
    this.saveGame();
    this.audioManager.destroy();
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }

  private tryRefill(): void {
    const playerPos = this.player.getGridPosition();

    for (const station of REFILL_STATIONS) {
      const dx = Math.abs(playerPos.x - station.x);
      const dy = Math.abs(playerPos.y - station.y);

      if (dx <= 2 && dy <= 2) {
        this.equipmentManager.refillAll();
        this.audioManager.playRefill();
        this.showNotification('Equipment refilled!');
        return;
      }
    }

    this.showNotification('No refill station nearby');
  }

  private showNotification(message: string): void {
    const uiScene = this.scene.get('UIScene') as { showNotification?: (msg: string, duration: number) => void };
    if (uiScene.showNotification) {
      uiScene.showNotification(message, 2000);
    }
  }

  update(time: number, delta: number): void {
    if (this.isPaused) return;

    this.player.update(this.cursors);

    const timeIsPaused = this.timeSystem.getIsPaused();
    this.timeSystem.update(delta);

    if (!timeIsPaused) {
      this.grassSystem.update(this.timeSystem.getGameTime(), delta * this.timeSystem.getTimeScale());
    }

    this.equipmentManager.update(time, delta);
    this.gameStateManager.update(delta);

    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.equipmentManager.activateCurrent();
      this.startEquipmentAudio();
    }

    if (Phaser.Input.Keyboard.JustUp(this.keySpace)) {
      this.equipmentManager.deactivateCurrent();
      this.stopEquipmentAudio();
    }

    const currentDay = this.timeSystem.getCurrentDay();
    if (currentDay !== this.previousDay) {
      this.previousDay = currentDay;
      this.gameStateManager.onNewDay();
      this.showNotification(`Day ${currentDay} begins!`);
    }

    if (time - this.lastAutoSave > 300000) {
      this.lastAutoSave = time;
      this.saveGame();
      this.showNotification('Game saved');
    }

    const tint = this.timeSystem.getDaylightTint();
    this.daylightOverlay.setFillStyle(tint, 0.15);
  }

  private startEquipmentAudio(): void {
    const type = this.equipmentManager.getCurrentType();
    switch (type) {
      case 'mower':
        this.audioManager.playMowerLoop();
        break;
      case 'sprinkler':
        this.audioManager.playSprayLoop();
        break;
      case 'spreader':
        this.audioManager.playSpreaderLoop();
        break;
    }
  }

  private stopEquipmentAudio(): void {
    this.audioManager.stopMowerLoop();
    this.audioManager.stopSprayLoop();
    this.audioManager.stopSpreaderLoop();
  }

  saveGame(): void {
    const saveData: SaveData = {
      version: '1.0.0',
      timestamp: Date.now(),
      timeSystem: this.timeSystem.getSerializableState(),
      grassCells: this.grassSystem.getSerializableState(),
      equipment: this.equipmentManager.getSerializableState(),
      gameState: this.gameStateManager.getSerializableState(),
      playerPosition: { x: this.player.x, y: this.player.y }
    };

    localStorage.setItem('greenkeeper_save', JSON.stringify(saveData));
  }

  loadGame(): void {
    const saveString = localStorage.getItem('greenkeeper_save');
    if (!saveString) return;

    try {
      const saveData = JSON.parse(saveString) as SaveData;

      this.timeSystem.loadState(saveData.timeSystem as Parameters<TimeSystem['loadState']>[0]);
      this.grassSystem.loadState(saveData.grassCells as Parameters<GrassSystem['loadState']>[0]);
      this.equipmentManager.loadState(saveData.equipment as Parameters<EquipmentManager['loadState']>[0]);
      this.gameStateManager.loadState(saveData.gameState as Parameters<GameStateManager['loadState']>[0]);

      this.player.setPosition(saveData.playerPosition.x, saveData.playerPosition.y);

      this.showNotification('Game loaded');
    } catch {
      console.error('Failed to load save');
    }
  }

  getGrassSystem(): GrassSystem {
    return this.grassSystem;
  }

  getTimeSystem(): TimeSystem {
    return this.timeSystem;
  }

  getEquipmentManager(): EquipmentManager {
    return this.equipmentManager;
  }

  getGameStateManager(): GameStateManager {
    return this.gameStateManager;
  }

  getPlayer(): Player {
    return this.player;
  }
}
