import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import { CourseData } from '../../data/courseData';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT, TERRAIN_CODES, TerrainType, getTerrainType, getTerrainCode, getSurfacePhysics, SurfacePhysics, getSlopeVector, getTileNormal, DEFAULT_WATER_LEVEL } from '../../core/terrain';

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
  private gridToFaceIds: Map<string, { mesh: Mesh; faceIds: number[] }[]> = new Map();
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
  private brush: TerrainBrush = {
    shape: 'circle',
    operation: 'raise',
    radius: 3,
    strength: 1,
    falloff: 0.5,
    isActive: false
  };
  private brushEnabled: boolean = false;
  private culling: CullingConfig = {
    enabled: false,
    padding: 5,
    updateInterval: 100,
    lastUpdate: 0,
    visibleTileCount: 0,
    hiddenTileCount: 0
  };
  private lastViewportBounds: ViewportBounds | null = null;
  private clipboard: TerrainClipboard | null = null;
  private stamps: Map<string, TerrainStamp> = new Map();
  private activeStampId: string | null = null;
  private constraints: TerrainConstraints = {
    maxSlopeDelta: 2,
    enforceConstraints: true
  };

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
  }

  public build(): void {
    this.faceIdToMetadata.clear();
    this.meshToFaceOffset.clear();
    this.gridToFaceIds.clear();
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

  public setTerrainTypeAt(gridX: number, gridY: number, terrainType: TerrainType, rebuildTile: boolean = true): boolean {
    const { width, height, layout } = this.courseData;
    if (gridX < 0 || gridX >= width || gridY < 0 || gridY >= height) return false;

    const code = getTerrainCode(terrainType);
    const oldCode = layout[gridY]?.[gridX] ?? TERRAIN_CODES.ROUGH;
    if (code === oldCode) return false;

    layout[gridY][gridX] = code;
    this.invalidateCacheAt(gridX, gridY);

    if (rebuildTile) {
      const elev = this.getElevationAt(gridX, gridY);
      const isMowed = this.mowedState[gridY]?.[gridX] ?? false;

      const key = `${gridX}_${gridY}`;
      const oldMesh = this.tileMap.get(key);
      if (oldMesh) {
        const idx = this.tileMeshes.indexOf(oldMesh);
        if (idx !== -1) this.tileMeshes.splice(idx, 1);
        oldMesh.dispose();
      }

      const newTile = this.createIsometricTile(gridX, gridY, elev, code, isMowed);
      this.tileMeshes.push(newTile);
      this.tileMap.set(key, newTile);
    }

    this.emitEvent({ type: 'terrainTypeChanged', gridX, gridY, timestamp: Date.now() });
    return true;
  }

  public setTerrainTypeInArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    terrainType: TerrainType
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.setTerrainTypeAt(x, y, terrainType, true)) {
          modifiedCount++;
        }
      }
    }
    return modifiedCount;
  }

  public paintTerrainCircle(
    centerX: number,
    centerY: number,
    radius: number,
    terrainType: TerrainType
  ): number {
    let modifiedCount = 0;
    const radiusSquared = radius * radius;

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.courseData.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.courseData.height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= radiusSquared) {
          if (this.setTerrainTypeAt(x, y, terrainType, true)) {
            modifiedCount++;
          }
        }
      }
    }
    return modifiedCount;
  }

  public replaceTerrainType(
    oldType: TerrainType,
    newType: TerrainType,
    area?: { startX: number; startY: number; endX: number; endY: number }
  ): number {
    let modifiedCount = 0;
    const { width, height } = this.courseData;

    const minX = area ? Math.max(0, Math.min(area.startX, area.endX)) : 0;
    const maxX = area ? Math.min(width - 1, Math.max(area.startX, area.endX)) : width - 1;
    const minY = area ? Math.max(0, Math.min(area.startY, area.endY)) : 0;
    const maxY = area ? Math.min(height - 1, Math.max(area.startY, area.endY)) : height - 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.getTerrainTypeAt(x, y) === oldType) {
          if (this.setTerrainTypeAt(x, y, newType, true)) {
            modifiedCount++;
          }
        }
      }
    }
    return modifiedCount;
  }

  public fillTerrainFlood(
    startX: number,
    startY: number,
    newType: TerrainType,
    maxTiles: number = 1000
  ): number {
    if (!this.isValidTile(startX, startY)) return 0;

    const originalType = this.getTerrainTypeAt(startX, startY);
    if (originalType === newType) return 0;

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let modifiedCount = 0;

    while (queue.length > 0 && modifiedCount < maxTiles) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (!this.isValidTile(x, y)) continue;
      if (this.getTerrainTypeAt(x, y) !== originalType) continue;

      visited.add(key);

      if (this.setTerrainTypeAt(x, y, newType, true)) {
        modifiedCount++;
      }

      queue.push({ x: x - 1, y });
      queue.push({ x: x + 1, y });
      queue.push({ x, y: y - 1 });
      queue.push({ x, y: y + 1 });
    }

    return modifiedCount;
  }

  public getTerrainTypeTiles(terrainType: TerrainType): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.getTerrainTypeAt(x, y) === terrainType) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  public getTerrainTypeAtPoints(points: Array<{ x: number; y: number }>): Map<string, TerrainType> {
    const result = new Map<string, TerrainType>();
    for (const { x, y } of points) {
      if (this.isValidTile(x, y)) {
        result.set(`${x},${y}`, this.getTerrainTypeAt(x, y));
      }
    }
    return result;
  }

  public getTerrainTypeCounts(): Record<TerrainType, number> {
    const counts: Record<TerrainType, number> = {
      fairway: 0,
      rough: 0,
      green: 0,
      bunker: 0,
      water: 0
    };

    const { width, height } = this.courseData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const type = this.getTerrainTypeAt(x, y);
        counts[type]++;
      }
    }

    return counts;
  }

  public getSlopeVectorAt(gridX: number, gridY: number): { angle: number; direction: number; magnitude: number } {
    const corners = this.getCornerHeights(gridX, gridY);
    return getSlopeVector(corners, ELEVATION_HEIGHT);
  }

  public getTileNormalAt(gridX: number, gridY: number): { x: number; y: number; z: number } {
    const corners = this.getCornerHeights(gridX, gridY);
    return getTileNormal(corners, ELEVATION_HEIGHT);
  }

  public getInterpolatedElevation(worldX: number, worldZ: number): number {
    const gridX = Math.floor(worldX / TILE_WIDTH);
    const gridY = Math.floor(worldZ / TILE_HEIGHT);

    if (!this.isValidGridPosition(gridX, gridY)) {
      return this.getElevationAt(
        Math.max(0, Math.min(this.courseData.width - 1, gridX)),
        Math.max(0, Math.min(this.courseData.height - 1, gridY))
      ) * ELEVATION_HEIGHT;
    }

    const corners = this.getCornerHeights(gridX, gridY);
    const localX = (worldX / TILE_WIDTH) - gridX;
    const localZ = (worldZ / TILE_HEIGHT) - gridY;

    const topInterp = corners.nw + (corners.ne - corners.nw) * localX;
    const bottomInterp = corners.sw + (corners.se - corners.sw) * localX;
    const elevation = topInterp + (bottomInterp - topInterp) * localZ;

    return elevation * ELEVATION_HEIGHT;
  }

  public getInterpolatedNormal(worldX: number, worldZ: number): { x: number; y: number; z: number } {
    const gridX = Math.floor(worldX / TILE_WIDTH);
    const gridY = Math.floor(worldZ / TILE_HEIGHT);

    if (!this.isValidGridPosition(gridX, gridY)) {
      return { x: 0, y: 1, z: 0 };
    }

    const corners = this.getCornerHeights(gridX, gridY);
    const dx = ((corners.ne - corners.nw) + (corners.se - corners.sw)) * 0.5 * ELEVATION_HEIGHT / TILE_WIDTH;
    const dz = ((corners.sw - corners.nw) + (corners.se - corners.ne)) * 0.5 * ELEVATION_HEIGHT / TILE_HEIGHT;
    const length = Math.sqrt(dx * dx + 1 + dz * dz);

    return { x: -dx / length, y: 1 / length, z: -dz / length };
  }

  public smoothElevationArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    iterations: number = 1,
    strength: number = 0.5
  ): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    let modifiedCount = 0;
    const clampedStrength = Math.max(0, Math.min(1, strength));

    for (let iter = 0; iter < iterations; iter++) {
      const tempElevation: number[][] = [];
      for (let y = minY; y <= maxY; y++) {
        tempElevation[y - minY] = [];
        for (let x = minX; x <= maxX; x++) {
          const currentElev = elevation[y][x];
          let sum = currentElev;
          let count = 1;

          const neighbors = [
            [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
            [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += elevation[ny][nx];
              count++;
            }
          }

          const avgElev = sum / count;
          tempElevation[y - minY][x - minX] = currentElev + (avgElev - currentElev) * clampedStrength;
        }
      }

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const newElev = Math.round(tempElevation[y - minY][x - minX]);
          if (elevation[y][x] !== newElev) {
            elevation[y][x] = newElev;
            modifiedCount++;
          }
        }
      }
    }

    if (modifiedCount > 0) {
      this.rebuildArea(minX, minY, maxX, maxY);
    }

    return modifiedCount;
  }

  public flattenElevationArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    targetElevation?: number
  ): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    let target = targetElevation;
    if (target === undefined) {
      let sum = 0;
      let count = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          sum += elevation[y][x];
          count++;
        }
      }
      target = Math.round(sum / count);
    }

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (elevation[y][x] !== target) {
          elevation[y][x] = target;
          modifiedCount++;
        }
      }
    }

    if (modifiedCount > 0) {
      this.rebuildArea(minX, minY, maxX, maxY);
    }

    return modifiedCount;
  }

  public raiseElevationArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    amount: number = 1
  ): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        elevation[y][x] += amount;
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      this.rebuildArea(minX, minY, maxX, maxY);
    }

    return modifiedCount;
  }

  public createElevationGradient(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    startElevation: number,
    endElevation: number
  ): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x - startX;
        const py = y - startY;
        const proj = (px * dx + py * dy) / (length * length);
        const t = Math.max(0, Math.min(1, proj));
        const newElev = Math.round(startElevation + (endElevation - startElevation) * t);
        if (elevation[y][x] !== newElev) {
          elevation[y][x] = newElev;
          modifiedCount++;
        }
      }
    }

    if (modifiedCount > 0) {
      this.rebuildArea(minX, minY, maxX, maxY);
    }

    return modifiedCount;
  }

  public createHill(
    centerX: number,
    centerY: number,
    radius: number,
    peakElevation: number,
    baseElevation: number = 0,
    falloff: 'linear' | 'quadratic' | 'cosine' = 'cosine'
  ): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          const t = dist / radius;
          let factor: number;
          switch (falloff) {
            case 'linear':
              factor = 1 - t;
              break;
            case 'quadratic':
              factor = 1 - t * t;
              break;
            case 'cosine':
              factor = (Math.cos(t * Math.PI) + 1) * 0.5;
              break;
          }
          const newElev = Math.round(baseElevation + (peakElevation - baseElevation) * factor);
          if (elevation[y][x] !== newElev) {
            elevation[y][x] = newElev;
            modifiedCount++;
          }
        }
      }
    }

    if (modifiedCount > 0) {
      this.rebuildArea(minX, minY, maxX, maxY);
    }

    return modifiedCount;
  }

  private rebuildArea(minX: number, minY: number, maxX: number, maxY: number): void {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${x}_${y}`;
        const oldMesh = this.tileMap.get(key);
        if (oldMesh) {
          const idx = this.tileMeshes.indexOf(oldMesh);
          if (idx !== -1) this.tileMeshes.splice(idx, 1);
          oldMesh.dispose();
        }

        const elev = this.courseData.elevation?.[y]?.[x] ?? 0;
        const code = this.courseData.layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
        const isMowed = this.mowedState[y]?.[x] ?? false;
        const newTile = this.createIsometricTile(x, y, elev, code, isMowed);
        this.tileMeshes.push(newTile);
        this.tileMap.set(key, newTile);
      }
    }

    this.buildGridLines();
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

    const faceIds: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      this.faceIdToMetadata.set(startFaceId + i, metadata);
      faceIds.push(startFaceId + i);
    }

    const gridKey = `${gridX},${gridY}`;
    const existingEntries = this.gridToFaceIds.get(gridKey) ?? [];
    existingEntries.push({ mesh, faceIds });
    this.gridToFaceIds.set(gridKey, existingEntries);

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

  public getFacesAtGridPosition(gridX: number, gridY: number): Array<{ mesh: Mesh; faceIds: number[] }> {
    const gridKey = `${gridX},${gridY}`;
    return this.gridToFaceIds.get(gridKey) ?? [];
  }

  public getMeshesAtGridPosition(gridX: number, gridY: number): Mesh[] {
    const entries = this.getFacesAtGridPosition(gridX, gridY);
    return entries.map(entry => entry.mesh);
  }

  public getAllFaceIdsAtGridPosition(gridX: number, gridY: number): number[] {
    const entries = this.getFacesAtGridPosition(gridX, gridY);
    const allFaceIds: number[] = [];
    for (const entry of entries) {
      allFaceIds.push(...entry.faceIds);
    }
    return allFaceIds;
  }

  public getFaceCountAtGridPosition(gridX: number, gridY: number): number {
    return this.getAllFaceIdsAtGridPosition(gridX, gridY).length;
  }

  public hasFacesAtGridPosition(gridX: number, gridY: number): boolean {
    const gridKey = `${gridX},${gridY}`;
    const entries = this.gridToFaceIds.get(gridKey);
    return entries !== undefined && entries.length > 0;
  }

  public getTotalFaceCount(): number {
    return this.faceIdToMetadata.size;
  }

  public getTotalRegisteredTiles(): number {
    return this.gridToFaceIds.size;
  }

  public getFaceStatistics(): {
    totalFaces: number;
    totalTilesWithFaces: number;
    averageFacesPerTile: number;
    cliffFaces: number;
    terrainFaces: number;
    tilesWithCliffs: number;
  } {
    let cliffFaces = 0;
    let terrainFaces = 0;
    const tilesWithCliffs = new Set<string>();

    for (const metadata of this.faceIdToMetadata.values()) {
      if (metadata.isCliff) {
        cliffFaces++;
        tilesWithCliffs.add(`${metadata.gridX},${metadata.gridY}`);
      } else {
        terrainFaces++;
      }
    }

    const totalFaces = this.faceIdToMetadata.size;
    const totalTilesWithFaces = this.gridToFaceIds.size;

    return {
      totalFaces,
      totalTilesWithFaces,
      averageFacesPerTile: totalTilesWithFaces > 0 ? totalFaces / totalTilesWithFaces : 0,
      cliffFaces,
      terrainFaces,
      tilesWithCliffs: tilesWithCliffs.size
    };
  }

  public findTilesWithMostFaces(limit: number = 10): Array<{ gridX: number; gridY: number; faceCount: number }> {
    const tileFaceCounts: Array<{ gridX: number; gridY: number; faceCount: number }> = [];

    for (const [gridKey, entries] of this.gridToFaceIds) {
      const [gridX, gridY] = gridKey.split(',').map(Number);
      let faceCount = 0;
      for (const entry of entries) {
        faceCount += entry.faceIds.length;
      }
      tileFaceCounts.push({ gridX, gridY, faceCount });
    }

    tileFaceCounts.sort((a, b) => b.faceCount - a.faceCount);
    return tileFaceCounts.slice(0, limit);
  }

  public getFacesByTerrainType(terrainType: TerrainType): Array<{ gridX: number; gridY: number; faceId: number }> {
    const result: Array<{ gridX: number; gridY: number; faceId: number }> = [];

    for (const [faceId, metadata] of this.faceIdToMetadata) {
      if (metadata.terrainType === terrainType && !metadata.isCliff) {
        result.push({ gridX: metadata.gridX, gridY: metadata.gridY, faceId });
      }
    }

    return result;
  }

  public getCliffFaces(): Array<{ gridX: number; gridY: number; faceId: number }> {
    const result: Array<{ gridX: number; gridY: number; faceId: number }> = [];

    for (const [faceId, metadata] of this.faceIdToMetadata) {
      if (metadata.isCliff) {
        result.push({ gridX: metadata.gridX, gridY: metadata.gridY, faceId });
      }
    }

    return result;
  }

  public getFacesInArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Map<string, Array<{ mesh: Mesh; faceIds: number[] }>> {
    const result = new Map<string, Array<{ mesh: Mesh; faceIds: number[] }>>();
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const faces = this.getFacesAtGridPosition(x, y);
        if (faces.length > 0) {
          result.set(`${x},${y}`, faces);
        }
      }
    }

    return result;
  }

  public dispose(): void {
    for (const mesh of this.tileMeshes) {
      mesh.dispose();
    }
    this.tileMeshes = [];
    this.tileMap.clear();
    this.faceIdToMetadata.clear();
    this.meshToFaceOffset.clear();
    this.gridToFaceIds.clear();
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

  public importFromRCTFormat(data: RCTTerrainData, options: RCTImportOptions = {}): RCTImportResult {
    const {
      validateConstraints = true,
      applyMowedState = true,
      updateWaterLevel = true,
      scaleElevation = false,
      rebuildMesh = true
    } = options;

    const result: RCTImportResult = {
      success: false,
      tilesImported: 0,
      tilesSkipped: 0,
      constraintViolations: 0,
      warnings: [],
      errors: []
    };

    if (!data || !data.gridSize || !data.tiles) {
      result.errors.push('Invalid RCT data: missing required fields');
      return result;
    }

    const [dataWidth, dataHeight] = data.gridSize;

    if (dataWidth !== this.courseData.width || dataHeight !== this.courseData.height) {
      result.warnings.push(
        `Grid size mismatch: data is ${dataWidth}x${dataHeight}, ` +
        `current terrain is ${this.courseData.width}x${this.courseData.height}`
      );
    }

    const elevationScale = scaleElevation && data.heightStep !== ELEVATION_HEIGHT
      ? ELEVATION_HEIGHT / data.heightStep
      : 1;

    if (scaleElevation && elevationScale !== 1) {
      result.warnings.push(
        `Scaling elevation by ${elevationScale.toFixed(2)} ` +
        `(source heightStep: ${data.heightStep}, target: ${ELEVATION_HEIGHT})`
      );
    }

    for (const tile of data.tiles) {
      const [x, y] = tile.pos;

      if (x < 0 || x >= this.courseData.width || y < 0 || y >= this.courseData.height) {
        result.tilesSkipped++;
        continue;
      }

      let [nw, ne, se, sw] = tile.heights;

      if (elevationScale !== 1) {
        nw = Math.round(nw * elevationScale);
        ne = Math.round(ne * elevationScale);
        se = Math.round(se * elevationScale);
        sw = Math.round(sw * elevationScale);
      }

      if (validateConstraints) {
        const maxDelta = this.constraints.maxSlopeDelta;
        const deltas = [
          Math.abs(nw - ne),
          Math.abs(ne - se),
          Math.abs(se - sw),
          Math.abs(sw - nw),
          Math.abs(nw - se),
          Math.abs(ne - sw)
        ];
        const maxFound = Math.max(...deltas);

        if (maxFound > maxDelta) {
          result.constraintViolations++;
          if (this.constraints.enforceConstraints) {
            const avg = Math.round((nw + ne + se + sw) / 4);
            nw = Math.max(avg - maxDelta, Math.min(avg + maxDelta, nw));
            ne = Math.max(avg - maxDelta, Math.min(avg + maxDelta, ne));
            se = Math.max(avg - maxDelta, Math.min(avg + maxDelta, se));
            sw = Math.max(avg - maxDelta, Math.min(avg + maxDelta, sw));
          }
        }
      }

      const avgElevation = Math.round((nw + ne + se + sw) / 4);
      this.setElevationAtInternal(x, y, avgElevation);

      if (applyMowedState && tile.flags?.mowed !== undefined) {
        this.mowedState[y][x] = tile.flags.mowed;
      }

      result.tilesImported++;
    }

    if (updateWaterLevel && data.waterLevel !== undefined) {
      this.waterLevel = data.waterLevel;
    }

    if (rebuildMesh) {
      this.buildWaterPlane();
      this.buildGridLines();
    }

    result.success = result.errors.length === 0;
    return result;
  }

  public validateRCTData(data: RCTTerrainData): RCTValidationResult {
    const result: RCTValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalTiles: 0,
        validTiles: 0,
        invalidTiles: 0,
        slopeViolations: 0,
        outOfBoundsTiles: 0,
        terrainTypeCounts: {} as Record<TerrainType, number>
      }
    };

    if (!data) {
      result.isValid = false;
      result.errors.push('Data is null or undefined');
      return result;
    }

    if (!data.gridSize || !Array.isArray(data.gridSize) || data.gridSize.length !== 2) {
      result.isValid = false;
      result.errors.push('Invalid or missing gridSize');
      return result;
    }

    if (!data.tiles || !Array.isArray(data.tiles)) {
      result.isValid = false;
      result.errors.push('Invalid or missing tiles array');
      return result;
    }

    const [width, height] = data.gridSize;
    const expectedTiles = width * height;
    result.statistics.totalTiles = data.tiles.length;

    if (data.tiles.length !== expectedTiles) {
      result.warnings.push(
        `Tile count mismatch: expected ${expectedTiles}, got ${data.tiles.length}`
      );
    }

    const seenPositions = new Set<string>();

    for (let i = 0; i < data.tiles.length; i++) {
      const tile = data.tiles[i];

      if (!tile.pos || !Array.isArray(tile.pos) || tile.pos.length !== 2) {
        result.statistics.invalidTiles++;
        result.errors.push(`Tile ${i}: invalid position`);
        continue;
      }

      if (!tile.heights || !Array.isArray(tile.heights) || tile.heights.length !== 4) {
        result.statistics.invalidTiles++;
        result.errors.push(`Tile ${i}: invalid heights array`);
        continue;
      }

      const [x, y] = tile.pos;
      const posKey = `${x},${y}`;

      if (seenPositions.has(posKey)) {
        result.warnings.push(`Tile ${i}: duplicate position (${x}, ${y})`);
      }
      seenPositions.add(posKey);

      if (x < 0 || x >= width || y < 0 || y >= height) {
        result.statistics.outOfBoundsTiles++;
        result.warnings.push(`Tile ${i}: position (${x}, ${y}) out of bounds`);
      }

      const [nw, ne, se, sw] = tile.heights;
      const deltas = [
        Math.abs(nw - ne),
        Math.abs(ne - se),
        Math.abs(se - sw),
        Math.abs(sw - nw)
      ];
      const maxDelta = Math.max(...deltas);

      if (maxDelta > 2) {
        result.statistics.slopeViolations++;
      }

      if (tile.type) {
        result.statistics.terrainTypeCounts[tile.type] =
          (result.statistics.terrainTypeCounts[tile.type] || 0) + 1;
      }

      result.statistics.validTiles++;
    }

    if (result.errors.length > 0) {
      result.isValid = false;
    }

    return result;
  }

  public mergeRCTData(
    existingData: RCTTerrainData,
    newData: RCTTerrainData,
    options: RCTMergeOptions = {}
  ): RCTTerrainData {
    const {
      conflictResolution = 'newer',
      blendOverlapping = false,
      blendFactor = 0.5
    } = options;

    const mergedTiles = new Map<string, RCTTileData>();

    for (const tile of existingData.tiles) {
      const key = `${tile.pos[0]},${tile.pos[1]}`;
      mergedTiles.set(key, { ...tile, heights: [...tile.heights] as [number, number, number, number] });
    }

    for (const tile of newData.tiles) {
      const key = `${tile.pos[0]},${tile.pos[1]}`;
      const existing = mergedTiles.get(key);

      if (!existing) {
        mergedTiles.set(key, { ...tile, heights: [...tile.heights] as [number, number, number, number] });
      } else if (blendOverlapping) {
        const blended: RCTTileData = {
          pos: tile.pos,
          heights: [
            Math.round(existing.heights[0] * (1 - blendFactor) + tile.heights[0] * blendFactor),
            Math.round(existing.heights[1] * (1 - blendFactor) + tile.heights[1] * blendFactor),
            Math.round(existing.heights[2] * (1 - blendFactor) + tile.heights[2] * blendFactor),
            Math.round(existing.heights[3] * (1 - blendFactor) + tile.heights[3] * blendFactor)
          ],
          type: conflictResolution === 'newer' ? tile.type : existing.type,
          flags: {
            water: tile.type === 'water' || existing.type === 'water',
            mowed: conflictResolution === 'newer' ? tile.flags.mowed : existing.flags.mowed
          }
        };
        mergedTiles.set(key, blended);
      } else if (conflictResolution === 'newer') {
        mergedTiles.set(key, { ...tile, heights: [...tile.heights] as [number, number, number, number] });
      }
    }

    const [existingWidth, existingHeight] = existingData.gridSize;
    const [newWidth, newHeight] = newData.gridSize;

    return {
      gridSize: [Math.max(existingWidth, newWidth), Math.max(existingHeight, newHeight)],
      heightStep: existingData.heightStep,
      waterLevel: conflictResolution === 'newer' ? newData.waterLevel : existingData.waterLevel,
      tiles: Array.from(mergedTiles.values())
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

  public hasLineOfSight3D(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    observerHeight: number = 1.5,
    targetHeight: number = 0
  ): boolean {
    const result = this.getLineOfSight3DDetails(fromX, fromY, toX, toY, observerHeight, targetHeight);
    return result.visible;
  }

  public getLineOfSight3DDetails(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    observerHeight: number = 1.5,
    targetHeight: number = 0
  ): LineOfSightResult {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return {
        visible: true,
        distance: 0,
        obstructionPoint: null,
        obstructionElevation: null,
        clearanceAtTarget: observerHeight + targetHeight,
        sampleCount: 0
      };
    }

    const fromElev = this.interpolateElevation(fromX, fromY) + observerHeight;
    const toElev = this.interpolateElevation(toX, toY) + targetHeight;

    const numSamples = Math.max(10, Math.ceil(distance * 2));
    const stepX = dx / numSamples;
    const stepY = dy / numSamples;
    const elevStep = (toElev - fromElev) / numSamples;

    let minClearance = Infinity;
    let obstructionPoint: { x: number; y: number } | null = null;
    let obstructionElevation: number | null = null;

    for (let i = 1; i < numSamples; i++) {
      const x = fromX + stepX * i;
      const y = fromY + stepY * i;
      const losHeight = fromElev + elevStep * i;
      const terrainHeight = this.interpolateElevation(x, y);
      const clearance = losHeight - terrainHeight;

      if (clearance < minClearance) {
        minClearance = clearance;
        if (clearance < 0) {
          obstructionPoint = { x, y };
          obstructionElevation = terrainHeight;
        }
      }
    }

    return {
      visible: minClearance >= 0,
      distance,
      obstructionPoint,
      obstructionElevation,
      clearanceAtTarget: minClearance,
      sampleCount: numSamples
    };
  }

  public getVisibleAreaFrom(
    gridX: number,
    gridY: number,
    maxDistance: number,
    observerHeight: number = 1.5
  ): Array<{ x: number; y: number; visible: boolean }> {
    const result: Array<{ x: number; y: number; visible: boolean }> = [];
    const { width, height } = this.courseData;

    const minX = Math.max(0, Math.floor(gridX - maxDistance));
    const maxX = Math.min(width - 1, Math.ceil(gridX + maxDistance));
    const minY = Math.max(0, Math.floor(gridY - maxDistance));
    const maxY = Math.min(height - 1, Math.ceil(gridY + maxDistance));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - gridX;
        const dy = y - gridY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= maxDistance) {
          const visible = this.hasLineOfSight3D(gridX, gridY, x, y, observerHeight, 0);
          result.push({ x, y, visible });
        }
      }
    }

    return result;
  }

  public getVisible3DTileCount(
    gridX: number,
    gridY: number,
    maxDistance: number,
    observerHeight: number = 1.5
  ): number {
    const visibleArea = this.getVisibleAreaFrom(gridX, gridY, maxDistance, observerHeight);
    return visibleArea.filter(t => t.visible).length;
  }

  public getVisibility3DPercentage(
    gridX: number,
    gridY: number,
    maxDistance: number,
    observerHeight: number = 1.5
  ): number {
    const visibleArea = this.getVisibleAreaFrom(gridX, gridY, maxDistance, observerHeight);
    if (visibleArea.length === 0) return 0;
    return (visibleArea.filter(t => t.visible).length / visibleArea.length) * 100;
  }

  public findHighestVisibility3DPoint(
    terrainType?: TerrainType,
    maxDistance: number = 20,
    observerHeight: number = 1.5
  ): { x: number; y: number; visibilityScore: number } | null {
    const { width, height } = this.courseData;
    let bestPoint: { x: number; y: number; visibilityScore: number } | null = null;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrainType && this.getTerrainTypeAt(x, y) !== terrainType) {
          continue;
        }

        const visibleCount = this.getVisible3DTileCount(x, y, maxDistance, observerHeight);
        if (!bestPoint || visibleCount > bestPoint.visibilityScore) {
          bestPoint = { x, y, visibilityScore: visibleCount };
        }
      }
    }

    return bestPoint;
  }

  public findBestViewing3DPosition(
    targetX: number,
    targetY: number,
    searchRadius: number = 10,
    minDistance: number = 2,
    maxDistance: number = 20,
    observerHeight: number = 1.5
  ): { x: number; y: number; clearance: number } | null {
    const { width, height } = this.courseData;
    let bestPosition: { x: number; y: number; clearance: number } | null = null;

    const minX = Math.max(0, Math.floor(targetX - searchRadius));
    const maxX = Math.min(width - 1, Math.ceil(targetX + searchRadius));
    const minY = Math.max(0, Math.floor(targetY - searchRadius));
    const maxY = Math.min(height - 1, Math.ceil(targetY + searchRadius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - targetX;
        const dy = y - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance || dist > maxDistance) continue;

        const losResult = this.getLineOfSight3DDetails(x, y, targetX, targetY, observerHeight, 0);
        if (losResult.visible) {
          if (!bestPosition || losResult.clearanceAtTarget > bestPosition.clearance) {
            bestPosition = { x, y, clearance: losResult.clearanceAtTarget };
          }
        }
      }
    }

    return bestPosition;
  }

  public computeShadowMap(
    lightDirectionX: number,
    lightDirectionY: number,
    lightAngle: number = 45
  ): boolean[][] {
    const { width, height } = this.courseData;
    const shadowMap: boolean[][] = [];

    const len = Math.sqrt(lightDirectionX * lightDirectionX + lightDirectionY * lightDirectionY);
    const dx = len > 0 ? lightDirectionX / len : 0;
    const dy = len > 0 ? lightDirectionY / len : 0;
    const slopeRatio = Math.tan(lightAngle * Math.PI / 180);

    for (let y = 0; y < height; y++) {
      shadowMap[y] = [];
      for (let x = 0; x < width; x++) {
        shadowMap[y][x] = this.isInShadow(x, y, dx, dy, slopeRatio);
      }
    }

    return shadowMap;
  }

  private isInShadow(
    gridX: number,
    gridY: number,
    lightDirX: number,
    lightDirY: number,
    slopeRatio: number
  ): boolean {
    const baseElev = this.getElevationAt(gridX, gridY) * ELEVATION_HEIGHT;
    const maxDist = 50;

    for (let dist = 1; dist <= maxDist; dist++) {
      const checkX = gridX - lightDirX * dist;
      const checkY = gridY - lightDirY * dist;
      const ix = Math.floor(checkX);
      const iy = Math.floor(checkY);

      if (!this.isValidGridPosition(ix, iy)) break;

      const checkElev = this.interpolateElevation(checkX, checkY);
      const requiredHeight = baseElev + dist * slopeRatio * ELEVATION_HEIGHT;

      if (checkElev > requiredHeight) {
        return true;
      }
    }

    return false;
  }

  public getFlowDirection(gridX: number, gridY: number): { dx: number; dy: number; steepness: number } | null {
    if (!this.isValidGridPosition(gridX, gridY)) return null;

    const currentElev = this.getElevationAt(gridX, gridY);
    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];

    let lowestNeighbor: { dx: number; dy: number; elev: number } | null = null;

    for (const n of neighbors) {
      const nx = gridX + n.dx;
      const ny = gridY + n.dy;
      if (!this.isValidGridPosition(nx, ny)) continue;

      const elev = this.getElevationAt(nx, ny);
      if (!lowestNeighbor || elev < lowestNeighbor.elev) {
        lowestNeighbor = { dx: n.dx, dy: n.dy, elev };
      }
    }

    if (!lowestNeighbor || lowestNeighbor.elev >= currentElev) {
      return { dx: 0, dy: 0, steepness: 0 };
    }

    const dist = Math.sqrt(lowestNeighbor.dx * lowestNeighbor.dx + lowestNeighbor.dy * lowestNeighbor.dy);
    const steepness = (currentElev - lowestNeighbor.elev) / dist;

    return {
      dx: lowestNeighbor.dx,
      dy: lowestNeighbor.dy,
      steepness
    };
  }

  public traceFlowPath(
    startX: number,
    startY: number,
    maxSteps: number = 1000
  ): Array<{ x: number; y: number; elevation: number }> {
    const path: Array<{ x: number; y: number; elevation: number }> = [];
    const visited = new Set<string>();

    let x = startX;
    let y = startY;

    for (let step = 0; step < maxSteps; step++) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);

      const elev = this.getElevationAt(x, y);
      path.push({ x, y, elevation: elev });

      const flow = this.getFlowDirection(x, y);
      if (!flow || (flow.dx === 0 && flow.dy === 0)) break;

      x += flow.dx;
      y += flow.dy;
    }

    return path;
  }

  public computeFlowAccumulation(): number[][] {
    const { width, height } = this.courseData;
    const accumulation: number[][] = [];

    for (let y = 0; y < height; y++) {
      accumulation[y] = new Array(width).fill(1);
    }

    const elevations: Array<{ x: number; y: number; elev: number }> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        elevations.push({ x, y, elev: this.getElevationAt(x, y) });
      }
    }

    elevations.sort((a, b) => b.elev - a.elev);

    for (const tile of elevations) {
      const flow = this.getFlowDirection(tile.x, tile.y);
      if (flow && (flow.dx !== 0 || flow.dy !== 0)) {
        const nx = tile.x + flow.dx;
        const ny = tile.y + flow.dy;
        if (this.isValidGridPosition(nx, ny)) {
          accumulation[ny][nx] += accumulation[tile.y][tile.x];
        }
      }
    }

    return accumulation;
  }

  public findDrainageSinks(): Array<{ x: number; y: number; elevation: number }> {
    const { width, height } = this.courseData;
    const sinks: Array<{ x: number; y: number; elevation: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const flow = this.getFlowDirection(x, y);
        if (flow && flow.dx === 0 && flow.dy === 0) {
          sinks.push({ x, y, elevation: this.getElevationAt(x, y) });
        }
      }
    }

    return sinks;
  }

  public findDrainageBasins(): Array<{
    sink: { x: number; y: number };
    tiles: Array<{ x: number; y: number }>;
    area: number;
  }> {
    const { width, height } = this.courseData;
    const sinks = this.findDrainageSinks();
    const basinMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      basinMap[y] = new Array(width).fill(-1);
    }

    for (let i = 0; i < sinks.length; i++) {
      basinMap[sinks[i].y][sinks[i].x] = i;
    }

    const elevations: Array<{ x: number; y: number; elev: number }> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        elevations.push({ x, y, elev: this.getElevationAt(x, y) });
      }
    }

    elevations.sort((a, b) => a.elev - b.elev);

    for (const tile of elevations) {
      if (basinMap[tile.y][tile.x] !== -1) continue;

      const flow = this.getFlowDirection(tile.x, tile.y);
      if (flow && (flow.dx !== 0 || flow.dy !== 0)) {
        const nx = tile.x + flow.dx;
        const ny = tile.y + flow.dy;
        if (this.isValidGridPosition(nx, ny) && basinMap[ny][nx] !== -1) {
          basinMap[tile.y][tile.x] = basinMap[ny][nx];
        }
      }
    }

    const basins: Array<{
      sink: { x: number; y: number };
      tiles: Array<{ x: number; y: number }>;
      area: number;
    }> = [];

    for (let i = 0; i < sinks.length; i++) {
      const tiles: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (basinMap[y][x] === i) {
            tiles.push({ x, y });
          }
        }
      }
      basins.push({
        sink: sinks[i],
        tiles,
        area: tiles.length
      });
    }

    return basins;
  }

  public getStreamNetwork(
    minAccumulation: number = 10
  ): Array<{ x: number; y: number; accumulation: number }> {
    const accumulation = this.computeFlowAccumulation();
    const { width, height } = this.courseData;
    const streams: Array<{ x: number; y: number; accumulation: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (accumulation[y][x] >= minAccumulation) {
          streams.push({ x, y, accumulation: accumulation[y][x] });
        }
      }
    }

    return streams;
  }

  public simulateWaterFlow(
    startX: number,
    startY: number,
    volume: number = 1,
    spreadFactor: number = 0.3
  ): number[][] {
    const { width, height } = this.courseData;
    const waterLevel: number[][] = [];

    for (let y = 0; y < height; y++) {
      waterLevel[y] = new Array(width).fill(0);
    }

    const queue: Array<{ x: number; y: number; vol: number }> = [{ x: startX, y: startY, vol: volume }];
    const processed = new Set<string>();

    while (queue.length > 0) {
      queue.sort((a, b) => this.getElevationAt(b.x, b.y) - this.getElevationAt(a.x, a.y));
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (processed.has(key)) continue;
      processed.add(key);

      waterLevel[current.y][current.x] += current.vol;

      if (current.vol < 0.01) continue;

      const neighbors = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
      ];

      const currentElev = this.getElevationAt(current.x, current.y);
      const lowerNeighbors: Array<{ x: number; y: number; drop: number }> = [];

      for (const n of neighbors) {
        const nx = current.x + n.dx;
        const ny = current.y + n.dy;
        if (!this.isValidGridPosition(nx, ny)) continue;

        const nElev = this.getElevationAt(nx, ny);
        if (nElev < currentElev) {
          lowerNeighbors.push({ x: nx, y: ny, drop: currentElev - nElev });
        }
      }

      if (lowerNeighbors.length > 0) {
        const totalDrop = lowerNeighbors.reduce((sum, n) => sum + n.drop, 0);
        const flowVolume = current.vol * (1 - spreadFactor);

        for (const n of lowerNeighbors) {
          const proportion = n.drop / totalDrop;
          queue.push({ x: n.x, y: n.y, vol: flowVolume * proportion });
        }
      }
    }

    return waterLevel;
  }

  public getDrainageStatistics(): {
    totalSinks: number;
    totalBasins: number;
    largestBasinArea: number;
    averageBasinArea: number;
    maxFlowAccumulation: number;
    streamNetworkLength: number;
  } {
    const sinks = this.findDrainageSinks();
    const basins = this.findDrainageBasins();
    const accumulation = this.computeFlowAccumulation();
    const streams = this.getStreamNetwork(10);

    const { width, height } = this.courseData;
    let maxAcc = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (accumulation[y][x] > maxAcc) {
          maxAcc = accumulation[y][x];
        }
      }
    }

    const largestBasin = basins.reduce((max, b) => b.area > max ? b.area : max, 0);
    const avgBasinArea = basins.length > 0 ? basins.reduce((sum, b) => sum + b.area, 0) / basins.length : 0;

    return {
      totalSinks: sinks.length,
      totalBasins: basins.length,
      largestBasinArea: largestBasin,
      averageBasinArea: avgBasinArea,
      maxFlowAccumulation: maxAcc,
      streamNetworkLength: streams.length
    };
  }

  public getSlopeAngle(gridX: number, gridY: number): number {
    const { width, height } = this.courseData;
    if (!this.isValidGridPosition(gridX, gridY)) return 0;

    const centerElev = this.getElevationAt(gridX, gridY);
    let dz_dx = 0;
    let dz_dy = 0;

    if (gridX > 0 && gridX < width - 1) {
      dz_dx = (this.getElevationAt(gridX + 1, gridY) - this.getElevationAt(gridX - 1, gridY)) / 2;
    } else if (gridX > 0) {
      dz_dx = centerElev - this.getElevationAt(gridX - 1, gridY);
    } else {
      dz_dx = this.getElevationAt(gridX + 1, gridY) - centerElev;
    }

    if (gridY > 0 && gridY < height - 1) {
      dz_dy = (this.getElevationAt(gridX, gridY + 1) - this.getElevationAt(gridX, gridY - 1)) / 2;
    } else if (gridY > 0) {
      dz_dy = centerElev - this.getElevationAt(gridX, gridY - 1);
    } else {
      dz_dy = this.getElevationAt(gridX, gridY + 1) - centerElev;
    }

    const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy) * ELEVATION_HEIGHT);
    return slopeRad * 180 / Math.PI;
  }

  public getAspect(gridX: number, gridY: number): number {
    const { width, height } = this.courseData;
    if (!this.isValidGridPosition(gridX, gridY)) return -1;

    const centerElev = this.getElevationAt(gridX, gridY);
    let dz_dx = 0;
    let dz_dy = 0;

    if (gridX > 0 && gridX < width - 1) {
      dz_dx = (this.getElevationAt(gridX + 1, gridY) - this.getElevationAt(gridX - 1, gridY)) / 2;
    } else if (gridX > 0) {
      dz_dx = centerElev - this.getElevationAt(gridX - 1, gridY);
    } else {
      dz_dx = this.getElevationAt(gridX + 1, gridY) - centerElev;
    }

    if (gridY > 0 && gridY < height - 1) {
      dz_dy = (this.getElevationAt(gridX, gridY + 1) - this.getElevationAt(gridX, gridY - 1)) / 2;
    } else if (gridY > 0) {
      dz_dy = centerElev - this.getElevationAt(gridX, gridY - 1);
    } else {
      dz_dy = this.getElevationAt(gridX, gridY + 1) - centerElev;
    }

    if (dz_dx === 0 && dz_dy === 0) return -1;

    let aspect = Math.atan2(-dz_dy, -dz_dx) * 180 / Math.PI;
    if (aspect < 0) aspect += 360;
    return aspect;
  }

  public getAspectDirection(gridX: number, gridY: number): string {
    const aspect = this.getAspect(gridX, gridY);
    if (aspect < 0) return 'flat';

    if (aspect >= 337.5 || aspect < 22.5) return 'E';
    if (aspect >= 22.5 && aspect < 67.5) return 'NE';
    if (aspect >= 67.5 && aspect < 112.5) return 'N';
    if (aspect >= 112.5 && aspect < 157.5) return 'NW';
    if (aspect >= 157.5 && aspect < 202.5) return 'W';
    if (aspect >= 202.5 && aspect < 247.5) return 'SW';
    if (aspect >= 247.5 && aspect < 292.5) return 'S';
    return 'SE';
  }

  public getCurvature(gridX: number, gridY: number): { plan: number; profile: number; total: number } {
    const { width, height } = this.courseData;
    if (!this.isValidGridPosition(gridX, gridY) || gridX < 1 || gridX >= width - 1 || gridY < 1 || gridY >= height - 1) {
      return { plan: 0, profile: 0, total: 0 };
    }

    const z = this.getElevationAt(gridX, gridY);
    const zN = this.getElevationAt(gridX, gridY - 1);
    const zS = this.getElevationAt(gridX, gridY + 1);
    const zE = this.getElevationAt(gridX + 1, gridY);
    const zW = this.getElevationAt(gridX - 1, gridY);
    const zNE = this.getElevationAt(gridX + 1, gridY - 1);
    const zNW = this.getElevationAt(gridX - 1, gridY - 1);
    const zSE = this.getElevationAt(gridX + 1, gridY + 1);
    const zSW = this.getElevationAt(gridX - 1, gridY + 1);

    const dz_dx = (zE - zW) / 2;
    const dz_dy = (zS - zN) / 2;
    const d2z_dx2 = zE - 2 * z + zW;
    const d2z_dy2 = zS - 2 * z + zN;
    const d2z_dxy = (zNE - zNW - zSE + zSW) / 4;

    const p = dz_dx * dz_dx + dz_dy * dz_dy;
    const q = p + 1;

    const plan = p > 0.00001 ?
      -(d2z_dx2 * dz_dy * dz_dy - 2 * d2z_dxy * dz_dx * dz_dy + d2z_dy2 * dz_dx * dz_dx) / (Math.pow(p, 1.5)) : 0;

    const profile = p > 0.00001 ?
      -(d2z_dx2 * dz_dx * dz_dx + 2 * d2z_dxy * dz_dx * dz_dy + d2z_dy2 * dz_dy * dz_dy) / (p * Math.pow(q, 1.5)) : 0;

    const total = d2z_dx2 + d2z_dy2;

    return { plan, profile, total };
  }

  public getSlopeClassification(gridX: number, gridY: number): string {
    const slopeAngle = this.getSlopeAngle(gridX, gridY);

    if (slopeAngle < 2) return 'flat';
    if (slopeAngle < 5) return 'gentle';
    if (slopeAngle < 15) return 'moderate';
    if (slopeAngle < 30) return 'steep';
    if (slopeAngle < 45) return 'very_steep';
    return 'extreme';
  }

  public computeSlopeMap(): number[][] {
    const { width, height } = this.courseData;
    const slopeMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      slopeMap[y] = [];
      for (let x = 0; x < width; x++) {
        slopeMap[y][x] = this.getSlopeAngle(x, y);
      }
    }

    return slopeMap;
  }

  public computeAspectMap(): number[][] {
    const { width, height } = this.courseData;
    const aspectMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      aspectMap[y] = [];
      for (let x = 0; x < width; x++) {
        aspectMap[y][x] = this.getAspect(x, y);
      }
    }

    return aspectMap;
  }

  public getSlopeAnalysis(): {
    minSlope: number;
    maxSlope: number;
    avgSlope: number;
    flatPercentage: number;
    gentlePercentage: number;
    moderatePercentage: number;
    steepPercentage: number;
  } {
    const { width, height } = this.courseData;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    const classifications: Record<string, number> = {
      flat: 0, gentle: 0, moderate: 0, steep: 0, very_steep: 0, extreme: 0
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const slope = this.getSlopeAngle(x, y);
        if (slope < min) min = slope;
        if (slope > max) max = slope;
        sum += slope;
        count++;
        classifications[this.getSlopeClassification(x, y)]++;
      }
    }

    const total = count || 1;
    return {
      minSlope: min === Infinity ? 0 : min,
      maxSlope: max === -Infinity ? 0 : max,
      avgSlope: sum / total,
      flatPercentage: (classifications.flat / total) * 100,
      gentlePercentage: (classifications.gentle / total) * 100,
      moderatePercentage: (classifications.moderate / total) * 100,
      steepPercentage: ((classifications.steep + classifications.very_steep + classifications.extreme) / total) * 100
    };
  }

  public findTilesWithSlopeInRange(
    minSlope: number,
    maxSlope: number
  ): Array<{ x: number; y: number; slope: number }> {
    const { width, height } = this.courseData;
    const result: Array<{ x: number; y: number; slope: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const slope = this.getSlopeAngle(x, y);
        if (slope >= minSlope && slope <= maxSlope) {
          result.push({ x, y, slope });
        }
      }
    }

    return result;
  }

  public findTilesByAspect(
    direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  ): Array<{ x: number; y: number; aspect: number }> {
    const { width, height } = this.courseData;
    const result: Array<{ x: number; y: number; aspect: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.getAspectDirection(x, y) === direction) {
          result.push({ x, y, aspect: this.getAspect(x, y) });
        }
      }
    }

    return result;
  }

  public mirrorTerrainHorizontal(): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < Math.floor(width / 2); x++) {
        const mirrorX = width - 1 - x;
        [elevation[y][x], elevation[y][mirrorX]] = [elevation[y][mirrorX], elevation[y][x]];
        [layout[y][x], layout[y][mirrorX]] = [layout[y][mirrorX], layout[y][x]];
        [this.mowedState[y][x], this.mowedState[y][mirrorX]] = [this.mowedState[y][mirrorX], this.mowedState[y][x]];
      }
    }

    this.rebuildAllTiles();
  }

  public mirrorTerrainVertical(): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    for (let y = 0; y < Math.floor(height / 2); y++) {
      const mirrorY = height - 1 - y;
      for (let x = 0; x < width; x++) {
        [elevation[y][x], elevation[mirrorY][x]] = [elevation[mirrorY][x], elevation[y][x]];
        [layout[y][x], layout[mirrorY][x]] = [layout[mirrorY][x], layout[y][x]];
        [this.mowedState[y][x], this.mowedState[mirrorY][x]] = [this.mowedState[mirrorY][x], this.mowedState[y][x]];
      }
    }

    this.rebuildAllTiles();
  }

  public mirrorAreaHorizontal(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    const areaWidth = maxX - minX + 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x < Math.floor(areaWidth / 2); x++) {
        const x1 = minX + x;
        const x2 = maxX - x;
        [elevation[y][x1], elevation[y][x2]] = [elevation[y][x2], elevation[y][x1]];
        [layout[y][x1], layout[y][x2]] = [layout[y][x2], layout[y][x1]];
        [this.mowedState[y][x1], this.mowedState[y][x2]] = [this.mowedState[y][x2], this.mowedState[y][x1]];
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
  }

  public mirrorAreaVertical(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    const areaHeight = maxY - minY + 1;
    for (let y = 0; y < Math.floor(areaHeight / 2); y++) {
      const y1 = minY + y;
      const y2 = maxY - y;
      for (let x = minX; x <= maxX; x++) {
        [elevation[y1][x], elevation[y2][x]] = [elevation[y2][x], elevation[y1][x]];
        [layout[y1][x], layout[y2][x]] = [layout[y2][x], layout[y1][x]];
        [this.mowedState[y1][x], this.mowedState[y2][x]] = [this.mowedState[y2][x], this.mowedState[y1][x]];
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
  }

  public rotateArea90CW(
    startX: number,
    startY: number,
    size: number
  ): boolean {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return false;

    const minX = Math.max(0, startX);
    const minY = Math.max(0, startY);
    const maxX = Math.min(width - 1, startX + size - 1);
    const maxY = Math.min(height - 1, startY + size - 1);

    if (maxX - minX !== maxY - minY) return false;

    const actualSize = maxX - minX + 1;
    const tempElev: number[][] = [];
    const tempLayout: number[][] = [];
    const tempMowed: boolean[][] = [];

    for (let y = 0; y < actualSize; y++) {
      tempElev[y] = [];
      tempLayout[y] = [];
      tempMowed[y] = [];
      for (let x = 0; x < actualSize; x++) {
        tempElev[y][x] = elevation[minY + y][minX + x];
        tempLayout[y][x] = layout[minY + y][minX + x];
        tempMowed[y][x] = this.mowedState[minY + y]?.[minX + x] ?? false;
      }
    }

    for (let y = 0; y < actualSize; y++) {
      for (let x = 0; x < actualSize; x++) {
        elevation[minY + x][minX + (actualSize - 1 - y)] = tempElev[y][x];
        layout[minY + x][minX + (actualSize - 1 - y)] = tempLayout[y][x];
        if (this.mowedState[minY + x]) {
          this.mowedState[minY + x][minX + (actualSize - 1 - y)] = tempMowed[y][x];
        }
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
    return true;
  }

  public rotateArea90CCW(
    startX: number,
    startY: number,
    size: number
  ): boolean {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return false;

    const minX = Math.max(0, startX);
    const minY = Math.max(0, startY);
    const maxX = Math.min(width - 1, startX + size - 1);
    const maxY = Math.min(height - 1, startY + size - 1);

    if (maxX - minX !== maxY - minY) return false;

    const actualSize = maxX - minX + 1;
    const tempElev: number[][] = [];
    const tempLayout: number[][] = [];
    const tempMowed: boolean[][] = [];

    for (let y = 0; y < actualSize; y++) {
      tempElev[y] = [];
      tempLayout[y] = [];
      tempMowed[y] = [];
      for (let x = 0; x < actualSize; x++) {
        tempElev[y][x] = elevation[minY + y][minX + x];
        tempLayout[y][x] = layout[minY + y][minX + x];
        tempMowed[y][x] = this.mowedState[minY + y]?.[minX + x] ?? false;
      }
    }

    for (let y = 0; y < actualSize; y++) {
      for (let x = 0; x < actualSize; x++) {
        elevation[minY + (actualSize - 1 - x)][minX + y] = tempElev[y][x];
        layout[minY + (actualSize - 1 - x)][minX + y] = tempLayout[y][x];
        if (this.mowedState[minY + (actualSize - 1 - x)]) {
          this.mowedState[minY + (actualSize - 1 - x)][minX + y] = tempMowed[y][x];
        }
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
    return true;
  }

  public rotateArea180(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    const areaWidth = maxX - minX + 1;
    const areaHeight = maxY - minY + 1;
    const totalTiles = areaWidth * areaHeight;

    for (let i = 0; i < Math.floor(totalTiles / 2); i++) {
      const y1 = minY + Math.floor(i / areaWidth);
      const x1 = minX + (i % areaWidth);
      const y2 = maxY - Math.floor(i / areaWidth);
      const x2 = maxX - (i % areaWidth);

      [elevation[y1][x1], elevation[y2][x2]] = [elevation[y2][x2], elevation[y1][x1]];
      [layout[y1][x1], layout[y2][x2]] = [layout[y2][x2], layout[y1][x1]];
      if (this.mowedState[y1] && this.mowedState[y2]) {
        [this.mowedState[y1][x1], this.mowedState[y2][x2]] = [this.mowedState[y2][x2], this.mowedState[y1][x1]];
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
  }

  public cutToClipboard(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    fillElevation: number = 0,
    fillTerrain: TerrainType = 'rough'
  ): boolean {
    if (!this.copyRegionToClipboard(startX, startY, endX, endY)) return false;

    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return true;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(height - 1, Math.max(startY, endY));

    const fillTerrainCode = getTerrainCode(fillTerrain);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        elevation[y][x] = fillElevation;
        layout[y][x] = fillTerrainCode;
        if (this.mowedState[y]) {
          this.mowedState[y][x] = false;
        }
      }
    }

    this.rebuildArea(minX, minY, maxX, maxY);
    return true;
  }

  public stampClipboardPattern(
    positions: Array<{ x: number; y: number }>,
    options?: { includeElevation?: boolean; includeMowed?: boolean; elevationOffset?: number }
  ): number {
    if (!this.clipboard) return 0;
    let totalPasted = 0;
    for (const pos of positions) {
      totalPasted += this.pasteFromClipboard(pos.x, pos.y, options);
    }
    return totalPasted;
  }

  public tileClipboardPattern(
    startX: number,
    startY: number,
    repeatX: number,
    repeatY: number,
    options?: { includeElevation?: boolean; includeMowed?: boolean; elevationOffset?: number }
  ): number {
    if (!this.clipboard) return 0;
    let totalPasted = 0;
    for (let ry = 0; ry < repeatY; ry++) {
      for (let rx = 0; rx < repeatX; rx++) {
        const targetX = startX + rx * this.clipboard.width;
        const targetY = startY + ry * this.clipboard.height;
        totalPasted += this.pasteFromClipboard(targetX, targetY, options);
      }
    }
    return totalPasted;
  }

  public blendClipboard(
    targetX: number,
    targetY: number,
    blendFactor: number = 0.5
  ): number {
    if (!this.clipboard) return 0;

    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const factor = Math.max(0, Math.min(1, blendFactor));
    let pastedCount = 0;
    const affectedMinX = Math.max(0, targetX);
    const affectedMinY = Math.max(0, targetY);
    const affectedMaxX = Math.min(width - 1, targetX + this.clipboard.width - 1);
    const affectedMaxY = Math.min(height - 1, targetY + this.clipboard.height - 1);

    for (const tile of this.clipboard.tiles) {
      const destX = targetX + tile.relativeX;
      const destY = targetY + tile.relativeY;

      if (destX < 0 || destX >= width || destY < 0 || destY >= height) continue;

      elevation[destY][destX] = Math.round(
        elevation[destY][destX] * (1 - factor) + tile.elevation * factor
      );
      pastedCount++;
    }

    if (pastedCount > 0) {
      this.rebuildArea(affectedMinX, affectedMinY, affectedMaxX, affectedMaxY);
    }

    return pastedCount;
  }

  public compareAreas(
    area1StartX: number,
    area1StartY: number,
    area1EndX: number,
    area1EndY: number,
    area2StartX: number,
    area2StartY: number
  ): TerrainComparison {
    const { width, height, elevation, layout } = this.courseData;
    const result: TerrainComparison = {
      identical: true,
      elevationDifferences: 0,
      terrainDifferences: 0,
      maxElevationDiff: 0,
      avgElevationDiff: 0
    };

    if (!elevation) return result;

    const minX1 = Math.max(0, Math.min(area1StartX, area1EndX));
    const maxX1 = Math.min(width - 1, Math.max(area1StartX, area1EndX));
    const minY1 = Math.max(0, Math.min(area1StartY, area1EndY));
    const maxY1 = Math.min(height - 1, Math.max(area1StartY, area1EndY));

    const areaWidth = maxX1 - minX1 + 1;
    const areaHeight = maxY1 - minY1 + 1;

    let totalElevationDiff = 0;
    let compareCount = 0;

    for (let y = 0; y < areaHeight; y++) {
      for (let x = 0; x < areaWidth; x++) {
        const src1X = minX1 + x;
        const src1Y = minY1 + y;
        const src2X = area2StartX + x;
        const src2Y = area2StartY + y;

        if (src2X < 0 || src2X >= width || src2Y < 0 || src2Y >= height) continue;

        const elevDiff = Math.abs(elevation[src1Y][src1X] - elevation[src2Y][src2X]);
        if (elevDiff > 0) {
          result.elevationDifferences++;
          result.identical = false;
          totalElevationDiff += elevDiff;
          result.maxElevationDiff = Math.max(result.maxElevationDiff, elevDiff);
        }

        if (layout[src1Y][src1X] !== layout[src2Y][src2X]) {
          result.terrainDifferences++;
          result.identical = false;
        }

        compareCount++;
      }
    }

    if (compareCount > 0) {
      result.avgElevationDiff = totalElevationDiff / compareCount;
    }

    return result;
  }

  public findPeaks(minProminence: number = 1): Array<{ x: number; y: number; elevation: number; prominence: number }> {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const peaks: Array<{ x: number; y: number; elevation: number; prominence: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerElev = elevation[y][x];
        let isPeak = true;
        let minNeighbor = centerElev;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighborElev = elevation[y + dy][x + dx];
            if (neighborElev >= centerElev) {
              isPeak = false;
              break;
            }
            minNeighbor = Math.min(minNeighbor, neighborElev);
          }
          if (!isPeak) break;
        }

        if (isPeak) {
          const prominence = centerElev - minNeighbor;
          if (prominence >= minProminence) {
            peaks.push({ x, y, elevation: centerElev, prominence });
          }
        }
      }
    }

    return peaks.sort((a, b) => b.elevation - a.elevation);
  }

  public findValleys(minDepth: number = 1): Array<{ x: number; y: number; elevation: number; depth: number }> {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const valleys: Array<{ x: number; y: number; elevation: number; depth: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerElev = elevation[y][x];
        let isValley = true;
        let maxNeighbor = centerElev;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighborElev = elevation[y + dy][x + dx];
            if (neighborElev <= centerElev) {
              isValley = false;
              break;
            }
            maxNeighbor = Math.max(maxNeighbor, neighborElev);
          }
          if (!isValley) break;
        }

        if (isValley) {
          const depth = maxNeighbor - centerElev;
          if (depth >= minDepth) {
            valleys.push({ x, y, elevation: centerElev, depth });
          }
        }
      }
    }

    return valleys.sort((a, b) => a.elevation - b.elevation);
  }

  public findSaddlePoints(): Array<{ x: number; y: number; elevation: number; passes: Array<{ dir: string; lowerElev: number }> }> {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const saddles: Array<{ x: number; y: number; elevation: number; passes: Array<{ dir: string; lowerElev: number }> }> = [];
    const directions = [
      { dx: 0, dy: -1, name: 'N' },
      { dx: 1, dy: 0, name: 'E' },
      { dx: 0, dy: 1, name: 'S' },
      { dx: -1, dy: 0, name: 'W' }
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerElev = elevation[y][x];
        const neighborElevs = directions.map(d => ({
          dir: d.name,
          elev: elevation[y + d.dy][x + d.dx]
        }));

        let higherCount = 0;
        let lowerCount = 0;
        const transitions: boolean[] = [];
        const lowerPasses: Array<{ dir: string; lowerElev: number }> = [];

        for (let i = 0; i < 4; i++) {
          if (neighborElevs[i].elev > centerElev) higherCount++;
          else if (neighborElevs[i].elev < centerElev) {
            lowerCount++;
            lowerPasses.push({ dir: neighborElevs[i].dir, lowerElev: neighborElevs[i].elev });
          }
          const nextI = (i + 1) % 4;
          const isHigher = neighborElevs[i].elev > centerElev;
          const nextIsHigher = neighborElevs[nextI].elev > centerElev;
          transitions.push(isHigher !== nextIsHigher);
        }

        const transitionCount = transitions.filter(t => t).length;

        if (transitionCount >= 4 && higherCount >= 2 && lowerCount >= 2) {
          saddles.push({ x, y, elevation: centerElev, passes: lowerPasses });
        }
      }
    }

    return saddles;
  }

  public findRidgeLines(): Array<Array<{ x: number; y: number; elevation: number }>> {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const ridgePoints = new Set<string>();

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerElev = elevation[y][x];
        const nsMin = Math.min(elevation[y - 1][x], elevation[y + 1][x]);
        const ewMin = Math.min(elevation[y][x - 1], elevation[y][x + 1]);

        if ((centerElev > nsMin && centerElev >= ewMin) || (centerElev >= nsMin && centerElev > ewMin)) {
          const avgNeighbor = (elevation[y - 1][x] + elevation[y + 1][x] + elevation[y][x - 1] + elevation[y][x + 1]) / 4;
          if (centerElev >= avgNeighbor) {
            ridgePoints.add(`${x},${y}`);
          }
        }
      }
    }

    const ridgeLines: Array<Array<{ x: number; y: number; elevation: number }>> = [];
    const visited = new Set<string>();

    for (const point of ridgePoints) {
      if (visited.has(point)) continue;

      const [startX, startY] = point.split(',').map(Number);
      const line: Array<{ x: number; y: number; elevation: number }> = [];
      const queue = [{ x: startX, y: startY }];
      visited.add(point);

      while (queue.length > 0) {
        const current = queue.shift()!;
        line.push({ x: current.x, y: current.y, elevation: elevation[current.y][current.x] });

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;
            if (ridgePoints.has(key) && !visited.has(key)) {
              visited.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      if (line.length >= 3) {
        ridgeLines.push(line);
      }
    }

    return ridgeLines.sort((a, b) => b.length - a.length);
  }

  public findValleyLines(): Array<Array<{ x: number; y: number; elevation: number }>> {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const valleyPoints = new Set<string>();

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerElev = elevation[y][x];
        const nsMax = Math.max(elevation[y - 1][x], elevation[y + 1][x]);
        const ewMax = Math.max(elevation[y][x - 1], elevation[y][x + 1]);

        if ((centerElev < nsMax && centerElev <= ewMax) || (centerElev <= nsMax && centerElev < ewMax)) {
          const avgNeighbor = (elevation[y - 1][x] + elevation[y + 1][x] + elevation[y][x - 1] + elevation[y][x + 1]) / 4;
          if (centerElev <= avgNeighbor) {
            valleyPoints.add(`${x},${y}`);
          }
        }
      }
    }

    const valleyLines: Array<Array<{ x: number; y: number; elevation: number }>> = [];
    const visited = new Set<string>();

    for (const point of valleyPoints) {
      if (visited.has(point)) continue;

      const [startX, startY] = point.split(',').map(Number);
      const line: Array<{ x: number; y: number; elevation: number }> = [];
      const queue = [{ x: startX, y: startY }];
      visited.add(point);

      while (queue.length > 0) {
        const current = queue.shift()!;
        line.push({ x: current.x, y: current.y, elevation: elevation[current.y][current.x] });

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = current.x + dx;
            const ny = current.y + dy;
            const key = `${nx},${ny}`;
            if (valleyPoints.has(key) && !visited.has(key)) {
              visited.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      if (line.length >= 3) {
        valleyLines.push(line);
      }
    }

    return valleyLines.sort((a, b) => b.length - a.length);
  }

  public classifyTerrainFeatures(): TerrainFeatureClassification {
    const peaks = this.findPeaks(1);
    const valleys = this.findValleys(1);
    const saddles = this.findSaddlePoints();
    const ridges = this.findRidgeLines();
    const valleyLines = this.findValleyLines();

    return {
      peaks,
      valleys,
      saddles,
      ridgeLines: ridges,
      valleyLines,
      peakCount: peaks.length,
      valleyCount: valleys.length,
      saddleCount: saddles.length,
      ridgeLineCount: ridges.length,
      valleyLineCount: valleyLines.length,
      totalRidgeLength: ridges.reduce((sum, r) => sum + r.length, 0),
      totalValleyLength: valleyLines.reduce((sum, v) => sum + v.length, 0)
    };
  }

  public getLocalRoughness(gridX: number, gridY: number, radius: number = 1): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const centerElev = elevation[gridY]?.[gridX] ?? 0;
    let sumSquaredDiff = 0;
    let count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const diff = elevation[ny][nx] - centerElev;
        sumSquaredDiff += diff * diff;
        count++;
      }
    }

    return count > 0 ? Math.sqrt(sumSquaredDiff / count) : 0;
  }

  public computeRoughnessMap(radius: number = 1): number[][] {
    const { width, height } = this.courseData;
    const roughnessMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      roughnessMap[y] = [];
      for (let x = 0; x < width; x++) {
        roughnessMap[y][x] = this.getLocalRoughness(x, y, radius);
      }
    }

    return roughnessMap;
  }

  public getRugosityIndex(gridX: number, gridY: number, windowSize: number = 3): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 1;

    const halfSize = Math.floor(windowSize / 2);
    let surfaceArea = 0;
    let projectedArea = 0;

    for (let dy = -halfSize; dy < halfSize; dy++) {
      for (let dx = -halfSize; dx < halfSize; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;
        if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) continue;

        const e00 = elevation[y][x];
        const e10 = elevation[y][x + 1];
        const e01 = elevation[y + 1][x];

        const dx1 = 1;
        const dy1 = 0;
        const dz1 = (e10 - e00) * ELEVATION_HEIGHT;
        const dx2 = 0;
        const dy2 = 1;
        const dz2 = (e01 - e00) * ELEVATION_HEIGHT;

        const crossX = dy1 * dz2 - dz1 * dy2;
        const crossY = dz1 * dx2 - dx1 * dz2;
        const crossZ = dx1 * dy2 - dy1 * dx2;

        surfaceArea += Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) * 0.5;
        projectedArea += 0.5;
      }
    }

    return projectedArea > 0 ? surfaceArea / projectedArea : 1;
  }

  public computeRugosityMap(windowSize: number = 3): number[][] {
    const { width, height } = this.courseData;
    const rugosityMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      rugosityMap[y] = [];
      for (let x = 0; x < width; x++) {
        rugosityMap[y][x] = this.getRugosityIndex(x, y, windowSize);
      }
    }

    return rugosityMap;
  }

  public getTerrainSmoothness(gridX: number, gridY: number, radius: number = 2): number {
    const roughness = this.getLocalRoughness(gridX, gridY, radius);
    return 1 / (1 + roughness);
  }

  public getSurfaceRoughnessAnalysis(): SurfaceRoughnessAnalysis {
    const { width, height, elevation } = this.courseData;
    if (!elevation) {
      return {
        minRoughness: 0,
        maxRoughness: 0,
        avgRoughness: 0,
        stdDevRoughness: 0,
        smoothTileCount: 0,
        roughTileCount: 0,
        veryRoughTileCount: 0,
        avgRugosity: 1,
        terrainComplexity: 0
      };
    }

    const roughnessValues: number[] = [];
    let totalRugosity = 0;
    let rugosityCount = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        roughnessValues.push(this.getLocalRoughness(x, y, 1));
        totalRugosity += this.getRugosityIndex(x, y, 3);
        rugosityCount++;
      }
    }

    const minRoughness = Math.min(...roughnessValues);
    const maxRoughness = Math.max(...roughnessValues);
    const avgRoughness = roughnessValues.reduce((a, b) => a + b, 0) / roughnessValues.length;

    const variance = roughnessValues.reduce((sum, r) => sum + Math.pow(r - avgRoughness, 2), 0) / roughnessValues.length;
    const stdDevRoughness = Math.sqrt(variance);

    const smoothTileCount = roughnessValues.filter(r => r < 0.5).length;
    const roughTileCount = roughnessValues.filter(r => r >= 0.5 && r < 1.5).length;
    const veryRoughTileCount = roughnessValues.filter(r => r >= 1.5).length;

    const avgRugosity = rugosityCount > 0 ? totalRugosity / rugosityCount : 1;

    const terrainComplexity = avgRoughness * avgRugosity * (1 + stdDevRoughness / (avgRoughness + 0.001));

    return {
      minRoughness,
      maxRoughness,
      avgRoughness,
      stdDevRoughness,
      smoothTileCount,
      roughTileCount,
      veryRoughTileCount,
      avgRugosity,
      terrainComplexity
    };
  }

  public findSmoothestArea(minSize: number = 5): { x: number; y: number; width: number; height: number; avgRoughness: number } | null {
    const { width, height, elevation } = this.courseData;
    if (!elevation || minSize > width || minSize > height) return null;

    let bestArea: { x: number; y: number; width: number; height: number; avgRoughness: number } | null = null;
    let bestRoughness = Infinity;

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let totalRoughness = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            totalRoughness += this.getLocalRoughness(x + dx, y + dy, 1);
            count++;
          }
        }

        const avgRoughness = totalRoughness / count;
        if (avgRoughness < bestRoughness) {
          bestRoughness = avgRoughness;
          bestArea = { x, y, width: minSize, height: minSize, avgRoughness };
        }
      }
    }

    return bestArea;
  }

  public findRoughestArea(minSize: number = 5): { x: number; y: number; width: number; height: number; avgRoughness: number } | null {
    const { width, height, elevation } = this.courseData;
    if (!elevation || minSize > width || minSize > height) return null;

    let bestArea: { x: number; y: number; width: number; height: number; avgRoughness: number } | null = null;
    let bestRoughness = -Infinity;

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let totalRoughness = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            totalRoughness += this.getLocalRoughness(x + dx, y + dy, 1);
            count++;
          }
        }

        const avgRoughness = totalRoughness / count;
        if (avgRoughness > bestRoughness) {
          bestRoughness = avgRoughness;
          bestArea = { x, y, width: minSize, height: minSize, avgRoughness };
        }
      }
    }

    return bestArea;
  }

  private rebuildAllTiles(): void {
    for (const mesh of this.tileMeshes) {
      mesh.dispose();
    }
    this.tileMeshes = [];
    this.tileMap.clear();
    this.faceIdToMetadata.clear();
    this.gridToFaceIds.clear();
    this.buildTiles();
    this.buildCliffFacesForAll();
    this.buildGridLines();
  }

  private buildCliffFacesForAll(): void {
    const { width, height, elevation, layout } = this.courseData;
    if (!elevation) return;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = elevation[y][x];
        const terrainType = layout[y][x];
        this.createCliffFaces(x, y, elev, terrainType);
      }
    }
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

  public setSelectionBrushRadius(radius: number): void {
    this.selection.brushRadius = Math.max(1, radius);
  }

  public getSelectionBrushRadius(): number {
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

  public setBrushEnabled(enabled: boolean): void {
    this.brushEnabled = enabled;
    if (!enabled) {
      this.brush.isActive = false;
    }
  }

  public isBrushEnabled(): boolean {
    return this.brushEnabled;
  }

  public setBrushShape(shape: BrushShape): void {
    this.brush.shape = shape;
  }

  public getBrushShape(): BrushShape {
    return this.brush.shape;
  }

  public setBrushOperation(operation: BrushOperation): void {
    this.brush.operation = operation;
  }

  public getBrushOperation(): BrushOperation {
    return this.brush.operation;
  }

  public setBrushRadius(radius: number): void {
    this.brush.radius = Math.max(1, Math.min(50, radius));
  }

  public getBrushRadius(): number {
    return this.brush.radius;
  }

  public setBrushStrength(strength: number): void {
    this.brush.strength = Math.max(0.1, Math.min(10, strength));
  }

  public getBrushStrength(): number {
    return this.brush.strength;
  }

  public setBrushFalloff(falloff: number): void {
    this.brush.falloff = Math.max(0, Math.min(1, falloff));
  }

  public getBrushFalloff(): number {
    return this.brush.falloff;
  }

  public getBrushConfig(): TerrainBrush {
    return { ...this.brush };
  }

  public getTilesInBrushShape(centerX: number, centerY: number): Array<{ x: number; y: number; weight: number }> {
    const tiles: Array<{ x: number; y: number; weight: number }> = [];
    const { width, height } = this.courseData;
    const radius = this.brush.radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        let inShape = false;
        let distance = 0;

        switch (this.brush.shape) {
          case 'circle':
            distance = Math.sqrt(dx * dx + dy * dy);
            inShape = distance <= radius;
            break;
          case 'square':
            distance = Math.max(Math.abs(dx), Math.abs(dy));
            inShape = distance <= radius;
            break;
          case 'diamond':
            distance = Math.abs(dx) + Math.abs(dy);
            inShape = distance <= radius;
            break;
        }

        if (inShape) {
          const normalizedDistance = distance / radius;
          const weight = 1 - normalizedDistance * this.brush.falloff;
          tiles.push({ x, y, weight: Math.max(0, weight) });
        }
      }
    }

    return tiles;
  }

  public applyBrush(centerX: number, centerY: number): void {
    if (!this.brushEnabled) return;

    const tiles = this.getTilesInBrushShape(centerX, centerY);
    if (tiles.length === 0) return;

    if (this.historyEnabled) {
      this.beginBatch(`Brush ${this.brush.operation} at (${centerX}, ${centerY})`);
    }

    switch (this.brush.operation) {
      case 'raise':
        this.applyRaiseBrush(tiles);
        break;
      case 'lower':
        this.applyLowerBrush(tiles);
        break;
      case 'smooth':
        this.applySmoothBrush(tiles);
        break;
      case 'flatten':
        this.applyFlattenBrush(tiles, centerX, centerY);
        break;
      case 'noise':
        this.applyNoiseBrush(tiles);
        break;
      case 'mow':
        this.applyMowBrush(tiles);
        break;
      case 'unmow':
        this.applyUnmowBrush(tiles);
        break;
    }

    if (this.historyEnabled) {
      this.endBatch();
    }
  }

  private applyRaiseBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    for (const tile of tiles) {
      const currentElev = this.getElevationAt(tile.x, tile.y);
      const delta = this.brush.strength * tile.weight;
      const newElev = currentElev + delta;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, newElev);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, newElev);
      }
    }
  }

  private applyLowerBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    for (const tile of tiles) {
      const currentElev = this.getElevationAt(tile.x, tile.y);
      const delta = this.brush.strength * tile.weight;
      const newElev = currentElev - delta;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, newElev);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, newElev);
      }
    }
  }

  private applySmoothBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    const elevations: Map<string, number> = new Map();

    for (const tile of tiles) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const elev = this.getElevationAt(tile.x + dx, tile.y + dy);
          sum += elev;
          count++;
        }
      }
      const avg = sum / count;
      elevations.set(`${tile.x}_${tile.y}`, avg);
    }

    for (const tile of tiles) {
      const key = `${tile.x}_${tile.y}`;
      const targetElev = elevations.get(key)!;
      const currentElev = this.getElevationAt(tile.x, tile.y);
      const blendedElev = currentElev + (targetElev - currentElev) * this.brush.strength * tile.weight;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, blendedElev);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, blendedElev);
      }
    }
  }

  private applyFlattenBrush(tiles: Array<{ x: number; y: number; weight: number }>, centerX: number, centerY: number): void {
    const targetElev = this.getElevationAt(centerX, centerY);

    for (const tile of tiles) {
      const currentElev = this.getElevationAt(tile.x, tile.y);
      const blendedElev = currentElev + (targetElev - currentElev) * this.brush.strength * tile.weight;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, blendedElev);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, blendedElev);
      }
    }
  }

  private applyNoiseBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    for (const tile of tiles) {
      const currentElev = this.getElevationAt(tile.x, tile.y);
      const noise = (Math.random() - 0.5) * 2 * this.brush.strength * tile.weight;
      const newElev = currentElev + noise;
      if (this.historyEnabled) {
        this.setElevationWithHistory(tile.x, tile.y, newElev);
      } else {
        this.setElevationAtInternal(tile.x, tile.y, newElev);
      }
    }
  }

  private applyMowBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    for (const tile of tiles) {
      if (this.historyEnabled) {
        this.setMowedWithHistory(tile.x, tile.y, true);
      } else {
        this.setMowed(tile.x, tile.y, true);
      }
    }
  }

  private applyUnmowBrush(tiles: Array<{ x: number; y: number; weight: number }>): void {
    for (const tile of tiles) {
      if (this.historyEnabled) {
        this.setMowedWithHistory(tile.x, tile.y, false);
      } else {
        this.setMowed(tile.x, tile.y, false);
      }
    }
  }

  public startBrushStroke(): void {
    if (!this.brushEnabled) return;
    this.brush.isActive = true;
    if (this.historyEnabled) {
      this.beginBatch(`Brush stroke: ${this.brush.operation}`);
    }
  }

  public continueBrushStroke(centerX: number, centerY: number): void {
    if (!this.brush.isActive) return;

    const tiles = this.getTilesInBrushShape(centerX, centerY);
    if (tiles.length === 0) return;

    switch (this.brush.operation) {
      case 'raise':
        this.applyRaiseBrush(tiles);
        break;
      case 'lower':
        this.applyLowerBrush(tiles);
        break;
      case 'smooth':
        this.applySmoothBrush(tiles);
        break;
      case 'flatten':
        this.applyFlattenBrush(tiles, centerX, centerY);
        break;
      case 'noise':
        this.applyNoiseBrush(tiles);
        break;
      case 'mow':
        this.applyMowBrush(tiles);
        break;
      case 'unmow':
        this.applyUnmowBrush(tiles);
        break;
    }
  }

  public endBrushStroke(): void {
    if (!this.brush.isActive) return;
    this.brush.isActive = false;
    if (this.historyEnabled) {
      this.endBatch();
    }
  }

  public isBrushStrokeActive(): boolean {
    return this.brush.isActive;
  }

  public getBrushPreview(centerX: number, centerY: number): Array<{ x: number; y: number; weight: number }> {
    return this.getTilesInBrushShape(centerX, centerY);
  }

  public setCullingEnabled(enabled: boolean): void {
    this.culling.enabled = enabled;
    if (!enabled) {
      this.resetCullingAndShowAll();
    }
  }

  public isCullingEnabled(): boolean {
    return this.culling.enabled;
  }

  public setCullingPadding(padding: number): void {
    this.culling.padding = Math.max(0, Math.min(50, padding));
  }

  public getCullingPadding(): number {
    return this.culling.padding;
  }

  public setCullingUpdateInterval(interval: number): void {
    this.culling.updateInterval = Math.max(16, interval);
  }

  public getCullingUpdateInterval(): number {
    return this.culling.updateInterval;
  }

  public getCullingStatistics(): { visible: number; hidden: number; total: number; percentage: number } {
    return {
      visible: this.culling.visibleTileCount,
      hidden: this.culling.hiddenTileCount,
      total: this.culling.visibleTileCount + this.culling.hiddenTileCount,
      percentage: this.culling.visibleTileCount / Math.max(1, this.culling.visibleTileCount + this.culling.hiddenTileCount) * 100
    };
  }

  public getViewportBounds(): ViewportBounds | null {
    return this.lastViewportBounds;
  }

  public updateCulling(viewportMinX: number, viewportMinY: number, viewportMaxX: number, viewportMaxY: number): void {
    if (!this.culling.enabled) return;

    const now = Date.now();
    if (now - this.culling.lastUpdate < this.culling.updateInterval) return;
    this.culling.lastUpdate = now;

    const padding = this.culling.padding;
    const bounds: ViewportBounds = {
      minX: Math.floor(viewportMinX - padding),
      maxX: Math.ceil(viewportMaxX + padding),
      minY: Math.floor(viewportMinY - padding),
      maxY: Math.ceil(viewportMaxY + padding)
    };

    if (this.lastViewportBounds &&
        bounds.minX === this.lastViewportBounds.minX &&
        bounds.maxX === this.lastViewportBounds.maxX &&
        bounds.minY === this.lastViewportBounds.minY &&
        bounds.maxY === this.lastViewportBounds.maxY) {
      return;
    }

    this.lastViewportBounds = bounds;
    this.applyCulling(bounds);
  }

  private applyCulling(bounds: ViewportBounds): void {
    let visible = 0;
    let hidden = 0;

    for (const [key, mesh] of this.tileMap) {
      const [x, y] = key.split('_').map(Number);
      const isVisible = x >= bounds.minX && x <= bounds.maxX &&
                        y >= bounds.minY && y <= bounds.maxY;

      if (isVisible) {
        mesh.setEnabled(true);
        visible++;
      } else {
        mesh.setEnabled(false);
        hidden++;
      }
    }

    this.culling.visibleTileCount = visible;
    this.culling.hiddenTileCount = hidden;
  }

  public resetCullingAndShowAll(): void {
    for (const mesh of this.tileMap.values()) {
      mesh.setEnabled(true);
    }
    this.culling.visibleTileCount = this.tileMap.size;
    this.culling.hiddenTileCount = 0;
    this.lastViewportBounds = null;
  }

  public hideAllForCulling(): void {
    for (const mesh of this.tileMap.values()) {
      mesh.setEnabled(false);
    }
    this.culling.visibleTileCount = 0;
    this.culling.hiddenTileCount = this.tileMap.size;
  }

  public setTileVisibility(gridX: number, gridY: number, visible: boolean): void {
    const key = `${gridX}_${gridY}`;
    const mesh = this.tileMap.get(key);
    if (mesh) {
      mesh.setEnabled(visible);
    }
  }

  public isTileVisibleInViewport(gridX: number, gridY: number): boolean {
    if (!this.lastViewportBounds) return true;
    return gridX >= this.lastViewportBounds.minX &&
           gridX <= this.lastViewportBounds.maxX &&
           gridY >= this.lastViewportBounds.minY &&
           gridY <= this.lastViewportBounds.maxY;
  }

  public getTilesInViewport(): Array<{ x: number; y: number }> {
    if (!this.lastViewportBounds) {
      const tiles: Array<{ x: number; y: number }> = [];
      for (const key of this.tileMap.keys()) {
        const [x, y] = key.split('_').map(Number);
        tiles.push({ x, y });
      }
      return tiles;
    }

    const tiles: Array<{ x: number; y: number }> = [];
    const { width, height } = this.courseData;
    const { minX, maxX, minY, maxY } = this.lastViewportBounds;

    for (let y = Math.max(0, minY); y <= Math.min(height - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(width - 1, maxX); x++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  public forceUpdateCulling(viewportMinX: number, viewportMinY: number, viewportMaxX: number, viewportMaxY: number): void {
    if (!this.culling.enabled) return;

    const padding = this.culling.padding;
    const bounds: ViewportBounds = {
      minX: Math.floor(viewportMinX - padding),
      maxX: Math.ceil(viewportMaxX + padding),
      minY: Math.floor(viewportMinY - padding),
      maxY: Math.ceil(viewportMaxY + padding)
    };

    this.lastViewportBounds = bounds;
    this.culling.lastUpdate = Date.now();
    this.applyCulling(bounds);
  }

  public getCullingVisibleCount(): number {
    return this.culling.visibleTileCount;
  }

  public getCullingHiddenCount(): number {
    return this.culling.hiddenTileCount;
  }

  public estimateViewportFromCamera(cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): ViewportBounds {
    const halfWidth = viewWidth / 2;
    const halfHeight = viewHeight / 2;

    return {
      minX: Math.floor(cameraX - halfWidth),
      maxX: Math.ceil(cameraX + halfWidth),
      minY: Math.floor(cameraY - halfHeight),
      maxY: Math.ceil(cameraY + halfHeight)
    };
  }

  public copySelectedToClipboard(): boolean {
    const selectedTiles = this.getSelectedTiles();
    if (selectedTiles.length === 0) return false;

    const bounds = this.getSelectionBounds();
    if (!bounds) return false;

    const tiles: ClipboardTileData[] = [];
    const { layout, elevation } = this.courseData;

    for (const tile of selectedTiles) {
      const tileData: ClipboardTileData = {
        relativeX: tile.x - bounds.minX,
        relativeY: tile.y - bounds.minY,
        elevation: elevation?.[tile.y]?.[tile.x] ?? 0,
        terrainCode: layout[tile.y]?.[tile.x] ?? 0,
        mowed: this.isMowed(tile.x, tile.y),
        cornerHeights: this.getCornerHeights(tile.x, tile.y)
      };
      tiles.push(tileData);
    }

    this.clipboard = {
      tiles,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
      sourceMinX: bounds.minX,
      sourceMinY: bounds.minY,
      timestamp: Date.now()
    };

    return true;
  }

  public copyRegionToClipboard(minX: number, minY: number, maxX: number, maxY: number): boolean {
    const { width, height, layout, elevation } = this.courseData;

    const clampedMinX = Math.max(0, minX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxX = Math.min(width - 1, maxX);
    const clampedMaxY = Math.min(height - 1, maxY);

    if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) return false;

    const tiles: ClipboardTileData[] = [];

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const tileData: ClipboardTileData = {
          relativeX: x - clampedMinX,
          relativeY: y - clampedMinY,
          elevation: elevation?.[y]?.[x] ?? 0,
          terrainCode: layout[y]?.[x] ?? 0,
          mowed: this.isMowed(x, y),
          cornerHeights: this.getCornerHeights(x, y)
        };
        tiles.push(tileData);
      }
    }

    this.clipboard = {
      tiles,
      width: clampedMaxX - clampedMinX + 1,
      height: clampedMaxY - clampedMinY + 1,
      sourceMinX: clampedMinX,
      sourceMinY: clampedMinY,
      timestamp: Date.now()
    };

    return true;
  }

  public hasClipboard(): boolean {
    return this.clipboard !== null && this.clipboard.tiles.length > 0;
  }

  public getClipboardSize(): { width: number; height: number; tileCount: number } | null {
    if (!this.clipboard) return null;
    return {
      width: this.clipboard.width,
      height: this.clipboard.height,
      tileCount: this.clipboard.tiles.length
    };
  }

  public clearClipboard(): void {
    this.clipboard = null;
  }

  public pasteFromClipboard(destX: number, destY: number, options?: {
    includeElevation?: boolean;
    includeMowed?: boolean;
    elevationOffset?: number;
  }): number {
    if (!this.clipboard) return 0;

    const { width, height } = this.courseData;
    const includeElevation = options?.includeElevation ?? true;
    const includeMowed = options?.includeMowed ?? true;
    const elevationOffset = options?.elevationOffset ?? 0;

    if (this.historyEnabled) {
      this.beginBatch(`Paste ${this.clipboard.tiles.length} tiles at (${destX}, ${destY})`);
    }

    let pastedCount = 0;

    for (const tile of this.clipboard.tiles) {
      const targetX = destX + tile.relativeX;
      const targetY = destY + tile.relativeY;

      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

      if (includeElevation) {
        const newElevation = tile.elevation + elevationOffset;
        if (this.historyEnabled) {
          this.setElevationWithHistory(targetX, targetY, newElevation);
        } else {
          this.setElevationAtInternal(targetX, targetY, newElevation);
        }
      }

      if (includeMowed) {
        if (this.historyEnabled) {
          this.setMowedWithHistory(targetX, targetY, tile.mowed);
        } else {
          this.setMowed(targetX, targetY, tile.mowed);
        }
      }

      pastedCount++;
    }

    if (this.historyEnabled) {
      this.endBatch();
    }

    return pastedCount;
  }

  public getPastePreview(destX: number, destY: number): Array<{ x: number; y: number; valid: boolean }> {
    if (!this.clipboard) return [];

    const { width, height } = this.courseData;
    const preview: Array<{ x: number; y: number; valid: boolean }> = [];

    for (const tile of this.clipboard.tiles) {
      const targetX = destX + tile.relativeX;
      const targetY = destY + tile.relativeY;
      const valid = targetX >= 0 && targetX < width && targetY >= 0 && targetY < height;
      preview.push({ x: targetX, y: targetY, valid });
    }

    return preview;
  }

  public canPasteAt(destX: number, destY: number): { canPaste: boolean; validCount: number; invalidCount: number } {
    if (!this.clipboard) return { canPaste: false, validCount: 0, invalidCount: 0 };

    const { width, height } = this.courseData;
    let validCount = 0;
    let invalidCount = 0;

    for (const tile of this.clipboard.tiles) {
      const targetX = destX + tile.relativeX;
      const targetY = destY + tile.relativeY;
      if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    return {
      canPaste: validCount > 0,
      validCount,
      invalidCount
    };
  }

  public getClipboardData(): TerrainClipboard | null {
    return this.clipboard ? { ...this.clipboard, tiles: [...this.clipboard.tiles] } : null;
  }

  public setClipboardData(data: TerrainClipboard): void {
    this.clipboard = { ...data, tiles: [...data.tiles] };
  }

  public duplicateSelection(offsetX: number, offsetY: number): number {
    if (!this.copySelectedToClipboard()) return 0;

    const bounds = this.getSelectionBounds();
    if (!bounds) return 0;

    const destX = bounds.minX + offsetX;
    const destY = bounds.minY + offsetY;

    return this.pasteFromClipboard(destX, destY);
  }

  public createStamp(id: string, name: string, category?: string, description?: string): boolean {
    const selectedTiles = this.getSelectedTiles();
    if (selectedTiles.length === 0) return false;

    const bounds = this.getSelectionBounds();
    if (!bounds) return false;

    const tiles: ClipboardTileData[] = [];
    const { layout, elevation } = this.courseData;

    for (const tile of selectedTiles) {
      const tileData: ClipboardTileData = {
        relativeX: tile.x - bounds.minX,
        relativeY: tile.y - bounds.minY,
        elevation: elevation?.[tile.y]?.[tile.x] ?? 0,
        terrainCode: layout[tile.y]?.[tile.x] ?? 0,
        mowed: this.isMowed(tile.x, tile.y),
        cornerHeights: this.getCornerHeights(tile.x, tile.y)
      };
      tiles.push(tileData);
    }

    const stamp: TerrainStamp = {
      id,
      name,
      tiles,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
      category,
      description
    };

    this.stamps.set(id, stamp);
    return true;
  }

  public createStampFromRegion(
    id: string,
    name: string,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    category?: string,
    description?: string
  ): boolean {
    const { width, height, layout, elevation } = this.courseData;

    const clampedMinX = Math.max(0, minX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxX = Math.min(width - 1, maxX);
    const clampedMaxY = Math.min(height - 1, maxY);

    if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) return false;

    const tiles: ClipboardTileData[] = [];

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const tileData: ClipboardTileData = {
          relativeX: x - clampedMinX,
          relativeY: y - clampedMinY,
          elevation: elevation?.[y]?.[x] ?? 0,
          terrainCode: layout[y]?.[x] ?? 0,
          mowed: this.isMowed(x, y),
          cornerHeights: this.getCornerHeights(x, y)
        };
        tiles.push(tileData);
      }
    }

    const stamp: TerrainStamp = {
      id,
      name,
      tiles,
      width: clampedMaxX - clampedMinX + 1,
      height: clampedMaxY - clampedMinY + 1,
      category,
      description
    };

    this.stamps.set(id, stamp);
    return true;
  }

  public deleteStamp(id: string): boolean {
    if (this.activeStampId === id) {
      this.activeStampId = null;
    }
    return this.stamps.delete(id);
  }

  public getStamp(id: string): TerrainStamp | undefined {
    return this.stamps.get(id);
  }

  public getAllStamps(): TerrainStamp[] {
    return Array.from(this.stamps.values());
  }

  public getStampsByCategory(category: string): TerrainStamp[] {
    return Array.from(this.stamps.values()).filter(s => s.category === category);
  }

  public getStampCategories(): string[] {
    const categories = new Set<string>();
    for (const stamp of this.stamps.values()) {
      if (stamp.category) {
        categories.add(stamp.category);
      }
    }
    return Array.from(categories);
  }

  public hasStamp(id: string): boolean {
    return this.stamps.has(id);
  }

  public getStampCount(): number {
    return this.stamps.size;
  }

  public setActiveStamp(id: string | null): void {
    if (id === null || this.stamps.has(id)) {
      this.activeStampId = id;
    }
  }

  public getActiveStamp(): TerrainStamp | null {
    if (!this.activeStampId) return null;
    return this.stamps.get(this.activeStampId) ?? null;
  }

  public getActiveStampId(): string | null {
    return this.activeStampId;
  }

  public applyStamp(stampId: string, destX: number, destY: number, options?: {
    includeElevation?: boolean;
    includeMowed?: boolean;
    elevationOffset?: number;
    rotation?: 0 | 90 | 180 | 270;
  }): number {
    const stamp = this.stamps.get(stampId);
    if (!stamp) return 0;

    const { width, height } = this.courseData;
    const includeElevation = options?.includeElevation ?? true;
    const includeMowed = options?.includeMowed ?? true;
    const elevationOffset = options?.elevationOffset ?? 0;
    const rotation = options?.rotation ?? 0;

    if (this.historyEnabled) {
      this.beginBatch(`Apply stamp "${stamp.name}" at (${destX}, ${destY})`);
    }

    let appliedCount = 0;

    for (const tile of stamp.tiles) {
      let relX = tile.relativeX;
      let relY = tile.relativeY;

      if (rotation === 90) {
        const temp = relX;
        relX = stamp.height - 1 - relY;
        relY = temp;
      } else if (rotation === 180) {
        relX = stamp.width - 1 - relX;
        relY = stamp.height - 1 - relY;
      } else if (rotation === 270) {
        const temp = relX;
        relX = relY;
        relY = stamp.width - 1 - temp;
      }

      const targetX = destX + relX;
      const targetY = destY + relY;

      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;

      if (includeElevation) {
        const newElevation = tile.elevation + elevationOffset;
        if (this.historyEnabled) {
          this.setElevationWithHistory(targetX, targetY, newElevation);
        } else {
          this.setElevationAtInternal(targetX, targetY, newElevation);
        }
      }

      if (includeMowed) {
        if (this.historyEnabled) {
          this.setMowedWithHistory(targetX, targetY, tile.mowed);
        } else {
          this.setMowed(targetX, targetY, tile.mowed);
        }
      }

      appliedCount++;
    }

    if (this.historyEnabled) {
      this.endBatch();
    }

    return appliedCount;
  }

  public applyActiveStamp(destX: number, destY: number, options?: {
    includeElevation?: boolean;
    includeMowed?: boolean;
    elevationOffset?: number;
    rotation?: 0 | 90 | 180 | 270;
  }): number {
    if (!this.activeStampId) return 0;
    return this.applyStamp(this.activeStampId, destX, destY, options);
  }

  public getStampPreview(stampId: string, destX: number, destY: number, rotation?: 0 | 90 | 180 | 270): Array<{ x: number; y: number; valid: boolean }> {
    const stamp = this.stamps.get(stampId);
    if (!stamp) return [];

    const { width, height } = this.courseData;
    const rot = rotation ?? 0;
    const preview: Array<{ x: number; y: number; valid: boolean }> = [];

    for (const tile of stamp.tiles) {
      let relX = tile.relativeX;
      let relY = tile.relativeY;

      if (rot === 90) {
        const temp = relX;
        relX = stamp.height - 1 - relY;
        relY = temp;
      } else if (rot === 180) {
        relX = stamp.width - 1 - relX;
        relY = stamp.height - 1 - relY;
      } else if (rot === 270) {
        const temp = relX;
        relX = relY;
        relY = stamp.width - 1 - temp;
      }

      const targetX = destX + relX;
      const targetY = destY + relY;
      const valid = targetX >= 0 && targetX < width && targetY >= 0 && targetY < height;
      preview.push({ x: targetX, y: targetY, valid });
    }

    return preview;
  }

  public clearAllStamps(): void {
    this.stamps.clear();
    this.activeStampId = null;
  }

  public renameStamp(id: string, newName: string): boolean {
    const stamp = this.stamps.get(id);
    if (!stamp) return false;
    stamp.name = newName;
    return true;
  }

  public setStampCategory(id: string, category: string | undefined): boolean {
    const stamp = this.stamps.get(id);
    if (!stamp) return false;
    stamp.category = category;
    return true;
  }

  public exportStamps(): TerrainStamp[] {
    return Array.from(this.stamps.values());
  }

  public importStamps(stamps: TerrainStamp[], overwrite: boolean = false): number {
    let imported = 0;
    for (const stamp of stamps) {
      if (overwrite || !this.stamps.has(stamp.id)) {
        this.stamps.set(stamp.id, { ...stamp, tiles: [...stamp.tiles] });
        imported++;
      }
    }
    return imported;
  }

  public setMaxSlopeDelta(maxDelta: number): void {
    this.constraints.maxSlopeDelta = Math.max(1, Math.min(10, maxDelta));
  }

  public getMaxSlopeDelta(): number {
    return this.constraints.maxSlopeDelta;
  }

  public setEnforceConstraints(enforce: boolean): void {
    this.constraints.enforceConstraints = enforce;
  }

  public isEnforceConstraints(): boolean {
    return this.constraints.enforceConstraints;
  }

  public getConstraints(): TerrainConstraints {
    return { ...this.constraints };
  }

  public validateTileSlope(gridX: number, gridY: number): SlopeValidation {
    const corners = this.getCornerHeights(gridX, gridY);
    const cornerValues = [
      { name: 'nw', value: corners.nw },
      { name: 'ne', value: corners.ne },
      { name: 'se', value: corners.se },
      { name: 'sw', value: corners.sw }
    ];

    const violations: Array<{ corner1: string; corner2: string; delta: number }> = [];
    let maxDelta = 0;

    for (let i = 0; i < cornerValues.length; i++) {
      for (let j = i + 1; j < cornerValues.length; j++) {
        const delta = Math.abs(cornerValues[i].value - cornerValues[j].value);
        maxDelta = Math.max(maxDelta, delta);
        if (delta > this.constraints.maxSlopeDelta) {
          violations.push({
            corner1: cornerValues[i].name,
            corner2: cornerValues[j].name,
            delta
          });
        }
      }
    }

    return {
      isValid: violations.length === 0,
      maxDelta,
      violatingCorners: violations
    };
  }

  public validateAllTileSlopes(): Array<{ gridX: number; gridY: number; validation: SlopeValidation }> {
    const { width, height } = this.courseData;
    const invalidTiles: Array<{ gridX: number; gridY: number; validation: SlopeValidation }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const validation = this.validateTileSlope(x, y);
        if (!validation.isValid) {
          invalidTiles.push({ gridX: x, gridY: y, validation });
        }
      }
    }

    return invalidTiles;
  }

  public getInvalidSlopeTileCount(): number {
    return this.validateAllTileSlopes().length;
  }

  public isTerrainValid(): boolean {
    return this.getInvalidSlopeTileCount() === 0;
  }

  public clampCornerHeightsToConstraints(gridX: number, gridY: number): boolean {
    const corners = this.getCornerHeights(gridX, gridY);
    const maxDelta = this.constraints.maxSlopeDelta;

    const values = [corners.nw, corners.ne, corners.se, corners.sw];
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max - min <= maxDelta) {
      return false;
    }

    const avg = (min + max) / 2;
    const halfDelta = maxDelta / 2;

    const clamp = (v: number) => Math.max(avg - halfDelta, Math.min(avg + halfDelta, v));

    const newCorners: CornerHeights = {
      nw: clamp(corners.nw),
      ne: clamp(corners.ne),
      se: clamp(corners.se),
      sw: clamp(corners.sw)
    };

    if (this.courseData.elevation) {
      const nwX = gridX;
      const nwY = gridY;
      const neX = gridX + 1;
      const neY = gridY;
      const seX = gridX + 1;
      const seY = gridY + 1;
      const swX = gridX;
      const swY = gridY + 1;

      const { width, height, elevation } = this.courseData;
      if (nwX < width && nwY < height) elevation[nwY][nwX] = newCorners.nw;
      if (neX < width && neY < height) elevation[neY][neX] = newCorners.ne;
      if (seX < width && seY < height) elevation[seY][seX] = newCorners.se;
      if (swX < width && swY < height) elevation[swY][swX] = newCorners.sw;
    }

    this.invalidateCacheAt(gridX, gridY);
    return true;
  }

  public fixAllInvalidSlopes(): number {
    const invalidTiles = this.validateAllTileSlopes();
    let fixedCount = 0;

    for (const tile of invalidTiles) {
      if (this.clampCornerHeightsToConstraints(tile.gridX, tile.gridY)) {
        fixedCount++;
      }
    }

    return fixedCount;
  }

  public wouldViolateConstraints(gridX: number, gridY: number, proposedElevation: number): boolean {
    if (!this.constraints.enforceConstraints) return false;

    const { width, height, elevation } = this.courseData;
    if (!elevation) return false;

    const neighbors = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 }
    ];

    for (const neighbor of neighbors) {
      const nx = gridX + neighbor.dx;
      const ny = gridY + neighbor.dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const neighborElev = elevation[ny]?.[nx] ?? 0;
      const delta = Math.abs(proposedElevation - neighborElev);

      if (delta > this.constraints.maxSlopeDelta) {
        return true;
      }
    }

    return false;
  }

  public getValidElevationRange(gridX: number, gridY: number): { min: number; max: number } {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return { min: -Infinity, max: Infinity };

    const maxDelta = this.constraints.maxSlopeDelta;
    let minValid = -Infinity;
    let maxValid = Infinity;

    const neighbors = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 }
    ];

    for (const neighbor of neighbors) {
      const nx = gridX + neighbor.dx;
      const ny = gridY + neighbor.dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const neighborElev = elevation[ny]?.[nx] ?? 0;
      minValid = Math.max(minValid, neighborElev - maxDelta);
      maxValid = Math.min(maxValid, neighborElev + maxDelta);
    }

    return { min: minValid, max: maxValid };
  }

  public setElevationConstrained(gridX: number, gridY: number, elevation: number): boolean {
    if (this.constraints.enforceConstraints) {
      const range = this.getValidElevationRange(gridX, gridY);
      const constrainedElev = Math.max(range.min, Math.min(range.max, elevation));

      if (this.historyEnabled) {
        this.setElevationWithHistory(gridX, gridY, constrainedElev);
      } else {
        this.setElevationAtInternal(gridX, gridY, constrainedElev);
      }
      this.invalidateCacheAt(gridX, gridY);
      return constrainedElev !== elevation;
    } else {
      if (this.historyEnabled) {
        this.setElevationWithHistory(gridX, gridY, elevation);
      } else {
        this.setElevationAtInternal(gridX, gridY, elevation);
      }
      this.invalidateCacheAt(gridX, gridY);
      return false;
    }
  }

  public getSlopeStatistics(): {
    totalTiles: number;
    validTiles: number;
    invalidTiles: number;
    maxSlopeDeltaFound: number;
    avgSlopeDelta: number;
  } {
    const { width, height } = this.courseData;
    let totalDelta = 0;
    let maxDelta = 0;
    let invalidCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const validation = this.validateTileSlope(x, y);
        totalDelta += validation.maxDelta;
        maxDelta = Math.max(maxDelta, validation.maxDelta);
        if (!validation.isValid) {
          invalidCount++;
        }
      }
    }

    const totalTiles = width * height;
    return {
      totalTiles,
      validTiles: totalTiles - invalidCount,
      invalidTiles: invalidCount,
      maxSlopeDeltaFound: maxDelta,
      avgSlopeDelta: totalTiles > 0 ? totalDelta / totalTiles : 0
    };
  }

  public isTileSubmerged(gridX: number, gridY: number): boolean {
    const corners = this.getCornerHeights(gridX, gridY);
    const maxHeight = Math.max(corners.nw, corners.ne, corners.se, corners.sw);
    return maxHeight < this.waterLevel;
  }

  public isTilePartiallySubmerged(gridX: number, gridY: number): boolean {
    const corners = this.getCornerHeights(gridX, gridY);
    const minHeight = Math.min(corners.nw, corners.ne, corners.se, corners.sw);
    const maxHeight = Math.max(corners.nw, corners.ne, corners.se, corners.sw);
    return minHeight < this.waterLevel && maxHeight >= this.waterLevel;
  }

  public getTileSubmersionDepth(gridX: number, gridY: number): number {
    const corners = this.getCornerHeights(gridX, gridY);
    const avgHeight = (corners.nw + corners.ne + corners.se + corners.sw) / 4;
    return Math.max(0, this.waterLevel - avgHeight);
  }

  public getSubmergedTiles(): Array<{ x: number; y: number; depth: number }> {
    const { width, height } = this.courseData;
    const submerged: Array<{ x: number; y: number; depth: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isTileSubmerged(x, y)) {
          submerged.push({
            x,
            y,
            depth: this.getTileSubmersionDepth(x, y)
          });
        }
      }
    }

    return submerged;
  }

  public getPartiallySubmergedTiles(): Array<{ x: number; y: number; submergedCorners: string[] }> {
    const { width, height } = this.courseData;
    const partial: Array<{ x: number; y: number; submergedCorners: string[] }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isTilePartiallySubmerged(x, y)) {
          const corners = this.getCornerHeights(x, y);
          const submergedCorners: string[] = [];
          if (corners.nw < this.waterLevel) submergedCorners.push('nw');
          if (corners.ne < this.waterLevel) submergedCorners.push('ne');
          if (corners.se < this.waterLevel) submergedCorners.push('se');
          if (corners.sw < this.waterLevel) submergedCorners.push('sw');
          partial.push({ x, y, submergedCorners });
        }
      }
    }

    return partial;
  }

  public getSubmergedTileCount(): number {
    const { width, height } = this.courseData;
    let count = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isTileSubmerged(x, y)) {
          count++;
        }
      }
    }

    return count;
  }

  public getSubmersionStatistics(): {
    totalSubmerged: number;
    partiallySubmerged: number;
    aboveWater: number;
    avgSubmersionDepth: number;
    maxSubmersionDepth: number;
    waterLevel: number;
  } {
    const { width, height } = this.courseData;
    let totalSubmerged = 0;
    let partiallySubmerged = 0;
    let totalDepth = 0;
    let maxDepth = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isTileSubmerged(x, y)) {
          totalSubmerged++;
          const depth = this.getTileSubmersionDepth(x, y);
          totalDepth += depth;
          maxDepth = Math.max(maxDepth, depth);
        } else if (this.isTilePartiallySubmerged(x, y)) {
          partiallySubmerged++;
        }
      }
    }

    const totalTiles = width * height;
    return {
      totalSubmerged,
      partiallySubmerged,
      aboveWater: totalTiles - totalSubmerged - partiallySubmerged,
      avgSubmersionDepth: totalSubmerged > 0 ? totalDepth / totalSubmerged : 0,
      maxSubmersionDepth: maxDepth,
      waterLevel: this.waterLevel
    };
  }

  public getCornerSubmersionState(gridX: number, gridY: number): {
    nw: boolean;
    ne: boolean;
    se: boolean;
    sw: boolean;
    submergedCount: number;
  } {
    const corners = this.getCornerHeights(gridX, gridY);
    const nw = corners.nw < this.waterLevel;
    const ne = corners.ne < this.waterLevel;
    const se = corners.se < this.waterLevel;
    const sw = corners.sw < this.waterLevel;

    return {
      nw,
      ne,
      se,
      sw,
      submergedCount: (nw ? 1 : 0) + (ne ? 1 : 0) + (se ? 1 : 0) + (sw ? 1 : 0)
    };
  }

  public findShoreline(): Array<{ x: number; y: number; edge: 'n' | 's' | 'e' | 'w' }> {
    const { width, height } = this.courseData;
    const shoreline: Array<{ x: number; y: number; edge: 'n' | 's' | 'e' | 'w' }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const submerged = this.isTileSubmerged(x, y) || this.isTilePartiallySubmerged(x, y);
        if (!submerged) continue;

        if (y > 0) {
          const northSubmerged = this.isTileSubmerged(x, y - 1) || this.isTilePartiallySubmerged(x, y - 1);
          if (!northSubmerged) shoreline.push({ x, y, edge: 'n' });
        } else {
          shoreline.push({ x, y, edge: 'n' });
        }

        if (y < height - 1) {
          const southSubmerged = this.isTileSubmerged(x, y + 1) || this.isTilePartiallySubmerged(x, y + 1);
          if (!southSubmerged) shoreline.push({ x, y, edge: 's' });
        } else {
          shoreline.push({ x, y, edge: 's' });
        }

        if (x > 0) {
          const westSubmerged = this.isTileSubmerged(x - 1, y) || this.isTilePartiallySubmerged(x - 1, y);
          if (!westSubmerged) shoreline.push({ x, y, edge: 'w' });
        } else {
          shoreline.push({ x, y, edge: 'w' });
        }

        if (x < width - 1) {
          const eastSubmerged = this.isTileSubmerged(x + 1, y) || this.isTilePartiallySubmerged(x + 1, y);
          if (!eastSubmerged) shoreline.push({ x, y, edge: 'e' });
        } else {
          shoreline.push({ x, y, edge: 'e' });
        }
      }
    }

    return shoreline;
  }

  public getTilesAtWaterLevel(): Array<{ x: number; y: number }> {
    const { width, height } = this.courseData;
    const tiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = this.getCornerHeights(x, y);
        const hasCornerAtWaterLevel =
          corners.nw === this.waterLevel ||
          corners.ne === this.waterLevel ||
          corners.se === this.waterLevel ||
          corners.sw === this.waterLevel;
        if (hasCornerAtWaterLevel) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  private isValidTile(gridX: number, gridY: number): boolean {
    return gridX >= 0 && gridX < this.courseData.width &&
           gridY >= 0 && gridY < this.courseData.height;
  }

  public flattenArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    targetElevation?: number
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let totalElevation = 0;
    let tileCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        totalElevation += this.getElevationAt(x, y);
        tileCount++;
      }
    }

    const elevation = targetElevation !== undefined
      ? targetElevation
      : Math.round(totalElevation / tileCount);

    let modifiedCount = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        if (currentElev !== elevation) {
          this.setElevationAtInternal(x, y, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createPlateau(
    centerX: number,
    centerY: number,
    radius: number,
    elevation: number,
    createRamps: boolean = true
  ): { flattened: number; rampsCreated: number } {
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    let flattened = 0;
    const plateauTiles: Array<{ x: number; y: number }> = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          this.setElevationAtInternal(x, y, elevation);
          plateauTiles.push({ x, y });
          flattened++;
        }
      }
    }

    let rampsCreated = 0;
    if (createRamps) {
      for (const tile of plateauTiles) {
        const neighbors = [
          { x: tile.x - 1, y: tile.y },
          { x: tile.x + 1, y: tile.y },
          { x: tile.x, y: tile.y - 1 },
          { x: tile.x, y: tile.y + 1 }
        ];

        for (const neighbor of neighbors) {
          if (!this.isValidTile(neighbor.x, neighbor.y)) continue;
          const neighborElev = this.getElevationAt(neighbor.x, neighbor.y);
          const delta = Math.abs(elevation - neighborElev);

          if (delta > this.constraints.maxSlopeDelta) {
            const direction = elevation > neighborElev ? -1 : 1;
            let currentElev = elevation;
            let rampX = neighbor.x;
            let rampY = neighbor.y;
            const dx = neighbor.x - tile.x;
            const dy = neighbor.y - tile.y;

            while (
              this.isValidTile(rampX, rampY) &&
              Math.abs(currentElev - this.getElevationAt(rampX, rampY)) > this.constraints.maxSlopeDelta
            ) {
              currentElev += direction * this.constraints.maxSlopeDelta;
              this.setElevationAtInternal(rampX, rampY, currentElev);
              rampsCreated++;
              rampX += dx;
              rampY += dy;
            }
          }
        }
      }
    }

    return { flattened, rampsCreated };
  }

  public averageElevationInArea(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    iterations: number = 1
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let modifiedTotal = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const newElevations: Map<string, number> = new Map();

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let sum = this.getElevationAt(x, y);
          let count = 1;

          const neighbors = [
            [x - 1, y], [x + 1, y],
            [x, y - 1], [x, y + 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
              sum += this.getElevationAt(nx, ny);
              count++;
            }
          }

          newElevations.set(`${x}_${y}`, Math.round(sum / count));
        }
      }

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const newElev = newElevations.get(`${x}_${y}`)!;
          if (this.getElevationAt(x, y) !== newElev) {
            this.setElevationAtInternal(x, y, newElev);
            modifiedTotal++;
          }
        }
      }
    }

    return modifiedTotal;
  }

  public createGradient(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    startElevation: number,
    endElevation: number
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    const width = maxX - minX;
    const height = maxY - minY;
    const maxDist = Math.sqrt(width * width + height * height);

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distFromStart = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
        const t = maxDist > 0 ? distFromStart / maxDist : 0;
        const elevation = Math.round(startElevation + t * (endElevation - startElevation));

        if (this.getElevationAt(x, y) !== elevation) {
          this.setElevationAtInternal(x, y, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createRamp(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number = 1
  ): { tilesModified: number; isValid: boolean } {
    const startElev = this.getElevationAt(startX, startY);
    const endElev = this.getElevationAt(endX, endY);

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance);

    if (steps === 0) {
      return { tilesModified: 0, isValid: true };
    }

    const elevDelta = Math.abs(endElev - startElev);
    const requiredSteps = Math.ceil(elevDelta / this.constraints.maxSlopeDelta);
    const isValid = steps >= requiredSteps;

    let tilesModified = 0;

    const perpX = -dy / distance;
    const perpY = dx / distance;

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const centerX = Math.round(startX + t * dx);
      const centerY = Math.round(startY + t * dy);
      const elevation = Math.round(startElev + t * (endElev - startElev));

      for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
        const tileX = Math.round(centerX + w * perpX);
        const tileY = Math.round(centerY + w * perpY);

        if (this.isValidTile(tileX, tileY)) {
          if (this.getElevationAt(tileX, tileY) !== elevation) {
            this.setElevationAtInternal(tileX, tileY, elevation);
            tilesModified++;
          }
        }
      }
    }

    return { tilesModified, isValid };
  }

  public matchEdgeElevations(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    depth: number = 2
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let modifiedCount = 0;

    for (let d = 1; d <= depth; d++) {
      for (let x = minX; x <= maxX; x++) {
        if (minY - d >= 0) {
          const targetElev = this.getElevationAt(x, minY);
          const neighborElev = this.getElevationAt(x, minY - d);
          const blendElev = Math.round((targetElev * (depth - d + 1) + neighborElev * d) / (depth + 1));
          if (this.getElevationAt(x, minY - d) !== blendElev) {
            this.setElevationAtInternal(x, minY - d, blendElev);
            modifiedCount++;
          }
        }
        if (maxY + d < this.courseData.height) {
          const targetElev = this.getElevationAt(x, maxY);
          const neighborElev = this.getElevationAt(x, maxY + d);
          const blendElev = Math.round((targetElev * (depth - d + 1) + neighborElev * d) / (depth + 1));
          if (this.getElevationAt(x, maxY + d) !== blendElev) {
            this.setElevationAtInternal(x, maxY + d, blendElev);
            modifiedCount++;
          }
        }
      }

      for (let y = minY; y <= maxY; y++) {
        if (minX - d >= 0) {
          const targetElev = this.getElevationAt(minX, y);
          const neighborElev = this.getElevationAt(minX - d, y);
          const blendElev = Math.round((targetElev * (depth - d + 1) + neighborElev * d) / (depth + 1));
          if (this.getElevationAt(minX - d, y) !== blendElev) {
            this.setElevationAtInternal(minX - d, y, blendElev);
            modifiedCount++;
          }
        }
        if (maxX + d < this.courseData.width) {
          const targetElev = this.getElevationAt(maxX, y);
          const neighborElev = this.getElevationAt(maxX + d, y);
          const blendElev = Math.round((targetElev * (depth - d + 1) + neighborElev * d) / (depth + 1));
          if (this.getElevationAt(maxX + d, y) !== blendElev) {
            this.setElevationAtInternal(maxX + d, y, blendElev);
            modifiedCount++;
          }
        }
      }
    }

    return modifiedCount;
  }

  public getAreaElevationStats(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): {
    min: number;
    max: number;
    avg: number;
    range: number;
    flatPercentage: number;
  } {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let minElev = Infinity;
    let maxElev = -Infinity;
    let totalElev = 0;
    let tileCount = 0;
    let flatCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
        totalElev += elev;
        tileCount++;

        const corners = this.getCornerHeights(x, y);
        if (corners.nw === corners.ne && corners.ne === corners.se && corners.se === corners.sw) {
          flatCount++;
        }
      }
    }

    return {
      min: minElev === Infinity ? 0 : minElev,
      max: maxElev === -Infinity ? 0 : maxElev,
      avg: tileCount > 0 ? totalElev / tileCount : 0,
      range: maxElev - minElev,
      flatPercentage: tileCount > 0 ? (flatCount / tileCount) * 100 : 0
    };
  }

  private noise2D(x: number, y: number, seed: number = 0): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
    return n - Math.floor(n);
  }

  private smoothNoise(x: number, y: number, seed: number = 0): number {
    const corners = (
      this.noise2D(x - 1, y - 1, seed) +
      this.noise2D(x + 1, y - 1, seed) +
      this.noise2D(x - 1, y + 1, seed) +
      this.noise2D(x + 1, y + 1, seed)
    ) / 16;

    const sides = (
      this.noise2D(x - 1, y, seed) +
      this.noise2D(x + 1, y, seed) +
      this.noise2D(x, y - 1, seed) +
      this.noise2D(x, y + 1, seed)
    ) / 8;

    const center = this.noise2D(x, y, seed) / 4;

    return corners + sides + center;
  }

  private interpolatedNoise(x: number, y: number, seed: number = 0): number {
    const intX = Math.floor(x);
    const fracX = x - intX;
    const intY = Math.floor(y);
    const fracY = y - intY;

    const v1 = this.smoothNoise(intX, intY, seed);
    const v2 = this.smoothNoise(intX + 1, intY, seed);
    const v3 = this.smoothNoise(intX, intY + 1, seed);
    const v4 = this.smoothNoise(intX + 1, intY + 1, seed);

    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;

    return i1 * (1 - fracY) + i2 * fracY;
  }

  private perlinNoise(x: number, y: number, octaves: number, persistence: number, seed: number = 0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.interpolatedNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  public generateNoiseElevation(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    config: NoiseConfig
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    const {
      scale = 0.1,
      octaves = 4,
      persistence = 0.5,
      minElevation = 0,
      maxElevation = 10,
      seed = Date.now(),
      additive = false
    } = config;

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const noiseValue = this.perlinNoise(x * scale, y * scale, octaves, persistence, seed);
        let elevation = Math.round(minElevation + noiseValue * (maxElevation - minElevation));

        if (additive) {
          elevation += this.getElevationAt(x, y);
        }

        elevation = Math.max(0, Math.min(elevation, 50));

        if (this.getElevationAt(x, y) !== elevation) {
          this.setElevationAtInternal(x, y, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public generateHillTerrain(
    centerX: number,
    centerY: number,
    radius: number,
    height: number,
    falloff: number = 1
  ): number {
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance > radius) continue;

        const normalizedDist = distance / radius;
        const heightMultiplier = Math.pow(1 - normalizedDist, falloff);
        const elevation = Math.round(this.getElevationAt(x, y) + height * heightMultiplier);

        const clampedElev = Math.max(0, Math.min(elevation, 50));
        if (this.getElevationAt(x, y) !== clampedElev) {
          this.setElevationAtInternal(x, y, clampedElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public generateValleyTerrain(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    depth: number
  ): number {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return 0;

    const dirX = dx / length;
    const dirY = dy / length;
    const perpX = -dirY;
    const perpY = dirX;

    let modifiedCount = 0;

    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        const relX = x - startX;
        const relY = y - startY;

        const projLength = relX * dirX + relY * dirY;
        if (projLength < 0 || projLength > length) continue;

        const perpDist = Math.abs(relX * perpX + relY * perpY);
        if (perpDist > width) continue;

        const valleyFactor = 1 - (perpDist / width);
        const depthAtPoint = Math.round(depth * valleyFactor);

        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.max(0, currentElev - depthAtPoint);

        if (currentElev !== newElev) {
          this.setElevationAtInternal(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public generateRidgeTerrain(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    height: number,
    roughness: number = 0
  ): number {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return 0;

    const dirX = dx / length;
    const dirY = dy / length;
    const perpX = -dirY;
    const perpY = dirX;
    const seed = Date.now();

    let modifiedCount = 0;

    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        const relX = x - startX;
        const relY = y - startY;

        const projLength = relX * dirX + relY * dirY;
        if (projLength < 0 || projLength > length) continue;

        const perpDist = Math.abs(relX * perpX + relY * perpY);
        if (perpDist > width) continue;

        const ridgeFactor = 1 - (perpDist / width);
        let heightAtPoint = height * ridgeFactor;

        if (roughness > 0) {
          const noiseValue = this.perlinNoise(x * 0.2, y * 0.2, 3, 0.5, seed);
          heightAtPoint *= (1 + (noiseValue - 0.5) * roughness);
        }

        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.min(50, currentElev + Math.round(heightAtPoint));

        if (currentElev !== newElev) {
          this.setElevationAtInternal(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public generateTerrainFromHeightmap(
    heights: number[][],
    offsetX: number = 0,
    offsetY: number = 0,
    scale: number = 1
  ): number {
    let modifiedCount = 0;

    for (let y = 0; y < heights.length; y++) {
      for (let x = 0; x < heights[y].length; x++) {
        const gridX = offsetX + x;
        const gridY = offsetY + y;

        if (!this.isValidTile(gridX, gridY)) continue;

        const elevation = Math.round(heights[y][x] * scale);
        const clampedElev = Math.max(0, Math.min(elevation, 50));

        if (this.getElevationAt(gridX, gridY) !== clampedElev) {
          this.setElevationAtInternal(gridX, gridY, clampedElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public exportToHeightmap(options: HeightmapExportOptions = {}): HeightmapData {
    const {
      startX = 0,
      startY = 0,
      endX = this.courseData.width - 1,
      endY = this.courseData.height - 1,
      normalize = true,
      targetMin = 0,
      targetMax = 255,
      includeCornerHeights = false
    } = options;

    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    let minElev = Infinity;
    let maxElev = -Infinity;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }
    }

    const elevRange = maxElev - minElev;
    const targetRange = targetMax - targetMin;
    const heights: number[][] = [];
    const cornerHeights: CornerHeights[][] | undefined = includeCornerHeights ? [] : undefined;

    for (let y = minY; y <= maxY; y++) {
      const row: number[] = [];
      const cornerRow: CornerHeights[] | undefined = includeCornerHeights ? [] : undefined;

      for (let x = minX; x <= maxX; x++) {
        const elev = this.getElevationAt(x, y);

        if (normalize && elevRange > 0) {
          const normalized = ((elev - minElev) / elevRange) * targetRange + targetMin;
          row.push(Math.round(normalized));
        } else {
          row.push(elev);
        }

        if (includeCornerHeights && cornerRow) {
          cornerRow.push(this.getCornerHeights(x, y));
        }
      }

      heights.push(row);
      if (includeCornerHeights && cornerHeights && cornerRow) {
        cornerHeights.push(cornerRow);
      }
    }

    return {
      width,
      height,
      heights,
      cornerHeights,
      metadata: {
        originalMinElevation: minElev,
        originalMaxElevation: maxElev,
        normalized: normalize,
        targetMin: normalize ? targetMin : undefined,
        targetMax: normalize ? targetMax : undefined,
        region: { startX: minX, startY: minY, endX: maxX, endY: maxY }
      }
    };
  }

  public exportToHeightmapFlat(options: HeightmapExportOptions = {}): number[] {
    const data = this.exportToHeightmap(options);
    const flat: number[] = [];

    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        flat.push(data.heights[y][x]);
      }
    }

    return flat;
  }

  public exportToHeightmapRGBA(options: HeightmapExportOptions = {}): Uint8Array {
    const normalizedOptions = { ...options, normalize: true, targetMin: 0, targetMax: 255 };
    const data = this.exportToHeightmap(normalizedOptions);
    const rgba = new Uint8Array(data.width * data.height * 4);

    let idx = 0;
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const value = Math.max(0, Math.min(255, data.heights[y][x]));
        rgba[idx++] = value;
        rgba[idx++] = value;
        rgba[idx++] = value;
        rgba[idx++] = 255;
      }
    }

    return rgba;
  }

  public getHeightmapStatistics(options: HeightmapExportOptions = {}): HeightmapStatistics {
    const data = this.exportToHeightmap({ ...options, normalize: false });
    const values: number[] = [];
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const v = data.heights[y][x];
        values.push(v);
        sum += v;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }

    const count = values.length;
    const mean = count > 0 ? sum / count : 0;

    let varianceSum = 0;
    for (const v of values) {
      varianceSum += (v - mean) * (v - mean);
    }
    const variance = count > 0 ? varianceSum / count : 0;
    const stdDev = Math.sqrt(variance);

    values.sort((a, b) => a - b);
    const median = count > 0 ? values[Math.floor(count / 2)] : 0;

    const histogram = new Array(11).fill(0);
    const range = max - min || 1;
    for (const v of values) {
      const bucket = Math.min(10, Math.floor(((v - min) / range) * 10));
      histogram[bucket]++;
    }

    return {
      width: data.width,
      height: data.height,
      totalPixels: count,
      min,
      max,
      range: max - min,
      mean,
      median,
      stdDev,
      variance,
      histogram
    };
  }

  public compareHeightmaps(
    other: number[][] | HeightmapData,
    options: HeightmapCompareOptions = {}
  ): HeightmapComparison {
    const { tolerance = 0 } = options;
    const current = this.exportToHeightmap({ normalize: false });

    const otherHeights = Array.isArray(other) ? other : other.heights;
    const otherWidth = Array.isArray(other) ? (other[0]?.length ?? 0) : other.width;
    const otherHeight = Array.isArray(other) ? other.length : other.height;

    const comparison: HeightmapComparison = {
      identical: true,
      withinTolerance: true,
      dimensionsMatch: current.width === otherWidth && current.height === otherHeight,
      totalDifferences: 0,
      maxDifference: 0,
      avgDifference: 0,
      differences: []
    };

    if (!comparison.dimensionsMatch) {
      comparison.identical = false;
      comparison.withinTolerance = false;
      return comparison;
    }

    let sumDiff = 0;
    let diffCount = 0;

    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const currentVal = current.heights[y]?.[x] ?? 0;
        const otherVal = otherHeights[y]?.[x] ?? 0;
        const diff = Math.abs(currentVal - otherVal);

        if (diff > 0) {
          comparison.identical = false;
          comparison.totalDifferences++;
          comparison.maxDifference = Math.max(comparison.maxDifference, diff);
          sumDiff += diff;
          diffCount++;

          if (diff > tolerance) {
            comparison.withinTolerance = false;
            comparison.differences.push({ x, y, currentValue: currentVal, otherValue: otherVal, difference: diff });
          }
        }
      }
    }

    comparison.avgDifference = diffCount > 0 ? sumDiff / diffCount : 0;
    return comparison;
  }

  public sampleTerrainLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: LineSampleOptions = {}
  ): TerrainLineSample {
    const {
      numSamples = 10,
      includeCornerHeights = false,
      includePhysics = false,
      includeSlope = true
    } = options;

    const samples: TerrainSamplePoint[] = [];
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let totalElevation = 0;
    let totalSlope = 0;
    let maxSlope = 0;
    const terrainTypes: TerrainType[] = [];

    for (let i = 0; i < numSamples; i++) {
      const t = numSamples > 1 ? i / (numSamples - 1) : 0;
      const x = startX + dx * t;
      const y = startY + dy * t;

      const gridX = Math.floor(x);
      const gridY = Math.floor(y);

      if (!this.isValidTile(gridX, gridY)) continue;

      const elevation = this.interpolateElevation(x, y);
      const terrainType = this.getTerrainTypeAt(gridX, gridY);

      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
      totalElevation += elevation;
      terrainTypes.push(terrainType);

      const sample: TerrainSamplePoint = {
        x,
        y,
        gridX,
        gridY,
        t,
        distanceFromStart: t * distance,
        elevation,
        terrainType
      };

      if (includeSlope) {
        const slope = this.getSlopeVectorAt(gridX, gridY);
        sample.slopeAngle = slope.angle;
        sample.slopeDirection = slope.direction;
        sample.slopeMagnitude = slope.magnitude;
        totalSlope += slope.angle;
        maxSlope = Math.max(maxSlope, slope.angle);
      }

      if (includeCornerHeights) {
        sample.cornerHeights = this.getCornerHeights(gridX, gridY);
      }

      if (includePhysics) {
        sample.physics = this.getSurfacePhysicsAt(gridX, gridY);
      }

      samples.push(sample);
    }

    const validSamples = samples.length;
    const avgElevation = validSamples > 0 ? totalElevation / validSamples : 0;
    const avgSlope = validSamples > 0 ? totalSlope / validSamples : 0;

    const elevationChange = validSamples > 0
      ? samples[validSamples - 1].elevation - samples[0].elevation
      : 0;
    const overallGrade = distance > 0 ? (elevationChange / distance) * 100 : 0;

    const terrainTypeChanges = this.countTerrainTypeChanges(terrainTypes);
    const dominantTerrainType = this.getDominantTerrainType(terrainTypes);

    return {
      samples,
      totalDistance: distance,
      numValidSamples: validSamples,
      elevationChange,
      minElevation: minElevation === Infinity ? 0 : minElevation,
      maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
      avgElevation,
      avgSlope,
      maxSlope,
      overallGrade,
      terrainTypeChanges,
      dominantTerrainType
    };
  }

  private countTerrainTypeChanges(types: TerrainType[]): number {
    let changes = 0;
    for (let i = 1; i < types.length; i++) {
      if (types[i] !== types[i - 1]) changes++;
    }
    return changes;
  }

  private getDominantTerrainType(types: TerrainType[]): TerrainType {
    const counts: Record<string, number> = {};
    for (const type of types) {
      counts[type] = (counts[type] || 0) + 1;
    }
    let dominant: TerrainType = 'rough';
    let maxCount = 0;
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = type as TerrainType;
      }
    }
    return dominant;
  }

  public sampleTerrainPath(
    points: Array<{ x: number; y: number }>,
    options: LineSampleOptions = {}
  ): TerrainPathSample {
    const segments: TerrainLineSample[] = [];
    let totalDistance = 0;
    let totalElevationChange = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let totalSlope = 0;
    let maxSlope = 0;
    let sampleCount = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const segment = this.sampleTerrainLine(start.x, start.y, end.x, end.y, options);
      segments.push(segment);

      totalDistance += segment.totalDistance;
      totalElevationChange += segment.elevationChange;
      minElevation = Math.min(minElevation, segment.minElevation);
      maxElevation = Math.max(maxElevation, segment.maxElevation);
      maxSlope = Math.max(maxSlope, segment.maxSlope);
      totalSlope += segment.avgSlope * segment.numValidSamples;
      sampleCount += segment.numValidSamples;
    }

    const avgSlope = sampleCount > 0 ? totalSlope / sampleCount : 0;

    return {
      segments,
      numSegments: segments.length,
      totalDistance,
      totalElevationChange,
      minElevation: minElevation === Infinity ? 0 : minElevation,
      maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
      avgSlope,
      maxSlope,
      overallGrade: totalDistance > 0 ? (totalElevationChange / totalDistance) * 100 : 0
    };
  }

  public getElevationProfile(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    numSamples: number = 50
  ): Array<{ distance: number; elevation: number }> {
    const sample = this.sampleTerrainLine(startX, startY, endX, endY, { numSamples, includeSlope: false });
    return sample.samples.map(s => ({
      distance: s.distanceFromStart,
      elevation: s.elevation
    }));
  }

  public getNoisePreview(
    width: number,
    height: number,
    config: NoiseConfig
  ): number[][] {
    const {
      scale = 0.1,
      octaves = 4,
      persistence = 0.5,
      minElevation = 0,
      maxElevation = 10,
      seed = Date.now()
    } = config;

    const preview: number[][] = [];

    for (let y = 0; y < height; y++) {
      preview[y] = [];
      for (let x = 0; x < width; x++) {
        const noiseValue = this.perlinNoise(x * scale, y * scale, octaves, persistence, seed);
        preview[y][x] = Math.round(minElevation + noiseValue * (maxElevation - minElevation));
      }
    }

    return preview;
  }

  public applyThermalErosion(
    iterations: number = 10,
    talusAngle: number = 1.5,
    erosionRate: number = 0.3
  ): number {
    const { width, height } = this.courseData;
    let totalMoved = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const sediment: Map<string, number> = new Map();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const currentElev = this.getElevationAt(x, y);

          const neighbors = [
            { x: x - 1, y, elev: x > 0 ? this.getElevationAt(x - 1, y) : currentElev },
            { x: x + 1, y, elev: x < width - 1 ? this.getElevationAt(x + 1, y) : currentElev },
            { x, y: y - 1, elev: y > 0 ? this.getElevationAt(x, y - 1) : currentElev },
            { x, y: y + 1, elev: y < height - 1 ? this.getElevationAt(x, y + 1) : currentElev }
          ];

          for (const neighbor of neighbors) {
            const delta = currentElev - neighbor.elev;
            if (delta > talusAngle) {
              const transfer = (delta - talusAngle) * erosionRate * 0.5;

              const currentKey = `${x}_${y}`;
              const neighborKey = `${neighbor.x}_${neighbor.y}`;

              sediment.set(currentKey, (sediment.get(currentKey) || 0) - transfer);
              sediment.set(neighborKey, (sediment.get(neighborKey) || 0) + transfer);
              totalMoved += transfer;
            }
          }
        }
      }

      for (const [key, amount] of sediment.entries()) {
        if (Math.abs(amount) < 0.01) continue;
        const [x, y] = key.split('_').map(Number);
        const newElev = Math.round(this.getElevationAt(x, y) + amount);
        const clampedElev = Math.max(0, Math.min(50, newElev));
        this.setElevationAtInternal(x, y, clampedElev);
      }
    }

    return Math.round(totalMoved);
  }

  public applyHydraulicErosion(
    droplets: number = 1000,
    inertia: number = 0.05,
    sedimentCapacity: number = 4,
    minSlope: number = 0.01,
    erosionRate: number = 0.3,
    depositionRate: number = 0.3,
    evaporationRate: number = 0.01,
    maxSteps: number = 64
  ): number {
    const { width, height } = this.courseData;
    let totalEroded = 0;

    for (let d = 0; d < droplets; d++) {
      let posX = Math.random() * (width - 1);
      let posY = Math.random() * (height - 1);
      let dirX = 0;
      let dirY = 0;
      let speed = 1;
      let water = 1;
      let sediment = 0;

      for (let step = 0; step < maxSteps; step++) {
        const cellX = Math.floor(posX);
        const cellY = Math.floor(posY);

        if (cellX < 0 || cellX >= width - 1 || cellY < 0 || cellY >= height - 1) break;

        const gradX = this.getElevationAt(cellX + 1, cellY) - this.getElevationAt(cellX, cellY);
        const gradY = this.getElevationAt(cellX, cellY + 1) - this.getElevationAt(cellX, cellY);

        dirX = dirX * inertia - gradX * (1 - inertia);
        dirY = dirY * inertia - gradY * (1 - inertia);

        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len > 0) {
          dirX /= len;
          dirY /= len;
        } else {
          dirX = Math.random() * 2 - 1;
          dirY = Math.random() * 2 - 1;
        }

        const newPosX = posX + dirX;
        const newPosY = posY + dirY;

        if (newPosX < 0 || newPosX >= width - 1 || newPosY < 0 || newPosY >= height - 1) break;

        const oldHeight = this.getElevationAt(cellX, cellY);
        const newCellX = Math.floor(newPosX);
        const newCellY = Math.floor(newPosY);
        const newHeight = this.getElevationAt(newCellX, newCellY);

        const deltaHeight = newHeight - oldHeight;

        const capacity = Math.max(-deltaHeight, minSlope) * speed * water * sedimentCapacity;

        if (sediment > capacity || deltaHeight > 0) {
          const toDeposit = deltaHeight > 0
            ? Math.min(deltaHeight, sediment)
            : (sediment - capacity) * depositionRate;

          sediment -= toDeposit;
          const depositElev = Math.round(oldHeight + toDeposit);
          this.setElevationAtInternal(cellX, cellY, Math.min(50, depositElev));
        } else {
          const toErode = Math.min((capacity - sediment) * erosionRate, -deltaHeight);
          sediment += toErode;
          const erodeElev = Math.round(oldHeight - toErode);
          this.setElevationAtInternal(cellX, cellY, Math.max(0, erodeElev));
          totalEroded += toErode;
        }

        speed = Math.sqrt(Math.max(0, speed * speed + deltaHeight));
        water *= (1 - evaporationRate);

        posX = newPosX;
        posY = newPosY;

        if (water < 0.01) break;
      }
    }

    return Math.round(totalEroded);
  }

  public applyWindErosion(
    iterations: number = 5,
    windDirX: number = 1,
    windDirY: number = 0,
    windStrength: number = 0.5,
    particleSize: number = 0.1
  ): number {
    const { width, height } = this.courseData;
    let totalMoved = 0;

    const len = Math.sqrt(windDirX * windDirX + windDirY * windDirY);
    const normX = len > 0 ? windDirX / len : 1;
    const normY = len > 0 ? windDirY / len : 0;

    for (let iter = 0; iter < iterations; iter++) {
      const changes: Map<string, number> = new Map();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const currentElev = this.getElevationAt(x, y);

          const upwindX = Math.round(x - normX);
          const upwindY = Math.round(y - normY);
          const downwindX = Math.round(x + normX);
          const downwindY = Math.round(y + normY);

          const upwindElev = this.isValidTile(upwindX, upwindY)
            ? this.getElevationAt(upwindX, upwindY)
            : currentElev;

          const exposure = currentElev - upwindElev;
          if (exposure <= 0) continue;

          const erosionAmount = exposure * windStrength * particleSize;

          const currentKey = `${x}_${y}`;
          changes.set(currentKey, (changes.get(currentKey) || 0) - erosionAmount);

          if (this.isValidTile(downwindX, downwindY)) {
            const downwindKey = `${downwindX}_${downwindY}`;
            changes.set(downwindKey, (changes.get(downwindKey) || 0) + erosionAmount);
          }

          totalMoved += erosionAmount;
        }
      }

      for (const [key, amount] of changes.entries()) {
        if (Math.abs(amount) < 0.01) continue;
        const [x, y] = key.split('_').map(Number);
        const newElev = Math.round(this.getElevationAt(x, y) + amount);
        const clampedElev = Math.max(0, Math.min(50, newElev));
        this.setElevationAtInternal(x, y, clampedElev);
      }
    }

    return Math.round(totalMoved);
  }

  public getErosionPreview(
    type: 'thermal' | 'hydraulic' | 'wind',
    config: ErosionConfig
  ): Array<{ x: number; y: number; change: number }> {
    const { width, height } = this.courseData;
    const preview: Array<{ x: number; y: number; change: number }> = [];

    const originalElevations: number[][] = [];
    for (let y = 0; y < height; y++) {
      originalElevations[y] = [];
      for (let x = 0; x < width; x++) {
        originalElevations[y][x] = this.getElevationAt(x, y);
      }
    }

    switch (type) {
      case 'thermal':
        this.applyThermalErosion(
          config.iterations || 5,
          config.talusAngle || 1.5,
          config.erosionRate || 0.3
        );
        break;
      case 'hydraulic':
        this.applyHydraulicErosion(
          config.droplets || 500,
          config.inertia || 0.05,
          config.sedimentCapacity || 4,
          config.minSlope || 0.01,
          config.erosionRate || 0.3,
          config.depositionRate || 0.3,
          config.evaporationRate || 0.01,
          config.maxSteps || 64
        );
        break;
      case 'wind':
        this.applyWindErosion(
          config.iterations || 3,
          config.windDirX || 1,
          config.windDirY || 0,
          config.windStrength || 0.5,
          config.particleSize || 0.1
        );
        break;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const change = this.getElevationAt(x, y) - originalElevations[y][x];
        if (change !== 0) {
          preview.push({ x, y, change });
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.setElevationAtInternal(x, y, originalElevations[y][x]);
      }
    }

    return preview;
  }

  public findConnectedRegions(maxElevationDelta: number = 2): TerrainRegion[] {
    const { width, height } = this.courseData;
    const visited: boolean[][] = [];
    const regions: TerrainRegion[] = [];

    for (let y = 0; y < height; y++) {
      visited[y] = new Array(width).fill(false);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited[y][x]) continue;

        const region = this.floodFillConnectedRegion(x, y, visited, maxElevationDelta);
        if (region.tiles.length > 0) {
          regions.push(region);
        }
      }
    }

    return regions.sort((a, b) => b.tiles.length - a.tiles.length);
  }

  private floodFillConnectedRegion(
    startX: number,
    startY: number,
    visited: boolean[][],
    maxElevationDelta: number
  ): TerrainRegion {
    const { width, height } = this.courseData;
    const tiles: Array<{ x: number; y: number }> = [];
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let minElev = Infinity;
    let maxElev = -Infinity;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[y][x]) continue;

      visited[y][x] = true;
      tiles.push({ x, y });

      const elev = this.getElevationAt(x, y);
      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);

      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ];

      for (const neighbor of neighbors) {
        if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
        if (visited[neighbor.y][neighbor.x]) continue;

        const neighborElev = this.getElevationAt(neighbor.x, neighbor.y);
        if (Math.abs(neighborElev - elev) <= maxElevationDelta) {
          queue.push(neighbor);
        }
      }
    }

    return {
      tiles,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      area: tiles.length
    };
  }

  public findIsolatedRegions(minRegionSize: number = 5, maxElevationDelta: number = 2): TerrainRegion[] {
    const regions = this.findConnectedRegions(maxElevationDelta);
    if (regions.length <= 1) return [];

    return regions.slice(1).filter(r => r.tiles.length >= minRegionSize);
  }

  public isReachable(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    maxElevationDelta: number = 2
  ): boolean {
    const { width, height } = this.courseData;
    const visited: boolean[][] = [];

    for (let y = 0; y < height; y++) {
      visited[y] = new Array(width).fill(false);
    }

    const queue: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      if (x === toX && y === toY) return true;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[y][x]) continue;

      visited[y][x] = true;

      const currentElev = this.getElevationAt(x, y);
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ];

      for (const neighbor of neighbors) {
        if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
        if (visited[neighbor.y][neighbor.x]) continue;

        const neighborElev = this.getElevationAt(neighbor.x, neighbor.y);
        if (Math.abs(neighborElev - currentElev) <= maxElevationDelta) {
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  public getReachableTiles(
    fromX: number,
    fromY: number,
    maxElevationDelta: number = 2
  ): Array<{ x: number; y: number }> {
    const { width, height } = this.courseData;
    const visited: boolean[][] = [];
    const reachable: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      visited[y] = new Array(width).fill(false);
    }

    const queue: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[y][x]) continue;

      visited[y][x] = true;
      reachable.push({ x, y });

      const currentElev = this.getElevationAt(x, y);
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ];

      for (const neighbor of neighbors) {
        if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
        if (visited[neighbor.y][neighbor.x]) continue;

        const neighborElev = this.getElevationAt(neighbor.x, neighbor.y);
        if (Math.abs(neighborElev - currentElev) <= maxElevationDelta) {
          queue.push(neighbor);
        }
      }
    }

    return reachable;
  }

  public getBridgePoints(
    region1: TerrainRegion,
    region2: TerrainRegion
  ): Array<{ from: { x: number; y: number }; to: { x: number; y: number }; distance: number }> {
    const bridges: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; distance: number }> = [];

    for (const tile1 of region1.tiles) {
      for (const tile2 of region2.tiles) {
        const distance = Math.abs(tile1.x - tile2.x) + Math.abs(tile1.y - tile2.y);
        if (distance <= 3) {
          bridges.push({
            from: tile1,
            to: tile2,
            distance
          });
        }
      }
    }

    return bridges.sort((a, b) => a.distance - b.distance);
  }

  public connectRegions(
    region1: TerrainRegion,
    region2: TerrainRegion,
    rampWidth: number = 1
  ): number {
    const bridges = this.getBridgePoints(region1, region2);
    if (bridges.length === 0) return 0;

    const bridge = bridges[0];
    const result = this.createRamp(
      bridge.from.x,
      bridge.from.y,
      bridge.to.x,
      bridge.to.y,
      rampWidth
    );

    return result.tilesModified;
  }

  public getConnectivityStatistics(): {
    totalRegions: number;
    mainRegionSize: number;
    isolatedRegions: number;
    isolatedTiles: number;
    connectivityPercentage: number;
  } {
    const regions = this.findConnectedRegions(this.constraints.maxSlopeDelta);
    const { width, height } = this.courseData;
    const totalTiles = width * height;

    if (regions.length === 0) {
      return {
        totalRegions: 0,
        mainRegionSize: 0,
        isolatedRegions: 0,
        isolatedTiles: 0,
        connectivityPercentage: 0
      };
    }

    const mainRegionSize = regions[0].tiles.length;
    const isolatedTiles = totalTiles - mainRegionSize;

    return {
      totalRegions: regions.length,
      mainRegionSize,
      isolatedRegions: regions.length - 1,
      isolatedTiles,
      connectivityPercentage: (mainRegionSize / totalTiles) * 100
    };
  }

  public findChokepointsInRegion(region: TerrainRegion): Array<{ x: number; y: number; score: number }> {
    const tileSet = new Set(region.tiles.map(t => `${t.x}_${t.y}`));
    const chokepoints: Array<{ x: number; y: number; score: number }> = [];

    for (const tile of region.tiles) {
      let neighborCount = 0;
      const neighbors = [
        { x: tile.x - 1, y: tile.y },
        { x: tile.x + 1, y: tile.y },
        { x: tile.x, y: tile.y - 1 },
        { x: tile.x, y: tile.y + 1 }
      ];

      for (const neighbor of neighbors) {
        if (tileSet.has(`${neighbor.x}_${neighbor.y}`)) {
          neighborCount++;
        }
      }

      if (neighborCount <= 2 && neighborCount > 0) {
        const score = 3 - neighborCount;
        chokepoints.push({ x: tile.x, y: tile.y, score });
      }
    }

    return chokepoints.sort((a, b) => b.score - a.score);
  }

  public mirrorHorizontal(centerX?: number): number {
    const { width, height } = this.courseData;
    const center = centerX ?? Math.floor(width / 2);
    let modifiedCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < center; x++) {
        const mirrorX = width - 1 - x;
        if (mirrorX <= center || mirrorX >= width) continue;

        const elevation = this.getElevationAt(x, y);
        if (this.getElevationAt(mirrorX, y) !== elevation) {
          this.setElevationAtInternal(mirrorX, y, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public mirrorVertical(centerY?: number): number {
    const { width, height } = this.courseData;
    const center = centerY ?? Math.floor(height / 2);
    let modifiedCount = 0;

    for (let y = 0; y < center; y++) {
      const mirrorY = height - 1 - y;
      if (mirrorY <= center || mirrorY >= height) continue;

      for (let x = 0; x < width; x++) {
        const elevation = this.getElevationAt(x, y);
        if (this.getElevationAt(x, mirrorY) !== elevation) {
          this.setElevationAtInternal(x, mirrorY, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public flipHorizontal(): number {
    const { width, height } = this.courseData;
    let modifiedCount = 0;

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(this.getElevationAt(x, y));
      }
      row.reverse();
      for (let x = 0; x < width; x++) {
        if (this.getElevationAt(x, y) !== row[x]) {
          this.setElevationAtInternal(x, y, row[x]);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public flipVertical(): number {
    const { width, height } = this.courseData;
    let modifiedCount = 0;

    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = this.getElevationAt(x, y);
      }
    }
    grid.reverse();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.getElevationAt(x, y) !== grid[y][x]) {
          this.setElevationAtInternal(x, y, grid[y][x]);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public rotateArea(
    centerX: number,
    centerY: number,
    radius: number,
    angleDegrees: number
  ): number {
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    const originalElevations: Map<string, number> = new Map();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          originalElevations.set(`${x}_${y}`, this.getElevationAt(x, y));
        }
      }
    }

    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance > radius) continue;

        const relX = x - centerX;
        const relY = y - centerY;
        const srcX = Math.round(centerX + relX * cos + relY * sin);
        const srcY = Math.round(centerY - relX * sin + relY * cos);

        const srcKey = `${srcX}_${srcY}`;
        if (originalElevations.has(srcKey)) {
          const elevation = originalElevations.get(srcKey)!;
          if (this.getElevationAt(x, y) !== elevation) {
            this.setElevationAtInternal(x, y, elevation);
            modifiedCount++;
          }
        }
      }
    }

    return modifiedCount;
  }

  public scaleElevation(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    scaleFactor: number
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.round(currentElev * scaleFactor);
        const clampedElev = Math.max(0, Math.min(50, newElev));

        if (currentElev !== clampedElev) {
          this.setElevationAtInternal(x, y, clampedElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public offsetElevation(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    offset: number
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        const newElev = currentElev + offset;
        const clampedElev = Math.max(0, Math.min(50, newElev));

        if (currentElev !== clampedElev) {
          this.setElevationAtInternal(x, y, clampedElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public invertElevation(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let minElev = Infinity;
    let maxElev = -Infinity;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }
    }

    if (minElev === Infinity) return 0;

    let modifiedCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        const invertedElev = maxElev - (currentElev - minElev);

        if (currentElev !== invertedElev) {
          this.setElevationAtInternal(x, y, invertedElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public normalizeElevation(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    targetMin: number = 0,
    targetMax: number = 10
  ): number {
    const minX = Math.max(0, Math.min(startX, endX));
    const maxX = Math.min(this.courseData.width - 1, Math.max(startX, endX));
    const minY = Math.max(0, Math.min(startY, endY));
    const maxY = Math.min(this.courseData.height - 1, Math.max(startY, endY));

    let currentMin = Infinity;
    let currentMax = -Infinity;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const elev = this.getElevationAt(x, y);
        currentMin = Math.min(currentMin, elev);
        currentMax = Math.max(currentMax, elev);
      }
    }

    if (currentMin === Infinity || currentMax === currentMin) return 0;

    let modifiedCount = 0;
    const range = currentMax - currentMin;
    const targetRange = targetMax - targetMin;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        const normalized = ((currentElev - currentMin) / range) * targetRange + targetMin;
        const newElev = Math.round(normalized);

        if (currentElev !== newElev) {
          this.setElevationAtInternal(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }
}

export interface TerrainRegion {
  tiles: Array<{ x: number; y: number }>;
  minElevation: number;
  maxElevation: number;
  area: number;
}

export interface ErosionConfig {
  iterations?: number;
  talusAngle?: number;
  erosionRate?: number;
  depositionRate?: number;
  droplets?: number;
  inertia?: number;
  sedimentCapacity?: number;
  minSlope?: number;
  evaporationRate?: number;
  maxSteps?: number;
  windDirX?: number;
  windDirY?: number;
  windStrength?: number;
  particleSize?: number;
}

export interface NoiseConfig {
  scale?: number;
  octaves?: number;
  persistence?: number;
  minElevation?: number;
  maxElevation?: number;
  seed?: number;
  additive?: boolean;
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

export interface RCTImportOptions {
  validateConstraints?: boolean;
  applyMowedState?: boolean;
  updateWaterLevel?: boolean;
  scaleElevation?: boolean;
  rebuildMesh?: boolean;
}

export interface RCTImportResult {
  success: boolean;
  tilesImported: number;
  tilesSkipped: number;
  constraintViolations: number;
  warnings: string[];
  errors: string[];
}

export interface RCTValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    totalTiles: number;
    validTiles: number;
    invalidTiles: number;
    slopeViolations: number;
    outOfBoundsTiles: number;
    terrainTypeCounts: Record<TerrainType, number>;
  };
}

export interface RCTMergeOptions {
  conflictResolution?: 'newer' | 'older' | 'blend';
  blendOverlapping?: boolean;
  blendFactor?: number;
}

export interface HeightmapExportOptions {
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  normalize?: boolean;
  targetMin?: number;
  targetMax?: number;
  includeCornerHeights?: boolean;
}

export interface HeightmapData {
  width: number;
  height: number;
  heights: number[][];
  cornerHeights?: CornerHeights[][];
  metadata: {
    originalMinElevation: number;
    originalMaxElevation: number;
    normalized: boolean;
    targetMin?: number;
    targetMax?: number;
    region: { startX: number; startY: number; endX: number; endY: number };
  };
}

export interface HeightmapStatistics {
  width: number;
  height: number;
  totalPixels: number;
  min: number;
  max: number;
  range: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  histogram: number[];
}

export interface HeightmapCompareOptions {
  tolerance?: number;
}

export interface HeightmapComparison {
  identical: boolean;
  withinTolerance: boolean;
  dimensionsMatch: boolean;
  totalDifferences: number;
  maxDifference: number;
  avgDifference: number;
  differences: Array<{
    x: number;
    y: number;
    currentValue: number;
    otherValue: number;
    difference: number;
  }>;
}

export interface TerrainComparison {
  identical: boolean;
  elevationDifferences: number;
  terrainDifferences: number;
  maxElevationDiff: number;
  avgElevationDiff: number;
}

export interface TerrainFeatureClassification {
  peaks: Array<{ x: number; y: number; elevation: number; prominence: number }>;
  valleys: Array<{ x: number; y: number; elevation: number; depth: number }>;
  saddles: Array<{ x: number; y: number; elevation: number; passes: Array<{ dir: string; lowerElev: number }> }>;
  ridgeLines: Array<Array<{ x: number; y: number; elevation: number }>>;
  valleyLines: Array<Array<{ x: number; y: number; elevation: number }>>;
  peakCount: number;
  valleyCount: number;
  saddleCount: number;
  ridgeLineCount: number;
  valleyLineCount: number;
  totalRidgeLength: number;
  totalValleyLength: number;
}

export interface SurfaceRoughnessAnalysis {
  minRoughness: number;
  maxRoughness: number;
  avgRoughness: number;
  stdDevRoughness: number;
  smoothTileCount: number;
  roughTileCount: number;
  veryRoughTileCount: number;
  avgRugosity: number;
  terrainComplexity: number;
}

export interface LineSampleOptions {
  numSamples?: number;
  includeCornerHeights?: boolean;
  includePhysics?: boolean;
  includeSlope?: boolean;
}

export interface TerrainSamplePoint {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  t: number;
  distanceFromStart: number;
  elevation: number;
  terrainType: TerrainType;
  slopeAngle?: number;
  slopeDirection?: number;
  slopeMagnitude?: number;
  cornerHeights?: CornerHeights;
  physics?: SurfacePhysics;
}

export interface TerrainLineSample {
  samples: TerrainSamplePoint[];
  totalDistance: number;
  numValidSamples: number;
  elevationChange: number;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  avgSlope: number;
  maxSlope: number;
  overallGrade: number;
  terrainTypeChanges: number;
  dominantTerrainType: TerrainType;
}

export interface TerrainPathSample {
  segments: TerrainLineSample[];
  numSegments: number;
  totalDistance: number;
  totalElevationChange: number;
  minElevation: number;
  maxElevation: number;
  avgSlope: number;
  maxSlope: number;
  overallGrade: number;
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

export interface LineOfSightResult {
  visible: boolean;
  distance: number;
  obstructionPoint: { x: number; y: number } | null;
  obstructionElevation: number | null;
  clearanceAtTarget: number;
  sampleCount: number;
}

export type TerrainEventType = 'mowed' | 'unmowed' | 'tileVisible' | 'tileHidden' | 'chunkVisible' | 'chunkHidden' | 'terrainTypeChanged';

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

export type BrushShape = 'circle' | 'square' | 'diamond';
export type BrushOperation = 'raise' | 'lower' | 'smooth' | 'flatten' | 'noise' | 'mow' | 'unmow';

export interface TerrainBrush {
  shape: BrushShape;
  operation: BrushOperation;
  radius: number;
  strength: number;
  falloff: number;
  isActive: boolean;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CullingConfig {
  enabled: boolean;
  padding: number;
  updateInterval: number;
  lastUpdate: number;
  visibleTileCount: number;
  hiddenTileCount: number;
}

export interface ClipboardTileData {
  relativeX: number;
  relativeY: number;
  elevation: number;
  terrainCode: number;
  mowed: boolean;
  cornerHeights?: CornerHeights;
}

export interface TerrainClipboard {
  tiles: ClipboardTileData[];
  width: number;
  height: number;
  sourceMinX: number;
  sourceMinY: number;
  timestamp: number;
}

export interface TerrainStamp {
  id: string;
  name: string;
  tiles: ClipboardTileData[];
  width: number;
  height: number;
  category?: string;
  description?: string;
}

export interface SlopeValidation {
  isValid: boolean;
  maxDelta: number;
  violatingCorners: Array<{ corner1: string; corner2: string; delta: number }>;
}

export interface TerrainConstraints {
  maxSlopeDelta: number;
  enforceConstraints: boolean;
}
