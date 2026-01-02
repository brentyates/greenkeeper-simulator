import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import {
  CellState,
  getTerrainType,
  getInitialValues,
  calculateHealth,
  getCellsInRadius,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_HEIGHT,
  TERRAIN_CODES,
} from '../../core/terrain';

import {
  simulateGrowth,
  applyMowing,
  applyWatering,
  applyFertilizing,
  getAverageStats,
} from '../../core/grass-simulation';

import { CourseData } from '../../data/courseData';

export type OverlayMode = 'normal' | 'moisture' | 'nutrients' | 'height';

export class GrassSystem {
  private scene: Scene;
  private courseData: CourseData;
  private cells: CellState[][] = [];
  private tileMeshes: Map<string, Mesh> = new Map();
  private cliffMeshes: Map<string, Mesh> = new Map();
  private gridLinesMesh: LinesMesh | null = null;
  private overlayMode: OverlayMode = 'normal';
  private tileMaterial: StandardMaterial | null = null;
  private gameTime: number = 0;
  private dirtyTiles: Set<string> = new Set();
  private static readonly CLIFF_HEIGHT = 48;
  private static readonly VISUAL_UPDATE_THRESHOLD = 0.5;

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
    this.initCells();
    this.createTileMaterial();
  }

  private initCells(): void {
    const { width, height, layout, elevation, obstacles } = this.courseData;

    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const terrainType = getTerrainType(terrainCode);
        const elev = elevation?.[y]?.[x] ?? 0;
        const initialValues = getInitialValues(terrainType);

        const cell: CellState = {
          x,
          y,
          type: terrainType,
          height: initialValues.height,
          moisture: initialValues.moisture,
          nutrients: initialValues.nutrients,
          health: 100,
          elevation: elev,
          obstacle: 'none',
          lastMowed: 0,
          lastWatered: 0,
          lastFertilized: 0,
        };
        cell.health = calculateHealth(cell);

        this.cells[y][x] = cell;
      }
    }

    if (obstacles) {
      for (const obs of obstacles) {
        if (this.cells[obs.y]?.[obs.x]) {
          const types: Array<'none' | 'tree' | 'pine_tree' | 'shrub' | 'bush'> = ['none', 'tree', 'pine_tree', 'shrub', 'bush'];
          this.cells[obs.y][obs.x].obstacle = types[obs.type] ?? 'none';
        }
      }
    }
  }

  private createTileMaterial(): void {
    this.tileMaterial = new StandardMaterial('grassTileMat', this.scene);
    this.tileMaterial.diffuseColor = new Color3(1, 1, 1);
    this.tileMaterial.specularColor = new Color3(0, 0, 0);
    this.tileMaterial.emissiveColor = new Color3(1, 1, 1);
    this.tileMaterial.disableLighting = true;
    this.tileMaterial.backFaceCulling = false;
  }

  public build(): void {
    const { width, height } = this.courseData;

    let tileCount = 0;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const cell = this.cells[y][x];
        const mesh = this.createTileMesh(cell);
        this.tileMeshes.set(`${x}_${y}`, mesh);
        tileCount++;
      }
    }
    this.createGridLines();
    this.createAllCliffFaces();
  }

  private createAllCliffFaces(): void {
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.cells[y][x];
        this.createCliffFacesForCell(cell, x, y);
      }
    }
    console.log(`GrassSystem: Created ${this.cliffMeshes.size} cliff faces for ${width}x${height} map`);
  }

  private createCliffFacesForCell(cell: CellState, x: number, y: number): void {
    const { width, height } = this.courseData;
    const center = this.gridToScreen(x, y, cell.elevation);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const rightNeighbor = this.cells[y]?.[x + 1];
    const bottomNeighbor = this.cells[y + 1]?.[x];

    const isRightEdge = x === width - 1;
    const isBottomEdge = y === height - 1;

    const rightElevDiff = rightNeighbor ? (cell.elevation - rightNeighbor.elevation) : 0;
    const bottomElevDiff = bottomNeighbor ? (cell.elevation - bottomNeighbor.elevation) : 0;

    if (isRightEdge) {
      const mesh = this.createCliffFace(
        center.x + hw, center.y,
        center.x, center.y - hh,
        GrassSystem.CLIFF_HEIGHT,
        `cliff_right_${x}_${y}`,
        'right'
      );
      this.cliffMeshes.set(`right_${x}_${y}`, mesh);
    } else if (rightElevDiff > 0) {
      const dropHeight = rightElevDiff * ELEVATION_HEIGHT;
      const mesh = this.createCliffFace(
        center.x + hw, center.y,
        center.x, center.y - hh,
        dropHeight,
        `cliff_right_${x}_${y}`,
        'right'
      );
      this.cliffMeshes.set(`right_${x}_${y}`, mesh);
    }

    if (isBottomEdge) {
      const mesh = this.createCliffFace(
        center.x, center.y - hh,
        center.x - hw, center.y,
        GrassSystem.CLIFF_HEIGHT,
        `cliff_bottom_${x}_${y}`,
        'bottom'
      );
      this.cliffMeshes.set(`bottom_${x}_${y}`, mesh);
    } else if (bottomElevDiff > 0) {
      const dropHeight = bottomElevDiff * ELEVATION_HEIGHT;
      const mesh = this.createCliffFace(
        center.x, center.y - hh,
        center.x - hw, center.y,
        dropHeight,
        `cliff_bottom_${x}_${y}`,
        'bottom'
      );
      this.cliffMeshes.set(`bottom_${x}_${y}`, mesh);
    }
  }

  private createCliffFace(
    x1: number, y1: number,
    x2: number, y2: number,
    dropHeight: number,
    name: string,
    side: 'right' | 'bottom'
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const topColor = side === 'right'
      ? new Color3(0.72, 0.58, 0.42)
      : new Color3(0.58, 0.48, 0.35);
    const bottomColor = side === 'right'
      ? new Color3(0.52, 0.42, 0.30)
      : new Color3(0.42, 0.35, 0.26);

    positions.push(x1, y1, 0);
    positions.push(x2, y2, 0);
    positions.push(x2, y2 - dropHeight, 0);
    positions.push(x1, y1 - dropHeight, 0);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    colors.push(topColor.r, topColor.g, topColor.b, 1);
    colors.push(topColor.r, topColor.g, topColor.b, 1);
    colors.push(bottomColor.r, bottomColor.g, bottomColor.b, 1);
    colors.push(bottomColor.r, bottomColor.g, bottomColor.b, 1);

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(name, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private createGridLines(): void {
    const { width, height } = this.courseData;
    const points: Vector3[][] = [];
    const colors: Color4[][] = [];

    const lineColor = new Color4(0.15, 0.25, 0.15, 1);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.cells[y][x];
        if (cell.type === 'water' || cell.type === 'bunker') continue;

        const center = this.gridToScreen(cell.x, cell.y, cell.elevation);
        const zOffset = -0.5;

        const top = new Vector3(center.x, center.y + hh, center.z + zOffset);
        const right = new Vector3(center.x + hw, center.y, center.z + zOffset);
        const bottom = new Vector3(center.x, center.y - hh, center.z + zOffset);
        const left = new Vector3(center.x - hw, center.y, center.z + zOffset);

        points.push([top, right, bottom, left, top]);
        colors.push([lineColor, lineColor, lineColor, lineColor, lineColor]);
      }
    }

    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
    }

    if (points.length > 0) {
      this.gridLinesMesh = MeshBuilder.CreateLineSystem(
        'gridLines',
        { lines: points, colors: colors, useVertexAlpha: true },
        this.scene
      );
      this.gridLinesMesh.isPickable = false;
    }
  }

  private gridToScreen(gridX: number, gridY: number, elevation: number): { x: number; y: number; z: number } {
    const screenX = (gridX - gridY) * (TILE_WIDTH / 2);
    const screenY = -((gridX + gridY) * (TILE_HEIGHT / 2)) - elevation * ELEVATION_HEIGHT;
    return { x: screenX, y: screenY, z: 0 };
  }

  private createTileMesh(cell: CellState): Mesh {
    const center = this.gridToScreen(cell.x, cell.y, cell.elevation);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const color = this.getCellColor(cell);
    const shouldStripe = this.shouldShowStripes(cell);

    if (shouldStripe) {
      return this.createStripedTile(cell, center, hw, hh, color);
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    positions.push(center.x, center.y + hh, center.z);
    positions.push(center.x + hw, center.y, center.z);
    positions.push(center.x, center.y - hh, center.z);
    positions.push(center.x - hw, center.y, center.z);

    indices.push(0, 2, 1);
    indices.push(0, 3, 2);

    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, 1);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private createStripedTile(
    cell: CellState,
    center: { x: number; y: number; z: number },
    hw: number,
    hh: number,
    baseColor: Color3
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const stripeCount = 4;
    const lightColor = new Color3(
      Math.min(1, baseColor.r + 0.10),
      Math.min(1, baseColor.g + 0.12),
      Math.min(1, baseColor.b + 0.06)
    );
    const darkColor = new Color3(
      Math.max(0, baseColor.r - 0.06),
      Math.max(0, baseColor.g - 0.04),
      Math.max(0, baseColor.b - 0.06)
    );

    let vertexIndex = 0;

    for (let i = 0; i < stripeCount * 2; i++) {
      const t0 = i / (stripeCount * 2);
      const t1 = (i + 1) / (stripeCount * 2);

      const y0 = center.y + hh - t0 * (2 * hh);
      const y1 = center.y + hh - t1 * (2 * hh);

      const getX = (y: number) => {
        const yRel = y - center.y;
        if (yRel >= 0) {
          return hw * (1 - yRel / hh);
        } else {
          return hw * (1 + yRel / hh);
        }
      };

      const x0Left = center.x - getX(y0);
      const x0Right = center.x + getX(y0);
      const x1Left = center.x - getX(y1);
      const x1Right = center.x + getX(y1);

      positions.push(x0Left, y0, center.z);
      positions.push(x0Right, y0, center.z);
      positions.push(x1Right, y1, center.z);
      positions.push(x1Left, y1, center.z);

      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1);
      indices.push(vertexIndex, vertexIndex + 3, vertexIndex + 2);

      const stripeColor = i % 2 === 0 ? lightColor : darkColor;
      for (let j = 0; j < 4; j++) {
        colors.push(stripeColor.r, stripeColor.g, stripeColor.b, 1);
      }

      vertexIndex += 4;
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private shouldShowStripes(cell: CellState): boolean {
    if (cell.type === 'bunker' || cell.type === 'water') return false;
    const mownThreshold = cell.type === 'green' ? 10 : cell.type === 'fairway' ? 20 : 30;
    return cell.height <= mownThreshold;
  }

  private getCellColor(cell: CellState): Color3 {
    if (this.overlayMode !== 'normal') {
      return this.getOverlayColor(cell);
    }

    const baseColor = this.getTerrainBaseColor(cell);

    if (cell.type === 'bunker' || cell.type === 'water') {
      return baseColor;
    }

    if (cell.health < 20) {
      return new Color3(0.45, 0.35, 0.2);
    }
    if (cell.health < 40) {
      return new Color3(0.55, 0.5, 0.25);
    }

    let tintR = 0, tintG = 0, tintB = 0;
    if (cell.moisture < 30) {
      tintR += 0.1;
      tintG += 0.08;
    }
    if (cell.nutrients < 30) {
      tintR += 0.08;
      tintG += 0.1;
      tintB -= 0.05;
    }

    const variation = ((cell.x * 7 + cell.y * 13) % 10) / 100 - 0.05;

    return new Color3(
      Math.max(0, Math.min(1, baseColor.r + variation + tintR)),
      Math.max(0, Math.min(1, baseColor.g + variation * 1.2 + tintG)),
      Math.max(0, Math.min(1, baseColor.b + variation * 0.8 + tintB))
    );
  }

  private getTerrainBaseColor(cell: CellState): Color3 {
    switch (cell.type) {
      case 'fairway': return new Color3(0.4, 0.7, 0.3);
      case 'rough': return new Color3(0.35, 0.55, 0.25);
      case 'green': return new Color3(0.3, 0.8, 0.35);
      case 'bunker': return new Color3(0.85, 0.75, 0.5);
      case 'water': return new Color3(0.2, 0.4, 0.65);
      default: return new Color3(0.4, 0.6, 0.3);
    }
  }

  private getOverlayColor(cell: CellState): Color3 {
    if (cell.type === 'bunker' || cell.type === 'water') {
      return this.getTerrainBaseColor(cell);
    }

    let value = 0;
    switch (this.overlayMode) {
      case 'moisture':
        value = cell.moisture;
        break;
      case 'nutrients':
        value = cell.nutrients;
        break;
      case 'height':
        value = cell.height;
        break;
      default:
        return this.getTerrainBaseColor(cell);
    }

    const t = value / 100;
    if (this.overlayMode === 'moisture') {
      return new Color3(0.2 + (1 - t) * 0.6, 0.3 + t * 0.3, 0.4 + t * 0.5);
    } else if (this.overlayMode === 'nutrients') {
      return new Color3(0.3 + (1 - t) * 0.5, 0.5 + t * 0.4, 0.2);
    } else {
      return new Color3(0.2 + t * 0.6, 0.7 - t * 0.4, 0.2);
    }
  }

  public update(deltaMs: number, gameTimeMinutes: number): void {
    this.gameTime = gameTimeMinutes;

    const deltaMinutes = (deltaMs / 1000) * 2;
    const { width, height } = this.courseData;
    const threshold = GrassSystem.VISUAL_UPDATE_THRESHOLD;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.cells[y][x];
        const prevHeight = cell.height;
        const prevMoisture = cell.moisture;
        const prevNutrients = cell.nutrients;
        const prevHealth = cell.health;

        const result = simulateGrowth(cell, deltaMinutes);

        cell.height = result.height;
        cell.moisture = result.moisture;
        cell.nutrients = result.nutrients;
        cell.health = result.health;

        const heightChanged = Math.abs(result.height - prevHeight) > threshold;
        const moistureChanged = Math.abs(result.moisture - prevMoisture) > threshold;
        const nutrientsChanged = Math.abs(result.nutrients - prevNutrients) > threshold;
        const healthChanged = Math.abs(result.health - prevHealth) > threshold;

        if (heightChanged || moistureChanged || nutrientsChanged || healthChanged) {
          this.dirtyTiles.add(`${x}_${y}`);
        }
      }
    }

    this.updateDirtyTileVisuals();
  }

  private updateDirtyTileVisuals(): void {
    for (const key of this.dirtyTiles) {
      const [xStr, yStr] = key.split('_');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      this.updateTileVisual(x, y);
    }
    this.dirtyTiles.clear();
  }

  private updateAllTileVisuals(): void {
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.updateTileVisual(x, y);
      }
    }
  }

  private updateTileVisual(x: number, y: number): void {
    const key = `${x}_${y}`;
    const oldMesh = this.tileMeshes.get(key);
    if (oldMesh) {
      oldMesh.dispose();
    }

    const cell = this.cells[y][x];
    const newMesh = this.createTileMesh(cell);
    this.tileMeshes.set(key, newMesh);
  }

  public mowAt(gridX: number, gridY: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell) return false;

    const result = applyMowing(cell);
    if (!result) return false;

    this.cells[gridY][gridX] = result;
    result.lastMowed = this.gameTime;
    this.updateTileVisual(gridX, gridY);
    return true;
  }

  public waterArea(centerX: number, centerY: number, radius: number, amount: number): number {
    const cellsToWater = getCellsInRadius(centerX, centerY, radius);
    let affectedCount = 0;

    for (const { x, y } of cellsToWater) {
      const cell = this.getCell(x, y);
      if (!cell) continue;

      const result = applyWatering(cell, amount);
      if (result) {
        this.cells[y][x] = result;
        result.lastWatered = this.gameTime;
        this.updateTileVisual(x, y);
        affectedCount++;
      }
    }

    return affectedCount;
  }

  public fertilizeArea(centerX: number, centerY: number, radius: number, amount: number): number {
    const cellsToFertilize = getCellsInRadius(centerX, centerY, radius);
    let affectedCount = 0;

    for (const { x, y } of cellsToFertilize) {
      const cell = this.getCell(x, y);
      if (!cell) continue;

      const result = applyFertilizing(cell, amount);
      if (result) {
        this.cells[y][x] = result;
        result.lastFertilized = this.gameTime;
        this.updateTileVisual(x, y);
        affectedCount++;
      }
    }

    return affectedCount;
  }

  public getCell(x: number, y: number): CellState | null {
    return this.cells[y]?.[x] ?? null;
  }

  public getCourseStats(): { health: number; moisture: number; nutrients: number; height: number } {
    return getAverageStats(this.cells);
  }

  public cycleOverlayMode(): OverlayMode {
    const modes: OverlayMode[] = ['normal', 'moisture', 'nutrients', 'height'];
    const currentIndex = modes.indexOf(this.overlayMode);
    this.overlayMode = modes[(currentIndex + 1) % modes.length];
    this.updateAllTileVisuals();
    return this.overlayMode;
  }

  public getOverlayMode(): OverlayMode {
    return this.overlayMode;
  }

  public setOverlayMode(mode: OverlayMode): void {
    this.overlayMode = mode;
    this.updateAllTileVisuals();
  }

  public getElevationAt(gridX: number, gridY: number): number {
    return this.cells[gridY]?.[gridX]?.elevation ?? 0;
  }

  public gridToWorld(gridX: number, gridY: number): { x: number; y: number; z: number } {
    const elev = this.getElevationAt(gridX, gridY);
    return this.gridToScreen(gridX, gridY, elev);
  }

  public dispose(): void {
    for (const mesh of this.tileMeshes.values()) {
      mesh.dispose();
    }
    this.tileMeshes.clear();
    for (const mesh of this.cliffMeshes.values()) {
      mesh.dispose();
    }
    this.cliffMeshes.clear();
    this.dirtyTiles.clear();
    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
    }
    if (this.tileMaterial) {
      this.tileMaterial.dispose();
    }
  }
}
