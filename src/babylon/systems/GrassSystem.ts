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
  getInitialValues,
  calculateHealth,
  getCellsInRadius,
  TILE_WIDTH,
  TILE_HEIGHT,
  ELEVATION_HEIGHT,
  TERRAIN_CODES,
} from "../../core/terrain";

import {
  simulateGrowth,
  applyMowing,
  applyWatering,
  applyFertilizing,
  getAverageStats,
} from "../../core/grass-simulation";

import { CourseData } from "../../data/courseData";

export type OverlayMode = "normal" | "moisture" | "nutrients" | "height";

export class GrassSystem {
  private scene: Scene;
  private courseData: CourseData;
  private cells: CellState[][] = [];
  private tileMeshes: Map<string, Mesh> = new Map();
  private cliffMeshes: Map<string, Mesh> = new Map();
  private gridLinesMesh: LinesMesh | null = null;
  private overlayMode: OverlayMode = "normal";
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
  }

  public build(): void {
    const { width, height } = this.courseData;

    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const cell = this.cells[y][x];
        const mesh = this.createTileMesh(cell);
        this.tileMeshes.set(`${x}_${y}`, mesh);
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
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const topColor =
      side === "right"
        ? new Color3(0.72, 0.58, 0.42)
        : new Color3(0.58, 0.48, 0.35);
    const bottomColor =
      side === "right"
        ? new Color3(0.52, 0.42, 0.3)
        : new Color3(0.42, 0.35, 0.26);

    const edgePoints: { x: number; y: number }[] = [];

    if (side === "right") {
      for (let y = 0; y < height; y++) {
        const x = width - 1;
        const corners = this.getCornerHeights(x, y);
        const center = this.gridToScreen(x, y, 0);

        edgePoints.push({
          x: center.x + hw,
          y: center.y + corners.ne * ELEVATION_HEIGHT,
        });
        edgePoints.push({
          x: center.x,
          y: center.y - hh + corners.se * ELEVATION_HEIGHT,
        });
      }
    } else {
      for (let x = 0; x < width; x++) {
        const y = height - 1;
        const corners = this.getCornerHeights(x, y);
        const center = this.gridToScreen(x, y, 0);

        edgePoints.push({
          x: center.x,
          y: center.y - hh + corners.se * ELEVATION_HEIGHT,
        });
        edgePoints.push({
          x: center.x - hw,
          y: center.y + corners.sw * ELEVATION_HEIGHT,
        });
      }
    }

    for (let i = 0; i < edgePoints.length; i++) {
      const pt = edgePoints[i];
      positions.push(pt.x, pt.y, -0.1);
      colors.push(topColor.r, topColor.g, topColor.b, 1);
      positions.push(pt.x, pt.y - GrassSystem.CLIFF_HEIGHT, -0.1);
      colors.push(bottomColor.r, bottomColor.g, bottomColor.b, 1);
    }

    for (let i = 0; i < edgePoints.length - 1; i++) {
      const topLeft = i * 2;
      const bottomLeft = i * 2 + 1;
      const topRight = (i + 1) * 2;
      const bottomRight = (i + 1) * 2 + 1;

      indices.push(topLeft, topRight, bottomRight);
      indices.push(topLeft, bottomRight, bottomLeft);
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
    const { width, height } = this.courseData;
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const corners = this.getCornerHeights(x, y);
    const center = this.gridToScreen(x, y, 0);

    const neY = center.y + corners.ne * ELEVATION_HEIGHT;
    const seY = center.y - hh + corners.se * ELEVATION_HEIGHT;
    const swY = center.y + corners.sw * ELEVATION_HEIGHT;

    const rightNeighbor = this.cells[y]?.[x + 1];
    const bottomNeighbor = this.cells[y + 1]?.[x];

    const isRightEdge = x === width - 1;
    const isBottomEdge = y === height - 1;

    // Right cliff for interior tiles (edge cliffs handled by createEdgeCliffStrip)
    if (!isRightEdge && rightNeighbor) {
      const neighborCorners = this.getCornerHeights(x + 1, y);
      const neighborCenter = this.gridToScreen(x + 1, y, 0);

      const neighborNwY =
        neighborCenter.y + hh + neighborCorners.nw * ELEVATION_HEIGHT;
      const neighborSwY =
        neighborCenter.y + neighborCorners.sw * ELEVATION_HEIGHT;

      const drop1 = neighborNwY - neY;
      const drop2 = neighborSwY - seY;

      if (drop1 > 0.5 || drop2 > 0.5) {
        const mesh = this.createCliffFaceWithCorners(
          center.x + hw,
          neY,
          center.x,
          seY,
          Math.max(0, drop1),
          Math.max(0, drop2),
          `cliff_right_${x}_${y}`,
          "right"
        );
        this.cliffMeshes.set(`right_${x}_${y}`, mesh);
      }
    }

    // Bottom cliff for interior tiles (edge cliffs handled by createEdgeCliffStrip)
    if (!isBottomEdge && bottomNeighbor) {
      const neighborCorners = this.getCornerHeights(x, y + 1);
      const neighborCenter = this.gridToScreen(x, y + 1, 0);

      const neighborNeY =
        neighborCenter.y + neighborCorners.ne * ELEVATION_HEIGHT;
      const neighborNwY =
        neighborCenter.y + hh + neighborCorners.nw * ELEVATION_HEIGHT;

      const drop1 = neighborNeY - seY;
      const drop2 = neighborNwY - swY;

      if (drop1 > 0.5 || drop2 > 0.5) {
        const mesh = this.createCliffFaceWithCorners(
          center.x,
          seY,
          center.x - hw,
          swY,
          Math.max(0, drop1),
          Math.max(0, drop2),
          `cliff_bottom_${x}_${y}`,
          "bottom"
        );
        this.cliffMeshes.set(`bottom_${x}_${y}`, mesh);
      }
    }
  }

  private createCliffFaceWithCorners(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    drop1: number,
    drop2: number,
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

    // Top-left, top-right, bottom-right, bottom-left
    positions.push(x1, y1, 0);
    positions.push(x2, y2, 0);
    positions.push(x2, y2 + drop2, 0);
    positions.push(x1, y1 + drop1, 0);

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
        if (cell.type === "water" || cell.type === "bunker") continue;

        const corners = this.getCornerHeights(x, y);
        const baseElev = Math.min(
          corners.nw,
          corners.ne,
          corners.se,
          corners.sw
        );
        const center = this.gridToScreen(cell.x, cell.y, baseElev);
        const zOffset = -0.05;

        // Calculate offsets from center
        const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
        const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
        const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
        const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

        const top = new Vector3(
          center.x,
          center.y + hh + nwOffset,
          center.z + zOffset
        );
        const right = new Vector3(
          center.x + hw,
          center.y + neOffset,
          center.z + zOffset
        );
        const bottom = new Vector3(
          center.x,
          center.y - hh + seOffset,
          center.z + zOffset
        );
        const left = new Vector3(
          center.x - hw,
          center.y + swOffset,
          center.z + zOffset
        );

        // 1. Draw Left->Top edge (NW facing)
        // This covers internal edges shared with the West neighbor, AND the West map boundary
        points.push([left, top]);
        colors.push([lineColor, lineColor]);

        // 2. Draw Top->Right edge (NE facing)
        // This covers internal edges shared with the North neighbor, AND the North map boundary
        points.push([top, right]);
        colors.push([lineColor, lineColor]);

        // 3. Draw Right->Bottom edge (SE facing) ONLY if at the East map boundary
        if (x === width - 1) {
          points.push([right, bottom]);
          colors.push([lineColor, lineColor]);
        }

        // 4. Draw Bottom->Left edge (SW facing) ONLY if at the South map boundary
        if (y === height - 1) {
          points.push([bottom, left]);
          colors.push([lineColor, lineColor]);
        }
      }
    }

    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
    }

    if (points.length > 0) {
      this.gridLinesMesh = MeshBuilder.CreateLineSystem(
        "gridLines",
        { lines: points, colors: colors, useVertexAlpha: true },
        this.scene
      );
      this.gridLinesMesh.isPickable = false;
    }
  }

  private gridToScreen(
    gridX: number,
    gridY: number,
    elevation: number
  ): { x: number; y: number; z: number } {
    const screenX = (gridX - gridY) * (TILE_WIDTH / 2);
    const screenY =
      -((gridX + gridY) * (TILE_HEIGHT / 2)) + elevation * ELEVATION_HEIGHT;
    return { x: screenX, y: screenY, z: 0 };
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
    gridY: number
  ): { nw: number; ne: number; se: number; sw: number } {
    const baseElev = this.getElevationAt(gridX, gridY);
    const nElev = this.getElevationAt(gridX, gridY - 1, baseElev);
    const sElev = this.getElevationAt(gridX, gridY + 1, baseElev);
    const eElev = this.getElevationAt(gridX + 1, gridY, baseElev);
    const wElev = this.getElevationAt(gridX - 1, gridY, baseElev);
    const neElev = this.getElevationAt(gridX + 1, gridY - 1, baseElev);
    const nwElev = this.getElevationAt(gridX - 1, gridY - 1, baseElev);
    const seElev = this.getElevationAt(gridX + 1, gridY + 1, baseElev);
    const swElev = this.getElevationAt(gridX - 1, gridY + 1, baseElev);

    const nw = Math.max(baseElev, nElev, wElev, nwElev);
    const ne = Math.max(baseElev, nElev, eElev, neElev);
    const se = Math.max(baseElev, sElev, eElev, seElev);
    const sw = Math.max(baseElev, sElev, wElev, swElev);

    return { nw, ne, se, sw };
  }

  private createTileMesh(cell: CellState): Mesh {
    const corners = this.getCornerHeights(cell.x, cell.y);
    const baseElev = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
    const center = this.gridToScreen(cell.x, cell.y, baseElev);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
    const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
    const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
    const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

    const color = this.getCellColor(cell);
    const shouldStripe = this.shouldShowStripes(cell);

    if (shouldStripe) {
      return this.createStripedTile(cell, center, hw, hh, color, corners);
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    positions.push(center.x, center.y + hh + nwOffset, center.z);
    positions.push(center.x + hw, center.y + neOffset, center.z);
    positions.push(center.x, center.y - hh + seOffset, center.z);
    positions.push(center.x - hw, center.y + swOffset, center.z);

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
    baseColor: Color3,
    corners: { nw: number; ne: number; se: number; sw: number }
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const baseElev = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
    const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
    const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
    const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
    const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

    const nw = { x: center.x, y: center.y + hh + nwOffset };
    const ne = { x: center.x + hw, y: center.y + neOffset };
    const se = { x: center.x, y: center.y - hh + seOffset };
    const sw = { x: center.x - hw, y: center.y + swOffset };

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

      const leftTop = this.lerpPoint(sw, nw, t0);
      const leftBot = this.lerpPoint(sw, nw, t1);
      const rightTop = this.lerpPoint(se, ne, t0);
      const rightBot = this.lerpPoint(se, ne, t1);

      positions.push(leftTop.x, leftTop.y, center.z);
      positions.push(rightTop.x, rightTop.y, center.z);
      positions.push(rightBot.x, rightBot.y, center.z);
      positions.push(leftBot.x, leftBot.y, center.z);

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

  private lerpPoint(
    a: { x: number; y: number },
    b: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
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
      Math.max(0, Math.min(1, baseColor.r + variation + tintR)),
      Math.max(0, Math.min(1, baseColor.g + variation * 1.2 + tintG)),
      Math.max(0, Math.min(1, baseColor.b + variation * 0.8 + tintB))
    );
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
    amount: number
  ): number {
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

  public gridToWorld(
    gridX: number,
    gridY: number
  ): { x: number; y: number; z: number } {
    const corners = this.getCornerHeights(gridX, gridY);
    const avgElev = (corners.nw + corners.ne + corners.se + corners.sw) / 4;
    return this.gridToScreen(gridX, gridY, avgElev);
  }

  public setElevationAt(x: number, y: number, elevation: number): void {
    const cell = this.getCell(x, y);
    if (!cell) return;

    cell.elevation = elevation;
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
    return this.getCornerHeights(gridX, gridY);
  }

  public getLayoutGrid(): number[][] {
    return this.cells.map((row) =>
      row.map((cell) => {
        switch (cell.type) {
          case "fairway":
            return TERRAIN_CODES.FAIRWAY;
          case "rough":
            return TERRAIN_CODES.ROUGH;
          case "green":
            return TERRAIN_CODES.GREEN;
          case "bunker":
            return TERRAIN_CODES.BUNKER;
          case "water":
            return TERRAIN_CODES.WATER;
          default:
            return TERRAIN_CODES.ROUGH;
        }
      })
    );
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
