import Phaser from 'phaser';
import { CourseData, TerrainType, getTerrainType } from '../data/courseData';

export interface GrassCell {
  x: number;
  y: number;
  type: TerrainType;
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
  sprite: Phaser.GameObjects.Sprite;
}

export type GrassState = 'healthy' | 'stressed' | 'dying' | 'dead';
export type OverlayMode = 'normal' | 'moisture' | 'nutrients' | 'height';

export class GrassSystem {
  private scene: Phaser.Scene;
  private cells: GrassCell[][] = [];
  private width: number;
  private height: number;
  private group: Phaser.GameObjects.Group;
  private overlayMode: OverlayMode = 'normal';

  constructor(scene: Phaser.Scene, courseData: CourseData) {
    this.scene = scene;
    this.width = courseData.width;
    this.height = courseData.height;
    this.group = scene.add.group();

    this.initializeCells(courseData);
  }

  private initializeCells(courseData: CourseData): void {
    for (let y = 0; y < this.height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.width; x++) {
        const terrainCode = courseData.layout[y]?.[x] ?? 1;
        const type = getTerrainType(terrainCode);
        const initialValues = this.getInitialValues(type);

        const sprite = this.scene.add.sprite(
          x * 32 + 16,
          y * 32 + 16,
          this.getTextureForType(type)
        );
        sprite.setDepth(0);
        this.group.add(sprite);

        const cell: GrassCell = {
          x,
          y,
          type,
          height: initialValues.height,
          moisture: initialValues.moisture,
          nutrients: initialValues.nutrients,
          health: 100,
          lastMowed: 0,
          lastWatered: 0,
          lastFertilized: 0,
          sprite
        };

        cell.health = this.calculateHealth(cell);
        this.cells[y][x] = cell;
        this.updateCellVisual(cell);
      }
    }
  }

  private getInitialValues(type: TerrainType): { height: number; moisture: number; nutrients: number } {
    switch (type) {
      case 'fairway':
        return { height: 30, moisture: 60, nutrients: 70 };
      case 'rough':
        return { height: 70, moisture: 50, nutrients: 50 };
      case 'green':
        return { height: 10, moisture: 70, nutrients: 80 };
      case 'bunker':
        return { height: 0, moisture: 20, nutrients: 0 };
      case 'water':
        return { height: 0, moisture: 100, nutrients: 0 };
      default:
        return { height: 50, moisture: 50, nutrients: 50 };
    }
  }

  private getTextureForType(type: TerrainType): string {
    switch (type) {
      case 'fairway': return 'fairway';
      case 'rough': return 'rough';
      case 'green': return 'green';
      case 'bunker': return 'bunker';
      case 'water': return 'water';
      default: return 'rough';
    }
  }

  calculateHealth(cell: GrassCell): number {
    if (cell.type === 'bunker' || cell.type === 'water') {
      return 100;
    }
    const moistureScore = cell.moisture * 0.3;
    const nutrientScore = cell.nutrients * 0.3;
    const heightScore = (100 - Math.min(cell.height, 100)) * 0.4;
    return Phaser.Math.Clamp(moistureScore + nutrientScore + heightScore, 0, 100);
  }

  updateCellVisual(cell: GrassCell): void {
    if (this.overlayMode !== 'normal') {
      this.updateOverlayVisual(cell);
      return;
    }

    let texture: string;

    if (cell.type === 'bunker') {
      texture = 'bunker';
    } else if (cell.type === 'water') {
      texture = 'water';
    } else if (cell.health < 20) {
      texture = 'grass_dead';
    } else if (cell.health < 40) {
      texture = 'grass_dry';
    } else if (cell.height > 70) {
      texture = 'grass_tall';
    } else if (cell.height > 40) {
      texture = 'grass_medium';
    } else {
      texture = 'grass_short';
    }

    cell.sprite.setTexture(texture);

    cell.sprite.clearTint();
    if (cell.moisture > 80 && cell.type !== 'water') {
      cell.sprite.setTint(0x88CCFF);
    } else if (cell.nutrients < 20 && cell.type !== 'bunker' && cell.type !== 'water') {
      cell.sprite.setTint(0xFFFF88);
    }
  }

  private updateOverlayVisual(cell: GrassCell): void {
    if (cell.type === 'bunker' || cell.type === 'water') {
      cell.sprite.clearTint();
      return;
    }

    let value: number;
    let lowColor: number;
    let highColor: number;

    switch (this.overlayMode) {
      case 'moisture':
        value = cell.moisture / 100;
        lowColor = 0xFF0000;
        highColor = 0x0000FF;
        break;
      case 'nutrients':
        value = cell.nutrients / 100;
        lowColor = 0xFFFF00;
        highColor = 0x00FF00;
        break;
      case 'height':
        value = cell.height / 100;
        lowColor = 0xFFFFFF;
        highColor = 0x003300;
        break;
      default:
        return;
    }

    const r = Math.floor(((lowColor >> 16) & 0xFF) * (1 - value) + ((highColor >> 16) & 0xFF) * value);
    const g = Math.floor(((lowColor >> 8) & 0xFF) * (1 - value) + ((highColor >> 8) & 0xFF) * value);
    const b = Math.floor((lowColor & 0xFF) * (1 - value) + (highColor & 0xFF) * value);

    cell.sprite.setTint((r << 16) | (g << 8) | b);
  }

  setOverlayMode(mode: OverlayMode): void {
    this.overlayMode = mode;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.updateCellVisual(this.cells[y][x]);
      }
    }
  }

  getOverlayMode(): OverlayMode {
    return this.overlayMode;
  }

  cycleOverlayMode(): OverlayMode {
    const modes: OverlayMode[] = ['normal', 'moisture', 'nutrients', 'height'];
    const currentIndex = modes.indexOf(this.overlayMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setOverlayMode(modes[nextIndex]);
    return this.overlayMode;
  }

  update(gameTime: number, delta: number): void {
    const deltaMinutes = delta / 60000;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];

        if (cell.type === 'bunker' || cell.type === 'water') continue;

        let growthRate = 0.1;
        if (cell.moisture > 50) growthRate += 0.05;
        if (cell.nutrients > 50) growthRate += 0.1;
        if (cell.health < 30) growthRate -= 0.05;

        cell.height = Math.min(100, cell.height + growthRate * deltaMinutes);
        cell.moisture = Math.max(0, cell.moisture - 0.05 * deltaMinutes);
        cell.nutrients = Math.max(0, cell.nutrients - 0.02 * deltaMinutes);
        cell.health = this.calculateHealth(cell);

        this.updateCellVisual(cell);
      }
    }
  }

  mow(gridX: number, gridY: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell || cell.type === 'bunker' || cell.type === 'water') {
      return false;
    }

    cell.height = 0;
    cell.lastMowed = this.scene.time.now;
    cell.health = this.calculateHealth(cell);
    this.updateCellVisual(cell);
    return true;
  }

  water(gridX: number, gridY: number, amount: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell || cell.type === 'water') {
      return false;
    }

    let effectiveAmount = amount;
    if (cell.type === 'bunker') {
      effectiveAmount *= 0.5;
    }

    cell.moisture = Math.min(100, cell.moisture + effectiveAmount);
    cell.lastWatered = this.scene.time.now;
    cell.health = this.calculateHealth(cell);
    this.updateCellVisual(cell);
    return true;
  }

  fertilize(gridX: number, gridY: number, amount: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell || cell.type === 'bunker' || cell.type === 'water') {
      return false;
    }

    cell.nutrients = Math.min(100, cell.nutrients + amount);
    cell.lastFertilized = this.scene.time.now;
    cell.health = this.calculateHealth(cell);
    this.updateCellVisual(cell);
    return true;
  }

  mowArea(centerX: number, centerY: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          this.mow(centerX + dx, centerY + dy);
        }
      }
    }
  }

  waterArea(centerX: number, centerY: number, radius: number, amount: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          this.water(centerX + dx, centerY + dy, amount);
        }
      }
    }
  }

  fertilizeArea(centerX: number, centerY: number, radius: number, amount: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          this.fertilize(centerX + dx, centerY + dy, amount);
        }
      }
    }
  }

  getCell(x: number, y: number): GrassCell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.cells[y][x];
  }

  getAverageHealth(): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          total += cell.health;
          count++;
        }
      }
    }
    return count > 0 ? total / count : 100;
  }

  getAverageMoisture(): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          total += cell.moisture;
          count++;
        }
      }
    }
    return count > 0 ? total / count : 100;
  }

  getAverageNutrients(): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          total += cell.nutrients;
          count++;
        }
      }
    }
    return count > 0 ? total / count : 100;
  }

  getAverageHeight(): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          total += cell.height;
          count++;
        }
      }
    }
    return count > 0 ? total / count : 0;
  }

  getCellsNeedingMowing(): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water' && cell.height > 60) {
          count++;
        }
      }
    }
    return count;
  }

  getCellsNeedingWater(): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water' && cell.moisture < 30) {
          count++;
        }
      }
    }
    return count;
  }

  getCellsNeedingFertilizer(): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water' && cell.nutrients < 30) {
          count++;
        }
      }
    }
    return count;
  }

  getOverallCourseCondition(): string {
    const health = this.getAverageHealth();
    if (health >= 80) return 'Excellent';
    if (health >= 60) return 'Good';
    if (health >= 40) return 'Fair';
    return 'Poor';
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getCells(): GrassCell[][] {
    return this.cells;
  }

  getSerializableState(): object {
    const cellStates: object[][] = [];
    for (let y = 0; y < this.height; y++) {
      cellStates[y] = [];
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        cellStates[y][x] = {
          height: cell.height,
          moisture: cell.moisture,
          nutrients: cell.nutrients,
          lastMowed: cell.lastMowed,
          lastWatered: cell.lastWatered,
          lastFertilized: cell.lastFertilized
        };
      }
    }
    return cellStates;
  }

  loadState(state: { height: number; moisture: number; nutrients: number; lastMowed: number; lastWatered: number; lastFertilized: number }[][]): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (state[y]?.[x]) {
          const cell = this.cells[y][x];
          const saved = state[y][x];
          cell.height = saved.height;
          cell.moisture = saved.moisture;
          cell.nutrients = saved.nutrients;
          cell.lastMowed = saved.lastMowed;
          cell.lastWatered = saved.lastWatered;
          cell.lastFertilized = saved.lastFertilized;
          cell.health = this.calculateHealth(cell);
          this.updateCellVisual(cell);
        }
      }
    }
  }
}
