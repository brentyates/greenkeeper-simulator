import Phaser from 'phaser';
import { CourseData, TerrainType, getTerrainType, getObstacleType, getObstacleTexture, ObstacleType } from '../data/courseData';

export interface GrassCell {
  x: number;
  y: number;
  type: TerrainType;
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
  elevation: number;
  obstacle: ObstacleType;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
  sprite: Phaser.GameObjects.Sprite;
  obstacleSprite: Phaser.GameObjects.Sprite | null;
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
  private readonly TILE_WIDTH = 64;
  private readonly TILE_HEIGHT = 32;

  constructor(scene: Phaser.Scene, courseData: CourseData) {
    this.scene = scene;
    this.width = courseData.width;
    this.height = courseData.height;
    this.group = scene.add.group();

    this.initializeCells(courseData);
  }

  private readonly ELEVATION_HEIGHT = 16;

  gridToScreen(gridX: number, gridY: number, elevation: number = 0): { x: number; y: number } {
    const screenX = (gridX - gridY) * (this.TILE_WIDTH / 2) + (this.width * this.TILE_WIDTH / 2);
    const screenY = (gridX + gridY) * (this.TILE_HEIGHT / 2) - elevation * this.ELEVATION_HEIGHT;
    return { x: screenX, y: screenY };
  }

  getElevation(gridX: number, gridY: number): number {
    const cell = this.getCell(gridX, gridY);
    return cell ? cell.elevation : 0;
  }

  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const offsetX = screenX - (this.width * this.TILE_WIDTH / 2);
    const isoX = (offsetX / (this.TILE_WIDTH / 2) + screenY / (this.TILE_HEIGHT / 2)) / 2;
    const isoY = (screenY / (this.TILE_HEIGHT / 2) - offsetX / (this.TILE_WIDTH / 2)) / 2;
    return { x: Math.floor(isoX), y: Math.floor(isoY) };
  }

  getTileSize(): { width: number; height: number } {
    return { width: this.TILE_WIDTH, height: this.TILE_HEIGHT };
  }

  private initializeCells(courseData: CourseData): void {
    const obstacleMap = new Map<string, number>();
    if (courseData.obstacles) {
      for (const obs of courseData.obstacles) {
        obstacleMap.set(`${obs.x},${obs.y}`, obs.type);
      }
    }

    for (let y = 0; y < this.height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.width; x++) {
        const terrainCode = courseData.layout[y]?.[x] ?? 1;
        const type = getTerrainType(terrainCode);
        const initialValues = this.getInitialValues(type);
        const elevation = courseData.elevation?.[y]?.[x] ?? 0;

        const pos = this.gridToScreen(x, y, elevation);
        const sprite = this.scene.add.sprite(pos.x, pos.y, this.getTextureForType(type));
        sprite.setDepth(x + y + elevation * 100);
        this.group.add(sprite);

        const obstacleCode = obstacleMap.get(`${x},${y}`) ?? 0;
        const obstacle = getObstacleType(obstacleCode);
        let obstacleSprite: Phaser.GameObjects.Sprite | null = null;

        if (obstacle !== 'none') {
          const texture = getObstacleTexture(obstacle);
          if (texture) {
            obstacleSprite = this.scene.add.sprite(pos.x, pos.y, texture);
            obstacleSprite.setOrigin(0.5, 1);
            obstacleSprite.setDepth(x + y + elevation * 100 + 10);
          }
        }

        const cell: GrassCell = {
          x,
          y,
          type,
          height: initialValues.height,
          moisture: initialValues.moisture,
          nutrients: initialValues.nutrients,
          health: 100,
          elevation,
          obstacle,
          lastMowed: 0,
          lastWatered: 0,
          lastFertilized: 0,
          sprite,
          obstacleSprite
        };

        cell.health = this.calculateHealth(cell);
        this.cells[y][x] = cell;
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.updateCellVisual(this.cells[y][x]);
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
      case 'fairway': return 'iso_fairway_mown';
      case 'rough': return 'iso_rough_mown';
      case 'green': return 'iso_green_mown';
      case 'bunker': return 'iso_bunker';
      case 'water': return 'iso_water';
      default: return 'iso_rough_mown';
    }
  }

  private getRampDirection(x: number, y: number, elevation: number): 'north' | 'south' | 'east' | 'west' | null {
    const northCell = this.getCell(x, y - 1);
    const southCell = this.getCell(x, y + 1);
    const eastCell = this.getCell(x + 1, y);
    const westCell = this.getCell(x - 1, y);

    const northElev = northCell?.elevation ?? elevation;
    const southElev = southCell?.elevation ?? elevation;
    const eastElev = eastCell?.elevation ?? elevation;
    const westElev = westCell?.elevation ?? elevation;

    if (northElev > elevation && northElev - elevation === 1 && southElev <= elevation) {
      return 'north';
    }
    if (southElev > elevation && southElev - elevation === 1 && northElev <= elevation) {
      return 'south';
    }
    if (eastElev > elevation && eastElev - elevation === 1 && westElev <= elevation) {
      return 'east';
    }
    if (westElev > elevation && westElev - elevation === 1 && eastElev <= elevation) {
      return 'west';
    }

    return null;
  }

  private getRampTexture(direction: 'north' | 'south' | 'east' | 'west'): string {
    return `iso_ramp_${direction}`;
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

    const rampDir = this.getRampDirection(cell.x, cell.y, cell.elevation);
    if (rampDir && cell.type !== 'bunker' && cell.type !== 'water') {
      texture = this.getRampTexture(rampDir);
    } else if (cell.type === 'bunker') {
      texture = 'iso_bunker';
    } else if (cell.type === 'water') {
      texture = 'iso_water';
    } else if (cell.health < 20) {
      texture = 'iso_grass_dead';
    } else if (cell.health < 40) {
      texture = 'iso_grass_dry';
    } else if (cell.type === 'fairway') {
      if (cell.height <= 20) texture = 'iso_fairway_mown';
      else if (cell.height <= 45) texture = 'iso_fairway_growing';
      else texture = 'iso_fairway_unmown';
    } else if (cell.type === 'rough') {
      if (cell.height <= 30) texture = 'iso_rough_mown';
      else if (cell.height <= 60) texture = 'iso_rough_growing';
      else texture = 'iso_rough_unmown';
    } else if (cell.type === 'green') {
      if (cell.height <= 10) texture = 'iso_green_mown';
      else if (cell.height <= 22) texture = 'iso_green_growing';
      else texture = 'iso_green_unmown';
    } else {
      if (cell.height <= 30) texture = 'iso_rough_mown';
      else if (cell.height <= 60) texture = 'iso_rough_growing';
      else texture = 'iso_rough_unmown';
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

  update(_gameTime: number, delta: number): void {
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

  private applyArea(centerX: number, centerY: number, radius: number, action: (x: number, y: number) => void): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          action(centerX + dx, centerY + dy);
        }
      }
    }
  }

  mowArea(centerX: number, centerY: number, radius: number): void {
    this.applyArea(centerX, centerY, radius, (x, y) => this.mow(x, y));
  }

  waterArea(centerX: number, centerY: number, radius: number, amount: number): void {
    this.applyArea(centerX, centerY, radius, (x, y) => this.water(x, y, amount));
  }

  fertilizeArea(centerX: number, centerY: number, radius: number, amount: number): void {
    this.applyArea(centerX, centerY, radius, (x, y) => this.fertilize(x, y, amount));
  }

  getCell(x: number, y: number): GrassCell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.cells[y][x];
  }

  isWalkable(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    if (cell.type === 'water') return false;
    if (cell.obstacle !== 'none') return false;
    return true;
  }

  canMoveFromTo(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (!this.isWalkable(toX, toY)) return false;

    const fromCell = this.getCell(fromX, fromY);
    const toCell = this.getCell(toX, toY);
    if (!fromCell || !toCell) return false;

    const elevationDiff = Math.abs(toCell.elevation - fromCell.elevation);
    if (elevationDiff > 1) return false;

    return true;
  }

  private getAverageStat(getter: (cell: GrassCell) => number, defaultValue: number): number {
    let total = 0;
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water') {
          total += getter(cell);
          count++;
        }
      }
    }
    return count > 0 ? total / count : defaultValue;
  }

  getAverageHealth(): number {
    return this.getAverageStat(cell => cell.health, 100);
  }

  getAverageMoisture(): number {
    return this.getAverageStat(cell => cell.moisture, 100);
  }

  getAverageNutrients(): number {
    return this.getAverageStat(cell => cell.nutrients, 100);
  }

  getAverageHeight(): number {
    return this.getAverageStat(cell => cell.height, 0);
  }

  private countCells(predicate: (cell: GrassCell) => boolean): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (cell.type !== 'bunker' && cell.type !== 'water' && predicate(cell)) {
          count++;
        }
      }
    }
    return count;
  }

  getCellsNeedingMowing(): number {
    return this.countCells(cell => cell.height > 60);
  }

  getCellsNeedingWater(): number {
    return this.countCells(cell => cell.moisture < 30);
  }

  getCellsNeedingFertilizer(): number {
    return this.countCells(cell => cell.nutrients < 30);
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
