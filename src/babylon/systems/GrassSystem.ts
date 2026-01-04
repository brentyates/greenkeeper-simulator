/**
 * GrassSystem - Primary terrain rendering system
 *
 * Handles all terrain tile rendering including:
 * - Isometric tile mesh creation with slope support (corner heights)
 * - Grid line rendering that follows terrain elevation
 * - Cliff face rendering for elevation changes
 * - Terrain type coloring (fairway, rough, green, bunker, water)
 * - Mowing stripe patterns on fairways
 * - Overlay modes (moisture, nutrients, height)
 */
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import {
  CellState,
  getTerrainType,
  getTerrainCode,
  getInitialValues,
  calculateHealth,
  getCellsInRadius,
  TERRAIN_CODES,
  OverlayMode,
} from "../../core/terrain";

import { gridTo3D } from "../engine/BabylonEngine";

import {
  simulateGrowth,
  applyMowing,
  applyWatering,
  applyFertilizing,
  getAverageStats,
  WeatherEffect,
} from "../../core/grass-simulation";

import { CourseData } from "../../data/courseData";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type { OverlayMode };

export class GrassSystem {
  private scene: Scene;
  private courseData: CourseData;
  private cells: CellState[][] = [];
  private tileMeshes: Map<string, Mesh> = new Map();
  private cliffMeshes: Map<string, Mesh> = new Map();
  private waterTiles: Set<string> = new Set();
  private gridLinesMesh: LinesMesh | null = null;
  private overlayMode: OverlayMode = "normal";
  private tileMaterial: StandardMaterial | null = null;
  private waterMaterial: StandardMaterial | null = null;
  private gameTime: number = 0;
  private waterTime: number = 0;
  private dirtyTiles: Set<string> = new Set();
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
          obstacle: "none",
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
          const types: Array<"none" | "tree" | "pine_tree" | "shrub" | "bush"> =
            ["none", "tree", "pine_tree", "shrub", "bush"];
          this.cells[obs.y][obs.x].obstacle = types[obs.type] ?? "none";
        }
      }
    }
  }

  private createTileMaterial(): void {
    this.tileMaterial = new StandardMaterial("grassTileMat", this.scene);
    this.tileMaterial.diffuseColor = new Color3(1, 1, 1);
    this.tileMaterial.specularColor = new Color3(0, 0, 0);
    this.tileMaterial.emissiveColor = new Color3(1, 1, 1);
    this.tileMaterial.disableLighting = true;
    this.tileMaterial.backFaceCulling = false;

    this.waterMaterial = new StandardMaterial("waterMat", this.scene);
    this.waterMaterial.diffuseColor = new Color3(1, 1, 1);
    this.waterMaterial.specularColor = new Color3(0.15, 0.15, 0.2);
    this.waterMaterial.emissiveColor = new Color3(0.85, 0.85, 0.9);
    this.waterMaterial.disableLighting = true;
    this.waterMaterial.backFaceCulling = false;
    this.waterMaterial.alpha = 1;
    this.waterMaterial.needAlphaBlending = () => true;
    this.waterMaterial.needAlphaTesting = () => false;
  }

  public build(): void {
    const { width, height } = this.courseData;

    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const cell = this.cells[y][x];
        const mesh = this.createTileMesh(cell);
        this.tileMeshes.set(`${x}_${y}`, mesh);
        if (cell.type === "water") {
          this.waterTiles.add(`${x}_${y}`);
        }
      }
    }
    this.createGridLines();
    this.createAllCliffFaces();
  }

  private createAllCliffFaces(): void {
    const { width, height } = this.courseData;

    this.createEdgeCliffStrip("right", width, height);
    this.createEdgeCliffStrip("bottom", width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.createCliffFacesForCell(x, y);
      }
    }
  }

  private createEdgeCliffStrip(
    side: "right" | "bottom",
    width: number,
    height: number
  ): void {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const cliffDepth = 1.5;

    const topColor =
      side === "right"
        ? new Color3(0.72, 0.58, 0.42)
        : new Color3(0.58, 0.48, 0.35);
    const bottomColor =
      side === "right"
        ? new Color3(0.52, 0.42, 0.3)
        : new Color3(0.42, 0.35, 0.26);

    if (side === "right") {
      for (let y = 0; y < height; y++) {
        const x = width - 1;
        const cell = this.cells[y][x];
        const corners = this.getCornerHeights(x, y, cell.elevation);
        const ne = gridTo3D(x + 1, y, corners.ne);
        const se = gridTo3D(x + 1, y + 1, corners.se);

        const baseIdx = positions.length / 3;
        positions.push(ne.x, ne.y, ne.z);
        positions.push(se.x, se.y, se.z);
        positions.push(se.x, se.y - cliffDepth, se.z);
        positions.push(ne.x, ne.y - cliffDepth, ne.z);

        for (let i = 0; i < 2; i++)
          colors.push(topColor.r, topColor.g, topColor.b, 1);
        for (let i = 0; i < 2; i++)
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, 1);

        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    } else {
      for (let x = 0; x < width; x++) {
        const y = height - 1;
        const cell = this.cells[y][x];
        const corners = this.getCornerHeights(x, y, cell.elevation);
        const sw = gridTo3D(x, y + 1, corners.sw);
        const se = gridTo3D(x + 1, y + 1, corners.se);

        const baseIdx = positions.length / 3;
        positions.push(sw.x, sw.y, sw.z);
        positions.push(se.x, se.y, se.z);
        positions.push(se.x, se.y - cliffDepth, se.z);
        positions.push(sw.x, sw.y - cliffDepth, sw.z);

        for (let i = 0; i < 2; i++)
          colors.push(topColor.r, topColor.g, topColor.b, 1);
        for (let i = 0; i < 2; i++)
          colors.push(bottomColor.r, bottomColor.g, bottomColor.b, 1);

        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    }

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`edgeCliff_${side}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;

    this.cliffMeshes.set(`edge_${side}`, mesh);
  }

  private createCliffFacesForCell(x: number, y: number): void {
    const cell = this.cells[y][x];
    const corners = this.getCornerHeights(x, y, cell.elevation);

    const ne = gridTo3D(x + 1, y, corners.ne);
    const se = gridTo3D(x + 1, y + 1, corners.se);
    const sw = gridTo3D(x, y + 1, corners.sw);

    const rightNeighbor = this.cells[y]?.[x + 1];
    const bottomNeighbor = this.cells[y + 1]?.[x];

    if (rightNeighbor) {
      const neighborCorners = this.getCornerHeights(
        x + 1,
        y,
        rightNeighbor.elevation
      );
      const neighborNw = gridTo3D(x + 1, y, neighborCorners.nw);
      const neighborSw = gridTo3D(x + 1, y + 1, neighborCorners.sw);

      const heightDiff1 = ne.y - neighborNw.y;
      const heightDiff2 = se.y - neighborSw.y;

      if (Math.abs(heightDiff1) > 0.01 || Math.abs(heightDiff2) > 0.01) {
        const mesh = this.createCliffFace3D(
          ne,
          se,
          neighborNw,
          neighborSw,
          `cliff_${x}_${y}_e`,
          "right"
        );
        this.cliffMeshes.set(`cliff_${x}_${y}_e`, mesh);
      }
    }

    if (bottomNeighbor) {
      const neighborCorners = this.getCornerHeights(
        x,
        y + 1,
        bottomNeighbor.elevation
      );
      const neighborNe = gridTo3D(x + 1, y + 1, neighborCorners.ne);
      const neighborNw = gridTo3D(x, y + 1, neighborCorners.nw);

      const heightDiff1 = se.y - neighborNe.y;
      const heightDiff2 = sw.y - neighborNw.y;

      if (Math.abs(heightDiff1) > 0.01 || Math.abs(heightDiff2) > 0.01) {
        const mesh = this.createCliffFace3D(
          se,
          sw,
          neighborNe,
          neighborNw,
          `cliff_${x}_${y}_s`,
          "bottom"
        );
        this.cliffMeshes.set(`cliff_${x}_${y}_s`, mesh);
      }
    }
  }

  private createCliffFace3D(
    top1: Vector3,
    top2: Vector3,
    bot1: Vector3,
    bot2: Vector3,
    name: string,
    side: "right" | "bottom"
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const topColor =
      side === "right"
        ? new Color3(0.72, 0.58, 0.42)
        : new Color3(0.58, 0.48, 0.35);
    const bottomColor =
      side === "right"
        ? new Color3(0.52, 0.42, 0.3)
        : new Color3(0.42, 0.35, 0.26);

    positions.push(top1.x, top1.y, top1.z);
    positions.push(top2.x, top2.y, top2.z);
    positions.push(bot2.x, bot2.y, bot2.z);
    positions.push(bot1.x, bot1.y, bot1.z);

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

    const startColor = new Color4(0.15, 0.25, 0.15, 1);
    const hiddenColor = new Color4(0, 0, 0, 0);
    const yOffset = 0.01;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.cells[y][x];
        const isHidden = cell.type === "water" || cell.type === "bunker";
        const lineColor = isHidden ? hiddenColor : startColor;

        const corners = this.getCornerHeights(x, y, cell.elevation);
        const nw = gridTo3D(x, y, corners.nw);
        const ne = gridTo3D(x + 1, y, corners.ne);
        const se = gridTo3D(x + 1, y + 1, corners.se);
        const sw = gridTo3D(x, y + 1, corners.sw);

        nw.y += yOffset;
        ne.y += yOffset;
        se.y += yOffset;
        sw.y += yOffset;

        points.push([nw, ne]);
        colors.push([lineColor, lineColor]);

        points.push([nw, sw]);
        colors.push([lineColor, lineColor]);

        if (x === width - 1) {
          points.push([ne, se]);
          colors.push([lineColor, lineColor]);
        }

        if (y === height - 1) {
          points.push([sw, se]);
          colors.push([lineColor, lineColor]);
        }
      }
    }

    if (this.gridLinesMesh) {
      this.gridLinesMesh = MeshBuilder.CreateLineSystem(
        "gridLines",
        { lines: points, colors: colors, instance: this.gridLinesMesh },
        this.scene
      );
    } else {
      if (points.length > 0) {
        this.gridLinesMesh = MeshBuilder.CreateLineSystem(
          "gridLines",
          {
            lines: points,
            colors: colors,
            useVertexAlpha: true,
            updatable: true,
          },
          this.scene
        );
        this.gridLinesMesh.isPickable = false;
      }
    }
  }


  private cellHash(cellX: number, cellY: number, n: number): number {
    const seed = cellX * 12345 + cellY * 67890;
    const x = Math.sin(seed + n * 9999) * 10000;
    return x - Math.floor(x);
  }

  public getElevationAt(
    gridX: number,
    gridY: number,
    defaultForOutOfBounds?: number
  ): number {
    const { width, height } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) {
      return defaultForOutOfBounds ?? 0;
    }
    return this.cells[gridY]?.[gridX]?.elevation ?? 0;
  }

  private getCornerHeights(
    gridX: number,
    gridY: number,
    baseElev: number
  ): { nw: number; ne: number; se: number; sw: number } {
    const nElev = this.getElevationAt(gridX, gridY - 1, baseElev);
    const sElev = this.getElevationAt(gridX, gridY + 1, baseElev);
    const wElev = this.getElevationAt(gridX - 1, gridY, baseElev);
    const eElev = this.getElevationAt(gridX + 1, gridY, baseElev);
    const nwElev = this.getElevationAt(gridX - 1, gridY - 1, baseElev);
    const neElev = this.getElevationAt(gridX + 1, gridY - 1, baseElev);
    const seElev = this.getElevationAt(gridX + 1, gridY + 1, baseElev);
    const swElev = this.getElevationAt(gridX - 1, gridY + 1, baseElev);

    const limit = 1;
    const nw = Math.min(
      baseElev + limit,
      Math.max(baseElev, nElev, wElev, nwElev)
    );
    const ne = Math.min(
      baseElev + limit,
      Math.max(baseElev, nElev, eElev, neElev)
    );
    const se = Math.min(
      baseElev + limit,
      Math.max(baseElev, sElev, eElev, seElev)
    );
    const sw = Math.min(
      baseElev + limit,
      Math.max(baseElev, sElev, wElev, swElev)
    );

    return { nw, ne, se, sw };
  }

  private createTileMesh(cell: CellState, existingMesh?: Mesh): Mesh {
    const corners = this.getCornerHeights(cell.x, cell.y, cell.elevation);

    const color = this.getCellColor(cell);
    const shouldStripe = this.shouldShowStripes(cell);

    if (shouldStripe) {
      return this.createStripedTile(cell, color, corners, existingMesh);
    }

    if (cell.type === "water") {
      return this.createWaterTile(cell, color, corners, existingMesh);
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const nw = gridTo3D(cell.x, cell.y, corners.nw);
    const ne = gridTo3D(cell.x + 1, cell.y, corners.ne);
    const se = gridTo3D(cell.x + 1, cell.y + 1, corners.se);
    const sw = gridTo3D(cell.x, cell.y + 1, corners.sw);

    positions.push(nw.x, nw.y, nw.z);
    positions.push(ne.x, ne.y, ne.z);
    positions.push(se.x, se.y, se.z);
    positions.push(sw.x, sw.y, sw.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const cornerColors = this.getCornerColorVariations(cell, color);
    for (const c of cornerColors) {
      colors.push(c.r, c.g, c.b, 1);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    if (existingMesh) {
      if (existingMesh.getTotalVertices() === 4) {
        vertexData.applyToMesh(existingMesh, true);
        return existingMesh;
      } else {
        existingMesh.dispose();
      }
    }

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh, true);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private createWaterTile(
    cell: CellState,
    baseColor: Color3,
    corners: { nw: number; ne: number; se: number; sw: number },
    existingMesh?: Mesh
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const nw = gridTo3D(cell.x, cell.y, corners.nw);
    const ne = gridTo3D(cell.x + 1, cell.y, corners.ne);
    const se = gridTo3D(cell.x + 1, cell.y + 1, corners.se);
    const sw = gridTo3D(cell.x, cell.y + 1, corners.sw);

    positions.push(nw.x, nw.y, nw.z);
    positions.push(ne.x, ne.y, ne.z);
    positions.push(se.x, se.y, se.z);
    positions.push(sw.x, sw.y, sw.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const wavePhase = this.waterTime * 2 + cell.x * 0.3 + cell.y * 0.5;
    const waveIntensity = Math.sin(wavePhase) * 0.03;

    for (let i = 0; i < 4; i++) {
      const variance = (this.cellHash(cell.x, cell.y, i) - 0.5) * 0.06;
      const cornerWave = Math.sin(wavePhase + i * 0.7) * 0.02;
      const r = clamp01(baseColor.r + variance + waveIntensity + cornerWave);
      const g = clamp01(baseColor.g + variance * 0.8 + waveIntensity * 0.6 + cornerWave);
      const b = clamp01(baseColor.b + variance * 0.5 + cornerWave * 0.3);
      colors.push(r, g, b, 0.7);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    if (existingMesh) {
      if (existingMesh.getTotalVertices() === 4) {
        vertexData.applyToMesh(existingMesh, true);
        return existingMesh;
      } else {
        existingMesh.dispose();
      }
    }

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh, true);
    mesh.material = this.waterMaterial;
    mesh.useVertexColors = true;
    mesh.hasVertexAlpha = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private createStripedTile(
    cell: CellState,
    baseColor: Color3,
    corners: { nw: number; ne: number; se: number; sw: number },
    existingMesh?: Mesh
  ): Mesh {
    const nw = gridTo3D(cell.x, cell.y, corners.nw);
    const ne = gridTo3D(cell.x + 1, cell.y, corners.ne);
    const se = gridTo3D(cell.x + 1, cell.y + 1, corners.se);
    const sw = gridTo3D(cell.x, cell.y + 1, corners.sw);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const lightColor = new Color3(
      Math.min(1, baseColor.r + 0.1),
      Math.min(1, baseColor.g + 0.12),
      Math.min(1, baseColor.b + 0.06)
    );
    const darkColor = new Color3(
      Math.max(0, baseColor.r - 0.06),
      Math.max(0, baseColor.g - 0.04),
      Math.max(0, baseColor.b - 0.06)
    );

    const stripeCount = 4;
    let vertexIndex = 0;

    for (let i = 0; i < stripeCount; i++) {
      const t0 = i / stripeCount;
      const t1 = (i + 1) / stripeCount;

      const leftTop = Vector3.Lerp(nw, sw, t0);
      const leftBot = Vector3.Lerp(nw, sw, t1);
      const rightTop = Vector3.Lerp(ne, se, t0);
      const rightBot = Vector3.Lerp(ne, se, t1);

      positions.push(leftTop.x, leftTop.y, leftTop.z);
      positions.push(rightTop.x, rightTop.y, rightTop.z);
      positions.push(rightBot.x, rightBot.y, rightBot.z);
      positions.push(leftBot.x, leftBot.y, leftBot.z);

      indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 3);

      const stripeColor = i % 2 === 0 ? lightColor : darkColor;
      for (let j = 0; j < 4; j++) {
        const variance = (this.cellHash(cell.x, cell.y, i * 4 + j) - 0.5) * 0.06;
        colors.push(
          clamp01(stripeColor.r + variance),
          clamp01(stripeColor.g + variance * 1.2),
          clamp01(stripeColor.b + variance * 0.5),
          1
        );
      }

      vertexIndex += 4;
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    if (existingMesh) {
      if (existingMesh.getTotalVertices() === 16) {
        vertexData.applyToMesh(existingMesh, true);
        return existingMesh;
      } else {
        existingMesh.dispose();
      }
    }

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh, true);
    mesh.material = this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  private shouldShowStripes(cell: CellState): boolean {
    if (cell.type === "bunker" || cell.type === "water") return false;
    const mownThreshold =
      cell.type === "green" ? 10 : cell.type === "fairway" ? 20 : 30;
    return cell.height <= mownThreshold;
  }

  private getCellColor(cell: CellState): Color3 {
    if (this.overlayMode !== "normal") {
      return this.getOverlayColor(cell);
    }

    const baseColor = this.getTerrainBaseColor(cell);

    if (cell.type === "bunker" || cell.type === "water") {
      return baseColor;
    }

    if (cell.health < 20) {
      return new Color3(0.45, 0.35, 0.2);
    }
    if (cell.health < 40) {
      return new Color3(0.55, 0.5, 0.25);
    }

    let tintR = 0,
      tintG = 0,
      tintB = 0;
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
      clamp01(baseColor.r + variation + tintR),
      clamp01(baseColor.g + variation * 1.2 + tintG),
      clamp01(baseColor.b + variation * 0.8 + tintB)
    );
  }

  private getCornerColorVariations(
    cell: CellState,
    baseColor: Color3
  ): Color3[] {
    if (cell.type === "water") {
      return [baseColor, baseColor, baseColor, baseColor];
    }

    const variations: Color3[] = [];

    if (cell.type === "bunker") {
      for (let i = 0; i < 4; i++) {
        const lumVariance = (this.cellHash(cell.x, cell.y, i) - 0.5) * 0.15;
        const warmVariance = (this.cellHash(cell.x, cell.y, i + 5) - 0.5) * 0.08;
        variations.push(
          new Color3(
            clamp01(baseColor.r + lumVariance + warmVariance),
            clamp01(baseColor.g + lumVariance * 0.9),
            clamp01(baseColor.b + lumVariance * 0.6 - warmVariance * 0.5)
          )
        );
      }
      return variations;
    }

    for (let i = 0; i < 4; i++) {
      const variance = (this.cellHash(cell.x, cell.y, i) - 0.5) * 0.12;
      const lumVariance = (this.cellHash(cell.x, cell.y, i + 10) - 0.5) * 0.08;

      variations.push(
        new Color3(
          clamp01(baseColor.r + variance + lumVariance),
          clamp01(baseColor.g + variance * 1.3 + lumVariance),
          clamp01(baseColor.b + variance * 0.6 + lumVariance)
        )
      );
    }

    return variations;
  }
  private getTerrainBaseColor(cell: CellState): Color3 {
    switch (cell.type) {
      case "fairway":
        return new Color3(0.4, 0.7, 0.3);
      case "rough":
        return new Color3(0.35, 0.55, 0.25);
      case "green":
        return new Color3(0.3, 0.8, 0.35);
      case "bunker":
        return new Color3(0.85, 0.75, 0.5);
      case "water":
        return new Color3(0.2, 0.4, 0.65);
      default:
        return new Color3(0.4, 0.6, 0.3);
    }
  }

  private getOverlayColor(cell: CellState): Color3 {
    if (cell.type === "bunker" || cell.type === "water") {
      return this.getTerrainBaseColor(cell);
    }

    let value = 0;
    switch (this.overlayMode) {
      case "moisture":
        value = cell.moisture;
        break;
      case "nutrients":
        value = cell.nutrients;
        break;
      case "height":
        value = cell.height;
        break;
      default:
        return this.getTerrainBaseColor(cell);
    }

    const t = value / 100;
    if (this.overlayMode === "moisture") {
      return new Color3(0.2 + (1 - t) * 0.6, 0.3 + t * 0.3, 0.4 + t * 0.5);
    } else if (this.overlayMode === "nutrients") {
      return new Color3(0.3 + (1 - t) * 0.5, 0.5 + t * 0.4, 0.2);
    } else {
      return new Color3(0.2 + t * 0.6, 0.7 - t * 0.4, 0.2);
    }
  }

  public update(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void {
    this.gameTime = gameTimeMinutes;
    this.waterTime += deltaMs / 1000;

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

        const result = simulateGrowth(cell, deltaMinutes, weather);

        cell.height = result.height;
        cell.moisture = result.moisture;
        cell.nutrients = result.nutrients;
        cell.health = result.health;

        const heightChanged = Math.abs(result.height - prevHeight) > threshold;
        const moistureChanged =
          Math.abs(result.moisture - prevMoisture) > threshold;
        const nutrientsChanged =
          Math.abs(result.nutrients - prevNutrients) > threshold;
        const healthChanged = Math.abs(result.health - prevHealth) > threshold;

        if (
          heightChanged ||
          moistureChanged ||
          nutrientsChanged ||
          healthChanged
        ) {
          this.dirtyTiles.add(`${x}_${y}`);
        }
      }
    }

    this.updateDirtyTileVisuals();
    this.updateWaterAnimation();
  }

  private updateWaterAnimation(): void {
    for (const key of this.waterTiles) {
      const [xStr, yStr] = key.split("_");
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const cell = this.cells[y]?.[x];
      if (!cell) continue;

      const mesh = this.tileMeshes.get(key);
      if (mesh) {
        const corners = this.getCornerHeights(x, y, cell.elevation);
        this.createWaterTile(cell, this.getCellColor(cell), corners, mesh);
      }
    }
  }

  private updateDirtyTileVisuals(): void {
    for (const key of this.dirtyTiles) {
      const [xStr, yStr] = key.split("_");
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

    const cell = this.cells[y][x];
    const newMesh = this.createTileMesh(cell, oldMesh);

    if (newMesh !== oldMesh) {
      this.tileMeshes.set(key, newMesh);
    }
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

  public rakeAt(gridX: number, gridY: number): boolean {
    const cell = this.getCell(gridX, gridY);
    if (!cell || cell.type !== 'bunker') return false;

    cell.lastMowed = this.gameTime;
    return true;
  }

  public waterArea(
    centerX: number,
    centerY: number,
    radius: number,
    amount: number
  ): number {
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

  public fertilizeArea(
    centerX: number,
    centerY: number,
    radius: number,
    amount: number,
    effectiveness: number = 1.0
  ): number {
    const cellsToFertilize = getCellsInRadius(centerX, centerY, radius);
    let affectedCount = 0;

    for (const { x, y } of cellsToFertilize) {
      const cell = this.getCell(x, y);
      if (!cell) continue;

      const result = applyFertilizing(cell, amount, effectiveness);
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

  public getAllCells(): CellState[][] {
    return this.cells;
  }

  public restoreCells(savedCells: CellState[][]): void {
    for (let y = 0; y < savedCells.length && y < this.cells.length; y++) {
      for (let x = 0; x < savedCells[y].length && x < this.cells[y].length; x++) {
        const saved = savedCells[y][x];
        this.cells[y][x] = { ...saved };
      }
    }
    this.updateAllTileVisuals();
  }

  public getCourseStats(): {
    health: number;
    moisture: number;
    nutrients: number;
    height: number;
  } {
    return getAverageStats(this.cells);
  }

  public cycleOverlayMode(): OverlayMode {
    const modes: OverlayMode[] = ["normal", "moisture", "nutrients", "height"];
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

  public gridToWorld(gridX: number, gridY: number): Vector3 {
    const cell = this.getCell(gridX, gridY);
    const avgElev = cell ? cell.elevation : 0;
    return gridTo3D(gridX + 0.5, gridY + 0.5, avgElev);
  }

  public setTerrainTypeAt(
    x: number,
    y: number,
    type: import("../../core/terrain").TerrainType
  ): void {
    const cell = this.getCell(x, y);
    if (!cell) return;

    const initialValues = getInitialValues(type);
    cell.type = type;
    cell.height = initialValues.height;
    cell.moisture = initialValues.moisture;
    cell.nutrients = initialValues.nutrients;
    cell.health = calculateHealth(cell);
  }

  public setElevationAt(x: number, y: number, elev: number): void {
    const { width, height } = this.courseData;
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    this.cells[y][x].elevation = elev;
    this.rebuildTileAndNeighbors(x, y);
  }

  public rebuildTileAndNeighbors(x: number, y: number): void {
    const { width, height } = this.courseData;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          this.updateTileVisual(nx, ny);
          this.rebuildCliffFacesForCell(nx, ny);
        }
      }
    }

    this.createGridLines();
  }

  private rebuildCliffFacesForCell(x: number, y: number): void {
    const directions = ["n", "e", "s", "w"];
    for (const dir of directions) {
      const key = `cliff_${x}_${y}_${dir}`;
      const oldMesh = this.cliffMeshes.get(key);
      if (oldMesh) {
        oldMesh.dispose();
        this.cliffMeshes.delete(key);
      }
    }

    this.createCliffFacesForCell(x, y);
  }

  public getCornerHeightsPublic(
    gridX: number,
    gridY: number
  ): { nw: number; ne: number; se: number; sw: number } {
    const cell = this.getCell(gridX, gridY);
    return this.getCornerHeights(gridX, gridY, cell ? cell.elevation : 0);
  }

  public getLayoutGrid(): number[][] {
    return this.cells.map((row) => row.map((cell) => getTerrainCode(cell.type)));
  }

  public getElevationGrid(): number[][] {
    return this.cells.map((row) => row.map((cell) => cell.elevation));
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
