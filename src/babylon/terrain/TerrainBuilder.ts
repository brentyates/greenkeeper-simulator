import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import { CourseData } from '../../data/courseData';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT, TERRAIN_CODES, TerrainType, getTerrainType, getSurfacePhysics, SurfacePhysics, getSlopeVector, getTileNormal, DEFAULT_WATER_LEVEL } from '../../core/terrain';

export interface CornerHeights {
  nw: number;
  ne: number;
  se: number;
  sw: number;
}

export interface FaceMetadata {
  gridX: number;
  gridY: number;
  terrainType: TerrainType;
  physics: SurfacePhysics;
  isCliff: boolean;
}

export class TerrainBuilder {
  private scene: Scene;
  private courseData: CourseData;
  private tileMeshes: Mesh[] = [];
  private tileMap: Map<string, Mesh> = new Map();
  private mowedState: boolean[][] = [];
  private gridLines: LinesMesh | null = null;
  private obstacleMeshes: Mesh[] = [];
  private faceIdToMetadata: Map<number, FaceMetadata> = new Map();
  private meshToFaceOffset: Map<Mesh, number> = new Map();
  private nextFaceId: number = 0;
  private waterLevel: number = DEFAULT_WATER_LEVEL;
  private waterMesh: Mesh | null = null;
  private batchedTerrainMesh: Mesh | null = null;
  private isBatched: boolean = false;
  private lodConfig: LODConfig = {
    enabled: false,
    levels: [
      { distance: 10, simplificationFactor: 1 },
      { distance: 25, simplificationFactor: 2 },
      { distance: 50, simplificationFactor: 4 }
    ],
    updateInterval: 100
  };
  private tileLODStates: Map<string, number> = new Map();
  private lastLODUpdate: number = 0;
  private lodCenterX: number = 0;
  private lodCenterY: number = 0;
  private chunks: Map<string, TerrainChunk> = new Map();
  private tileToChunk: Map<string, string> = new Map();
  private chunkConfig: ChunkConfig = {
    chunkSize: 8,
    enabled: true
  };
  private eventListeners: Map<TerrainEventType, TerrainEventCallback[]> = new Map();
  private eventQueue: TerrainEvent[] = [];
  private eventsEnabled: boolean = true;
  private cache: TerrainCache = {
    elevationCache: new Map(),
    cornerHeightsCache: new Map(),
    terrainTypeCache: new Map(),
    physicsCache: new Map(),
    slopeCache: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    lastClearTime: Date.now()
  };
  private cacheEnabled: boolean = false;
  private zones: Map<string, TerrainZone> = new Map();
  private tileToZones: Map<string, string[]> = new Map();
  private history: TerrainHistory = {
    undoStack: [],
    redoStack: [],
    maxHistorySize: 100,
    currentBatch: null,
    batchDescription: null
  };
  private historyEnabled: boolean = false;
  private selection: TerrainSelection = {
    tiles: new Set<string>(),
    mode: 'single',
    anchorX: null,
    anchorY: null,
    isActive: false,
    color: { r: 0.2, g: 0.6, b: 1.0 },
    brushRadius: 3
  };
  private selectionEnabled: boolean = false;

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
  }

  public build(): void {
    this.faceIdToMetadata.clear();
    this.meshToFaceOffset.clear();
    this.nextFaceId = 0;
    this.initMowedState();
    this.buildTiles();
    this.buildGridLines();
    this.buildWaterPlane();
    this.buildObstacles();
    this.buildRefillStation();
    this.buildChunks();
  }

  private initMowedState(): void {
    const { width, height } = this.courseData;
    this.mowedState = [];
    for (let y = 0; y < height; y++) {
      this.mowedState[y] = [];
      for (let x = 0; x < width; x++) {
        this.mowedState[y][x] = false;
      }
    }
  }

  private gridToScreen(gridX: number, gridY: number, elevation: number = 0): { x: number; y: number; z: number } {
    const screenX = (gridX - gridY) * (TILE_WIDTH / 2);
    const screenY = -((gridX + gridY) * (TILE_HEIGHT / 2)) - elevation * ELEVATION_HEIGHT;
    const depth = gridX + gridY + elevation * 0.01;
    return { x: screenX, y: screenY, z: depth };
  }

  private buildTiles(): void {
    const { width, height, layout, elevation } = this.courseData;

    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const terrainType = layout[y]?.[x] ?? 1;
        const elev = elevation?.[y]?.[x] ?? 0;
        const isMowed = this.mowedState[y]?.[x] ?? false;

        const tile = this.createIsometricTile(x, y, elev, terrainType, isMowed);
        this.tileMeshes.push(tile);
        this.tileMap.set(`${x}_${y}`, tile);

        if (elevation) {
          this.createCliffFaces(x, y, elev, terrainType);
        }
      }
    }
  }

  private createIsometricTile(gridX: number, gridY: number, _elevation: number, terrainType: number, isMowed: boolean = false): Mesh {
    const corners = this.getCornerHeights(gridX, gridY);
    const baseElev = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
    const center = this.gridToScreen(gridX, gridY, baseElev);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const isGrass = terrainType === TERRAIN_CODES.FAIRWAY || terrainType === TERRAIN_CODES.ROUGH || terrainType === TERRAIN_CODES.GREEN;

    if (isGrass && isMowed) {
      return this.createMowedTile(gridX, gridY, center, hw, hh, terrainType);
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
    const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
    const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
    const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

    positions.push(center.x, center.y + hh + nwOffset, center.z);
    positions.push(center.x + hw, center.y + neOffset, center.z);
    positions.push(center.x, center.y - hh + seOffset, center.z);
    positions.push(center.x - hw, center.y + swOffset, center.z);

    const atlasUVs = this.getTextureAtlasUVs(terrainType);
    uvs.push(atlasUVs.u0, atlasUVs.v1);
    uvs.push(atlasUVs.u1, atlasUVs.v0 + (atlasUVs.v1 - atlasUVs.v0) / 2);
    uvs.push(atlasUVs.u0, atlasUVs.v0);
    uvs.push(atlasUVs.u0 - (atlasUVs.u1 - atlasUVs.u0) / 2, atlasUVs.v0 + (atlasUVs.v1 - atlasUVs.v0) / 2);

    const diagonal = this.getOptimalDiagonal(corners);
    if (diagonal === 'nwse') {
      indices.push(0, 2, 1);
      indices.push(0, 3, 2);
    } else {
      indices.push(0, 3, 1);
      indices.push(1, 3, 2);
    }

    const baseColor = this.getTerrainColor(terrainType);
    const variation = ((gridX * 7 + gridY * 13) % 10) / 100 - 0.05;
    const color = new Color3(
      Math.max(0, Math.min(1, baseColor.r + variation)),
      Math.max(0, Math.min(1, baseColor.g + variation * 1.2)),
      Math.max(0, Math.min(1, baseColor.b + variation * 0.8))
    );
    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, 1);
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;
    vertexData.uvs = uvs;

    const mesh = new Mesh(`tile_${gridX}_${gridY}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.convertToFlatShadedMesh();

    const material = this.getTileMaterial();
    mesh.material = material;
    mesh.useVertexColors = true;

    const tType = getTerrainType(terrainType);
    const physics = getSurfacePhysics(tType);
    this.registerFaceMetadata(mesh, gridX, gridY, tType, physics, false);

    return mesh;
  }

  private createMowedTile(gridX: number, gridY: number, center: { x: number; y: number; z: number }, hw: number, hh: number, terrainType: number): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const stripeCount = 4;
    const baseColor = this.getTerrainColor(terrainType);
    const lightColor = new Color3(
      Math.min(1, baseColor.r + 0.15),
      Math.min(1, baseColor.g + 0.18),
      Math.min(1, baseColor.b + 0.1)
    );
    const darkColor = new Color3(
      Math.max(0, baseColor.r - 0.05),
      Math.max(0, baseColor.g - 0.02),
      Math.max(0, baseColor.b - 0.05)
    );

    let vertexIndex = 0;
    for (let i = 0; i < stripeCount; i++) {
      const t0 = i / stripeCount;
      const t1 = (i + 1) / stripeCount;

      const top0X = center.x - hw + t0 * hw;
      const top0Y = center.y + hh - t0 * hh;
      const top1X = center.x - hw + t1 * hw;
      const top1Y = center.y + hh - t1 * hh;

      const bot0X = center.x + t0 * hw;
      const bot0Y = center.y - t0 * hh;
      const bot1X = center.x + t1 * hw;
      const bot1Y = center.y - t1 * hh;

      positions.push(top0X, top0Y, center.z);
      positions.push(top1X, top1Y, center.z);
      positions.push(bot1X, bot1Y, center.z);
      positions.push(bot0X, bot0Y, center.z);

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

    const mesh = new Mesh(`tile_${gridX}_${gridY}`, this.scene);
    vertexData.applyToMesh(mesh);

    const material = this.getTileMaterial();
    mesh.material = material;
    mesh.useVertexColors = true;

    const tType = getTerrainType(terrainType);
    const physics = getSurfacePhysics(tType);
    this.registerFaceMetadata(mesh, gridX, gridY, tType, physics, false);

    return mesh;
  }

  private createCliffFaces(gridX: number, gridY: number, _elevation: number, terrainType: number): void {
    const { width, height, elevation: elevData } = this.courseData;
    if (!elevData) return;

    const corners = this.getCornerHeights(gridX, gridY);
    const baseElev = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
    const center = this.gridToScreen(gridX, gridY, baseElev);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    if (gridY + 1 < height) {
      const neighborCorners = this.getCornerHeights(gridX, gridY + 1);
      const swDiff = corners.sw - neighborCorners.nw;
      const seDiff = corners.se - neighborCorners.ne;

      if (swDiff > 0 || seDiff > 0) {
        const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;
        const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
        const cliffZ = center.z - 0.05;

        this.createCliffQuadWithCorners(
          center.x - hw, center.y + swOffset, cliffZ,
          center.x, center.y - hh + seOffset,
          Math.max(swDiff, 0) * ELEVATION_HEIGHT,
          Math.max(seDiff, 0) * ELEVATION_HEIGHT,
          terrainType, 'sw', gridX, gridY
        );
      }
    }

    if (gridX + 1 < width) {
      const neighborCorners = this.getCornerHeights(gridX + 1, gridY);
      const neDiff = corners.ne - neighborCorners.nw;
      const seDiff = corners.se - neighborCorners.sw;

      if (neDiff > 0 || seDiff > 0) {
        const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
        const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
        const cliffZ = center.z - 0.05;

        this.createCliffQuadWithCorners(
          center.x, center.y - hh + seOffset, cliffZ,
          center.x + hw, center.y + neOffset,
          Math.max(seDiff, 0) * ELEVATION_HEIGHT,
          Math.max(neDiff, 0) * ELEVATION_HEIGHT,
          terrainType, 'se', gridX, gridY
        );
      }
    }
  }

  private createCliffQuadWithCorners(
    x1: number, y1: number, z: number,
    x2: number, y2: number,
    height1: number, height2: number,
    terrainType: number, side: string,
    gridX: number, gridY: number
  ): void {
    if (height1 <= 0 && height2 <= 0) return;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    positions.push(x1, y1, z);
    positions.push(x2, y2, z);
    positions.push(x2, y2 + height2, z);
    positions.push(x1, y1 + height1, z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const baseColor = this.getTerrainColor(terrainType);
    const shade = side === 'sw' ? 0.15 : 0.25;
    const cliffColor = new Color3(baseColor.r * shade, baseColor.g * shade, baseColor.b * shade);

    for (let i = 0; i < 4; i++) {
      colors.push(cliffColor.r, cliffColor.g, cliffColor.b, 1);
    }

    const cliffUVs = this.getCliffTextureAtlasUVs();
    uvs.push(cliffUVs.u0, cliffUVs.v0);
    uvs.push(cliffUVs.u1, cliffUVs.v0);
    uvs.push(cliffUVs.u1, cliffUVs.v1);
    uvs.push(cliffUVs.u0, cliffUVs.v1);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;
    vertexData.uvs = uvs;

    const mesh = new Mesh(`cliff_${side}_${x1}_${y1}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.convertToFlatShadedMesh();

    const material = this.getTileMaterial();
    mesh.material = material;
    mesh.useVertexColors = true;

    const tType = getTerrainType(terrainType);
    const physics = getSurfacePhysics(tType);
    this.registerFaceMetadata(mesh, gridX, gridY, tType, physics, true);

    this.tileMeshes.push(mesh);
  }

  private buildGridLines(): void {
    const { width, height } = this.courseData;
    const lines: Vector3[][] = [];
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = this.getCornerHeights(x, y);
        const baseElev = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
        const center = this.gridToScreen(x, y, baseElev);

        const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
        const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
        const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
        const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

        const tileOutline: Vector3[] = [
          new Vector3(center.x, center.y + hh + nwOffset, center.z - 0.1),
          new Vector3(center.x + hw, center.y + neOffset, center.z - 0.1),
          new Vector3(center.x, center.y - hh + seOffset, center.z - 0.1),
          new Vector3(center.x - hw, center.y + swOffset, center.z - 0.1),
          new Vector3(center.x, center.y + hh + nwOffset, center.z - 0.1),
        ];
        lines.push(tileOutline);
      }
    }

    this.gridLines = MeshBuilder.CreateLineSystem('gridLines', { lines }, this.scene);
    this.gridLines.color = new Color3(0.1, 0.15, 0.05);
    this.gridLines.alpha = 0.2;
  }

  private buildWaterPlane(): void {
    const { width, height, layout } = this.courseData;

    let hasWater = false;
    for (let y = 0; y < height && !hasWater; y++) {
      for (let x = 0; x < width && !hasWater; x++) {
        if (layout[y]?.[x] === TERRAIN_CODES.WATER) {
          hasWater = true;
        }
      }
    }

    if (!hasWater) return;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    let vertexIndex = 0;

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const waterColor = new Color3(0.2, 0.5, 0.8);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layout[y]?.[x] !== TERRAIN_CODES.WATER) continue;

        const center = this.gridToScreen(x, y, this.waterLevel);

        positions.push(center.x, center.y + hh, center.z - 0.08);
        positions.push(center.x + hw, center.y, center.z - 0.08);
        positions.push(center.x, center.y - hh, center.z - 0.08);
        positions.push(center.x - hw, center.y, center.z - 0.08);

        indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1);
        indices.push(vertexIndex, vertexIndex + 3, vertexIndex + 2);

        for (let i = 0; i < 4; i++) {
          colors.push(waterColor.r, waterColor.g, waterColor.b, 0.6);
        }

        vertexIndex += 4;
      }
    }

    if (positions.length === 0) return;

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    this.waterMesh = new Mesh('waterPlane', this.scene);
    vertexData.applyToMesh(this.waterMesh);

    const waterMaterial = new StandardMaterial('waterMat', this.scene);
    waterMaterial.diffuseColor = waterColor;
    waterMaterial.specularColor = new Color3(0.3, 0.3, 0.4);
    waterMaterial.emissiveColor = new Color3(0.1, 0.25, 0.4);
    waterMaterial.alpha = 0.6;
    waterMaterial.backFaceCulling = false;
    this.waterMesh.material = waterMaterial;
    this.waterMesh.useVertexColors = true;
  }

  private getTileMaterial(): StandardMaterial {
    const key = 'tileMat';
    let material = this.scene.getMaterialByName(key) as StandardMaterial;

    if (!material) {
      material = new StandardMaterial(key, this.scene);
      material.diffuseColor = new Color3(1, 1, 1);
      material.specularColor = new Color3(0, 0, 0);
      material.emissiveColor = new Color3(0.5, 0.5, 0.5);
      material.disableLighting = true;
      material.backFaceCulling = false;
    }

    return material;
  }

  private getTerrainColor(terrainType: number): Color3 {
    switch (terrainType) {
      case 0: return new Color3(0.4, 0.7, 0.3);    // Fairway - medium green
      case 1: return new Color3(0.35, 0.55, 0.25); // Rough - darker olive green
      case 2: return new Color3(0.3, 0.8, 0.35);   // Green - bright vibrant green
      case 3: return new Color3(0.85, 0.75, 0.5);  // Bunker - sandy tan
      case 4: return new Color3(0.2, 0.4, 0.65);   // Water - deeper blue
      default: return new Color3(0.4, 0.6, 0.3);
    }
  }

  private getTextureAtlasUVs(terrainType: number): { u0: number; v0: number; u1: number; v1: number } {
    const atlasColumns = 4;
    const atlasRows = 2;
    const tileU = 1 / atlasColumns;
    const tileV = 1 / atlasRows;

    let col = 0;
    let row = 0;

    switch (terrainType) {
      case TERRAIN_CODES.FAIRWAY:
        col = 0; row = 0;
        break;
      case TERRAIN_CODES.ROUGH:
        col = 1; row = 0;
        break;
      case TERRAIN_CODES.GREEN:
        col = 2; row = 0;
        break;
      case TERRAIN_CODES.BUNKER:
        col = 3; row = 0;
        break;
      case TERRAIN_CODES.WATER:
        col = 0; row = 1;
        break;
      default:
        col = 1; row = 0;
    }

    return {
      u0: col * tileU,
      v0: row * tileV,
      u1: (col + 1) * tileU,
      v1: (row + 1) * tileV
    };
  }

  public getCliffTextureAtlasUVs(): { u0: number; v0: number; u1: number; v1: number } {
    const atlasColumns = 4;
    const atlasRows = 2;
    const tileU = 1 / atlasColumns;
    const tileV = 1 / atlasRows;

    return {
      u0: 1 * tileU,
      v0: 1 * tileV,
      u1: 2 * tileU,
      v1: 2 * tileV
    };
  }

  private buildObstacles(): void {
    const { obstacles } = this.courseData;
    if (!obstacles) return;

    for (const obs of obstacles) {
      const elev = this.getElevationAt(obs.x, obs.y);
      const pos = this.gridToScreen(obs.x, obs.y, elev);

      if (obs.type === 1 || obs.type === 2) {
        this.createTree(pos.x, pos.y, pos.z, obs.type === 2);
      }
    }
  }

  private createTree(x: number, y: number, z: number, isPine: boolean): void {
    const trunkHeight = isPine ? 35 : 25;
    const trunkWidth = 4;
    const foliageSize = isPine ? 18 : 28;

    const trunkPositions: number[] = [];
    const trunkIndices: number[] = [];
    const trunkColors: number[] = [];

    const trunkTop = y + trunkHeight;
    trunkPositions.push(x - trunkWidth/2, y, z - 0.2);
    trunkPositions.push(x + trunkWidth/2, y, z - 0.2);
    trunkPositions.push(x + trunkWidth/2, trunkTop, z - 0.2);
    trunkPositions.push(x - trunkWidth/2, trunkTop, z - 0.2);
    trunkIndices.push(0, 1, 2, 0, 2, 3);

    const trunkColor = new Color3(0.35, 0.22, 0.1);
    for (let i = 0; i < 4; i++) {
      trunkColors.push(trunkColor.r, trunkColor.g, trunkColor.b, 1);
    }

    const trunkNormals: number[] = [];
    VertexData.ComputeNormals(trunkPositions, trunkIndices, trunkNormals);

    const trunkData = new VertexData();
    trunkData.positions = trunkPositions;
    trunkData.indices = trunkIndices;
    trunkData.normals = trunkNormals;
    trunkData.colors = trunkColors;

    const trunkMesh = new Mesh(`trunk_${x}_${y}`, this.scene);
    trunkData.applyToMesh(trunkMesh);
    trunkMesh.material = this.getTileMaterial();
    trunkMesh.useVertexColors = true;
    this.obstacleMeshes.push(trunkMesh);

    if (isPine) {
      for (let layer = 0; layer < 3; layer++) {
        const layerY = trunkTop + layer * 12;
        const layerSize = foliageSize - layer * 5;
        this.createFoliageLayer(x, layerY, z, layerSize, true);
      }
    } else {
      this.createFoliageLayer(x, trunkTop + 5, z, foliageSize, false);
    }
  }

  private createFoliageLayer(x: number, y: number, z: number, size: number, isTriangle: boolean): void {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const baseColor = new Color3(0.15, 0.45, 0.15);
    const variation = (Math.abs(x * 7 + y * 13) % 10) / 50 - 0.1;
    const color = new Color3(
      Math.max(0, baseColor.r + variation),
      Math.max(0, baseColor.g + variation),
      Math.max(0, baseColor.b + variation * 0.5)
    );

    if (isTriangle) {
      positions.push(x, y + size, z - 0.3);
      positions.push(x - size * 0.7, y, z - 0.3);
      positions.push(x + size * 0.7, y, z - 0.3);
      indices.push(0, 1, 2);
      for (let i = 0; i < 3; i++) {
        colors.push(color.r, color.g, color.b, 1);
      }
    } else {
      const segments = 6;
      positions.push(x, y, z - 0.3);
      colors.push(color.r, color.g, color.b, 1);
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        positions.push(x + Math.cos(angle) * size, y + Math.sin(angle) * size * 0.5, z - 0.3);
        const edgeColor = new Color3(color.r * 0.8, color.g * 0.85, color.b * 0.8);
        colors.push(edgeColor.r, edgeColor.g, edgeColor.b, 1);
      }
      for (let i = 0; i < segments; i++) {
        indices.push(0, i + 1, i + 2);
      }
    }

    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);

    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.colors = colors;

    const mesh = new Mesh(`foliage_${x}_${y}`, this.scene);
    data.applyToMesh(mesh);
    mesh.material = this.getTileMaterial();
    mesh.useVertexColors = true;
    this.obstacleMeshes.push(mesh);
  }

  private buildRefillStation(): void {
    const stationX = 24;
    const stationY = 20;
    const elev = this.getElevationAt(stationX, stationY);
    const pos = this.gridToScreen(stationX, stationY, elev);

    const basePositions: number[] = [];
    const baseIndices: number[] = [];
    const baseColors: number[] = [];

    const baseWidth = 40;
    const baseHeight = 20;
    const baseDepth = 12;

    basePositions.push(pos.x - baseWidth/2, pos.y - baseHeight, pos.z - 0.3);
    basePositions.push(pos.x + baseWidth/2, pos.y - baseHeight, pos.z - 0.3);
    basePositions.push(pos.x + baseWidth/2, pos.y, pos.z - 0.3);
    basePositions.push(pos.x - baseWidth/2, pos.y, pos.z - 0.3);
    baseIndices.push(0, 1, 2, 0, 2, 3);

    const baseColor = new Color3(0.55, 0.27, 0.07);
    for (let i = 0; i < 4; i++) {
      baseColors.push(baseColor.r, baseColor.g, baseColor.b, 1);
    }

    const baseNormals: number[] = [];
    VertexData.ComputeNormals(basePositions, baseIndices, baseNormals);

    const baseData = new VertexData();
    baseData.positions = basePositions;
    baseData.indices = baseIndices;
    baseData.normals = baseNormals;
    baseData.colors = baseColors;

    const baseMesh = new Mesh('refillBase', this.scene);
    baseData.applyToMesh(baseMesh);
    baseMesh.material = this.getTileMaterial();
    baseMesh.useVertexColors = true;
    this.obstacleMeshes.push(baseMesh);

    const roofPositions: number[] = [];
    const roofIndices: number[] = [];
    const roofColors: number[] = [];

    roofPositions.push(pos.x - baseWidth/2 - 5, pos.y - baseHeight - baseDepth, pos.z - 0.35);
    roofPositions.push(pos.x + baseWidth/2 + 5, pos.y - baseHeight - baseDepth, pos.z - 0.35);
    roofPositions.push(pos.x + baseWidth/2 + 5, pos.y - baseHeight + 5, pos.z - 0.35);
    roofPositions.push(pos.x - baseWidth/2 - 5, pos.y - baseHeight + 5, pos.z - 0.35);
    roofIndices.push(0, 1, 2, 0, 2, 3);

    const roofColor = new Color3(0.61, 0.33, 0.12);
    for (let i = 0; i < 4; i++) {
      roofColors.push(roofColor.r, roofColor.g, roofColor.b, 1);
    }

    const roofNormals: number[] = [];
    VertexData.ComputeNormals(roofPositions, roofIndices, roofNormals);

    const roofData = new VertexData();
    roofData.positions = roofPositions;
    roofData.indices = roofIndices;
    roofData.normals = roofNormals;
    roofData.colors = roofColors;

    const roofMesh = new Mesh('refillRoof', this.scene);
    roofData.applyToMesh(roofMesh);
    roofMesh.material = this.getTileMaterial();
    roofMesh.useVertexColors = true;
    this.obstacleMeshes.push(roofMesh);

    const pumpMesh = MeshBuilder.CreateBox('pump', { width: 12, height: 25, depth: 0.1 }, this.scene);
    pumpMesh.position = new Vector3(pos.x, pos.y - baseHeight - baseDepth - 10, pos.z - 0.4);
    const pumpMat = new StandardMaterial('pumpMat', this.scene);
    pumpMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
    pumpMat.emissiveColor = new Color3(0.25, 0.25, 0.28);
    pumpMesh.material = pumpMat;
    this.obstacleMeshes.push(pumpMesh);

    const blueDot = MeshBuilder.CreateSphere('blueDot', { diameter: 6 }, this.scene);
    blueDot.position = new Vector3(pos.x - 4, pos.y - baseHeight - baseDepth - 12, pos.z - 0.45);
    const blueMat = new StandardMaterial('blueMat', this.scene);
    blueMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    blueMat.emissiveColor = new Color3(0.1, 0.2, 0.4);
    blueDot.material = blueMat;
    this.obstacleMeshes.push(blueDot);

    const redDot = MeshBuilder.CreateSphere('redDot', { diameter: 6 }, this.scene);
    redDot.position = new Vector3(pos.x + 4, pos.y - baseHeight - baseDepth - 12, pos.z - 0.45);
    const redMat = new StandardMaterial('redMat', this.scene);
    redMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
    redMat.emissiveColor = new Color3(0.4, 0.1, 0.1);
    redDot.material = redMat;
    this.obstacleMeshes.push(redDot);
  }

  public getElevationAt(gridX: number, gridY: number): number {
    if (!this.courseData.elevation) return 0;
    const clampedX = Math.min(Math.max(0, gridX), this.courseData.width - 1);
    const clampedY = Math.min(Math.max(0, gridY), this.courseData.height - 1);
    return this.courseData.elevation[clampedY]?.[clampedX] ?? 0;
  }

  public getCornerHeights(gridX: number, gridY: number): CornerHeights {
    const baseElev = this.getElevationAt(gridX, gridY);
    const nElev = this.getElevationAt(gridX, gridY - 1);
    const sElev = this.getElevationAt(gridX, gridY + 1);
    const eElev = this.getElevationAt(gridX + 1, gridY);
    const wElev = this.getElevationAt(gridX - 1, gridY);
    const neElev = this.getElevationAt(gridX + 1, gridY - 1);
    const nwElev = this.getElevationAt(gridX - 1, gridY - 1);
    const seElev = this.getElevationAt(gridX + 1, gridY + 1);
    const swElev = this.getElevationAt(gridX - 1, gridY + 1);

    const nw = Math.max(baseElev, nElev, wElev, nwElev);
    const ne = Math.max(baseElev, nElev, eElev, neElev);
    const se = Math.max(baseElev, sElev, eElev, seElev);
    const sw = Math.max(baseElev, sElev, wElev, swElev);

    return { nw, ne, se, sw };
  }

  private getOptimalDiagonal(corners: CornerHeights): 'nwse' | 'nesw' {
    const diagA = Math.abs(corners.nw - corners.se);
    const diagB = Math.abs(corners.ne - corners.sw);
    return diagA <= diagB ? 'nwse' : 'nesw';
  }

  public setMowed(gridX: number, gridY: number, mowed: boolean): void {
    const { width, height, layout, elevation } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) return;

    const terrainType = layout[gridY]?.[gridX] ?? TERRAIN_CODES.ROUGH;
    const isGrass = terrainType === TERRAIN_CODES.FAIRWAY || terrainType === TERRAIN_CODES.ROUGH || terrainType === TERRAIN_CODES.GREEN;
    if (!isGrass) return;

    if (this.mowedState[gridY]?.[gridX] === mowed) return;

    this.mowedState[gridY][gridX] = mowed;

    const key = `${gridX}_${gridY}`;
    const oldMesh = this.tileMap.get(key);
    if (oldMesh) {
      const idx = this.tileMeshes.indexOf(oldMesh);
      if (idx !== -1) this.tileMeshes.splice(idx, 1);
      oldMesh.dispose();
    }

    const elev = elevation?.[gridY]?.[gridX] ?? 0;
    const newTile = this.createIsometricTile(gridX, gridY, elev, terrainType, mowed);
    this.tileMeshes.push(newTile);
    this.tileMap.set(key, newTile);
  }

  public isMowed(gridX: number, gridY: number): boolean {
    return this.mowedState[gridY]?.[gridX] ?? false;
  }

  public setMowedInRadius(centerX: number, centerY: number, radius: number, mowed: boolean): number {
    let count = 0;
    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    for (const tile of tiles) {
      const wasMowed = this.isMowed(tile.x, tile.y);
      this.setMowed(tile.x, tile.y, mowed);
      if (this.isMowed(tile.x, tile.y) !== wasMowed) {
        count++;
      }
    }
    return count;
  }

  public setMowedInRect(x1: number, y1: number, x2: number, y2: number, mowed: boolean): number {
    let count = 0;
    const tiles = this.getTilesInRect(x1, y1, x2, y2);
    for (const tile of tiles) {
      const wasMowed = this.isMowed(tile.x, tile.y);
      this.setMowed(tile.x, tile.y, mowed);
      if (this.isMowed(tile.x, tile.y) !== wasMowed) {
        count++;
      }
    }
    return count;
  }

  public getMowedCount(): number {
    let count = 0;
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.mowedState[y]?.[x]) {
          count++;
        }
      }
    }
    return count;
  }

  public getMowableCount(): number {
    let count = 0;
    const { width, height, layout } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const code = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        if (code === TERRAIN_CODES.FAIRWAY || code === TERRAIN_CODES.ROUGH || code === TERRAIN_CODES.GREEN) {
          count++;
        }
      }
    }
    return count;
  }

  public getMowedPercentage(): number {
    const mowable = this.getMowableCount();
    if (mowable === 0) return 0;
    return (this.getMowedCount() / mowable) * 100;
  }

  public resetAllMowed(): void {
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.mowedState[y]?.[x]) {
          this.setMowed(x, y, false);
        }
      }
    }
  }

  public gridToWorld(gridX: number, gridY: number, elevation?: number): Vector3 {
    const elev = elevation ?? this.getElevationAt(gridX, gridY);
    const pos = this.gridToScreen(gridX, gridY, elev);
    return new Vector3(pos.x, pos.y, pos.z);
  }

  public worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    const isoX = (worldX / hw + (-worldY) / hh) / 2;
    const isoY = ((-worldY) / hh - worldX / hw) / 2;

    return {
      x: Math.floor(isoX),
      y: Math.floor(isoY)
    };
  }

  public getTerrainTypeAt(gridX: number, gridY: number): TerrainType {
    const { width, height, layout } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) {
      return 'rough';
    }
    const code = layout[gridY]?.[gridX] ?? TERRAIN_CODES.ROUGH;
    return getTerrainType(code);
  }

  public getSurfacePhysicsAt(gridX: number, gridY: number): SurfacePhysics {
    const type = this.getTerrainTypeAt(gridX, gridY);
    return getSurfacePhysics(type);
  }

  public getSlopeVectorAt(gridX: number, gridY: number): { angle: number; direction: number; magnitude: number } {
    const corners = this.getCornerHeights(gridX, gridY);
    return getSlopeVector(corners, ELEVATION_HEIGHT);
  }

  public getTileNormalAt(gridX: number, gridY: number): { x: number; y: number; z: number } {
    const corners = this.getCornerHeights(gridX, gridY);
    return getTileNormal(corners, ELEVATION_HEIGHT);
  }

  public isValidGridPosition(gridX: number, gridY: number): boolean {
    const { width, height } = this.courseData;
    return gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;
  }

  public getGridDimensions(): { width: number; height: number } {
    return { width: this.courseData.width, height: this.courseData.height };
  }

  public getTilesInRadius(centerX: number, centerY: number, radius: number): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;
    const radiusSq = radius * radius;

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= radiusSq) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  public getTilesInRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    const minX = Math.max(0, Math.min(x1, x2));
    const maxX = Math.min(width - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(height - 1, Math.max(y1, y2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  public getNeighborTiles(gridX: number, gridY: number, includeDiagonals: boolean = false): Array<{ x: number; y: number }> {
    const neighbors: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    const offsets = includeDiagonals
      ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
      : [[0, -1], [-1, 0], [1, 0], [0, 1]];

    for (const [dx, dy] of offsets) {
      const nx = gridX + dx;
      const ny = gridY + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    return neighbors;
  }

  public forEachTileInRadius(
    centerX: number,
    centerY: number,
    radius: number,
    callback: (x: number, y: number, distance: number) => void
  ): void {
    const { width, height } = this.courseData;
    const radiusSq = radius * radius;

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSq = dx * dx + dy * dy;
        if (distSq <= radiusSq) {
          callback(x, y, Math.sqrt(distSq));
        }
      }
    }
  }

  private registerFaceMetadata(
    mesh: Mesh,
    gridX: number,
    gridY: number,
    terrainType: TerrainType,
    physics: SurfacePhysics,
    isCliff: boolean
  ): void {
    const faceCount = mesh.getTotalIndices() / 3;
    const startFaceId = this.nextFaceId;
    this.meshToFaceOffset.set(mesh, startFaceId);

    const metadata: FaceMetadata = {
      gridX,
      gridY,
      terrainType,
      physics,
      isCliff
    };

    for (let i = 0; i < faceCount; i++) {
      this.faceIdToMetadata.set(startFaceId + i, metadata);
    }

    this.nextFaceId += faceCount;
  }

  public getFaceMetadata(mesh: Mesh, faceId: number): FaceMetadata | null {
    const offset = this.meshToFaceOffset.get(mesh);
    if (offset === undefined) return null;
    return this.faceIdToMetadata.get(offset + faceId) ?? null;
  }

  public getSurfacePhysicsAtFace(mesh: Mesh, faceId: number): SurfacePhysics | null {
    const metadata = this.getFaceMetadata(mesh, faceId);
    return metadata?.physics ?? null;
  }

  public getTerrainTypeAtFace(mesh: Mesh, faceId: number): TerrainType | null {
    const metadata = this.getFaceMetadata(mesh, faceId);
    return metadata?.terrainType ?? null;
  }

  public getGridPositionAtFace(mesh: Mesh, faceId: number): { x: number; y: number } | null {
    const metadata = this.getFaceMetadata(mesh, faceId);
    if (!metadata) return null;
    return { x: metadata.gridX, y: metadata.gridY };
  }

  public isCliffFace(mesh: Mesh, faceId: number): boolean {
    const metadata = this.getFaceMetadata(mesh, faceId);
    return metadata?.isCliff ?? false;
  }

  public dispose(): void {
    for (const mesh of this.tileMeshes) {
      mesh.dispose();
    }
    this.tileMeshes = [];
    this.tileMap.clear();
    this.faceIdToMetadata.clear();
    this.meshToFaceOffset.clear();
    this.nextFaceId = 0;
    for (const mesh of this.obstacleMeshes) {
      mesh.dispose();
    }
    this.obstacleMeshes = [];
    if (this.gridLines) {
      this.gridLines.dispose();
      this.gridLines = null;
    }
    if (this.waterMesh) {
      this.waterMesh.dispose();
      this.waterMesh = null;
    }
    if (this.batchedTerrainMesh) {
      this.batchedTerrainMesh.dispose();
      this.batchedTerrainMesh = null;
    }
    this.isBatched = false;
  }

  public setWaterLevel(level: number): void {
    this.waterLevel = level;
  }

  public getWaterLevel(): number {
    return this.waterLevel;
  }

  public getTerrainStatistics(): TerrainStatistics {
    const { width, height, layout, elevation } = this.courseData;
    const terrainCounts: Record<TerrainType, number> = {
      fairway: 0,
      rough: 0,
      green: 0,
      bunker: 0,
      water: 0
    };

    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let totalElevation = 0;
    let slopeCount = 0;
    let flatCount = 0;
    let cliffFaceCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const code = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const type = getTerrainType(code);
        terrainCounts[type]++;

        if (elevation) {
          const elev = elevation[y]?.[x] ?? 0;
          minElevation = Math.min(minElevation, elev);
          maxElevation = Math.max(maxElevation, elev);
          totalElevation += elev;

          const corners = this.getCornerHeights(x, y);
          const isFlat = corners.nw === corners.ne && corners.ne === corners.se && corners.se === corners.sw;
          if (isFlat) {
            flatCount++;
          } else {
            slopeCount++;
          }

          if (y + 1 < height) {
            const neighborCorners = this.getCornerHeights(x, y + 1);
            if (corners.sw > neighborCorners.nw || corners.se > neighborCorners.ne) {
              cliffFaceCount++;
            }
          }
          if (x + 1 < width) {
            const neighborCorners = this.getCornerHeights(x + 1, y);
            if (corners.ne > neighborCorners.nw || corners.se > neighborCorners.sw) {
              cliffFaceCount++;
            }
          }
        }
      }
    }

    const totalTiles = width * height;
    const avgElevation = elevation ? totalElevation / totalTiles : 0;

    return {
      width,
      height,
      totalTiles,
      terrainCounts,
      minElevation: elevation ? minElevation : 0,
      maxElevation: elevation ? maxElevation : 0,
      avgElevation,
      flatTileCount: flatCount,
      slopedTileCount: slopeCount,
      cliffFaceCount,
      waterLevel: this.waterLevel
    };
  }

  public getTerrainTypePercentages(): Record<TerrainType, number> {
    const stats = this.getTerrainStatistics();
    const percentages: Record<TerrainType, number> = {
      fairway: 0,
      rough: 0,
      green: 0,
      bunker: 0,
      water: 0
    };

    for (const [type, count] of Object.entries(stats.terrainCounts)) {
      percentages[type as TerrainType] = (count / stats.totalTiles) * 100;
    }

    return percentages;
  }

  public getElevationRange(): { min: number; max: number; range: number } {
    const stats = this.getTerrainStatistics();
    return {
      min: stats.minElevation,
      max: stats.maxElevation,
      range: stats.maxElevation - stats.minElevation
    };
  }

  public getTilesAlongLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = Math.floor(x1);
    let y = Math.floor(y1);
    const endX = Math.floor(x2);
    const endY = Math.floor(y2);

    while (true) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles.push({ x, y });
      }

      if (x === endX && y === endY) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return tiles;
  }

  public hasLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    maxElevationDiff: number = 2
  ): boolean {
    const tiles = this.getTilesAlongLine(x1, y1, x2, y2);
    if (tiles.length < 2) return true;

    const startElev = this.getElevationAt(tiles[0].x, tiles[0].y);
    const endElev = this.getElevationAt(tiles[tiles.length - 1].x, tiles[tiles.length - 1].y);
    const baselineSlope = (endElev - startElev) / tiles.length;

    for (let i = 1; i < tiles.length - 1; i++) {
      const tile = tiles[i];
      const elev = this.getElevationAt(tile.x, tile.y);
      const expectedElev = startElev + baselineSlope * i;

      if (elev > expectedElev + maxElevationDiff) {
        return false;
      }
    }

    return true;
  }

  public getElevationAtWorldPos(worldX: number, worldY: number): number {
    const grid = this.worldToGrid(worldX, worldY);
    return this.getElevationAt(grid.x, grid.y);
  }

  public interpolateElevation(gridX: number, gridY: number): number {
    const { width, height } = this.courseData;

    const baseX = Math.floor(gridX);
    const baseY = Math.floor(gridY);
    const fracX = gridX - baseX;
    const fracY = gridY - baseY;

    const e00 = this.getElevationAt(baseX, baseY);
    const e10 = this.getElevationAt(Math.min(baseX + 1, width - 1), baseY);
    const e01 = this.getElevationAt(baseX, Math.min(baseY + 1, height - 1));
    const e11 = this.getElevationAt(Math.min(baseX + 1, width - 1), Math.min(baseY + 1, height - 1));

    const top = e00 + (e10 - e00) * fracX;
    const bottom = e01 + (e11 - e01) * fracX;

    return top + (bottom - top) * fracY;
  }

  public getDistanceBetweenTiles(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    includeElevation: boolean = true
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const horizontalDist = Math.sqrt(dx * dx + dy * dy);

    if (!includeElevation) {
      return horizontalDist;
    }

    const elev1 = this.getElevationAt(x1, y1);
    const elev2 = this.getElevationAt(x2, y2);
    const dz = (elev2 - elev1) * ELEVATION_HEIGHT;

    return Math.sqrt(horizontalDist * horizontalDist + dz * dz);
  }

  public canTraverse(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    maxSlopeDelta: number = 2
  ): boolean {
    if (!this.isValidGridPosition(fromX, fromY) || !this.isValidGridPosition(toX, toY)) {
      return false;
    }

    const fromType = this.getTerrainTypeAt(fromX, fromY);
    const toType = this.getTerrainTypeAt(toX, toY);

    if (fromType === 'water' || toType === 'water') {
      return false;
    }

    const fromElev = this.getElevationAt(fromX, fromY);
    const toElev = this.getElevationAt(toX, toY);
    const elevDiff = Math.abs(toElev - fromElev);

    return elevDiff <= maxSlopeDelta;
  }

  public batchTerrain(): void {
    if (this.isBatched || this.tileMeshes.length === 0) return;

    const nonMowedMeshes = this.tileMeshes.filter(mesh => !mesh.name.includes('mowed'));
    if (nonMowedMeshes.length === 0) return;

    const allPositions: number[] = [];
    const allIndices: number[] = [];
    const allColors: number[] = [];
    const allUvs: number[] = [];
    let vertexOffset = 0;

    for (const mesh of nonMowedMeshes) {
      const positions = mesh.getVerticesData('position');
      const indices = mesh.getIndices();
      const colors = mesh.getVerticesData('color');
      const uvs = mesh.getVerticesData('uv');

      if (!positions || !indices) continue;

      for (let i = 0; i < positions.length; i++) {
        allPositions.push(positions[i]);
      }

      for (let i = 0; i < indices.length; i++) {
        allIndices.push(indices[i] + vertexOffset);
      }

      if (colors) {
        for (let i = 0; i < colors.length; i++) {
          allColors.push(colors[i]);
        }
      }

      if (uvs) {
        for (let i = 0; i < uvs.length; i++) {
          allUvs.push(uvs[i]);
        }
      }

      vertexOffset += positions.length / 3;
    }

    const vertexData = new VertexData();
    vertexData.positions = allPositions;
    vertexData.indices = allIndices;
    if (allColors.length > 0) {
      vertexData.colors = allColors;
    }
    if (allUvs.length > 0) {
      vertexData.uvs = allUvs;
    }

    this.batchedTerrainMesh = new Mesh('batchedTerrain', this.scene);
    vertexData.applyToMesh(this.batchedTerrainMesh);
    this.batchedTerrainMesh.convertToFlatShadedMesh();
    this.batchedTerrainMesh.material = this.getTileMaterial();
    this.batchedTerrainMesh.useVertexColors = true;

    for (const mesh of nonMowedMeshes) {
      mesh.setEnabled(false);
    }

    this.isBatched = true;
  }

  public unbatchTerrain(): void {
    if (!this.isBatched) return;

    if (this.batchedTerrainMesh) {
      this.batchedTerrainMesh.dispose();
      this.batchedTerrainMesh = null;
    }

    for (const mesh of this.tileMeshes) {
      mesh.setEnabled(true);
    }

    this.isBatched = false;
  }

  public isBatchedMode(): boolean {
    return this.isBatched;
  }

  public getBatchedMesh(): Mesh | null {
    return this.batchedTerrainMesh;
  }

  public getTileMeshCount(): number {
    return this.tileMeshes.length;
  }

  public getVisibleMeshCount(): number {
    if (this.isBatched) {
      const mowedMeshes = this.tileMeshes.filter(mesh => mesh.name.includes('mowed') || mesh.isEnabled());
      return mowedMeshes.length + (this.batchedTerrainMesh ? 1 : 0);
    }
    return this.tileMeshes.filter(mesh => mesh.isEnabled()).length;
  }

  public getDrawCallEstimate(): number {
    let count = this.getVisibleMeshCount();
    if (this.gridLines?.isEnabled()) count++;
    if (this.waterMesh?.isEnabled()) count++;
    count += this.obstacleMeshes.filter(m => m.isEnabled()).length;
    return count;
  }

  public setTileVisibilityInRegion(
    minGridX: number,
    minGridY: number,
    maxGridX: number,
    maxGridY: number,
    visible: boolean
  ): number {
    let count = 0;
    const { width, height } = this.courseData;

    const clampedMinX = Math.max(0, minGridX);
    const clampedMaxX = Math.min(width - 1, maxGridX);
    const clampedMinY = Math.max(0, minGridY);
    const clampedMaxY = Math.min(height - 1, maxGridY);

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const key = `${x}_${y}`;
        const mesh = this.tileMap.get(key);
        if (mesh && mesh.isEnabled() !== visible) {
          mesh.setEnabled(visible);
          count++;
        }
      }
    }

    return count;
  }

  public hideAllTiles(): void {
    for (const mesh of this.tileMeshes) {
      mesh.setEnabled(false);
    }
  }

  public showAllTiles(): void {
    for (const mesh of this.tileMeshes) {
      mesh.setEnabled(true);
    }
  }

  public updateVisibleRegion(
    centerGridX: number,
    centerGridY: number,
    viewRadius: number
  ): { shown: number; hidden: number } {
    const { width, height } = this.courseData;

    const minX = Math.max(0, Math.floor(centerGridX - viewRadius));
    const maxX = Math.min(width - 1, Math.ceil(centerGridX + viewRadius));
    const minY = Math.max(0, Math.floor(centerGridY - viewRadius));
    const maxY = Math.min(height - 1, Math.ceil(centerGridY + viewRadius));

    let shown = 0;
    let hidden = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}_${y}`;
        const mesh = this.tileMap.get(key);
        if (!mesh) continue;

        const inRegion = x >= minX && x <= maxX && y >= minY && y <= maxY;
        if (inRegion && !mesh.isEnabled()) {
          mesh.setEnabled(true);
          shown++;
        } else if (!inRegion && mesh.isEnabled()) {
          mesh.setEnabled(false);
          hidden++;
        }
      }
    }

    return { shown, hidden };
  }

  public getVisibleTileCount(): number {
    let count = 0;
    for (const mesh of this.tileMeshes) {
      if (mesh.isEnabled()) {
        count++;
      }
    }
    return count;
  }

  public getTerrainBounds(): {
    minWorldX: number;
    maxWorldX: number;
    minWorldY: number;
    maxWorldY: number;
  } {
    const { width, height } = this.courseData;

    const topLeft = this.gridToWorld(0, 0);
    const topRight = this.gridToWorld(width - 1, 0);
    const bottomLeft = this.gridToWorld(0, height - 1);
    const bottomRight = this.gridToWorld(width - 1, height - 1);

    return {
      minWorldX: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      maxWorldX: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      minWorldY: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
      maxWorldY: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
    };
  }

  public isPointInTerrain(worldX: number, worldY: number): boolean {
    const grid = this.worldToGrid(worldX, worldY);
    return this.isValidGridPosition(grid.x, grid.y);
  }

  public clampToTerrain(gridX: number, gridY: number): { x: number; y: number } {
    const { width, height } = this.courseData;
    return {
      x: Math.max(0, Math.min(width - 1, gridX)),
      y: Math.max(0, Math.min(height - 1, gridY))
    };
  }

  public findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: PathfindingOptions = {}
  ): PathNode[] | null {
    const {
      maxSlopeDelta = 2,
      allowDiagonals = false,
      avoidTypes = ['water'],
      maxIterations = 10000
    } = options;

    if (!this.isValidGridPosition(startX, startY) || !this.isValidGridPosition(endX, endY)) {
      return null;
    }

    const startType = this.getTerrainTypeAt(startX, startY);
    const endType = this.getTerrainTypeAt(endX, endY);
    if (avoidTypes.includes(startType) || avoidTypes.includes(endType)) {
      return null;
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, PathNode>();

    const heuristic = (x: number, y: number): number => {
      return Math.abs(endX - x) + Math.abs(endY - y);
    };

    const getKey = (x: number, y: number): string => `${x}_${y}`;

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY),
      f: heuristic(startX, startY)
    };
    openSet.push(startNode);

    let iterations = 0;
    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = getKey(current.x, current.y);

      if (current.x === endX && current.y === endY) {
        const path: PathNode[] = [current];
        let node = current;
        while (cameFrom.has(getKey(node.x, node.y))) {
          node = cameFrom.get(getKey(node.x, node.y))!;
          path.unshift(node);
        }
        return path;
      }

      closedSet.add(currentKey);

      const neighbors = this.getNeighborTiles(current.x, current.y, allowDiagonals);
      for (const neighbor of neighbors) {
        const neighborKey = getKey(neighbor.x, neighbor.y);
        if (closedSet.has(neighborKey)) continue;

        const neighborType = this.getTerrainTypeAt(neighbor.x, neighbor.y);
        if (avoidTypes.includes(neighborType)) continue;

        if (!this.canTraverse(current.x, current.y, neighbor.x, neighbor.y, maxSlopeDelta)) continue;

        const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
        const moveCost = isDiagonal ? 1.414 : 1;
        const tentativeG = current.g + moveCost;

        const existingIdx = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existingIdx !== -1) {
          if (tentativeG < openSet[existingIdx].g) {
            openSet[existingIdx].g = tentativeG;
            openSet[existingIdx].f = tentativeG + openSet[existingIdx].h;
            cameFrom.set(neighborKey, current);
          }
        } else {
          const h = heuristic(neighbor.x, neighbor.y);
          const neighborNode: PathNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h,
            f: tentativeG + h
          };
          openSet.push(neighborNode);
          cameFrom.set(neighborKey, current);
        }
      }
    }

    return null;
  }

  public getPathLength(path: PathNode[]): number {
    if (path.length < 2) return 0;

    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  public getPathWorldPositions(path: PathNode[]): Vector3[] {
    return path.map(node => this.gridToWorld(node.x, node.y));
  }

  public isPathClear(path: PathNode[], avoidTypes: TerrainType[] = ['water']): boolean {
    for (const node of path) {
      const type = this.getTerrainTypeAt(node.x, node.y);
      if (avoidTypes.includes(type)) {
        return false;
      }
    }
    return true;
  }

  public floodFillTerrainType(
    startX: number,
    startY: number,
    includeDiagonals: boolean = false
  ): Array<{ x: number; y: number }> {
    if (!this.isValidGridPosition(startX, startY)) {
      return [];
    }

    const targetType = this.getTerrainTypeAt(startX, startY);
    const result: Array<{ x: number; y: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x}_${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const currentType = this.getTerrainTypeAt(current.x, current.y);
      if (currentType !== targetType) continue;

      result.push(current);

      const neighbors = this.getNeighborTiles(current.x, current.y, includeDiagonals);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x}_${neighbor.y}`;
        if (!visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  public getConnectedRegions(terrainType: TerrainType): Array<Array<{ x: number; y: number }>> {
    const { width, height } = this.courseData;
    const visited = new Set<string>();
    const regions: Array<Array<{ x: number; y: number }>> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}_${y}`;
        if (visited.has(key)) continue;

        const type = this.getTerrainTypeAt(x, y);
        if (type !== terrainType) {
          visited.add(key);
          continue;
        }

        const region = this.floodFillTerrainType(x, y, false);
        for (const tile of region) {
          visited.add(`${tile.x}_${tile.y}`);
        }
        regions.push(region);
      }
    }

    return regions;
  }

  public getRegionBounds(tiles: Array<{ x: number; y: number }>): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } | null {
    if (tiles.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const tile of tiles) {
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  public getRegionCenter(tiles: Array<{ x: number; y: number }>): { x: number; y: number } | null {
    if (tiles.length === 0) return null;

    let sumX = 0, sumY = 0;
    for (const tile of tiles) {
      sumX += tile.x;
      sumY += tile.y;
    }

    return {
      x: Math.round(sumX / tiles.length),
      y: Math.round(sumY / tiles.length)
    };
  }

  public getLargestRegion(terrainType: TerrainType): Array<{ x: number; y: number }> {
    const regions = this.getConnectedRegions(terrainType);
    if (regions.length === 0) return [];

    let largest = regions[0];
    for (const region of regions) {
      if (region.length > largest.length) {
        largest = region;
      }
    }
    return largest;
  }

  public findTerrainEdges(terrainType: TerrainType): Array<{ x: number; y: number }> {
    const { width, height } = this.courseData;
    const edges: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentType = this.getTerrainTypeAt(x, y);
        if (currentType !== terrainType) continue;

        const neighbors = this.getNeighborTiles(x, y, false);
        let isEdge = neighbors.length < 4;

        if (!isEdge) {
          for (const neighbor of neighbors) {
            const neighborType = this.getTerrainTypeAt(neighbor.x, neighbor.y);
            if (neighborType !== terrainType) {
              isEdge = true;
              break;
            }
          }
        }

        if (isEdge) {
          edges.push({ x, y });
        }
      }
    }

    return edges;
  }

  public findTerrainBoundary(
    type1: TerrainType,
    type2: TerrainType
  ): Array<{ x: number; y: number; side: 'n' | 's' | 'e' | 'w' }> {
    const { width, height } = this.courseData;
    const boundary: Array<{ x: number; y: number; side: 'n' | 's' | 'e' | 'w' }> = [];

    const directions: Array<{ dx: number; dy: number; side: 'n' | 's' | 'e' | 'w' }> = [
      { dx: 0, dy: -1, side: 'n' },
      { dx: 0, dy: 1, side: 's' },
      { dx: 1, dy: 0, side: 'e' },
      { dx: -1, dy: 0, side: 'w' }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentType = this.getTerrainTypeAt(x, y);
        if (currentType !== type1) continue;

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;

          if (!this.isValidGridPosition(nx, ny)) continue;

          const neighborType = this.getTerrainTypeAt(nx, ny);
          if (neighborType === type2) {
            boundary.push({ x, y, side: dir.side });
          }
        }
      }
    }

    return boundary;
  }

  public getTerrainPerimeter(tiles: Array<{ x: number; y: number }>): number {
    const tileSet = new Set(tiles.map(t => `${t.x}_${t.y}`));
    let perimeter = 0;

    for (const tile of tiles) {
      const neighbors = this.getNeighborTiles(tile.x, tile.y, false);
      const borderEdges = 4 - neighbors.filter(n => tileSet.has(`${n.x}_${n.y}`)).length;
      perimeter += borderEdges;
    }

    return perimeter;
  }

  public isTerrainEnclosed(tiles: Array<{ x: number; y: number }>): boolean {
    if (tiles.length === 0) return false;

    const { width, height } = this.courseData;

    for (const tile of tiles) {
      if (tile.x === 0 || tile.x === width - 1 || tile.y === 0 || tile.y === height - 1) {
        return false;
      }
    }

    return true;
  }

  public getTerrainCompactness(tiles: Array<{ x: number; y: number }>): number {
    if (tiles.length === 0) return 0;

    const area = tiles.length;
    const perimeter = this.getTerrainPerimeter(tiles);

    if (perimeter === 0) return 1;
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  public serializeTerrainState(): TerrainSerializedState {
    const { width, height } = this.courseData;

    const mowedTiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.mowedState[y]?.[x]) {
          mowedTiles.push({ x, y });
        }
      }
    }

    return {
      version: 1,
      width,
      height,
      waterLevel: this.waterLevel,
      mowedTiles,
      timestamp: Date.now()
    };
  }

  public deserializeTerrainState(state: TerrainSerializedState): boolean {
    if (state.version !== 1) {
      console.warn('Unknown terrain state version:', state.version);
      return false;
    }

    if (state.width !== this.courseData.width || state.height !== this.courseData.height) {
      console.warn('Terrain dimensions mismatch');
      return false;
    }

    this.resetAllMowed();

    for (const tile of state.mowedTiles) {
      this.setMowed(tile.x, tile.y, true);
    }

    if (state.waterLevel !== undefined) {
      this.setWaterLevel(state.waterLevel);
    }

    return true;
  }

  public exportToRCTFormat(): RCTTerrainData {
    const { width, height, layout } = this.courseData;
    const tiles: RCTTileData[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = this.getCornerHeights(x, y);
        const code = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const type = getTerrainType(code);

        tiles.push({
          pos: [x, y],
          heights: [corners.nw, corners.ne, corners.se, corners.sw],
          type,
          flags: {
            water: type === 'water',
            mowed: this.mowedState[y]?.[x] ?? false
          }
        });
      }
    }

    return {
      gridSize: [width, height],
      heightStep: ELEVATION_HEIGHT,
      waterLevel: this.waterLevel,
      tiles
    };
  }

  public getMowedStateSnapshot(): boolean[][] {
    const { width, height } = this.courseData;
    const snapshot: boolean[][] = [];

    for (let y = 0; y < height; y++) {
      snapshot[y] = [];
      for (let x = 0; x < width; x++) {
        snapshot[y][x] = this.mowedState[y]?.[x] ?? false;
      }
    }

    return snapshot;
  }

  public restoreMowedStateSnapshot(snapshot: boolean[][]): void {
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wasMowed = this.mowedState[y]?.[x] ?? false;
        const shouldBeMowed = snapshot[y]?.[x] ?? false;

        if (wasMowed !== shouldBeMowed) {
          this.setMowed(x, y, shouldBeMowed);
        }
      }
    }
  }

  public setGridLinesVisible(visible: boolean): void {
    if (this.gridLines) {
      this.gridLines.setEnabled(visible);
    }
  }

  public isGridLinesVisible(): boolean {
    return this.gridLines?.isEnabled() ?? false;
  }

  public setWaterVisible(visible: boolean): void {
    if (this.waterMesh) {
      this.waterMesh.setEnabled(visible);
    }
  }

  public isWaterVisible(): boolean {
    return this.waterMesh?.isEnabled() ?? false;
  }

  public setObstaclesVisible(visible: boolean): void {
    for (const mesh of this.obstacleMeshes) {
      mesh.setEnabled(visible);
    }
  }

  public getTerrainDebugInfo(): TerrainDebugInfo {
    const stats = this.getTerrainStatistics();
    const bounds = this.getTerrainBounds();

    return {
      dimensions: { width: stats.width, height: stats.height },
      totalTiles: stats.totalTiles,
      tileMeshCount: this.getTileMeshCount(),
      visibleMeshCount: this.getVisibleMeshCount(),
      drawCallEstimate: this.getDrawCallEstimate(),
      isBatched: this.isBatchedMode(),
      mowedCount: this.getMowedCount(),
      mowedPercentage: this.getMowedPercentage(),
      terrainCounts: stats.terrainCounts,
      elevationRange: this.getElevationRange(),
      bounds,
      waterLevel: this.waterLevel,
      gridLinesVisible: this.isGridLinesVisible(),
      waterVisible: this.isWaterVisible()
    };
  }

  public logTerrainDebugInfo(): void {
    const info = this.getTerrainDebugInfo();
    console.log('=== Terrain Debug Info ===');
    console.log(`Dimensions: ${info.dimensions.width}x${info.dimensions.height}`);
    console.log(`Total tiles: ${info.totalTiles}`);
    console.log(`Tile meshes: ${info.tileMeshCount}`);
    console.log(`Visible meshes: ${info.visibleMeshCount}`);
    console.log(`Draw calls (est): ${info.drawCallEstimate}`);
    console.log(`Batched: ${info.isBatched}`);
    console.log(`Mowed: ${info.mowedCount} (${info.mowedPercentage.toFixed(1)}%)`);
    console.log(`Elevation: ${info.elevationRange.min} to ${info.elevationRange.max}`);
    console.log('Terrain types:', info.terrainCounts);
  }

  public getTerrainHeatmap(
    valueFunc: (x: number, y: number) => number
  ): Array<{ x: number; y: number; value: number }> {
    const { width, height } = this.courseData;
    const heatmap: Array<{ x: number; y: number; value: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        heatmap.push({ x, y, value: valueFunc(x, y) });
      }
    }

    return heatmap;
  }

  public getElevationHeatmap(): Array<{ x: number; y: number; value: number }> {
    return this.getTerrainHeatmap((x, y) => this.getElevationAt(x, y));
  }

  public getSlopeHeatmap(): Array<{ x: number; y: number; value: number }> {
    return this.getTerrainHeatmap((x, y) => {
      const slope = this.getSlopeVectorAt(x, y);
      return slope.magnitude;
    });
  }

  public pickTileAtScreenPosition(
    screenX: number,
    screenY: number,
    camera: { x: number; y: number }
  ): { x: number; y: number } | null {
    const worldX = screenX + camera.x;
    const worldY = screenY + camera.y;
    const grid = this.worldToGrid(worldX, worldY);

    if (this.isValidGridPosition(grid.x, grid.y)) {
      return grid;
    }
    return null;
  }

  public getTileUnderWorldPosition(worldX: number, worldY: number): {
    gridX: number;
    gridY: number;
    terrainType: TerrainType;
    elevation: number;
    isMowed: boolean;
    physics: SurfacePhysics;
  } | null {
    const grid = this.worldToGrid(worldX, worldY);

    if (!this.isValidGridPosition(grid.x, grid.y)) {
      return null;
    }

    return {
      gridX: grid.x,
      gridY: grid.y,
      terrainType: this.getTerrainTypeAt(grid.x, grid.y),
      elevation: this.getElevationAt(grid.x, grid.y),
      isMowed: this.isMowed(grid.x, grid.y),
      physics: this.getSurfacePhysicsAt(grid.x, grid.y)
    };
  }

  public findNearestTileOfType(
    fromX: number,
    fromY: number,
    terrainType: TerrainType,
    maxRadius: number = 50
  ): { x: number; y: number; distance: number } | null {
    let nearest: { x: number; y: number; distance: number } | null = null;

    for (let radius = 1; radius <= maxRadius; radius++) {
      const tiles = this.getTilesInRadius(fromX, fromY, radius);

      for (const tile of tiles) {
        if (this.getTerrainTypeAt(tile.x, tile.y) === terrainType) {
          const dx = tile.x - fromX;
          const dy = tile.y - fromY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (!nearest || dist < nearest.distance) {
            nearest = { x: tile.x, y: tile.y, distance: dist };
          }
        }
      }

      if (nearest) {
        return nearest;
      }
    }

    return null;
  }

  public findNearestMowedTile(
    fromX: number,
    fromY: number,
    mowed: boolean = true,
    maxRadius: number = 50
  ): { x: number; y: number; distance: number } | null {
    let nearest: { x: number; y: number; distance: number } | null = null;

    for (let radius = 1; radius <= maxRadius; radius++) {
      const tiles = this.getTilesInRadius(fromX, fromY, radius);

      for (const tile of tiles) {
        if (this.isMowed(tile.x, tile.y) === mowed) {
          const type = this.getTerrainTypeAt(tile.x, tile.y);
          if (type === 'fairway' || type === 'rough' || type === 'green') {
            const dx = tile.x - fromX;
            const dy = tile.y - fromY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (!nearest || dist < nearest.distance) {
              nearest = { x: tile.x, y: tile.y, distance: dist };
            }
          }
        }
      }

      if (nearest) {
        return nearest;
      }
    }

    return null;
  }

  public getRandomTileOfType(terrainType: TerrainType): { x: number; y: number } | null {
    const { width, height } = this.courseData;
    const matchingTiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.getTerrainTypeAt(x, y) === terrainType) {
          matchingTiles.push({ x, y });
        }
      }
    }

    if (matchingTiles.length === 0) return null;

    const idx = Math.floor(Math.random() * matchingTiles.length);
    return matchingTiles[idx];
  }

  public getRandomWalkableTile(): { x: number; y: number } | null {
    const { width, height } = this.courseData;
    const walkableTiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const type = this.getTerrainTypeAt(x, y);
        if (type !== 'water') {
          walkableTiles.push({ x, y });
        }
      }
    }

    if (walkableTiles.length === 0) return null;

    const idx = Math.floor(Math.random() * walkableTiles.length);
    return walkableTiles[idx];
  }

  public setLODEnabled(enabled: boolean): void {
    this.lodConfig.enabled = enabled;
    if (!enabled) {
      this.resetLODStates();
    }
  }

  public isLODEnabled(): boolean {
    return this.lodConfig.enabled;
  }

  public setLODLevels(levels: LODLevel[]): void {
    this.lodConfig.levels = levels.sort((a, b) => a.distance - b.distance);
  }

  public getLODLevels(): LODLevel[] {
    return [...this.lodConfig.levels];
  }

  public setLODUpdateInterval(interval: number): void {
    this.lodConfig.updateInterval = Math.max(0, interval);
  }

  public getLODUpdateInterval(): number {
    return this.lodConfig.updateInterval;
  }

  public updateLOD(centerGridX: number, centerGridY: number, forceUpdate: boolean = false): number {
    if (!this.lodConfig.enabled) return 0;

    const now = Date.now();
    if (!forceUpdate && now - this.lastLODUpdate < this.lodConfig.updateInterval) {
      return 0;
    }

    this.lastLODUpdate = now;
    this.lodCenterX = centerGridX;
    this.lodCenterY = centerGridY;

    let updatedCount = 0;
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}_${y}`;
        const dx = x - centerGridX;
        const dy = y - centerGridY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const newLOD = this.calculateLODLevel(distance);
        const currentLOD = this.tileLODStates.get(key) ?? 0;

        if (newLOD !== currentLOD) {
          this.tileLODStates.set(key, newLOD);
          this.applyTileLOD(x, y, newLOD);
          updatedCount++;
        }
      }
    }

    return updatedCount;
  }

  private calculateLODLevel(distance: number): number {
    const levels = this.lodConfig.levels;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (distance >= levels[i].distance) {
        return i;
      }
    }
    return 0;
  }

  private applyTileLOD(gridX: number, gridY: number, lodLevel: number): void {
    const key = `${gridX}_${gridY}`;
    const mesh = this.tileMap.get(key);
    if (!mesh) return;

    const level = this.lodConfig.levels[lodLevel];
    if (!level) return;

    if (level.simplificationFactor >= 4) {
      mesh.visibility = 0.6;
    } else if (level.simplificationFactor >= 2) {
      mesh.visibility = 0.8;
    } else {
      mesh.visibility = 1.0;
    }
  }

  private resetLODStates(): void {
    for (const [key] of this.tileLODStates) {
      const mesh = this.tileMap.get(key);
      if (mesh) {
        mesh.visibility = 1.0;
      }
    }
    this.tileLODStates.clear();
  }

  public getTileLODLevel(gridX: number, gridY: number): number {
    const key = `${gridX}_${gridY}`;
    return this.tileLODStates.get(key) ?? 0;
  }

  public getLODCenter(): { x: number; y: number } {
    return { x: this.lodCenterX, y: this.lodCenterY };
  }

  public getTilesAtLODLevel(level: number): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    for (const [key, lodLevel] of this.tileLODStates) {
      if (lodLevel === level) {
        const parts = key.split('_');
        tiles.push({
          x: parseInt(parts[0], 10),
          y: parseInt(parts[1], 10)
        });
      }
    }
    return tiles;
  }

  public getLODStatistics(): {
    enabled: boolean;
    centerX: number;
    centerY: number;
    tilesPerLevel: number[];
    totalTilesWithLOD: number;
  } {
    const tilesPerLevel: number[] = [];
    for (let i = 0; i < this.lodConfig.levels.length; i++) {
      tilesPerLevel[i] = 0;
    }

    for (const [, lodLevel] of this.tileLODStates) {
      if (lodLevel < tilesPerLevel.length) {
        tilesPerLevel[lodLevel]++;
      }
    }

    return {
      enabled: this.lodConfig.enabled,
      centerX: this.lodCenterX,
      centerY: this.lodCenterY,
      tilesPerLevel,
      totalTilesWithLOD: this.tileLODStates.size
    };
  }

  public forceFullLODUpdate(): number {
    return this.updateLOD(this.lodCenterX, this.lodCenterY, true);
  }

  public getDistanceToLODCenter(gridX: number, gridY: number): number {
    const dx = gridX - this.lodCenterX;
    const dy = gridY - this.lodCenterY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public getTileLODInfo(gridX: number, gridY: number): TileLODInfo {
    return {
      gridX,
      gridY,
      currentLOD: this.getTileLODLevel(gridX, gridY),
      distance: this.getDistanceToLODCenter(gridX, gridY)
    };
  }

  public getAllTileLODInfo(): TileLODInfo[] {
    const { width, height } = this.courseData;
    const info: TileLODInfo[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        info.push(this.getTileLODInfo(x, y));
      }
    }

    return info;
  }

  private buildChunks(): void {
    if (!this.chunkConfig.enabled) return;

    this.chunks.clear();
    this.tileToChunk.clear();

    const { width, height } = this.courseData;
    const chunkSize = this.chunkConfig.chunkSize;

    const chunksX = Math.ceil(width / chunkSize);
    const chunksY = Math.ceil(height / chunkSize);

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkId = `chunk_${cx}_${cy}`;
        const minX = cx * chunkSize;
        const maxX = Math.min((cx + 1) * chunkSize - 1, width - 1);
        const minY = cy * chunkSize;
        const maxY = Math.min((cy + 1) * chunkSize - 1, height - 1);

        const tiles: Array<{ x: number; y: number }> = [];
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            tiles.push({ x, y });
            this.tileToChunk.set(`${x}_${y}`, chunkId);
          }
        }

        const chunk: TerrainChunk = {
          id: chunkId,
          minX,
          maxX,
          minY,
          maxY,
          tiles,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2
        };

        this.chunks.set(chunkId, chunk);
      }
    }
  }

  public setChunkSize(size: number): void {
    this.chunkConfig.chunkSize = Math.max(1, Math.floor(size));
    if (this.chunkConfig.enabled) {
      this.buildChunks();
    }
  }

  public getChunkSize(): number {
    return this.chunkConfig.chunkSize;
  }

  public setChunksEnabled(enabled: boolean): void {
    this.chunkConfig.enabled = enabled;
    if (enabled) {
      this.buildChunks();
    } else {
      this.chunks.clear();
      this.tileToChunk.clear();
    }
  }

  public isChunksEnabled(): boolean {
    return this.chunkConfig.enabled;
  }

  public getChunkCount(): number {
    return this.chunks.size;
  }

  public getChunkAt(gridX: number, gridY: number): TerrainChunk | null {
    const tileKey = `${gridX}_${gridY}`;
    const chunkId = this.tileToChunk.get(tileKey);
    if (!chunkId) return null;
    return this.chunks.get(chunkId) ?? null;
  }

  public getChunkById(chunkId: string): TerrainChunk | null {
    return this.chunks.get(chunkId) ?? null;
  }

  public getAllChunks(): TerrainChunk[] {
    return Array.from(this.chunks.values());
  }

  public getChunksInRadius(centerX: number, centerY: number, radius: number): TerrainChunk[] {
    const result: TerrainChunk[] = [];
    const radiusSq = radius * radius;

    for (const chunk of this.chunks.values()) {
      const dx = chunk.centerX - centerX;
      const dy = chunk.centerY - centerY;
      if (dx * dx + dy * dy <= radiusSq) {
        result.push(chunk);
      }
    }

    return result;
  }

  public getChunksInRect(
    minGridX: number,
    minGridY: number,
    maxGridX: number,
    maxGridY: number
  ): TerrainChunk[] {
    const result: TerrainChunk[] = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.maxX >= minGridX && chunk.minX <= maxGridX &&
          chunk.maxY >= minGridY && chunk.minY <= maxGridY) {
        result.push(chunk);
      }
    }

    return result;
  }

  public getTilesInChunk(chunkId: string): Array<{ x: number; y: number }> {
    const chunk = this.chunks.get(chunkId);
    return chunk ? [...chunk.tiles] : [];
  }

  public getChunkNeighbors(chunkId: string): TerrainChunk[] {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return [];

    const chunkSize = this.chunkConfig.chunkSize;
    const cx = Math.floor(chunk.minX / chunkSize);
    const cy = Math.floor(chunk.minY / chunkSize);

    const neighbors: TerrainChunk[] = [];
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dx, dy] of offsets) {
      const neighborId = `chunk_${cx + dx}_${cy + dy}`;
      const neighbor = this.chunks.get(neighborId);
      if (neighbor) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  public forEachChunk(callback: (chunk: TerrainChunk) => void): void {
    for (const chunk of this.chunks.values()) {
      callback(chunk);
    }
  }

  public forEachTileInChunk(
    chunkId: string,
    callback: (x: number, y: number) => void
  ): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return;

    for (const tile of chunk.tiles) {
      callback(tile.x, tile.y);
    }
  }

  public getChunkStatistics(): {
    chunkCount: number;
    chunkSize: number;
    chunksX: number;
    chunksY: number;
    tilesPerChunk: number;
    enabled: boolean;
  } {
    const { width, height } = this.courseData;
    const chunkSize = this.chunkConfig.chunkSize;
    const chunksX = Math.ceil(width / chunkSize);
    const chunksY = Math.ceil(height / chunkSize);

    return {
      chunkCount: this.chunks.size,
      chunkSize,
      chunksX,
      chunksY,
      tilesPerChunk: chunkSize * chunkSize,
      enabled: this.chunkConfig.enabled
    };
  }

  public getChunkWorldBounds(chunkId: string): {
    minWorldX: number;
    maxWorldX: number;
    minWorldY: number;
    maxWorldY: number;
  } | null {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return null;

    const topLeft = this.gridToWorld(chunk.minX, chunk.minY);
    const topRight = this.gridToWorld(chunk.maxX, chunk.minY);
    const bottomLeft = this.gridToWorld(chunk.minX, chunk.maxY);
    const bottomRight = this.gridToWorld(chunk.maxX, chunk.maxY);

    return {
      minWorldX: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      maxWorldX: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      minWorldY: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
      maxWorldY: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
    };
  }

  public setChunkTilesVisible(chunkId: string, visible: boolean): number {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return 0;

    let count = 0;
    for (const tile of chunk.tiles) {
      const key = `${tile.x}_${tile.y}`;
      const mesh = this.tileMap.get(key);
      if (mesh && mesh.isEnabled() !== visible) {
        mesh.setEnabled(visible);
        count++;
      }
    }

    return count;
  }

  public getVisibleChunks(): TerrainChunk[] {
    const result: TerrainChunk[] = [];

    for (const chunk of this.chunks.values()) {
      let hasVisibleTile = false;
      for (const tile of chunk.tiles) {
        const key = `${tile.x}_${tile.y}`;
        const mesh = this.tileMap.get(key);
        if (mesh?.isEnabled()) {
          hasVisibleTile = true;
          break;
        }
      }
      if (hasVisibleTile) {
        result.push(chunk);
      }
    }

    return result;
  }

  public sampleTerrainAt(gridX: number, gridY: number): TerrainSample | null {
    if (!this.isValidGridPosition(Math.floor(gridX), Math.floor(gridY))) {
      return null;
    }

    const baseX = Math.floor(gridX);
    const baseY = Math.floor(gridY);

    const elevation = this.interpolateElevation(gridX, gridY);
    const slope = this.getSlopeVectorAt(baseX, baseY);
    const terrainType = this.getTerrainTypeAt(baseX, baseY);
    const normal = this.getTileNormalAt(baseX, baseY);

    return {
      gridX,
      gridY,
      elevation,
      slopeAngle: slope.angle,
      slopeDirection: slope.direction,
      terrainType,
      normal
    };
  }

  public sampleTerrainAlongLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sampleCount: number = 10
  ): TerrainSample[] {
    const samples: TerrainSample[] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;

      const sample = this.sampleTerrainAt(x, y);
      if (sample) {
        samples.push(sample);
      }
    }

    return samples;
  }

  public getAverageElevationInRadius(
    centerX: number,
    centerY: number,
    radius: number
  ): number {
    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    if (tiles.length === 0) return 0;

    let sum = 0;
    for (const tile of tiles) {
      sum += this.getElevationAt(tile.x, tile.y);
    }

    return sum / tiles.length;
  }

  public getMaxElevationInRadius(
    centerX: number,
    centerY: number,
    radius: number
  ): number {
    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    if (tiles.length === 0) return 0;

    let max = -Infinity;
    for (const tile of tiles) {
      const elev = this.getElevationAt(tile.x, tile.y);
      if (elev > max) max = elev;
    }

    return max;
  }

  public getMinElevationInRadius(
    centerX: number,
    centerY: number,
    radius: number
  ): number {
    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    if (tiles.length === 0) return 0;

    let min = Infinity;
    for (const tile of tiles) {
      const elev = this.getElevationAt(tile.x, tile.y);
      if (elev < min) min = elev;
    }

    return min;
  }

  public raycastTerrain(
    startGridX: number,
    startGridY: number,
    directionX: number,
    directionY: number,
    maxDistance: number = 100
  ): RaycastResult {
    const step = 0.5;
    const len = Math.sqrt(directionX * directionX + directionY * directionY);
    if (len === 0) {
      return {
        hit: false,
        gridX: startGridX,
        gridY: startGridY,
        elevation: 0,
        distance: 0,
        terrainType: 'rough'
      };
    }

    const dx = directionX / len;
    const dy = directionY / len;

    for (let dist = 0; dist <= maxDistance; dist += step) {
      const x = startGridX + dx * dist;
      const y = startGridY + dy * dist;
      const ix = Math.floor(x);
      const iy = Math.floor(y);

      if (!this.isValidGridPosition(ix, iy)) {
        return {
          hit: false,
          gridX: x,
          gridY: y,
          elevation: 0,
          distance: dist,
          terrainType: 'rough'
        };
      }

      const terrainType = this.getTerrainTypeAt(ix, iy);
      if (terrainType === 'water' || terrainType === 'bunker') {
        return {
          hit: true,
          gridX: x,
          gridY: y,
          elevation: this.interpolateElevation(x, y),
          distance: dist,
          terrainType
        };
      }
    }

    const endX = startGridX + dx * maxDistance;
    const endY = startGridY + dy * maxDistance;
    return {
      hit: false,
      gridX: endX,
      gridY: endY,
      elevation: this.interpolateElevation(endX, endY),
      distance: maxDistance,
      terrainType: this.getTerrainTypeAt(Math.floor(endX), Math.floor(endY))
    };
  }

  public getElevationGradient(gridX: number, gridY: number): { dx: number; dy: number } {
    const { width, height } = this.courseData;
    const x = Math.floor(gridX);
    const y = Math.floor(gridY);

    const centerElev = this.getElevationAt(x, y);
    let dx = 0;
    let dy = 0;

    if (x > 0) {
      dx -= this.getElevationAt(x - 1, y) - centerElev;
    }
    if (x < width - 1) {
      dx += this.getElevationAt(x + 1, y) - centerElev;
    }
    if (y > 0) {
      dy -= this.getElevationAt(x, y - 1) - centerElev;
    }
    if (y < height - 1) {
      dy += this.getElevationAt(x, y + 1) - centerElev;
    }

    return { dx: dx / 2, dy: dy / 2 };
  }

  public getBilinearElevation(gridX: number, gridY: number): number {
    const { width, height } = this.courseData;

    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const fx = gridX - x0;
    const fy = gridY - y0;

    const e00 = this.getElevationAt(x0, y0);
    const e10 = this.getElevationAt(x1, y0);
    const e01 = this.getElevationAt(x0, y1);
    const e11 = this.getElevationAt(x1, y1);

    const e0 = e00 * (1 - fx) + e10 * fx;
    const e1 = e01 * (1 - fx) + e11 * fx;

    return e0 * (1 - fy) + e1 * fy;
  }

  public getCubicElevation(gridX: number, gridY: number): number {
    const x = Math.floor(gridX);
    const y = Math.floor(gridY);
    const fx = gridX - x;
    const fy = gridY - y;

    const p = [];
    for (let j = -1; j <= 2; j++) {
      const row = [];
      for (let i = -1; i <= 2; i++) {
        row.push(this.getElevationAt(x + i, y + j));
      }
      p.push(row);
    }

    const cx = this.cubicInterpolate(p[0][0], p[0][1], p[0][2], p[0][3], fx);
    const cy = this.cubicInterpolate(p[1][0], p[1][1], p[1][2], p[1][3], fx);
    const cz = this.cubicInterpolate(p[2][0], p[2][1], p[2][2], p[2][3], fx);
    const cw = this.cubicInterpolate(p[3][0], p[3][1], p[3][2], p[3][3], fx);

    return this.cubicInterpolate(cx, cy, cz, cw, fy);
  }

  private cubicInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;
    return a * t * t * t + b * t * t + c * t + d;
  }

  public getSmoothNormal(gridX: number, gridY: number): { x: number; y: number; z: number } {
    const delta = 0.1;
    const e0 = this.getBilinearElevation(gridX - delta, gridY);
    const e1 = this.getBilinearElevation(gridX + delta, gridY);
    const e2 = this.getBilinearElevation(gridX, gridY - delta);
    const e3 = this.getBilinearElevation(gridX, gridY + delta);

    const dzdx = (e1 - e0) / (2 * delta) * ELEVATION_HEIGHT;
    const dzdy = (e3 - e2) / (2 * delta) * ELEVATION_HEIGHT;

    const len = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
    return {
      x: -dzdx / len,
      y: -dzdy / len,
      z: 1 / len
    };
  }

  public getTerrainContour(
    elevation: number,
    sampleSpacing: number = 1
  ): Array<{ x: number; y: number }> {
    const contour: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    for (let y = 0; y < height - 1; y += sampleSpacing) {
      for (let x = 0; x < width - 1; x += sampleSpacing) {
        const e00 = this.getElevationAt(x, y);
        const e10 = this.getElevationAt(x + 1, y);
        const e01 = this.getElevationAt(x, y + 1);
        const e11 = this.getElevationAt(x + 1, y + 1);

        const crossesX1 = (e00 < elevation) !== (e10 < elevation);
        const crossesX2 = (e01 < elevation) !== (e11 < elevation);
        const crossesY1 = (e00 < elevation) !== (e01 < elevation);
        const crossesY2 = (e10 < elevation) !== (e11 < elevation);

        if (crossesX1) {
          const t = (elevation - e00) / (e10 - e00);
          contour.push({ x: x + t, y });
        }
        if (crossesX2) {
          const t = (elevation - e01) / (e11 - e01);
          contour.push({ x: x + t, y: y + 1 });
        }
        if (crossesY1) {
          const t = (elevation - e00) / (e01 - e00);
          contour.push({ x, y: y + t });
        }
        if (crossesY2) {
          const t = (elevation - e10) / (e11 - e10);
          contour.push({ x: x + 1, y: y + t });
        }
      }
    }

    return contour;
  }

  public getTerrainProfile(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sampleCount: number = 20
  ): Array<{ distance: number; elevation: number; terrainType: TerrainType }> {
    const profile: Array<{ distance: number; elevation: number; terrainType: TerrainType }> = [];

    const dx = endX - startX;
    const dy = endY - startY;
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const x = startX + dx * t;
      const y = startY + dy * t;

      profile.push({
        distance: totalDist * t,
        elevation: this.getBilinearElevation(x, y),
        terrainType: this.getTerrainTypeAt(Math.floor(x), Math.floor(y))
      });
    }

    return profile;
  }

  public addEventListener(type: TerrainEventType, callback: TerrainEventCallback): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(callback);
  }

  public removeEventListener(type: TerrainEventType, callback: TerrainEventCallback): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  public removeAllEventListeners(type?: TerrainEventType): void {
    if (type) {
      this.eventListeners.delete(type);
    } else {
      this.eventListeners.clear();
    }
  }

  private emitEvent(event: TerrainEvent): void {
    if (!this.eventsEnabled) return;

    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const callback of listeners) {
        callback(event);
      }
    }
  }

  public queueEvent(event: TerrainEvent): void {
    this.eventQueue.push(event);
  }

  public processEventQueue(): number {
    const count = this.eventQueue.length;
    for (const event of this.eventQueue) {
      this.emitEvent(event);
    }
    this.eventQueue = [];
    return count;
  }

  public clearEventQueue(): void {
    this.eventQueue = [];
  }

  public getEventQueueLength(): number {
    return this.eventQueue.length;
  }

  public setEventsEnabled(enabled: boolean): void {
    this.eventsEnabled = enabled;
  }

  public isEventsEnabled(): boolean {
    return this.eventsEnabled;
  }

  public getListenerCount(type?: TerrainEventType): number {
    if (type) {
      return this.eventListeners.get(type)?.length ?? 0;
    }

    let total = 0;
    for (const listeners of this.eventListeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  public onMowed(callback: (gridX: number, gridY: number) => void): () => void {
    const wrapper: TerrainEventCallback = (event) => {
      if (event.gridX !== undefined && event.gridY !== undefined) {
        callback(event.gridX, event.gridY);
      }
    };
    this.addEventListener('mowed', wrapper);
    return () => this.removeEventListener('mowed', wrapper);
  }

  public onUnmowed(callback: (gridX: number, gridY: number) => void): () => void {
    const wrapper: TerrainEventCallback = (event) => {
      if (event.gridX !== undefined && event.gridY !== undefined) {
        callback(event.gridX, event.gridY);
      }
    };
    this.addEventListener('unmowed', wrapper);
    return () => this.removeEventListener('unmowed', wrapper);
  }

  public onTileVisibilityChange(callback: (gridX: number, gridY: number, visible: boolean) => void): () => void {
    const wrapperShow: TerrainEventCallback = (event) => {
      if (event.gridX !== undefined && event.gridY !== undefined) {
        callback(event.gridX, event.gridY, true);
      }
    };
    const wrapperHide: TerrainEventCallback = (event) => {
      if (event.gridX !== undefined && event.gridY !== undefined) {
        callback(event.gridX, event.gridY, false);
      }
    };
    this.addEventListener('tileVisible', wrapperShow);
    this.addEventListener('tileHidden', wrapperHide);
    return () => {
      this.removeEventListener('tileVisible', wrapperShow);
      this.removeEventListener('tileHidden', wrapperHide);
    };
  }

  public onChunkVisibilityChange(callback: (chunkId: string, visible: boolean) => void): () => void {
    const wrapperShow: TerrainEventCallback = (event) => {
      if (event.chunkId !== undefined) {
        callback(event.chunkId, true);
      }
    };
    const wrapperHide: TerrainEventCallback = (event) => {
      if (event.chunkId !== undefined) {
        callback(event.chunkId, false);
      }
    };
    this.addEventListener('chunkVisible', wrapperShow);
    this.addEventListener('chunkHidden', wrapperHide);
    return () => {
      this.removeEventListener('chunkVisible', wrapperShow);
      this.removeEventListener('chunkHidden', wrapperHide);
    };
  }

  public emitMowedEvent(gridX: number, gridY: number): void {
    this.emitEvent({
      type: 'mowed',
      gridX,
      gridY,
      timestamp: Date.now()
    });
  }

  public emitUnmowedEvent(gridX: number, gridY: number): void {
    this.emitEvent({
      type: 'unmowed',
      gridX,
      gridY,
      timestamp: Date.now()
    });
  }

  public emitTileVisibleEvent(gridX: number, gridY: number): void {
    this.emitEvent({
      type: 'tileVisible',
      gridX,
      gridY,
      timestamp: Date.now()
    });
  }

  public emitTileHiddenEvent(gridX: number, gridY: number): void {
    this.emitEvent({
      type: 'tileHidden',
      gridX,
      gridY,
      timestamp: Date.now()
    });
  }

  public emitChunkVisibleEvent(chunkId: string): void {
    this.emitEvent({
      type: 'chunkVisible',
      chunkId,
      timestamp: Date.now()
    });
  }

  public emitChunkHiddenEvent(chunkId: string): void {
    this.emitEvent({
      type: 'chunkHidden',
      chunkId,
      timestamp: Date.now()
    });
  }

  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  public isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  public clearCache(): void {
    this.cache.elevationCache.clear();
    this.cache.cornerHeightsCache.clear();
    this.cache.terrainTypeCache.clear();
    this.cache.physicsCache.clear();
    this.cache.slopeCache.clear();
    this.cache.cacheHits = 0;
    this.cache.cacheMisses = 0;
    this.cache.lastClearTime = Date.now();
  }

  public getCacheStatistics(): {
    elevationCacheSize: number;
    cornerHeightsCacheSize: number;
    terrainTypeCacheSize: number;
    physicsCacheSize: number;
    slopeCacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    lastClearTime: number;
  } {
    const total = this.cache.cacheHits + this.cache.cacheMisses;
    return {
      elevationCacheSize: this.cache.elevationCache.size,
      cornerHeightsCacheSize: this.cache.cornerHeightsCache.size,
      terrainTypeCacheSize: this.cache.terrainTypeCache.size,
      physicsCacheSize: this.cache.physicsCache.size,
      slopeCacheSize: this.cache.slopeCache.size,
      cacheHits: this.cache.cacheHits,
      cacheMisses: this.cache.cacheMisses,
      hitRate: total > 0 ? this.cache.cacheHits / total : 0,
      lastClearTime: this.cache.lastClearTime
    };
  }

  public getCachedElevation(gridX: number, gridY: number): number {
    if (!this.cacheEnabled) {
      return this.getElevationAt(gridX, gridY);
    }

    const key = `${gridX}_${gridY}`;
    if (this.cache.elevationCache.has(key)) {
      this.cache.cacheHits++;
      return this.cache.elevationCache.get(key)!;
    }

    this.cache.cacheMisses++;
    const value = this.getElevationAt(gridX, gridY);
    this.cache.elevationCache.set(key, value);
    return value;
  }

  public getCachedCornerHeights(gridX: number, gridY: number): CornerHeights {
    if (!this.cacheEnabled) {
      return this.getCornerHeights(gridX, gridY);
    }

    const key = `${gridX}_${gridY}`;
    if (this.cache.cornerHeightsCache.has(key)) {
      this.cache.cacheHits++;
      return this.cache.cornerHeightsCache.get(key)!;
    }

    this.cache.cacheMisses++;
    const value = this.getCornerHeights(gridX, gridY);
    this.cache.cornerHeightsCache.set(key, value);
    return value;
  }

  public getCachedTerrainType(gridX: number, gridY: number): TerrainType {
    if (!this.cacheEnabled) {
      return this.getTerrainTypeAt(gridX, gridY);
    }

    const key = `${gridX}_${gridY}`;
    if (this.cache.terrainTypeCache.has(key)) {
      this.cache.cacheHits++;
      return this.cache.terrainTypeCache.get(key)!;
    }

    this.cache.cacheMisses++;
    const value = this.getTerrainTypeAt(gridX, gridY);
    this.cache.terrainTypeCache.set(key, value);
    return value;
  }

  public getCachedSurfacePhysics(gridX: number, gridY: number): SurfacePhysics {
    if (!this.cacheEnabled) {
      return this.getSurfacePhysicsAt(gridX, gridY);
    }

    const key = `${gridX}_${gridY}`;
    if (this.cache.physicsCache.has(key)) {
      this.cache.cacheHits++;
      return this.cache.physicsCache.get(key)!;
    }

    this.cache.cacheMisses++;
    const value = this.getSurfacePhysicsAt(gridX, gridY);
    this.cache.physicsCache.set(key, value);
    return value;
  }

  public getCachedSlopeVector(gridX: number, gridY: number): { angle: number; direction: number; magnitude: number } {
    if (!this.cacheEnabled) {
      return this.getSlopeVectorAt(gridX, gridY);
    }

    const key = `${gridX}_${gridY}`;
    if (this.cache.slopeCache.has(key)) {
      this.cache.cacheHits++;
      return this.cache.slopeCache.get(key)!;
    }

    this.cache.cacheMisses++;
    const value = this.getSlopeVectorAt(gridX, gridY);
    this.cache.slopeCache.set(key, value);
    return value;
  }

  public invalidateCacheAt(gridX: number, gridY: number): void {
    const key = `${gridX}_${gridY}`;
    this.cache.elevationCache.delete(key);
    this.cache.cornerHeightsCache.delete(key);
    this.cache.terrainTypeCache.delete(key);
    this.cache.physicsCache.delete(key);
    this.cache.slopeCache.delete(key);

    const neighbors = this.getNeighborTiles(gridX, gridY, true);
    for (const neighbor of neighbors) {
      const nKey = `${neighbor.x}_${neighbor.y}`;
      this.cache.cornerHeightsCache.delete(nKey);
      this.cache.slopeCache.delete(nKey);
    }
  }

  public warmupCache(): void {
    if (!this.cacheEnabled) return;

    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.getCachedElevation(x, y);
        this.getCachedTerrainType(x, y);
        this.getCachedCornerHeights(x, y);
      }
    }
  }

  public warmupCacheInRadius(centerX: number, centerY: number, radius: number): void {
    if (!this.cacheEnabled) return;

    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    for (const tile of tiles) {
      this.getCachedElevation(tile.x, tile.y);
      this.getCachedTerrainType(tile.x, tile.y);
      this.getCachedCornerHeights(tile.x, tile.y);
    }
  }

  public getTotalCacheSize(): number {
    return (
      this.cache.elevationCache.size +
      this.cache.cornerHeightsCache.size +
      this.cache.terrainTypeCache.size +
      this.cache.physicsCache.size +
      this.cache.slopeCache.size
    );
  }

  public getCacheMemoryEstimate(): number {
    const elevationSize = this.cache.elevationCache.size * 16;
    const cornerHeightsSize = this.cache.cornerHeightsCache.size * 64;
    const terrainTypeSize = this.cache.terrainTypeCache.size * 24;
    const physicsSize = this.cache.physicsCache.size * 48;
    const slopeSize = this.cache.slopeCache.size * 48;

    return elevationSize + cornerHeightsSize + terrainTypeSize + physicsSize + slopeSize;
  }

  public createZone(
    id: string,
    name: string,
    tiles: Array<{ x: number; y: number }>,
    properties: Record<string, unknown> = {},
    priority: number = 0,
    color?: { r: number; g: number; b: number }
  ): TerrainZone {
    const zone: TerrainZone = {
      id,
      name,
      tiles: [...tiles],
      properties,
      color,
      priority
    };

    this.zones.set(id, zone);

    for (const tile of tiles) {
      const key = `${tile.x}_${tile.y}`;
      if (!this.tileToZones.has(key)) {
        this.tileToZones.set(key, []);
      }
      const zoneList = this.tileToZones.get(key)!;
      if (!zoneList.includes(id)) {
        zoneList.push(id);
      }
    }

    return zone;
  }

  public deleteZone(id: string): boolean {
    const zone = this.zones.get(id);
    if (!zone) return false;

    for (const tile of zone.tiles) {
      const key = `${tile.x}_${tile.y}`;
      const zoneList = this.tileToZones.get(key);
      if (zoneList) {
        const index = zoneList.indexOf(id);
        if (index !== -1) {
          zoneList.splice(index, 1);
        }
        if (zoneList.length === 0) {
          this.tileToZones.delete(key);
        }
      }
    }

    this.zones.delete(id);
    return true;
  }

  public getZone(id: string): TerrainZone | null {
    return this.zones.get(id) ?? null;
  }

  public getZoneByName(name: string): TerrainZone | null {
    for (const zone of this.zones.values()) {
      if (zone.name === name) {
        return zone;
      }
    }
    return null;
  }

  public getAllZones(): TerrainZone[] {
    return Array.from(this.zones.values());
  }

  public getZonesAt(gridX: number, gridY: number): TerrainZone[] {
    const key = `${gridX}_${gridY}`;
    const zoneIds = this.tileToZones.get(key) ?? [];
    const zones: TerrainZone[] = [];

    for (const id of zoneIds) {
      const zone = this.zones.get(id);
      if (zone) {
        zones.push(zone);
      }
    }

    return zones.sort((a, b) => b.priority - a.priority);
  }

  public getPrimaryZoneAt(gridX: number, gridY: number): TerrainZone | null {
    const zones = this.getZonesAt(gridX, gridY);
    return zones.length > 0 ? zones[0] : null;
  }

  public isInZone(gridX: number, gridY: number, zoneId: string): boolean {
    const key = `${gridX}_${gridY}`;
    const zoneIds = this.tileToZones.get(key);
    return zoneIds?.includes(zoneId) ?? false;
  }

  public addTileToZone(zoneId: string, gridX: number, gridY: number): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;

    const exists = zone.tiles.some(t => t.x === gridX && t.y === gridY);
    if (exists) return false;

    zone.tiles.push({ x: gridX, y: gridY });

    const key = `${gridX}_${gridY}`;
    if (!this.tileToZones.has(key)) {
      this.tileToZones.set(key, []);
    }
    this.tileToZones.get(key)!.push(zoneId);

    return true;
  }

  public removeTileFromZone(zoneId: string, gridX: number, gridY: number): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;

    const index = zone.tiles.findIndex(t => t.x === gridX && t.y === gridY);
    if (index === -1) return false;

    zone.tiles.splice(index, 1);

    const key = `${gridX}_${gridY}`;
    const zoneList = this.tileToZones.get(key);
    if (zoneList) {
      const zIdx = zoneList.indexOf(zoneId);
      if (zIdx !== -1) {
        zoneList.splice(zIdx, 1);
      }
      if (zoneList.length === 0) {
        this.tileToZones.delete(key);
      }
    }

    return true;
  }

  public setZoneProperty(zoneId: string, key: string, value: unknown): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.properties[key] = value;
    return true;
  }

  public getZoneProperty<T>(zoneId: string, key: string): T | null {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;
    return (zone.properties[key] as T) ?? null;
  }

  public setZoneColor(zoneId: string, color: { r: number; g: number; b: number }): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.color = color;
    return true;
  }

  public setZonePriority(zoneId: string, priority: number): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    zone.priority = priority;
    return true;
  }

  public getZoneCount(): number {
    return this.zones.size;
  }

  public getZoneStatistics(zoneId: string): {
    tileCount: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
    center: { x: number; y: number } | null;
    terrainTypes: Record<TerrainType, number>;
  } | null {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;

    const terrainTypes: Record<TerrainType, number> = {
      fairway: 0,
      rough: 0,
      green: 0,
      bunker: 0,
      water: 0
    };

    if (zone.tiles.length === 0) {
      return {
        tileCount: 0,
        bounds: null,
        center: null,
        terrainTypes
      };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;

    for (const tile of zone.tiles) {
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
      sumX += tile.x;
      sumY += tile.y;

      const type = this.getTerrainTypeAt(tile.x, tile.y);
      terrainTypes[type]++;
    }

    return {
      tileCount: zone.tiles.length,
      bounds: { minX, maxX, minY, maxY },
      center: {
        x: Math.round(sumX / zone.tiles.length),
        y: Math.round(sumY / zone.tiles.length)
      },
      terrainTypes
    };
  }

  public clearAllZones(): void {
    this.zones.clear();
    this.tileToZones.clear();
  }

  public createZoneFromTerrainType(
    id: string,
    name: string,
    terrainType: TerrainType,
    priority: number = 0
  ): TerrainZone {
    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.getTerrainTypeAt(x, y) === terrainType) {
          tiles.push({ x, y });
        }
      }
    }

    return this.createZone(id, name, tiles, { terrainType }, priority);
  }

  public createZoneFromRect(
    id: string,
    name: string,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    priority: number = 0
  ): TerrainZone {
    const tiles = this.getTilesInRect(minX, minY, maxX, maxY);
    return this.createZone(id, name, tiles, {}, priority);
  }

  public createZoneFromRadius(
    id: string,
    name: string,
    centerX: number,
    centerY: number,
    radius: number,
    priority: number = 0
  ): TerrainZone {
    const tiles = this.getTilesInRadius(centerX, centerY, radius);
    return this.createZone(id, name, tiles, {}, priority);
  }

  public setHistoryEnabled(enabled: boolean): void {
    this.historyEnabled = enabled;
    if (!enabled) {
      this.clearHistory();
    }
  }

  public isHistoryEnabled(): boolean {
    return this.historyEnabled;
  }

  public setMaxHistorySize(size: number): void {
    this.history.maxHistorySize = Math.max(1, size);
    while (this.history.undoStack.length > this.history.maxHistorySize) {
      this.history.undoStack.shift();
    }
  }

  public getMaxHistorySize(): number {
    return this.history.maxHistorySize;
  }

  public clearHistory(): void {
    this.history.undoStack = [];
    this.history.redoStack = [];
    this.history.currentBatch = null;
    this.history.batchDescription = null;
  }

  public getUndoStackSize(): number {
    return this.history.undoStack.length;
  }

  public getRedoStackSize(): number {
    return this.history.redoStack.length;
  }

  public canUndo(): boolean {
    return this.history.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.history.redoStack.length > 0;
  }

  public beginBatch(description: string): void {
    if (this.history.currentBatch !== null) {
      this.endBatch();
    }
    this.history.currentBatch = [];
    this.history.batchDescription = description;
  }

  public endBatch(): void {
    if (this.history.currentBatch !== null && this.history.currentBatch.length > 0) {
      this.pushHistoryState({
        modifications: this.history.currentBatch,
        description: this.history.batchDescription || 'Batch modification',
        timestamp: Date.now()
      });
    }
    this.history.currentBatch = null;
    this.history.batchDescription = null;
  }

  public isInBatch(): boolean {
    return this.history.currentBatch !== null;
  }

  private pushHistoryState(state: TerrainHistoryState): void {
    this.history.undoStack.push(state);
    this.history.redoStack = [];
    while (this.history.undoStack.length > this.history.maxHistorySize) {
      this.history.undoStack.shift();
    }
  }

  public recordModification(
    type: TerrainModificationType,
    gridX: number,
    gridY: number,
    previousValue: unknown,
    newValue: unknown
  ): void {
    if (!this.historyEnabled) return;

    const modification: TerrainModification = {
      type,
      gridX,
      gridY,
      previousValue,
      newValue,
      timestamp: Date.now()
    };

    if (this.history.currentBatch !== null) {
      this.history.currentBatch.push(modification);
    } else {
      this.pushHistoryState({
        modifications: [modification],
        description: `${type} at (${gridX}, ${gridY})`,
        timestamp: Date.now()
      });
    }
  }

  public undo(): boolean {
    if (!this.canUndo()) return false;

    const state = this.history.undoStack.pop()!;
    const redoModifications: TerrainModification[] = [];

    for (let i = state.modifications.length - 1; i >= 0; i--) {
      const mod = state.modifications[i];
      const currentValue = this.getModificationValue(mod.type, mod.gridX, mod.gridY);
      this.applyModificationValue(mod.type, mod.gridX, mod.gridY, mod.previousValue);
      redoModifications.unshift({
        ...mod,
        previousValue: currentValue,
        newValue: mod.previousValue
      });
    }

    this.history.redoStack.push({
      modifications: redoModifications,
      description: state.description,
      timestamp: Date.now()
    });

    return true;
  }

  public redo(): boolean {
    if (!this.canRedo()) return false;

    const state = this.history.redoStack.pop()!;
    const undoModifications: TerrainModification[] = [];

    for (const mod of state.modifications) {
      const currentValue = this.getModificationValue(mod.type, mod.gridX, mod.gridY);
      this.applyModificationValue(mod.type, mod.gridX, mod.gridY, mod.newValue);
      undoModifications.push({
        ...mod,
        previousValue: currentValue
      });
    }

    this.history.undoStack.push({
      modifications: undoModifications,
      description: state.description,
      timestamp: Date.now()
    });

    return true;
  }

  private getModificationValue(type: TerrainModificationType, gridX: number, gridY: number): unknown {
    switch (type) {
      case 'elevation':
        return this.getElevationAt(gridX, gridY);
      case 'mowed':
        return this.isMowed(gridX, gridY);
      case 'terrainType':
        return this.getTerrainTypeAt(gridX, gridY);
      case 'cornerHeights':
        return this.getCornerHeights(gridX, gridY);
      default:
        return null;
    }
  }

  private applyModificationValue(type: TerrainModificationType, gridX: number, gridY: number, value: unknown): void {
    switch (type) {
      case 'elevation':
        this.setElevationAtInternal(gridX, gridY, value as number);
        break;
      case 'mowed':
        this.setMowed(gridX, gridY, value as boolean);
        break;
      case 'cornerHeights':
        break;
    }
    this.invalidateCacheAt(gridX, gridY);
  }

  private setElevationAtInternal(gridX: number, gridY: number, elevation: number): void {
    const { width, height, layout } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) return;

    if (this.courseData.elevation) {
      this.courseData.elevation[gridY][gridX] = elevation;

      const key = `${gridX}_${gridY}`;
      const oldMesh = this.tileMap.get(key);
      if (oldMesh) {
        const idx = this.tileMeshes.indexOf(oldMesh);
        if (idx !== -1) this.tileMeshes.splice(idx, 1);
        oldMesh.dispose();
      }

      const terrainType = layout[gridY]?.[gridX] ?? TERRAIN_CODES.ROUGH;
      const isMowedState = this.mowedState[gridY]?.[gridX] ?? false;
      const newTile = this.createIsometricTile(gridX, gridY, elevation, terrainType, isMowedState);
      this.tileMeshes.push(newTile);
      this.tileMap.set(key, newTile);
    }
  }

  public setElevationWithHistory(gridX: number, gridY: number, elevation: number): void {
    const previousValue = this.getElevationAt(gridX, gridY);
    this.recordModification('elevation', gridX, gridY, previousValue, elevation);
    this.setElevationAtInternal(gridX, gridY, elevation);
    this.invalidateCacheAt(gridX, gridY);
  }

  public setMowedWithHistory(gridX: number, gridY: number, mowed: boolean): void {
    const previousValue = this.isMowed(gridX, gridY);
    if (previousValue !== mowed) {
      this.recordModification('mowed', gridX, gridY, previousValue, mowed);
      this.setMowed(gridX, gridY, mowed);
    }
  }

  public getHistoryState(): { undoCount: number; redoCount: number; isInBatch: boolean; maxSize: number } {
    return {
      undoCount: this.history.undoStack.length,
      redoCount: this.history.redoStack.length,
      isInBatch: this.history.currentBatch !== null,
      maxSize: this.history.maxHistorySize
    };
  }

  public getLastUndoDescription(): string | null {
    if (this.history.undoStack.length === 0) return null;
    return this.history.undoStack[this.history.undoStack.length - 1].description;
  }

  public getLastRedoDescription(): string | null {
    if (this.history.redoStack.length === 0) return null;
    return this.history.redoStack[this.history.redoStack.length - 1].description;
  }

  public getHistoryStatistics(): {
    undoCount: number;
    redoCount: number;
    totalModifications: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    let totalModifications = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const state of this.history.undoStack) {
      totalModifications += state.modifications.length;
      if (oldestTimestamp === null || state.timestamp < oldestTimestamp) {
        oldestTimestamp = state.timestamp;
      }
      if (newestTimestamp === null || state.timestamp > newestTimestamp) {
        newestTimestamp = state.timestamp;
      }
    }

    return {
      undoCount: this.history.undoStack.length,
      redoCount: this.history.redoStack.length,
      totalModifications,
      oldestTimestamp,
      newestTimestamp
    };
  }

  public setSelectionEnabled(enabled: boolean): void {
    this.selectionEnabled = enabled;
    if (!enabled) {
      this.clearSelection();
    }
  }

  public isSelectionEnabled(): boolean {
    return this.selectionEnabled;
  }

  public setSelectionMode(mode: SelectionMode): void {
    this.selection.mode = mode;
  }

  public getSelectionMode(): SelectionMode {
    return this.selection.mode;
  }

  public setSelectionColor(r: number, g: number, b: number): void {
    this.selection.color = { r, g, b };
  }

  public getSelectionColor(): { r: number; g: number; b: number } {
    return { ...this.selection.color };
  }

  public setBrushRadius(radius: number): void {
    this.selection.brushRadius = Math.max(1, radius);
  }

  public getBrushRadius(): number {
    return this.selection.brushRadius;
  }

  public clearSelection(): void {
    this.selection.tiles.clear();
    this.selection.anchorX = null;
    this.selection.anchorY = null;
    this.selection.isActive = false;
  }

  public selectTile(gridX: number, gridY: number): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) return;

    const key = `${gridX}_${gridY}`;
    this.selection.tiles.add(key);
  }

  public deselectTile(gridX: number, gridY: number): void {
    const key = `${gridX}_${gridY}`;
    this.selection.tiles.delete(key);
  }

  public toggleTileSelection(gridX: number, gridY: number): void {
    if (!this.selectionEnabled) return;
    const key = `${gridX}_${gridY}`;
    if (this.selection.tiles.has(key)) {
      this.selection.tiles.delete(key);
    } else {
      const { width, height } = this.courseData;
      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
        this.selection.tiles.add(key);
      }
    }
  }

  public isTileSelected(gridX: number, gridY: number): boolean {
    const key = `${gridX}_${gridY}`;
    return this.selection.tiles.has(key);
  }

  public getSelectedTileCount(): number {
    return this.selection.tiles.size;
  }

  public getSelectedTiles(): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    for (const key of this.selection.tiles) {
      const [x, y] = key.split('_').map(Number);
      tiles.push({ x, y });
    }
    return tiles;
  }

  public startRectSelection(gridX: number, gridY: number): void {
    if (!this.selectionEnabled) return;
    this.selection.anchorX = gridX;
    this.selection.anchorY = gridY;
    this.selection.isActive = true;
  }

  public updateRectSelection(gridX: number, gridY: number): void {
    if (!this.selection.isActive || this.selection.anchorX === null || this.selection.anchorY === null) return;

    this.selection.tiles.clear();

    const minX = Math.min(this.selection.anchorX, gridX);
    const maxX = Math.max(this.selection.anchorX, gridX);
    const minY = Math.min(this.selection.anchorY, gridY);
    const maxY = Math.max(this.selection.anchorY, gridY);

    const { width, height } = this.courseData;

    for (let y = Math.max(0, minY); y <= Math.min(height - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(width - 1, maxX); x++) {
        const key = `${x}_${y}`;
        this.selection.tiles.add(key);
      }
    }
  }

  public endRectSelection(): void {
    this.selection.isActive = false;
    this.selection.anchorX = null;
    this.selection.anchorY = null;
  }

  public selectInRadius(centerX: number, centerY: number, radius?: number): void {
    if (!this.selectionEnabled) return;
    const r = radius ?? this.selection.brushRadius;
    const tiles = this.getTilesInRadius(centerX, centerY, r);
    for (const tile of tiles) {
      const key = `${tile.x}_${tile.y}`;
      this.selection.tiles.add(key);
    }
  }

  public deselectInRadius(centerX: number, centerY: number, radius?: number): void {
    const r = radius ?? this.selection.brushRadius;
    const tiles = this.getTilesInRadius(centerX, centerY, r);
    for (const tile of tiles) {
      const key = `${tile.x}_${tile.y}`;
      this.selection.tiles.delete(key);
    }
  }

  public selectAll(): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}_${y}`;
        this.selection.tiles.add(key);
      }
    }
  }

  public selectByTerrainType(type: TerrainType): void {
    if (!this.selectionEnabled) return;
    const { width, height, layout } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layout[y]?.[x] !== undefined) {
          const tileType = getTerrainType(layout[y][x]);
          if (tileType === type) {
            const key = `${x}_${y}`;
            this.selection.tiles.add(key);
          }
        }
      }
    }
  }

  public selectMowed(): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isMowed(x, y)) {
          const key = `${x}_${y}`;
          this.selection.tiles.add(key);
        }
      }
    }
  }

  public selectUnmowed(): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!this.isMowed(x, y)) {
          const key = `${x}_${y}`;
          this.selection.tiles.add(key);
        }
      }
    }
  }

  public selectByElevation(minElevation: number, maxElevation: number): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = this.getElevationAt(x, y);
        if (elev >= minElevation && elev <= maxElevation) {
          const key = `${x}_${y}`;
          this.selection.tiles.add(key);
        }
      }
    }
  }

  public invertSelection(): void {
    if (!this.selectionEnabled) return;
    const { width, height } = this.courseData;
    const newSelection = new Set<string>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x}_${y}`;
        if (!this.selection.tiles.has(key)) {
          newSelection.add(key);
        }
      }
    }
    this.selection.tiles = newSelection;
  }

  public expandSelection(amount: number = 1): void {
    if (!this.selectionEnabled) return;
    const currentTiles = this.getSelectedTiles();
    for (const tile of currentTiles) {
      const neighbors = this.getTilesInRadius(tile.x, tile.y, amount);
      for (const neighbor of neighbors) {
        const key = `${neighbor.x}_${neighbor.y}`;
        this.selection.tiles.add(key);
      }
    }
  }

  public contractSelection(amount: number = 1): void {
    const { width, height } = this.courseData;
    const toRemove = new Set<string>();

    for (const key of this.selection.tiles) {
      const [x, y] = key.split('_').map(Number);

      for (let dy = -amount; dy <= amount; dy++) {
        for (let dx = -amount; dx <= amount; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            toRemove.add(key);
            break;
          }
          const neighborKey = `${nx}_${ny}`;
          if (!this.selection.tiles.has(neighborKey)) {
            toRemove.add(key);
            break;
          }
        }
        if (toRemove.has(key)) break;
      }
    }

    for (const key of toRemove) {
      this.selection.tiles.delete(key);
    }
  }

  public getSelectionBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.selection.tiles.size === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const key of this.selection.tiles) {
      const [x, y] = key.split('_').map(Number);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return { minX, minY, maxX, maxY };
  }

  public getSelectionStatistics(): {
    count: number;
    terrainCounts: Record<TerrainType, number>;
    mowedCount: number;
    avgElevation: number;
  } {
    const tiles = this.getSelectedTiles();
    const terrainCounts: Record<TerrainType, number> = {
      fairway: 0,
      rough: 0,
      green: 0,
      bunker: 0,
      water: 0
    };

    let mowedCount = 0;
    let totalElevation = 0;

    for (const tile of tiles) {
      const type = this.getTerrainTypeAt(tile.x, tile.y);
      if (type) {
        terrainCounts[type]++;
      }
      if (this.isMowed(tile.x, tile.y)) {
        mowedCount++;
      }
      totalElevation += this.getElevationAt(tile.x, tile.y);
    }

    return {
      count: tiles.length,
      terrainCounts,
      mowedCount,
      avgElevation: tiles.length > 0 ? totalElevation / tiles.length : 0
    };
  }

  public setMowedForSelection(mowed: boolean): void {
    const tiles = this.getSelectedTiles();
    if (this.historyEnabled) {
      this.beginBatch(mowed ? 'Mow selected tiles' : 'Unmow selected tiles');
    }
    for (const tile of tiles) {
      if (this.historyEnabled) {
        this.setMowedWithHistory(tile.x, tile.y, mowed);
      } else {
        this.setMowed(tile.x, tile.y, mowed);
      }
    }
    if (this.historyEnabled) {
      this.endBatch();
    }
  }

  public setElevationForSelection(elevation: number): void {
    const tiles = this.getSelectedTiles();
    if (this.historyEnabled) {
      this.beginBatch(`Set elevation to ${elevation} for selected tiles`);
    }
    for (const tile of tiles) {
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, elevation);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, elevation);
      }
    }
    if (this.historyEnabled) {
      this.endBatch();
    }
  }

  public adjustElevationForSelection(delta: number): void {
    const tiles = this.getSelectedTiles();
    if (this.historyEnabled) {
      this.beginBatch(`Adjust elevation by ${delta} for selected tiles`);
    }
    for (const tile of tiles) {
      const currentElevation = this.getElevationAt(tile.x, tile.y);
      const newElevation = currentElevation + delta;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, newElevation);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, newElevation);
      }
    }
    if (this.historyEnabled) {
      this.endBatch();
    }
  }
}

export interface TerrainStatistics {
  width: number;
  height: number;
  totalTiles: number;
  terrainCounts: Record<TerrainType, number>;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  flatTileCount: number;
  slopedTileCount: number;
  cliffFaceCount: number;
  waterLevel: number;
}

export interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
}

export interface PathfindingOptions {
  maxSlopeDelta?: number;
  allowDiagonals?: boolean;
  avoidTypes?: TerrainType[];
  maxIterations?: number;
}

export interface TerrainSerializedState {
  version: number;
  width: number;
  height: number;
  waterLevel: number;
  mowedTiles: Array<{ x: number; y: number }>;
  timestamp: number;
}

export interface RCTTileData {
  pos: [number, number];
  heights: [number, number, number, number];
  type: TerrainType;
  flags: {
    water: boolean;
    mowed: boolean;
  };
}

export interface RCTTerrainData {
  gridSize: [number, number];
  heightStep: number;
  waterLevel: number;
  tiles: RCTTileData[];
}

export interface TerrainDebugInfo {
  dimensions: { width: number; height: number };
  totalTiles: number;
  tileMeshCount: number;
  visibleMeshCount: number;
  drawCallEstimate: number;
  isBatched: boolean;
  mowedCount: number;
  mowedPercentage: number;
  terrainCounts: Record<TerrainType, number>;
  elevationRange: { min: number; max: number; range: number };
  bounds: {
    minWorldX: number;
    maxWorldX: number;
    minWorldY: number;
    maxWorldY: number;
  };
  waterLevel: number;
  gridLinesVisible: boolean;
  waterVisible: boolean;
}

export interface LODLevel {
  distance: number;
  simplificationFactor: number;
}

export interface LODConfig {
  enabled: boolean;
  levels: LODLevel[];
  updateInterval: number;
}

export interface TileLODInfo {
  gridX: number;
  gridY: number;
  currentLOD: number;
  distance: number;
}

export interface TerrainChunk {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  tiles: Array<{ x: number; y: number }>;
  centerX: number;
  centerY: number;
}

export interface ChunkConfig {
  chunkSize: number;
  enabled: boolean;
}

export interface TerrainSample {
  gridX: number;
  gridY: number;
  elevation: number;
  slopeAngle: number;
  slopeDirection: number;
  terrainType: TerrainType;
  normal: { x: number; y: number; z: number };
}

export interface RaycastResult {
  hit: boolean;
  gridX: number;
  gridY: number;
  elevation: number;
  distance: number;
  terrainType: TerrainType;
}

export type TerrainEventType = 'mowed' | 'unmowed' | 'tileVisible' | 'tileHidden' | 'chunkVisible' | 'chunkHidden';

export interface TerrainEvent {
  type: TerrainEventType;
  gridX?: number;
  gridY?: number;
  chunkId?: string;
  timestamp: number;
}

export type TerrainEventCallback = (event: TerrainEvent) => void;

export interface TerrainCache {
  elevationCache: Map<string, number>;
  cornerHeightsCache: Map<string, CornerHeights>;
  terrainTypeCache: Map<string, TerrainType>;
  physicsCache: Map<string, SurfacePhysics>;
  slopeCache: Map<string, { angle: number; direction: number; magnitude: number }>;
  cacheHits: number;
  cacheMisses: number;
  lastClearTime: number;
}

export interface TerrainZone {
  id: string;
  name: string;
  tiles: Array<{ x: number; y: number }>;
  properties: Record<string, unknown>;
  color?: { r: number; g: number; b: number };
  priority: number;
}

export type TerrainModificationType = 'elevation' | 'mowed' | 'terrainType' | 'cornerHeights' | 'batch';

export interface TerrainModification {
  type: TerrainModificationType;
  gridX: number;
  gridY: number;
  previousValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface TerrainHistoryState {
  modifications: TerrainModification[];
  description: string;
  timestamp: number;
}

export interface TerrainHistory {
  undoStack: TerrainHistoryState[];
  redoStack: TerrainHistoryState[];
  maxHistorySize: number;
  currentBatch: TerrainModification[] | null;
  batchDescription: string | null;
}

export type SelectionMode = 'single' | 'rect' | 'lasso' | 'brush';

export interface TerrainSelection {
  tiles: Set<string>;
  mode: SelectionMode;
  anchorX: number | null;
  anchorY: number | null;
  isActive: boolean;
  color: { r: number; g: number; b: number };
  brushRadius: number;
}
