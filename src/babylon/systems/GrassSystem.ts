import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import {
  TerrainType,
  MovableCell,
  getTerrainType,
  getInitialValues,
  calculateHealth,
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
  GrassCell,
  WeatherEffect,
} from "../../core/grass-simulation";

import { CourseData } from "../../data/courseData";
import { FaceState } from "../../core/face-state";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type { OverlayMode };

interface InternalCell extends GrassCell {
  x: number;
  y: number;
  elevation: number;
  obstacle: "none" | "tree" | "pine_tree" | "shrub" | "bush";
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
}

export class GrassSystem {
  private scene: Scene;
  private courseData: CourseData;
  private cells: InternalCell[][] = [];
  private tileMeshes: Map<string, Mesh> = new Map();
  private waterTiles: Set<string> = new Set();
  private gridLinesMesh: LinesMesh | null = null;
  private overlayMode: OverlayMode = "normal";
  private tileMaterial: StandardMaterial | null = null;
  private waterMaterial: StandardMaterial | null = null;
  private gameTime: number = 0;
  private waterTime: number = 0;
  private dirtyTiles: Set<string> = new Set();
  private updateCount: number = 0;
  private static readonly VISUAL_UPDATE_THRESHOLD = 0.5;

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
    this.initCells();
    this.createTileMaterial();
  }

  private initCells(): void {
    const { width, height, obstacles } = this.courseData;

    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        const terrainType = getTerrainType(TERRAIN_CODES.ROUGH);
        const initialValues = getInitialValues(terrainType);

        const cell: InternalCell = {
          x,
          y,
          type: terrainType,
          height: initialValues.height,
          moisture: initialValues.moisture,
          nutrients: initialValues.nutrients,
          health: 100,
          elevation: 0,
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
    this.tileMaterial.needAlphaBlending = () =>
      this.overlayMode === "irrigation";
    this.tileMaterial.needAlphaTesting = () => false;
    this.tileMaterial.freeze();

    this.waterMaterial = new StandardMaterial("waterMat", this.scene);
    this.waterMaterial.diffuseColor = new Color3(1, 1, 1);
    this.waterMaterial.specularColor = new Color3(0.15, 0.15, 0.2);
    this.waterMaterial.emissiveColor = new Color3(0.85, 0.85, 0.9);
    this.waterMaterial.disableLighting = true;
    this.waterMaterial.backFaceCulling = false;
    this.waterMaterial.alpha = 1;
    this.waterMaterial.needAlphaBlending = () => true;
    this.waterMaterial.needAlphaTesting = () => false;
    this.waterMaterial.freeze();
  }

  public build(_courseData: CourseData): void {
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

  public getMeshElevationAt(meshX: number, meshY: number, defaultForOutOfBounds?: number): number {
    return this.getElevationAt(meshX, meshY, defaultForOutOfBounds);
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

  private getNeighborType(x: number, y: number): string | null {
    const { width, height } = this.courseData;
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    const cell = this.cells[y]?.[x];
    return cell ? cell.type : null;
  }

  private getCornerRounding(cell: InternalCell): {
    nw: number;
    ne: number;
    se: number;
    sw: number;
  } {
    if (cell.type === "rough") {
      return { nw: 0, ne: 0, se: 0, sw: 0 };
    }

    const x = cell.x;
    const y = cell.y;
    const myType = cell.type;

    const nType = this.getNeighborType(x, y - 1);
    const sType = this.getNeighborType(x, y + 1);
    const eType = this.getNeighborType(x + 1, y);
    const wType = this.getNeighborType(x - 1, y);

    const nDiff = nType !== null && nType !== myType;
    const sDiff = sType !== null && sType !== myType;
    const eDiff = eType !== null && eType !== myType;
    const wDiff = wType !== null && wType !== myType;

    return {
      nw: nDiff && wDiff && nType === wType ? 1 : 0,
      ne: nDiff && eDiff && nType === eType ? 1 : 0,
      se: sDiff && eDiff && sType === eType ? 1 : 0,
      sw: sDiff && wDiff && sType === wType ? 1 : 0,
    };
  }

  private getCornerFillType(
    cell: InternalCell,
    corner: "nw" | "ne" | "se" | "sw"
  ): string {
    const x = cell.x;
    const y = cell.y;

    switch (corner) {
      case "nw":
        return this.getNeighborType(x, y - 1) || "rough";
      case "ne":
        return this.getNeighborType(x + 1, y) || "rough";
      case "se":
        return this.getNeighborType(x, y + 1) || "rough";
      case "sw":
        return this.getNeighborType(x - 1, y) || "rough";
    }
  }

  private needsRounding(rounding: {
    nw: number;
    ne: number;
    se: number;
    sw: number;
  }): boolean {
    return (
      rounding.nw > 0 || rounding.ne > 0 || rounding.se > 0 || rounding.sw > 0
    );
  }

  private createRoundedTileMesh(
    cell: InternalCell,
    baseColor: Color3,
    corners: { nw: number; ne: number; se: number; sw: number },
    rounding: { nw: number; ne: number; se: number; sw: number },
    existingMesh?: Mesh,
    isWater: boolean = false
  ): Mesh {
    const nw3d = gridTo3D(cell.x, cell.y, corners.nw);
    const ne3d = gridTo3D(cell.x + 1, cell.y, corners.ne);
    const se3d = gridTo3D(cell.x + 1, cell.y + 1, corners.se);
    const sw3d = gridTo3D(cell.x, cell.y + 1, corners.sw);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const INSET = 0.3;

    const getColorForType = (type: string): Color3 => {
      switch (type) {
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
          return new Color3(0.35, 0.55, 0.25);
      }
    };

    const nwFillColor = getColorForType(this.getCornerFillType(cell, "nw"));
    const neFillColor = getColorForType(this.getCornerFillType(cell, "ne"));
    const seFillColor = getColorForType(this.getCornerFillType(cell, "se"));
    const swFillColor = getColorForType(this.getCornerFillType(cell, "sw"));

    const insetNW = rounding.nw > 0 ? INSET * rounding.nw : 0;
    const insetNE = rounding.ne > 0 ? INSET * rounding.ne : 0;
    const insetSE = rounding.se > 0 ? INSET * rounding.se : 0;
    const insetSW = rounding.sw > 0 ? INSET * rounding.sw : 0;

    positions.push(nw3d.x, nw3d.y, nw3d.z);
    positions.push(ne3d.x, ne3d.y, ne3d.z);
    positions.push(se3d.x, se3d.y, se3d.z);
    positions.push(sw3d.x, sw3d.y, sw3d.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const alpha = isWater ? 0.7 : this.overlayMode === "irrigation" ? 0.2 : 1;

    const isIrrigation = this.overlayMode === "irrigation";

    for (let i = 0; i < 4; i++) {
      const variance = (this.cellHash(cell.x, cell.y, i) - 0.5) * 0.06;
      if (isIrrigation) {
        colors.push(0.92, 0.9, 0.88, 0.2);
      } else {
        colors.push(
          clamp01(baseColor.r + variance),
          clamp01(baseColor.g + variance * 1.2),
          clamp01(baseColor.b + variance * 0.5),
          alpha
        );
      }
    }

    let vertexIndex = 4;

    const yOffset = 0.002;

    if (rounding.nw > 0) {
      const v = vertexIndex;
      positions.push(nw3d.x, nw3d.y + yOffset, nw3d.z);
      positions.push(nw3d.x, nw3d.y + yOffset, nw3d.z + insetNW);
      positions.push(nw3d.x + insetNW, nw3d.y + yOffset, nw3d.z);

      indices.push(v, v + 1, v + 2);

      const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      const isIrrigation = this.overlayMode === "irrigation";
      const r = isIrrigation ? 0.92 : nwFillColor.r;
      const g = isIrrigation ? 0.9 : nwFillColor.g;
      const b = isIrrigation ? 0.88 : nwFillColor.b;
      for (let i = 0; i < 3; i++) {
        colors.push(r, g, b, alpha);
      }
      vertexIndex += 3;
    }

    if (rounding.ne > 0) {
      const v = vertexIndex;
      positions.push(ne3d.x, ne3d.y + yOffset, ne3d.z);
      positions.push(ne3d.x - insetNE, ne3d.y + yOffset, ne3d.z);
      positions.push(ne3d.x, ne3d.y + yOffset, ne3d.z + insetNE);

      indices.push(v, v + 1, v + 2);

      const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      const isIrrigation = this.overlayMode === "irrigation";
      const r = isIrrigation ? 0.92 : neFillColor.r;
      const g = isIrrigation ? 0.9 : neFillColor.g;
      const b = isIrrigation ? 0.88 : neFillColor.b;
      for (let i = 0; i < 3; i++) {
        colors.push(r, g, b, alpha);
      }
      vertexIndex += 3;
    }

    if (rounding.se > 0) {
      const v = vertexIndex;
      positions.push(se3d.x, se3d.y + yOffset, se3d.z);
      positions.push(se3d.x, se3d.y + yOffset, se3d.z - insetSE);
      positions.push(se3d.x - insetSE, se3d.y + yOffset, se3d.z);

      indices.push(v, v + 1, v + 2);

      const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      const isIrrigation = this.overlayMode === "irrigation";
      const r = isIrrigation ? 0.92 : seFillColor.r;
      const g = isIrrigation ? 0.9 : seFillColor.g;
      const b = isIrrigation ? 0.88 : seFillColor.b;
      for (let i = 0; i < 3; i++) {
        colors.push(r, g, b, alpha);
      }
      vertexIndex += 3;
    }

    if (rounding.sw > 0) {
      const v = vertexIndex;
      positions.push(sw3d.x, sw3d.y + yOffset, sw3d.z);
      positions.push(sw3d.x + insetSW, sw3d.y + yOffset, sw3d.z);
      positions.push(sw3d.x, sw3d.y + yOffset, sw3d.z - insetSW);

      indices.push(v, v + 1, v + 2);

      const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      const isIrrigation = this.overlayMode === "irrigation";
      const r = isIrrigation ? 0.92 : swFillColor.r;
      const g = isIrrigation ? 0.9 : swFillColor.g;
      const b = isIrrigation ? 0.88 : swFillColor.b;
      for (let i = 0; i < 3; i++) {
        colors.push(r, g, b, alpha);
      }
      vertexIndex += 3;
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    if (existingMesh) {
      existingMesh.dispose();
    }

    const mesh = new Mesh(`tile_${cell.x}_${cell.y}`, this.scene);
    vertexData.applyToMesh(mesh, true);
    mesh.material = isWater ? this.waterMaterial : this.tileMaterial;
    mesh.useVertexColors = true;
    mesh.hasVertexAlpha = isWater || this.overlayMode === "irrigation";
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.freezeWorldMatrix();

    return mesh;
  }

  private createTileMesh(cell: InternalCell, existingMesh?: Mesh): Mesh {
    const corners = this.getCornerHeights(cell.x, cell.y, cell.elevation);
    const color = this.getCellColor(cell);
    const rounding = this.getCornerRounding(cell);

    if (this.needsRounding(rounding)) {
      const isWater = cell.type === "water";
      return this.createRoundedTileMesh(
        cell,
        color,
        corners,
        rounding,
        existingMesh,
        isWater
      );
    }

    if (cell.type === "water") {
      return this.createWaterTile(cell, color, corners, existingMesh);
    }

    const shouldStripe = this.shouldShowStripes(cell);
    if (shouldStripe) {
      return this.createStripedTile(cell, color, corners, existingMesh);
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

    const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
    const cornerColors = this.getCornerColorVariations(cell, color);
    const isIrrigation = this.overlayMode === "irrigation";
    const baseR = isIrrigation ? 0.92 : null;
    const baseG = isIrrigation ? 0.9 : null;
    const baseB = isIrrigation ? 0.88 : null;

    for (const c of cornerColors) {
      colors.push(baseR ?? c.r, baseG ?? c.g, baseB ?? c.b, alpha);
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
    mesh.hasVertexAlpha = this.overlayMode === "irrigation";
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.freezeWorldMatrix();

    return mesh;
  }

  private createWaterTile(
    cell: InternalCell,
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
      const g = clamp01(
        baseColor.g + variance * 0.8 + waveIntensity * 0.6 + cornerWave
      );
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
    cell: InternalCell,
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

      const alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      const stripeColor = i % 2 === 0 ? lightColor : darkColor;

      const r = this.overlayMode === "irrigation" ? 1 : stripeColor.r;
      const g = this.overlayMode === "irrigation" ? 1 : stripeColor.g;
      const b = this.overlayMode === "irrigation" ? 1 : stripeColor.b;

      for (let j = 0; j < 4; j++) {
        const variance =
          (this.cellHash(cell.x, cell.y, i * 4 + j) - 0.5) * 0.06;
        colors.push(
          this.overlayMode === "irrigation" ? r : clamp01(r + variance),
          this.overlayMode === "irrigation" ? g : clamp01(g + variance * 1.2),
          this.overlayMode === "irrigation" ? b : clamp01(b + variance * 0.5),
          alpha
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
    mesh.hasVertexAlpha = this.overlayMode === "irrigation";
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.freezeWorldMatrix();

    return mesh;
  }

  private shouldShowStripes(cell: InternalCell): boolean {
    if (cell.type === "bunker" || cell.type === "water") return false;
    const mownThreshold =
      cell.type === "green" ? 10 : cell.type === "fairway" ? 20 : 30;
    return cell.height <= mownThreshold;
  }

  private getCellColor(cell: InternalCell): Color3 {
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
    cell: InternalCell,
    baseColor: Color3
  ): Color3[] {
    if (cell.type === "water") {
      return [baseColor, baseColor, baseColor, baseColor];
    }

    const variations: Color3[] = [];

    if (cell.type === "bunker") {
      for (let i = 0; i < 4; i++) {
        const lumVariance = (this.cellHash(cell.x, cell.y, i) - 0.5) * 0.15;
        const warmVariance =
          (this.cellHash(cell.x, cell.y, i + 5) - 0.5) * 0.08;
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
  private getTerrainBaseColor(cell: InternalCell): Color3 {
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

  private getOverlayColor(cell: InternalCell): Color3 {
    if (cell.type === "bunker" || cell.type === "water") {
      return this.getTerrainBaseColor(cell);
    }

    if (this.overlayMode === "irrigation") {
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

  public update(
    deltaMs: number,
    gameTimeMinutes: number,
    weather?: WeatherEffect
  ): void {
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
    this.updateCount++;
  }

  public mowAt(gridX: number, gridY: number): boolean {
    const cell = this.cells[gridY]?.[gridX];
    if (!cell) return false;

    const result = applyMowing(cell);
    if (!result) return false;

    cell.height = result.height;
    cell.moisture = result.moisture;
    cell.nutrients = result.nutrients;
    cell.health = result.health;
    cell.lastMowed = this.gameTime;
    this.updateTileVisual(gridX, gridY);
    return true;
  }

  public rakeAt(gridX: number, gridY: number): boolean {
    const cell = this.cells[gridY]?.[gridX];
    if (!cell || cell.type !== "bunker") return false;

    cell.lastMowed = this.gameTime;
    return true;
  }

  public waterArea(
    centerX: number,
    centerY: number,
    radius: number,
    amount: number
  ): number {
    let affectedCount = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const x = centerX + dx;
          const y = centerY + dy;
          const cell = this.cells[y]?.[x];
          if (!cell) continue;

          const result = applyWatering(cell, amount);
          if (result) {
            cell.height = result.height;
            cell.moisture = result.moisture;
            cell.nutrients = result.nutrients;
            cell.health = result.health;
            cell.lastWatered = this.gameTime;
            this.updateTileVisual(x, y);
            affectedCount++;
          }
        }
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
    let affectedCount = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const x = centerX + dx;
          const y = centerY + dy;
          const cell = this.cells[y]?.[x];
          if (!cell) continue;

          const result = applyFertilizing(cell, amount, effectiveness);
          if (result) {
            cell.height = result.height;
            cell.moisture = result.moisture;
            cell.nutrients = result.nutrients;
            cell.health = result.health;
            cell.lastFertilized = this.gameTime;
            this.updateTileVisual(x, y);
            affectedCount++;
          }
        }
      }
    }

    return affectedCount;
  }

  public getCell(x: number, y: number): MovableCell | null {
    const cell = this.cells[y]?.[x];
    if (!cell) return null;
    return cell;
  }

  public getAllCells(): GrassCell[][] {
    return this.cells.map(row =>
      row.map(cell => ({
        type: cell.type,
        height: cell.height,
        moisture: cell.moisture,
        nutrients: cell.nutrients,
        health: cell.health,
      }))
    );
  }

  public getTerrainTypeAt(x: number, y: number): string | undefined {
    return this.cells[y]?.[x]?.type;
  }

  public setCellState(
    x: number,
    y: number,
    state: Partial<Pick<GrassCell, 'height' | 'moisture' | 'nutrients' | 'health'>>
  ): void {
    const cell = this.cells[y]?.[x];
    if (!cell) return;

    if (state.height !== undefined) cell.height = state.height;
    if (state.moisture !== undefined) cell.moisture = state.moisture;
    if (state.nutrients !== undefined) cell.nutrients = state.nutrients;
    if (state.health !== undefined) cell.health = state.health;

    this.updateTileVisual(x, y);
  }

  public setAllCellsState(
    state: Partial<Pick<GrassCell, 'height' | 'moisture' | 'nutrients' | 'health'>>
  ): void {
    for (let y = 0; y < this.cells.length; y++) {
      for (let x = 0; x < this.cells[y].length; x++) {
        const cell = this.cells[y][x];
        if (cell.type === 'water' || cell.type === 'bunker') continue;

        if (state.height !== undefined) cell.height = state.height;
        if (state.moisture !== undefined) cell.moisture = state.moisture;
        if (state.nutrients !== undefined) cell.nutrients = state.nutrients;
        if (state.health !== undefined) cell.health = state.health;
      }
    }
    this.updateAllTileVisuals();
  }

  public restoreCells(savedCells: GrassCell[][]): void {
    for (let y = 0; y < savedCells.length && y < this.cells.length; y++) {
      for (
        let x = 0;
        x < savedCells[y].length && x < this.cells[y].length;
        x++
      ) {
        const saved = savedCells[y][x];
        this.cells[y][x] = { ...this.cells[y][x], ...saved };
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
    const modes: OverlayMode[] = [
      "normal",
      "moisture",
      "nutrients",
      "height",
      "irrigation",
    ];
    const currentIndex = modes.indexOf(this.overlayMode);
    this.overlayMode = modes[(currentIndex + 1) % modes.length];
    if (this.tileMaterial) {
      this.tileMaterial.unfreeze();
      this.tileMaterial.needAlphaBlending = () =>
        this.overlayMode === "irrigation";
      this.tileMaterial.backFaceCulling = this.overlayMode === "irrigation";
      this.tileMaterial.alpha = this.overlayMode === "irrigation" ? 0.2 : 1;
      this.tileMaterial.freeze();
    }
    this.updateAllTileVisuals();
    return this.overlayMode;
  }

  public getOverlayMode(): OverlayMode {
    return this.overlayMode;
  }

  public setOverlayMode(mode: OverlayMode): void {
    this.overlayMode = mode;
    if (this.tileMaterial) {
      this.tileMaterial.unfreeze();
      this.tileMaterial.needAlphaBlending = () => mode === "irrigation";
      this.tileMaterial.backFaceCulling = mode === "irrigation";
      this.tileMaterial.alpha = mode === "irrigation" ? 0.2 : 1;
      this.tileMaterial.freeze();
    }
    this.updateAllTileVisuals();
  }

  public gridToWorld(gridX: number, gridY: number): Vector3 {
    const cell = this.cells[gridY]?.[gridX];
    const avgElev = cell ? cell.elevation : 0;
    return gridTo3D(gridX + 0.5, gridY + 0.5, avgElev);
  }

  public setTerrainTypeAt(
    x: number,
    y: number,
    type: TerrainType
  ): void {
    const cell = this.cells[y]?.[x];
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
        }
      }
    }

    this.createGridLines();
  }


  public getUpdateCount(): number {
    return this.updateCount;
  }

  public getFaceState(_faceId: number): FaceState | undefined {
    return undefined;
  }

  public getAllFaceStates(): Map<number, FaceState> {
    return new Map();
  }

  public restoreFaceStates(_saved: Map<number, FaceState>): void {
  }

  public setFaceState(_faceId: number, _state: Partial<FaceState>): void {
  }

  public setAllFaceStates(_state: Partial<Pick<FaceState, 'moisture' | 'nutrients' | 'grassHeight' | 'health'>>): void {
  }

  public findFaceAtPosition(_worldX: number, _worldZ: number): number | null {
    return null;
  }

  public isPositionWalkable(_worldX: number, _worldZ: number): boolean {
    return true;
  }

  public getTerrainSpeedAt(_worldX: number, _worldZ: number): number {
    return 1.0;
  }

  public getGridDimensions(): { width: number; height: number } {
    return { width: this.courseData.width, height: this.courseData.height };
  }

  public getFacesInBrush(_worldX: number, _worldZ: number, _radius: number): number[] {
    return [];
  }

  public sampleFaceStatesInRadius(_worldX: number, _worldZ: number, _sampleRadius: number): { avgMoisture: number; avgNutrients: number; avgGrassHeight: number; avgHealth: number; dominantTerrainCode: number; faceCount: number } {
    return { avgMoisture: 0, avgNutrients: 0, avgGrassHeight: 0, avgHealth: 0, dominantTerrainCode: 0, faceCount: 0 };
  }

  public findWorkCandidates(_centerX: number, _centerZ: number, _maxRadius: number, _cellSize?: number): { worldX: number; worldZ: number; avgMoisture: number; avgNutrients: number; avgGrassHeight: number; avgHealth: number; dominantTerrainCode: number; faceCount: number }[] {
    return [];
  }

  public applyWorkEffect(_worldX: number, _worldZ: number, _equipmentRadius: number, _jobType: 'mow' | 'water' | 'fertilize' | 'rake', _efficiency: number, _gameTime: number): number[] {
    return [];
  }

  public dispose(): void {
    for (const mesh of this.tileMeshes.values()) {
      mesh.dispose();
    }
    this.tileMeshes.clear();
    this.dirtyTiles.clear();
    if (this.gridLinesMesh) {
      this.gridLinesMesh.dispose();
    }
    if (this.tileMaterial) {
      this.tileMaterial.dispose();
    }
  }
}
