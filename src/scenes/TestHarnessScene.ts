import Phaser from 'phaser';
import { GameState, createDefaultGameState } from '../systems/GameState';
import { getPreset, listPresets } from '../data/testPresets';
import { COURSE_HOLE_1, getTerrainType } from '../data/courseData';
import { OverlayMode } from '../systems/GrassSystem';
import { Direction } from '../gameobjects/Player';

type StateCategory = 'player' | 'time' | 'equipment' | 'grass' | 'camera' | 'presets';

interface SliderConfig {
  label: string;
  min: number;
  max: number;
  step: number;
  getValue: () => number;
  setValue: (v: number) => void;
}

interface ButtonConfig {
  label: string;
  onClick: () => void;
}

export class TestHarnessScene extends Phaser.Scene {
  private state: GameState = createDefaultGameState();
  private categoryButtons: Phaser.GameObjects.Container[] = [];
  private controlsContainer!: Phaser.GameObjects.Container;
  private previewContainer!: Phaser.GameObjects.Container;
  private grassPreviewSprites: Phaser.GameObjects.Sprite[] = [];
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'TestHarnessScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a3a2a');

    this.add.text(400, 20, 'TEST HARNESS', {
      fontSize: '24px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#7FFF7F'
    }).setOrigin(0.5, 0);

    this.createCategoryTabs();
    this.controlsContainer = this.add.container(20, 100);
    this.previewContainer = this.add.container(550, 100);

    this.createPreviewArea();
    this.showCategory('player');
    this.setupInput();

    this.add.text(400, 580, 'ESC = Exit | ENTER = Apply & Play', {
      fontSize: '12px',
      color: '#7a9a7a'
    }).setOrigin(0.5);
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.keyEsc.on('down', () => {
      this.scene.start('MenuScene');
    });

    this.keyEnter.on('down', () => {
      this.applyAndPlay();
    });
  }

  private createCategoryTabs(): void {
    const categories: StateCategory[] = ['player', 'time', 'equipment', 'grass', 'camera', 'presets'];
    const startX = 50;
    const y = 60;
    const spacing = 120;

    categories.forEach((cat, i) => {
      const btn = this.createTabButton(startX + i * spacing, y, cat.toUpperCase(), () => {
        this.showCategory(cat);
      });
      this.categoryButtons.push(btn);
    });
  }

  private createTabButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 100, 30, 0x2a5a3a);
    bg.setStrokeStyle(2, 0x4a8a5a);
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(text);

    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x3d7a4f))
      .on('pointerout', () => bg.setFillStyle(0x2a5a3a))
      .on('pointerdown', onClick);

    return container;
  }

  private showCategory(category: StateCategory): void {
    this.controlsContainer.removeAll(true);

    switch (category) {
      case 'player':
        this.showPlayerControls();
        break;
      case 'time':
        this.showTimeControls();
        break;
      case 'equipment':
        this.showEquipmentControls();
        break;
      case 'grass':
        this.showGrassControls();
        break;
      case 'camera':
        this.showCameraControls();
        break;
      case 'presets':
        this.showPresetsControls();
        break;
    }
  }

  private showPlayerControls(): void {
    const sliders: SliderConfig[] = [
      {
        label: 'Grid X',
        min: 0, max: COURSE_HOLE_1.width - 1, step: 1,
        getValue: () => {
          const gridPos = this.screenToGrid(this.state.player.x, this.state.player.y);
          return gridPos.x;
        },
        setValue: (v) => {
          const gridPos = this.screenToGrid(this.state.player.x, this.state.player.y);
          const newPos = this.gridToScreen(v, gridPos.y);
          this.state.player.x = newPos.x;
          this.state.player.y = newPos.y;
        }
      },
      {
        label: 'Grid Y',
        min: 0, max: COURSE_HOLE_1.height - 1, step: 1,
        getValue: () => {
          const gridPos = this.screenToGrid(this.state.player.x, this.state.player.y);
          return gridPos.y;
        },
        setValue: (v) => {
          const gridPos = this.screenToGrid(this.state.player.x, this.state.player.y);
          const newPos = this.gridToScreen(gridPos.x, v);
          this.state.player.x = newPos.x;
          this.state.player.y = newPos.y;
        }
      },
      {
        label: 'Stamina',
        min: 0, max: 100, step: 5,
        getValue: () => this.state.player.stamina,
        setValue: (v) => { this.state.player.stamina = v; }
      }
    ];

    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const dirButtons: ButtonConfig[] = directions.map(dir => ({
      label: dir.toUpperCase(),
      onClick: () => { this.state.player.direction = dir; }
    }));

    this.createSliders(sliders);
    this.createButtonRow('Direction', dirButtons, 4);
  }

  private showTimeControls(): void {
    const sliders: SliderConfig[] = [
      {
        label: 'Current Hour',
        min: 0, max: 23, step: 1,
        getValue: () => this.state.time.currentHour,
        setValue: (v) => { this.state.time.currentHour = v; }
      },
      {
        label: 'Current Day',
        min: 1, max: 365, step: 1,
        getValue: () => this.state.time.currentDay,
        setValue: (v) => { this.state.time.currentDay = v; }
      },
      {
        label: 'Time Scale',
        min: 1, max: 100, step: 1,
        getValue: () => this.state.time.timeScale,
        setValue: (v) => { this.state.time.timeScale = v; }
      }
    ];

    const timeButtons: ButtonConfig[] = [
      { label: 'Dawn (6)', onClick: () => { this.state.time.currentHour = 6; } },
      { label: 'Noon (12)', onClick: () => { this.state.time.currentHour = 12; } },
      { label: 'Dusk (19)', onClick: () => { this.state.time.currentHour = 19; } },
      { label: 'Night (23)', onClick: () => { this.state.time.currentHour = 23; } }
    ];

    this.createSliders(sliders);
    this.createButtonRow('Quick Set', timeButtons, 4);
  }

  private showEquipmentControls(): void {
    const sliders: SliderConfig[] = [
      {
        label: 'Mower Fuel',
        min: 0, max: 100, step: 5,
        getValue: () => this.state.equipment.mowerResource,
        setValue: (v) => { this.state.equipment.mowerResource = v; }
      },
      {
        label: 'Sprinkler Water',
        min: 0, max: 100, step: 5,
        getValue: () => this.state.equipment.sprinklerResource,
        setValue: (v) => { this.state.equipment.sprinklerResource = v; }
      },
      {
        label: 'Spreader Fertilizer',
        min: 0, max: 100, step: 5,
        getValue: () => this.state.equipment.spreaderResource,
        setValue: (v) => { this.state.equipment.spreaderResource = v; }
      }
    ];

    const equipButtons: ButtonConfig[] = [
      { label: 'None', onClick: () => { this.state.equipment.currentType = null; } },
      { label: 'Mower', onClick: () => { this.state.equipment.currentType = 'mower'; } },
      { label: 'Sprinkler', onClick: () => { this.state.equipment.currentType = 'sprinkler'; } },
      { label: 'Spreader', onClick: () => { this.state.equipment.currentType = 'spreader'; } }
    ];

    this.createSliders(sliders);
    this.createButtonRow('Equipment', equipButtons, 4);
  }

  private showGrassControls(): void {
    const sliders: SliderConfig[] = [
      {
        label: 'All Height',
        min: 0, max: 100, step: 10,
        getValue: () => 50,
        setValue: (v) => { this.setAllGrassProperty('height', v); }
      },
      {
        label: 'All Moisture',
        min: 0, max: 100, step: 10,
        getValue: () => 50,
        setValue: (v) => { this.setAllGrassProperty('moisture', v); }
      },
      {
        label: 'All Nutrients',
        min: 0, max: 100, step: 10,
        getValue: () => 50,
        setValue: (v) => { this.setAllGrassProperty('nutrients', v); }
      }
    ];

    const overlayModes: OverlayMode[] = ['normal', 'moisture', 'nutrients', 'height'];
    const overlayButtons: ButtonConfig[] = overlayModes.map(mode => ({
      label: mode.charAt(0).toUpperCase() + mode.slice(1),
      onClick: () => { this.state.ui.overlayMode = mode; }
    }));

    this.createSliders(sliders);
    this.createButtonRow('Overlay', overlayButtons, 4);

    const quickSetButtons: ButtonConfig[] = [
      { label: 'All Mown', onClick: () => { this.setAllGrassProperty('height', 0); } },
      { label: 'All Overgrown', onClick: () => { this.setAllGrassProperty('height', 100); } },
      { label: 'All Dry', onClick: () => { this.setAllGrassProperty('moisture', 0); } },
      { label: 'All Watered', onClick: () => { this.setAllGrassProperty('moisture', 100); } }
    ];

    this.createButtonRow('Quick Set', quickSetButtons, 4, 280);
  }

  private showCameraControls(): void {
    const sliders: SliderConfig[] = [
      {
        label: 'Zoom',
        min: 0.5, max: 2, step: 0.1,
        getValue: () => this.state.camera.zoom,
        setValue: (v) => { this.state.camera.zoom = v; }
      },
      {
        label: 'Scroll X',
        min: -500, max: 2000, step: 50,
        getValue: () => this.state.camera.scrollX,
        setValue: (v) => { this.state.camera.scrollX = v; }
      },
      {
        label: 'Scroll Y',
        min: -500, max: 2000, step: 50,
        getValue: () => this.state.camera.scrollY,
        setValue: (v) => { this.state.camera.scrollY = v; }
      }
    ];

    const zoomButtons: ButtonConfig[] = [
      { label: '0.5x', onClick: () => { this.state.camera.zoom = 0.5; } },
      { label: '1x', onClick: () => { this.state.camera.zoom = 1; } },
      { label: '1.5x', onClick: () => { this.state.camera.zoom = 1.5; } },
      { label: '2x', onClick: () => { this.state.camera.zoom = 2; } }
    ];

    this.createSliders(sliders);
    this.createButtonRow('Quick Zoom', zoomButtons, 4);
  }

  private showPresetsControls(): void {
    const presetNames = listPresets();
    let yOffset = 0;

    this.add.text(0, yOffset, 'Available Presets:', {
      fontSize: '14px',
      color: '#7FFF7F'
    }).setOrigin(0, 0);
    this.controlsContainer.add(this.add.text(0, yOffset, 'Available Presets:', {
      fontSize: '14px',
      color: '#7FFF7F'
    }).setOrigin(0, 0));

    yOffset += 30;

    const columns = 2;
    const btnWidth = 200;
    const btnHeight = 30;
    const padding = 10;

    presetNames.forEach((name, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * (btnWidth + padding);
      const y = yOffset + row * (btnHeight + padding);

      const btn = this.createPresetButton(x, y, btnWidth, btnHeight, name);
      this.controlsContainer.add(btn);
    });
  }

  private createPresetButton(x: number, y: number, width: number, height: number, presetName: string): Phaser.GameObjects.Container {
    const container = this.add.container(x + width / 2, y + height / 2);

    const bg = this.add.rectangle(0, 0, width, height, 0x2a5a3a);
    bg.setStrokeStyle(1, 0x4a8a5a);
    container.add(bg);

    const displayName = presetName.replace(/_/g, ' ');
    const text = this.add.text(0, 0, displayName, {
      fontSize: '11px',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(text);

    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.setFillStyle(0x3d7a4f);
        bg.setStrokeStyle(2, 0x7FFF7F);
      })
      .on('pointerout', () => {
        bg.setFillStyle(0x2a5a3a);
        bg.setStrokeStyle(1, 0x4a8a5a);
      })
      .on('pointerdown', () => {
        const preset = getPreset(presetName);
        if (preset) {
          this.state = preset;
          this.updatePreview();
        }
      });

    return container;
  }

  private createSliders(sliders: SliderConfig[]): void {
    let yOffset = 0;

    sliders.forEach(config => {
      const row = this.createSliderRow(0, yOffset, config);
      this.controlsContainer.add(row);
      yOffset += 50;
    });
  }

  private createSliderRow(x: number, y: number, config: SliderConfig): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const label = this.add.text(0, 0, config.label, {
      fontSize: '12px',
      color: '#ffffff'
    });
    container.add(label);

    const sliderWidth = 200;
    const sliderX = 120;
    const sliderY = 10;

    const track = this.add.rectangle(sliderX + sliderWidth / 2, sliderY, sliderWidth, 8, 0x1a3a2a);
    track.setStrokeStyle(1, 0x4a8a5a);
    container.add(track);

    const initialValue = config.getValue();
    const initialPercent = (initialValue - config.min) / (config.max - config.min);
    const handleX = sliderX + initialPercent * sliderWidth;

    const handle = this.add.circle(handleX, sliderY, 8, 0x4a8a5a);
    handle.setStrokeStyle(2, 0x7FFF7F);
    container.add(handle);

    const valueText = this.add.text(sliderX + sliderWidth + 20, sliderY, initialValue.toFixed(1), {
      fontSize: '12px',
      color: '#7FFF7F'
    }).setOrigin(0, 0.5);
    container.add(valueText);

    track.setInteractive({ useHandCursor: true });
    handle.setInteractive({ useHandCursor: true, draggable: true });

    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.controlsContainer.x - x;
      const percent = Phaser.Math.Clamp((localX - sliderX) / sliderWidth, 0, 1);
      const value = config.min + percent * (config.max - config.min);
      const steppedValue = Math.round(value / config.step) * config.step;

      config.setValue(steppedValue);
      handle.x = sliderX + percent * sliderWidth;
      valueText.setText(steppedValue.toFixed(config.step < 1 ? 1 : 0));
      this.updatePreview();
    });

    handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const percent = Phaser.Math.Clamp((dragX - sliderX) / sliderWidth, 0, 1);
      const value = config.min + percent * (config.max - config.min);
      const steppedValue = Math.round(value / config.step) * config.step;

      config.setValue(steppedValue);
      handle.x = sliderX + percent * sliderWidth;
      valueText.setText(steppedValue.toFixed(config.step < 1 ? 1 : 0));
      this.updatePreview();
    });

    return container;
  }

  private createButtonRow(label: string, buttons: ButtonConfig[], cols: number, yOverride?: number): void {
    const y = yOverride ?? (this.controlsContainer.list.length > 0 ? 200 : 0);

    const labelText = this.add.text(0, y, label + ':', {
      fontSize: '12px',
      color: '#7a9a7a'
    });
    this.controlsContainer.add(labelText);

    const btnWidth = 80;
    const btnHeight = 28;
    const padding = 8;

    buttons.forEach((btn, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = col * (btnWidth + padding);
      const by = y + 20 + row * (btnHeight + padding);

      const container = this.add.container(bx + btnWidth / 2, by + btnHeight / 2);

      const bg = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x2a5a3a);
      bg.setStrokeStyle(1, 0x4a8a5a);
      container.add(bg);

      const text = this.add.text(0, 0, btn.label, {
        fontSize: '10px',
        color: '#ffffff'
      }).setOrigin(0.5);
      container.add(text);

      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(0x3d7a4f))
        .on('pointerout', () => bg.setFillStyle(0x2a5a3a))
        .on('pointerdown', () => {
          btn.onClick();
          this.updatePreview();
        });

      this.controlsContainer.add(container);
    });
  }

  private createPreviewArea(): void {
    const bg = this.add.rectangle(125, 200, 230, 380, 0x0d2818);
    bg.setStrokeStyle(2, 0x4a8a5a);
    this.previewContainer.add(bg);

    const title = this.add.text(125, 20, 'Preview', {
      fontSize: '14px',
      color: '#7FFF7F'
    }).setOrigin(0.5);
    this.previewContainer.add(title);

    this.updatePreview();
  }

  private updatePreview(): void {
    this.grassPreviewSprites.forEach(s => s.destroy());
    this.grassPreviewSprites = [];
  }

  private setAllGrassProperty(property: 'height' | 'moisture' | 'nutrients', value: number): void {
    if (!this.state.grassCells || this.state.grassCells.length === 0) {
      this.initializeGrassCells();
    }

    for (let y = 0; y < this.state.grassCells.length; y++) {
      for (let x = 0; x < this.state.grassCells[y].length; x++) {
        const cell = this.state.grassCells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          cell[property] = value;
        }
      }
    }
  }

  private initializeGrassCells(): void {
    this.state.grassCells = [];

    for (let y = 0; y < COURSE_HOLE_1.height; y++) {
      this.state.grassCells[y] = [];
      for (let x = 0; x < COURSE_HOLE_1.width; x++) {
        const terrainCode = COURSE_HOLE_1.layout[y]?.[x] ?? 1;
        const type = getTerrainType(terrainCode);

        this.state.grassCells[y][x] = {
          x,
          y,
          type,
          height: 50,
          moisture: 50,
          nutrients: 50,
          health: 100,
          lastMowed: 0,
          lastWatered: 0,
          lastFertilized: 0
        };
      }
    }
  }

  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const TILE_WIDTH = 64;
    const TILE_HEIGHT = 32;
    const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + (COURSE_HOLE_1.width * TILE_WIDTH / 2);
    const screenY = (gridX + gridY) * (TILE_HEIGHT / 2);
    return { x: screenX, y: screenY };
  }

  private screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const TILE_WIDTH = 64;
    const TILE_HEIGHT = 32;
    const offsetX = screenX - (COURSE_HOLE_1.width * TILE_WIDTH / 2);
    const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
    const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
    return { x: Math.round(isoX), y: Math.round(isoY) };
  }

  private applyAndPlay(): void {
    if (!this.state.grassCells || this.state.grassCells.length === 0) {
      this.initializeGrassCells();
    }

    (window as unknown as { startupParams: { state: GameState } }).startupParams = {
      state: this.state
    };

    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }
}
