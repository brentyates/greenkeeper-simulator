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

  public computeViewshed(
    observerX: number,
    observerY: number,
    observerHeight: number = 1.5,
    maxRadius?: number
  ): boolean[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const viewshed: boolean[][] = [];
    const radius = maxRadius ?? Math.max(width, height);
    const observerElev = (elevation[observerY]?.[observerX] ?? 0) + observerHeight;

    for (let y = 0; y < height; y++) {
      viewshed[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === observerX && y === observerY) {
          viewshed[y][x] = true;
          continue;
        }

        const dx = x - observerX;
        const dy = y - observerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) {
          viewshed[y][x] = false;
          continue;
        }

        viewshed[y][x] = this.isVisibleFromPoint(observerX, observerY, observerElev, x, y);
      }
    }

    return viewshed;
  }

  private isVisibleFromPoint(
    obsX: number,
    obsY: number,
    obsElev: number,
    targetX: number,
    targetY: number
  ): boolean {
    const { elevation } = this.courseData;
    if (!elevation) return false;

    const dx = targetX - obsX;
    const dy = targetY - obsY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return true;

    const targetElev = elevation[targetY]?.[targetX] ?? 0;
    const steps = Math.ceil(dist);
    const stepX = dx / steps;
    const stepY = dy / steps;

    let maxAngle = -Infinity;

    for (let i = 1; i <= steps; i++) {
      const sampleX = Math.round(obsX + stepX * i);
      const sampleY = Math.round(obsY + stepY * i);
      const sampleDist = Math.sqrt(Math.pow(sampleX - obsX, 2) + Math.pow(sampleY - obsY, 2));

      if (sampleDist === 0) continue;

      const sampleElev = elevation[sampleY]?.[sampleX] ?? 0;
      const angle = Math.atan2(sampleElev - obsElev, sampleDist);

      if (i === steps) {
        return angle >= maxAngle;
      }

      if (angle > maxAngle) {
        maxAngle = angle;
      }
    }

    const finalAngle = Math.atan2(targetElev - obsElev, dist);
    return finalAngle >= maxAngle;
  }

  public computeMultiViewshed(
    observers: Array<{ x: number; y: number; height?: number }>,
    maxRadius?: number
  ): { combined: boolean[][]; coverage: number[][] } {
    const { width, height, elevation } = this.courseData;
    if (!elevation || observers.length === 0) return { combined: [], coverage: [] };

    const combined: boolean[][] = [];
    const coverage: number[][] = [];

    for (let y = 0; y < height; y++) {
      combined[y] = [];
      coverage[y] = [];
      for (let x = 0; x < width; x++) {
        combined[y][x] = false;
        coverage[y][x] = 0;
      }
    }

    for (const obs of observers) {
      const viewshed = this.computeViewshed(obs.x, obs.y, obs.height ?? 1.5, maxRadius);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (viewshed[y]?.[x]) {
            combined[y][x] = true;
            coverage[y][x]++;
          }
        }
      }
    }

    return { combined, coverage };
  }

  public getViewshedStatistics(viewshed: boolean[][]): ViewshedStatistics {
    const { width, height } = this.courseData;
    let visibleCount = 0;
    let hiddenCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (viewshed[y]?.[x]) {
          visibleCount++;
        } else {
          hiddenCount++;
        }
      }
    }

    const totalTiles = visibleCount + hiddenCount;
    return {
      visibleCount,
      hiddenCount,
      totalTiles,
      visibilityPercentage: totalTiles > 0 ? (visibleCount / totalTiles) * 100 : 0
    };
  }

  public findOptimalObserverPosition(
    numCandidates: number = 100,
    observerHeight: number = 1.5,
    maxRadius?: number
  ): { x: number; y: number; visibilityPercentage: number } | null {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return null;

    let bestPosition: { x: number; y: number; visibilityPercentage: number } | null = null;
    let bestVisibility = -1;

    const stepX = Math.max(1, Math.floor(width / Math.sqrt(numCandidates)));
    const stepY = Math.max(1, Math.floor(height / Math.sqrt(numCandidates)));

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const viewshed = this.computeViewshed(x, y, observerHeight, maxRadius);
        const stats = this.getViewshedStatistics(viewshed);

        if (stats.visibilityPercentage > bestVisibility) {
          bestVisibility = stats.visibilityPercentage;
          bestPosition = { x, y, visibilityPercentage: stats.visibilityPercentage };
        }
      }
    }

    return bestPosition;
  }

  public computeCumulativeViewshed(gridSpacing: number = 5, observerHeight: number = 1.5): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const cumulativeVisibility: number[][] = [];

    for (let y = 0; y < height; y++) {
      cumulativeVisibility[y] = [];
      for (let x = 0; x < width; x++) {
        cumulativeVisibility[y][x] = 0;
      }
    }

    for (let obsY = 0; obsY < height; obsY += gridSpacing) {
      for (let obsX = 0; obsX < width; obsX += gridSpacing) {
        const viewshed = this.computeViewshed(obsX, obsY, observerHeight);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (viewshed[y]?.[x]) {
              cumulativeVisibility[y][x]++;
            }
          }
        }
      }
    }

    return cumulativeVisibility;
  }

  public getViewshedBoundary(viewshed: boolean[][]): Array<{ x: number; y: number }> {
    const { width, height } = this.courseData;
    const boundary: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!viewshed[y]?.[x]) continue;

        let isBoundary = false;
        for (let dy = -1; dy <= 1 && !isBoundary; dy++) {
          for (let dx = -1; dx <= 1 && !isBoundary; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || !viewshed[ny]?.[nx]) {
              isBoundary = true;
            }
          }
        }

        if (isBoundary) {
          boundary.push({ x, y });
        }
      }
    }

    return boundary;
  }

  public computeSolarExposure(
    sunAzimuth: number,
    sunAltitude: number
  ): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const exposure: number[][] = [];
    const sunAzRad = (sunAzimuth * Math.PI) / 180;
    const sunAltRad = (sunAltitude * Math.PI) / 180;

    const sunDirX = Math.cos(sunAltRad) * Math.sin(sunAzRad);
    const sunDirY = Math.cos(sunAltRad) * Math.cos(sunAzRad);
    const sunDirZ = Math.sin(sunAltRad);

    for (let y = 0; y < height; y++) {
      exposure[y] = [];
      for (let x = 0; x < width; x++) {
        const normal = this.getInterpolatedNormal(x, y);
        const dotProduct = normal.x * sunDirX + normal.y * sunDirY + normal.z * sunDirZ;
        exposure[y][x] = Math.max(0, dotProduct);
      }
    }

    return exposure;
  }

  public computeSolarExposureWithShadows(
    sunAzimuth: number,
    sunAltitude: number
  ): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const exposure = this.computeSolarExposure(sunAzimuth, sunAltitude);
    const shadowMap = this.computeShadowMap(
      Math.sin((sunAzimuth * Math.PI) / 180),
      Math.cos((sunAzimuth * Math.PI) / 180),
      sunAltitude
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (shadowMap[y]?.[x]) {
          exposure[y][x] = 0;
        }
      }
    }

    return exposure;
  }

  public computeDailyInsolation(
    latitude: number = 45,
    dayOfYear: number = 172,
    sampleInterval: number = 30
  ): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const insolation: number[][] = [];
    for (let y = 0; y < height; y++) {
      insolation[y] = [];
      for (let x = 0; x < width; x++) {
        insolation[y][x] = 0;
      }
    }

    const declination = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear) * Math.PI) / 180);
    const decRad = (declination * Math.PI) / 180;
    const latRad = (latitude * Math.PI) / 180;

    const hourAngleSunrise = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * (180 / Math.PI);

    for (let hourAngle = -hourAngleSunrise; hourAngle <= hourAngleSunrise; hourAngle += sampleInterval / 4) {
      const hourAngleRad = (hourAngle * Math.PI) / 180;

      const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
        Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
      const altitude = Math.asin(sinAlt) * (180 / Math.PI);

      if (altitude <= 0) continue;

      const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
        (Math.cos(latRad) * Math.cos(altitude * Math.PI / 180));
      let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
      if (hourAngle > 0) azimuth = 360 - azimuth;

      const exposure = this.computeSolarExposureWithShadows(azimuth, altitude);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          insolation[y][x] += exposure[y][x];
        }
      }
    }

    return insolation;
  }

  public getSolarAnalysis(latitude: number = 45, dayOfYear: number = 172): SolarAnalysis {
    const insolation = this.computeDailyInsolation(latitude, dayOfYear, 60);
    const { width, height } = this.courseData;

    let minInsolation = Infinity;
    let maxInsolation = -Infinity;
    let totalInsolation = 0;
    let count = 0;
    let shadedCount = 0;
    let fullSunCount = 0;

    const maxPossible = insolation.flat().reduce((max, val) => Math.max(max, val), 0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = insolation[y]?.[x] ?? 0;
        minInsolation = Math.min(minInsolation, val);
        maxInsolation = Math.max(maxInsolation, val);
        totalInsolation += val;
        count++;

        if (val < maxPossible * 0.2) shadedCount++;
        else if (val > maxPossible * 0.8) fullSunCount++;
      }
    }

    return {
      minInsolation: count > 0 ? minInsolation : 0,
      maxInsolation: count > 0 ? maxInsolation : 0,
      avgInsolation: count > 0 ? totalInsolation / count : 0,
      shadedTileCount: shadedCount,
      fullSunTileCount: fullSunCount,
      partialSunTileCount: count - shadedCount - fullSunCount,
      shadedPercentage: count > 0 ? (shadedCount / count) * 100 : 0,
      fullSunPercentage: count > 0 ? (fullSunCount / count) * 100 : 0
    };
  }

  public findSunniestAreas(minSize: number = 5, latitude: number = 45, dayOfYear: number = 172): Array<{ x: number; y: number; avgInsolation: number }> {
    const insolation = this.computeDailyInsolation(latitude, dayOfYear, 60);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgInsolation: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;
        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += insolation[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }
        areas.push({ x, y, avgInsolation: total / count });
      }
    }

    return areas.sort((a, b) => b.avgInsolation - a.avgInsolation).slice(0, 10);
  }

  public findShadiestAreas(minSize: number = 5, latitude: number = 45, dayOfYear: number = 172): Array<{ x: number; y: number; avgInsolation: number }> {
    const insolation = this.computeDailyInsolation(latitude, dayOfYear, 60);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgInsolation: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;
        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += insolation[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }
        areas.push({ x, y, avgInsolation: total / count });
      }
    }

    return areas.sort((a, b) => a.avgInsolation - b.avgInsolation).slice(0, 10);
  }

  public computeWindExposure(windAzimuth: number, maxFetchDistance: number = 20): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const exposure: number[][] = [];
    const windAzRad = (windAzimuth * Math.PI) / 180;
    const windDirX = Math.sin(windAzRad);
    const windDirY = Math.cos(windAzRad);

    for (let y = 0; y < height; y++) {
      exposure[y] = [];
      for (let x = 0; x < width; x++) {
        const currentElev = elevation[y][x];
        let fetchDistance = 0;
        let maxUpwindElev = currentElev;
        let totalElevDiff = 0;

        for (let d = 1; d <= maxFetchDistance; d++) {
          const upwindX = Math.round(x - windDirX * d);
          const upwindY = Math.round(y - windDirY * d);

          if (upwindX < 0 || upwindX >= width || upwindY < 0 || upwindY >= height) break;

          const upwindElev = elevation[upwindY][upwindX];
          if (upwindElev > maxUpwindElev) {
            maxUpwindElev = upwindElev;
          }
          totalElevDiff += currentElev - upwindElev;
          fetchDistance = d;
        }

        const shelteredFactor = maxUpwindElev > currentElev ?
          Math.max(0, 1 - (maxUpwindElev - currentElev) / 3) : 1;
        const fetchFactor = fetchDistance / maxFetchDistance;
        const exposureFactor = totalElevDiff > 0 ? Math.min(1, totalElevDiff / (fetchDistance * 2 + 1)) : 0;

        exposure[y][x] = shelteredFactor * (0.5 + 0.3 * fetchFactor + 0.2 * exposureFactor);
      }
    }

    return exposure;
  }

  public computeMultiDirectionalWindExposure(directions: number[] = [0, 45, 90, 135, 180, 225, 270, 315]): number[][] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    const combinedExposure: number[][] = [];
    for (let y = 0; y < height; y++) {
      combinedExposure[y] = [];
      for (let x = 0; x < width; x++) {
        combinedExposure[y][x] = 0;
      }
    }

    for (const dir of directions) {
      const dirExposure = this.computeWindExposure(dir);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          combinedExposure[y][x] += dirExposure[y]?.[x] ?? 0;
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        combinedExposure[y][x] /= directions.length;
      }
    }

    return combinedExposure;
  }

  public classifyWindExposure(gridX: number, gridY: number, windAzimuth: number): 'windward' | 'leeward' | 'neutral' {
    const { elevation } = this.courseData;
    if (!elevation || !this.isValidGridPosition(gridX, gridY)) return 'neutral';

    const aspect = this.getAspect(gridX, gridY);
    const angleDiff = Math.abs(((aspect - windAzimuth + 180) % 360) - 180);

    if (angleDiff < 60) return 'windward';
    if (angleDiff > 120) return 'leeward';
    return 'neutral';
  }

  public getWindExposureAnalysis(windAzimuth: number = 270): WindExposureAnalysis {
    const exposure = this.computeWindExposure(windAzimuth);
    const { width, height, elevation } = this.courseData;
    if (!elevation) {
      return {
        windDirection: windAzimuth,
        minExposure: 0,
        maxExposure: 0,
        avgExposure: 0,
        windwardTileCount: 0,
        leewardTileCount: 0,
        neutralTileCount: 0,
        highlyExposedPercentage: 0,
        shelteredPercentage: 0
      };
    }

    let minExposure = Infinity;
    let maxExposure = -Infinity;
    let totalExposure = 0;
    let count = 0;
    let windwardCount = 0;
    let leewardCount = 0;
    let neutralCount = 0;
    let highlyExposedCount = 0;
    let shelteredCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const exp = exposure[y]?.[x] ?? 0;
        minExposure = Math.min(minExposure, exp);
        maxExposure = Math.max(maxExposure, exp);
        totalExposure += exp;
        count++;

        if (exp > 0.8) highlyExposedCount++;
        if (exp < 0.3) shelteredCount++;

        const classification = this.classifyWindExposure(x, y, windAzimuth);
        if (classification === 'windward') windwardCount++;
        else if (classification === 'leeward') leewardCount++;
        else neutralCount++;
      }
    }

    return {
      windDirection: windAzimuth,
      minExposure: count > 0 ? minExposure : 0,
      maxExposure: count > 0 ? maxExposure : 0,
      avgExposure: count > 0 ? totalExposure / count : 0,
      windwardTileCount: windwardCount,
      leewardTileCount: leewardCount,
      neutralTileCount: neutralCount,
      highlyExposedPercentage: count > 0 ? (highlyExposedCount / count) * 100 : 0,
      shelteredPercentage: count > 0 ? (shelteredCount / count) * 100 : 0
    };
  }

  public findMostExposedAreas(windAzimuth: number = 270, minSize: number = 5): Array<{ x: number; y: number; avgExposure: number }> {
    const exposure = this.computeWindExposure(windAzimuth);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgExposure: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;
        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += exposure[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }
        areas.push({ x, y, avgExposure: total / count });
      }
    }

    return areas.sort((a, b) => b.avgExposure - a.avgExposure).slice(0, 10);
  }

  public findMostShelteredAreas(windAzimuth: number = 270, minSize: number = 5): Array<{ x: number; y: number; avgExposure: number }> {
    const exposure = this.computeWindExposure(windAzimuth);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgExposure: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;
        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += exposure[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }
        areas.push({ x, y, avgExposure: total / count });
      }
    }

    return areas.sort((a, b) => a.avgExposure - b.avgExposure).slice(0, 10);
  }

  public computeAccessibility(
    startX: number,
    startY: number,
    maxSlopeTraversable: number = 45,
    slopePenaltyFactor: number = 2.0
  ): number[][] {
    const { width, height, elevation } = this.courseData;
    const accessibility: number[][] = [];

    for (let y = 0; y < height; y++) {
      accessibility[y] = new Array(width).fill(Infinity);
    }

    if (!elevation || !this.isValidGridPosition(startX, startY)) {
      return accessibility;
    }

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; cost: number }> = [{ x: startX, y: startY, cost: 0 }];
    accessibility[startY][startX] = 0;

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      for (const n of neighbors) {
        const nx = current.x + n.dx;
        const ny = current.y + n.dy;

        if (!this.isValidGridPosition(nx, ny)) continue;

        const terrainCode = this.courseData.layout[ny][nx];
        if (terrainCode === 5) continue;

        const elevDiff = Math.abs(elevation[ny][nx] - elevation[current.y][current.x]);
        const dist = Math.sqrt(n.dx * n.dx + n.dy * n.dy);
        const slopeAngle = Math.atan2(elevDiff * 0.25, dist) * (180 / Math.PI);

        if (slopeAngle > maxSlopeTraversable) continue;

        const slopePenalty = 1 + (slopeAngle / 45) * slopePenaltyFactor;
        const moveCost = dist * slopePenalty;
        const newCost = current.cost + moveCost;

        if (newCost < accessibility[ny][nx]) {
          accessibility[ny][nx] = newCost;
          queue.push({ x: nx, y: ny, cost: newCost });
        }
      }
    }

    return accessibility;
  }

  public computeMultiPointAccessibility(
    startPoints: Array<{ x: number; y: number }>,
    maxSlopeTraversable: number = 45
  ): number[][] {
    const { width, height } = this.courseData;
    const combined: number[][] = [];

    for (let y = 0; y < height; y++) {
      combined[y] = new Array(width).fill(Infinity);
    }

    for (const start of startPoints) {
      const singleAccess = this.computeAccessibility(start.x, start.y, maxSlopeTraversable);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          combined[y][x] = Math.min(combined[y][x], singleAccess[y][x]);
        }
      }
    }

    return combined;
  }

  public classifyAccessibility(gridX: number, gridY: number, accessibility: number[][]): 'easy' | 'moderate' | 'difficult' | 'inaccessible' {
    if (!this.isValidGridPosition(gridX, gridY)) return 'inaccessible';

    const cost = accessibility[gridY][gridX];

    if (cost === Infinity) return 'inaccessible';
    if (cost <= 5) return 'easy';
    if (cost <= 15) return 'moderate';
    return 'difficult';
  }

  public getAccessibilityAnalysis(startX: number, startY: number): AccessibilityAnalysis {
    const accessibility = this.computeAccessibility(startX, startY);
    const { width, height } = this.courseData;

    let minCost = Infinity;
    let maxCost = 0;
    let totalCost = 0;
    let accessibleCount = 0;
    let easyCount = 0;
    let moderateCount = 0;
    let difficultCount = 0;
    let inaccessibleCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cost = accessibility[y][x];
        const classification = this.classifyAccessibility(x, y, accessibility);

        switch (classification) {
          case 'easy': easyCount++; break;
          case 'moderate': moderateCount++; break;
          case 'difficult': difficultCount++; break;
          case 'inaccessible': inaccessibleCount++; break;
        }

        if (cost !== Infinity) {
          minCost = Math.min(minCost, cost);
          maxCost = Math.max(maxCost, cost);
          totalCost += cost;
          accessibleCount++;
        }
      }
    }

    const totalTiles = width * height;

    return {
      startPoint: { x: startX, y: startY },
      minAccessibilityCost: minCost === Infinity ? 0 : minCost,
      maxAccessibilityCost: maxCost,
      avgAccessibilityCost: accessibleCount > 0 ? totalCost / accessibleCount : 0,
      accessibleTileCount: accessibleCount,
      inaccessibleTileCount: inaccessibleCount,
      easyAccessCount: easyCount,
      moderateAccessCount: moderateCount,
      difficultAccessCount: difficultCount,
      accessibilityPercentage: (accessibleCount / totalTiles) * 100
    };
  }

  public findBestAccessPoint(candidates: Array<{ x: number; y: number }>): { x: number; y: number; avgCost: number } | null {
    if (candidates.length === 0) return null;

    const { width, height } = this.courseData;
    let bestPoint: { x: number; y: number; avgCost: number } | null = null;

    for (const candidate of candidates) {
      const accessibility = this.computeAccessibility(candidate.x, candidate.y);
      let totalCost = 0;
      let count = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (accessibility[y][x] !== Infinity) {
            totalCost += accessibility[y][x];
            count++;
          }
        }
      }

      const avgCost = count > 0 ? totalCost / count : Infinity;

      if (!bestPoint || avgCost < bestPoint.avgCost) {
        bestPoint = { x: candidate.x, y: candidate.y, avgCost };
      }
    }

    return bestPoint;
  }

  public findInaccessibleAreas(startX: number, startY: number): Array<{ x: number; y: number }> {
    const accessibility = this.computeAccessibility(startX, startY);
    const { width, height } = this.courseData;
    const inaccessible: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (accessibility[y][x] === Infinity) {
          const terrainCode = this.courseData.layout[y][x];
          if (terrainCode !== 5) {
            inaccessible.push({ x, y });
          }
        }
      }
    }

    return inaccessible;
  }

  public findMostAccessibleArea(startX: number, startY: number, minSize: number = 5): { x: number; y: number; avgCost: number } | null {
    const accessibility = this.computeAccessibility(startX, startY);
    const { width, height } = this.courseData;
    let bestArea: { x: number; y: number; avgCost: number } | null = null;

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;
        let valid = true;

        for (let dy = 0; dy < minSize && valid; dy++) {
          for (let dx = 0; dx < minSize && valid; dx++) {
            const cost = accessibility[y + dy]?.[x + dx];
            if (cost === undefined || cost === Infinity) {
              valid = false;
            } else {
              total += cost;
              count++;
            }
          }
        }

        if (valid && count > 0) {
          const avgCost = total / count;
          if (!bestArea || avgCost < bestArea.avgCost) {
            bestArea = { x, y, avgCost };
          }
        }
      }
    }

    return bestArea;
  }

  public computeFrostRisk(nighttimeTemperature: number = -2): number[][] {
    const { width, height, elevation } = this.courseData;
    const frostRisk: number[][] = [];

    for (let y = 0; y < height; y++) {
      frostRisk[y] = new Array(width).fill(0);
    }

    if (!elevation) return frostRisk;

    let minElev = Infinity;
    let maxElev = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = elevation[y][x];
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }
    }
    const elevRange = maxElev - minElev || 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = elevation[y][x];
        const normalizedElev = (elev - minElev) / elevRange;

        const coldAirDrainage = 1 - normalizedElev;

        const aspect = this.getAspect(x, y);
        const aspectRad = aspect * (Math.PI / 180);
        const northFacing = Math.cos(aspectRad);
        const solarExposure = (northFacing + 1) / 2;

        const isSink = this.getFlowDirection(x, y);
        const sinkFactor = (isSink && isSink.dx === 0 && isSink.dy === 0) ? 0.3 : 0;

        const slope = this.getSlopeAngle(x, y);
        const slopeFactor = 1 - Math.min(slope / 45, 1) * 0.3;

        const temperatureFactor = Math.max(0, Math.min(1, (-nighttimeTemperature) / 10));

        const risk = (
          coldAirDrainage * 0.4 +
          solarExposure * 0.25 +
          sinkFactor +
          (1 - slopeFactor) * 0.05
        ) * temperatureFactor;

        frostRisk[y][x] = Math.max(0, Math.min(1, risk));
      }
    }

    return frostRisk;
  }

  public findFrostPockets(threshold: number = 0.6): Array<{ x: number; y: number; riskLevel: number }> {
    const frostRisk = this.computeFrostRisk();
    const { width, height } = this.courseData;
    const pockets: Array<{ x: number; y: number; riskLevel: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (frostRisk[y][x] >= threshold) {
          let isLocalMax = true;
          const neighbors = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
          ];

          for (const n of neighbors) {
            const nx = x + n.dx;
            const ny = y + n.dy;
            if (this.isValidGridPosition(nx, ny) && frostRisk[ny][nx] > frostRisk[y][x]) {
              isLocalMax = false;
              break;
            }
          }

          if (isLocalMax) {
            pockets.push({ x, y, riskLevel: frostRisk[y][x] });
          }
        }
      }
    }

    return pockets.sort((a, b) => b.riskLevel - a.riskLevel);
  }

  public computeColdAirDrainage(): number[][] {
    const { width, height, elevation } = this.courseData;
    const drainage: number[][] = [];

    for (let y = 0; y < height; y++) {
      drainage[y] = new Array(width).fill(0);
    }

    if (!elevation) return drainage;

    const elevations: Array<{ x: number; y: number; elev: number }> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        elevations.push({ x, y, elev: elevation[y][x] });
        drainage[y][x] = 1;
      }
    }

    elevations.sort((a, b) => b.elev - a.elev);

    for (const tile of elevations) {
      const flow = this.getFlowDirection(tile.x, tile.y);
      if (flow && (flow.dx !== 0 || flow.dy !== 0)) {
        const nx = tile.x + flow.dx;
        const ny = tile.y + flow.dy;
        if (this.isValidGridPosition(nx, ny)) {
          drainage[ny][nx] += drainage[tile.y][tile.x] * 0.8;
        }
      }
    }

    let maxDrainage = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        maxDrainage = Math.max(maxDrainage, drainage[y][x]);
      }
    }

    if (maxDrainage > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          drainage[y][x] = drainage[y][x] / maxDrainage;
        }
      }
    }

    return drainage;
  }

  public classifyFrostRisk(gridX: number, gridY: number, frostRisk: number[][]): 'none' | 'low' | 'moderate' | 'high' | 'severe' {
    if (!this.isValidGridPosition(gridX, gridY)) return 'none';

    const risk = frostRisk[gridY][gridX];

    if (risk < 0.2) return 'none';
    if (risk < 0.4) return 'low';
    if (risk < 0.6) return 'moderate';
    if (risk < 0.8) return 'high';
    return 'severe';
  }

  public getFrostAnalysis(nighttimeTemperature: number = -2): FrostAnalysis {
    const frostRisk = this.computeFrostRisk(nighttimeTemperature);
    const { width, height } = this.courseData;

    let minRisk = Infinity;
    let maxRisk = 0;
    let totalRisk = 0;
    let noneCount = 0;
    let lowCount = 0;
    let moderateCount = 0;
    let highCount = 0;
    let severeCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const risk = frostRisk[y][x];
        minRisk = Math.min(minRisk, risk);
        maxRisk = Math.max(maxRisk, risk);
        totalRisk += risk;

        const classification = this.classifyFrostRisk(x, y, frostRisk);
        switch (classification) {
          case 'none': noneCount++; break;
          case 'low': lowCount++; break;
          case 'moderate': moderateCount++; break;
          case 'high': highCount++; break;
          case 'severe': severeCount++; break;
        }
      }
    }

    const frostPockets = this.findFrostPockets();
    const totalTiles = width * height;

    return {
      nighttimeTemperature,
      minFrostRisk: minRisk,
      maxFrostRisk: maxRisk,
      avgFrostRisk: totalRisk / totalTiles,
      frostPocketCount: frostPockets.length,
      noneRiskCount: noneCount,
      lowRiskCount: lowCount,
      moderateRiskCount: moderateCount,
      highRiskCount: highCount,
      severeRiskCount: severeCount,
      atRiskPercentage: ((lowCount + moderateCount + highCount + severeCount) / totalTiles) * 100
    };
  }

  public findSafestFromFrost(minSize: number = 5): { x: number; y: number; avgRisk: number } | null {
    const frostRisk = this.computeFrostRisk();
    const { width, height } = this.courseData;
    let safestArea: { x: number; y: number; avgRisk: number } | null = null;

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += frostRisk[y + dy]?.[x + dx] ?? 1;
            count++;
          }
        }

        const avgRisk = total / count;
        if (!safestArea || avgRisk < safestArea.avgRisk) {
          safestArea = { x, y, avgRisk };
        }
      }
    }

    return safestArea;
  }

  public findMostFrostProneAreas(minSize: number = 5): Array<{ x: number; y: number; avgRisk: number }> {
    const frostRisk = this.computeFrostRisk();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgRisk: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += frostRisk[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgRisk: total / count });
      }
    }

    return areas.sort((a, b) => b.avgRisk - a.avgRisk).slice(0, 10);
  }

  public computeTerrainComplexity(): number[][] {
    const { width, height, elevation } = this.courseData;
    const complexity: number[][] = [];

    for (let y = 0; y < height; y++) {
      complexity[y] = new Array(width).fill(0);
    }

    if (!elevation) return complexity;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const slope = this.getSlopeAngle(x, y);
        const roughness = this.getLocalRoughness(x, y, 1);
        const curvature = this.getCurvature(x, y);

        const neighbors = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
        ];

        let aspectVariance = 0;
        const centerAspect = this.getAspect(x, y);
        let validNeighbors = 0;

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (this.isValidGridPosition(nx, ny)) {
            const neighborAspect = this.getAspect(nx, ny);
            const diff = Math.abs(((centerAspect - neighborAspect + 180) % 360) - 180);
            aspectVariance += diff;
            validNeighbors++;
          }
        }
        aspectVariance = validNeighbors > 0 ? aspectVariance / validNeighbors / 180 : 0;

        const slopeComponent = Math.min(slope / 60, 1) * 0.35;
        const roughnessComponent = Math.min(roughness / 2, 1) * 0.25;
        const curvatureComponent = Math.min(Math.abs(curvature.total) / 0.5, 1) * 0.25;
        const aspectComponent = aspectVariance * 0.15;

        complexity[y][x] = Math.min(1, slopeComponent + roughnessComponent + curvatureComponent + aspectComponent);
      }
    }

    return complexity;
  }

  public computeFeatureDensity(featureType: 'slope' | 'roughness' | 'peaks' | 'valleys', windowSize: number = 5): number[][] {
    const { width, height, elevation } = this.courseData;
    const density: number[][] = [];

    for (let y = 0; y < height; y++) {
      density[y] = new Array(width).fill(0);
    }

    if (!elevation) return density;

    let features: Set<string>;
    switch (featureType) {
      case 'peaks':
        features = new Set(this.findPeaks(0.5).map(p => `${p.x},${p.y}`));
        break;
      case 'valleys':
        features = new Set(this.findValleys(0.5).map(v => `${v.x},${v.y}`));
        break;
      default:
        features = new Set();
    }

    const halfWindow = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let count = 0;
        let total = 0;

        for (let dy = -halfWindow; dy <= halfWindow; dy++) {
          for (let dx = -halfWindow; dx <= halfWindow; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.isValidGridPosition(nx, ny)) continue;

            total++;
            if (featureType === 'slope') {
              const slope = this.getSlopeAngle(nx, ny);
              if (slope > 15) count++;
            } else if (featureType === 'roughness') {
              const rough = this.getLocalRoughness(nx, ny, 1);
              if (rough > 0.5) count++;
            } else {
              if (features.has(`${nx},${ny}`)) count++;
            }
          }
        }

        density[y][x] = total > 0 ? count / total : 0;
      }
    }

    return density;
  }

  public computeSpatialVariance(property: 'elevation' | 'slope' | 'aspect', windowSize: number = 5): number[][] {
    const { width, height, elevation } = this.courseData;
    const variance: number[][] = [];

    for (let y = 0; y < height; y++) {
      variance[y] = new Array(width).fill(0);
    }

    if (!elevation) return variance;

    const halfWindow = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const values: number[] = [];

        for (let dy = -halfWindow; dy <= halfWindow; dy++) {
          for (let dx = -halfWindow; dx <= halfWindow; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.isValidGridPosition(nx, ny)) continue;

            let value: number;
            switch (property) {
              case 'elevation':
                value = elevation[ny][nx];
                break;
              case 'slope':
                value = this.getSlopeAngle(nx, ny);
                break;
              case 'aspect':
                value = this.getAspect(nx, ny);
                break;
            }
            values.push(value);
          }
        }

        if (values.length > 1) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const sumSquaredDiff = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
          variance[y][x] = sumSquaredDiff / values.length;
        }
      }
    }

    return variance;
  }

  public getTerrainComplexityAnalysis(): TerrainComplexityAnalysis {
    const complexity = this.computeTerrainComplexity();
    const { width, height } = this.courseData;

    let minComplexity = Infinity;
    let maxComplexity = 0;
    let totalComplexity = 0;
    let simpleCount = 0;
    let moderateCount = 0;
    let complexCount = 0;
    let veryComplexCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = complexity[y][x];
        minComplexity = Math.min(minComplexity, c);
        maxComplexity = Math.max(maxComplexity, c);
        totalComplexity += c;

        if (c < 0.25) simpleCount++;
        else if (c < 0.5) moderateCount++;
        else if (c < 0.75) complexCount++;
        else veryComplexCount++;
      }
    }

    const peaks = this.findPeaks(0.5);
    const valleys = this.findValleys(0.5);
    const ridges = this.findRidgeLines();
    const totalTiles = width * height;

    return {
      minComplexity,
      maxComplexity,
      avgComplexity: totalComplexity / totalTiles,
      simpleTileCount: simpleCount,
      moderateTileCount: moderateCount,
      complexTileCount: complexCount,
      veryComplexTileCount: veryComplexCount,
      peakCount: peaks.length,
      valleyCount: valleys.length,
      ridgeLineCount: ridges.length,
      overallComplexityScore: (totalComplexity / totalTiles) * 100
    };
  }

  public findMostComplexAreas(minSize: number = 5): Array<{ x: number; y: number; avgComplexity: number }> {
    const complexity = this.computeTerrainComplexity();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgComplexity: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += complexity[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgComplexity: total / count });
      }
    }

    return areas.sort((a, b) => b.avgComplexity - a.avgComplexity).slice(0, 10);
  }

  public findSimplestAreas(minSize: number = 5): Array<{ x: number; y: number; avgComplexity: number }> {
    const complexity = this.computeTerrainComplexity();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgComplexity: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += complexity[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgComplexity: total / count });
      }
    }

    return areas.sort((a, b) => a.avgComplexity - b.avgComplexity).slice(0, 10);
  }

  public classifyTerrainComplexity(gridX: number, gridY: number): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    const complexity = this.computeTerrainComplexity();
    if (!this.isValidGridPosition(gridX, gridY)) return 'simple';

    const c = complexity[gridY][gridX];

    if (c < 0.25) return 'simple';
    if (c < 0.5) return 'moderate';
    if (c < 0.75) return 'complex';
    return 'very_complex';
  }

  public computeTeeSuitability(): number[][] {
    const { width, height, elevation } = this.courseData;
    const suitability: number[][] = [];

    for (let y = 0; y < height; y++) {
      suitability[y] = new Array(width).fill(0);
    }

    if (!elevation) return suitability;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainCode = this.courseData.layout[y][x];
        if (terrainCode === 4 || terrainCode === 5) {
          suitability[y][x] = 0;
          continue;
        }

        const slope = this.getSlopeAngle(x, y);
        const slopeFactor = Math.max(0, 1 - slope / 5);

        const roughness = this.getLocalRoughness(x, y, 2);
        const roughnessFactor = Math.max(0, 1 - roughness);

        const accessibility = this.computeAccessibility(x, y, 30);
        let accessibleCount = 0;
        let totalNeighbors = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (this.isValidGridPosition(nx, ny)) {
              totalNeighbors++;
              if (accessibility[ny][nx] !== Infinity) accessibleCount++;
            }
          }
        }
        const accessibilityFactor = totalNeighbors > 0 ? accessibleCount / totalNeighbors : 0;

        suitability[y][x] = slopeFactor * 0.5 + roughnessFactor * 0.3 + accessibilityFactor * 0.2;
      }
    }

    return suitability;
  }

  public computeGreenSuitability(): number[][] {
    const { width, height, elevation } = this.courseData;
    const suitability: number[][] = [];

    for (let y = 0; y < height; y++) {
      suitability[y] = new Array(width).fill(0);
    }

    if (!elevation) return suitability;

    const flowAccumulation = this.computeFlowAccumulation();
    const frostRisk = this.computeFrostRisk();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainCode = this.courseData.layout[y][x];
        if (terrainCode === 4 || terrainCode === 5) {
          suitability[y][x] = 0;
          continue;
        }

        const slope = this.getSlopeAngle(x, y);
        const slopeFactor = Math.max(0, 1 - Math.abs(slope - 3) / 10);

        const roughness = this.getLocalRoughness(x, y, 3);
        const smoothnessFactor = Math.max(0, 1 - roughness * 2);

        const drainage = flowAccumulation[y]?.[x] ?? 0;
        const drainageFactor = Math.max(0, 1 - Math.min(drainage / 20, 1));

        const frost = frostRisk[y]?.[x] ?? 0;
        const frostFactor = 1 - frost;

        suitability[y][x] = slopeFactor * 0.35 + smoothnessFactor * 0.30 + drainageFactor * 0.20 + frostFactor * 0.15;
      }
    }

    return suitability;
  }

  public computeFairwaySuitability(): number[][] {
    const { width, height, elevation } = this.courseData;
    const suitability: number[][] = [];

    for (let y = 0; y < height; y++) {
      suitability[y] = new Array(width).fill(0);
    }

    if (!elevation) return suitability;

    const complexity = this.computeTerrainComplexity();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainCode = this.courseData.layout[y][x];
        if (terrainCode === 4 || terrainCode === 5) {
          suitability[y][x] = 0;
          continue;
        }

        const slope = this.getSlopeAngle(x, y);
        const slopeFactor = Math.max(0, 1 - slope / 25);

        const comp = complexity[y][x];
        const simpleFactor = 1 - comp;

        const roughness = this.getLocalRoughness(x, y, 2);
        const roughnessFactor = Math.max(0, 1 - roughness);

        suitability[y][x] = slopeFactor * 0.45 + simpleFactor * 0.30 + roughnessFactor * 0.25;
      }
    }

    return suitability;
  }

  public getGolfSuitabilityAnalysis(): GolfSuitabilityAnalysis {
    const teeSuitability = this.computeTeeSuitability();
    const greenSuitability = this.computeGreenSuitability();
    const fairwaySuitability = this.computeFairwaySuitability();
    const { width, height } = this.courseData;

    let teeStats = { min: Infinity, max: 0, total: 0, excellentCount: 0 };
    let greenStats = { min: Infinity, max: 0, total: 0, excellentCount: 0 };
    let fairwayStats = { min: Infinity, max: 0, total: 0, excellentCount: 0 };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tee = teeSuitability[y][x];
        const green = greenSuitability[y][x];
        const fairway = fairwaySuitability[y][x];

        teeStats.min = Math.min(teeStats.min, tee);
        teeStats.max = Math.max(teeStats.max, tee);
        teeStats.total += tee;
        if (tee >= 0.8) teeStats.excellentCount++;

        greenStats.min = Math.min(greenStats.min, green);
        greenStats.max = Math.max(greenStats.max, green);
        greenStats.total += green;
        if (green >= 0.8) greenStats.excellentCount++;

        fairwayStats.min = Math.min(fairwayStats.min, fairway);
        fairwayStats.max = Math.max(fairwayStats.max, fairway);
        fairwayStats.total += fairway;
        if (fairway >= 0.8) fairwayStats.excellentCount++;
      }
    }

    const totalTiles = width * height;

    return {
      teeMinSuitability: teeStats.min,
      teeMaxSuitability: teeStats.max,
      teeAvgSuitability: teeStats.total / totalTiles,
      teeExcellentCount: teeStats.excellentCount,
      greenMinSuitability: greenStats.min,
      greenMaxSuitability: greenStats.max,
      greenAvgSuitability: greenStats.total / totalTiles,
      greenExcellentCount: greenStats.excellentCount,
      fairwayMinSuitability: fairwayStats.min,
      fairwayMaxSuitability: fairwayStats.max,
      fairwayAvgSuitability: fairwayStats.total / totalTiles,
      fairwayExcellentCount: fairwayStats.excellentCount,
      overallPlayabilityScore: ((teeStats.total + greenStats.total + fairwayStats.total) / (totalTiles * 3)) * 100
    };
  }

  public findBestTeeLocations(minSize: number = 3): Array<{ x: number; y: number; avgSuitability: number }> {
    const suitability = this.computeTeeSuitability();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgSuitability: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += suitability[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgSuitability: total / count });
      }
    }

    return areas.sort((a, b) => b.avgSuitability - a.avgSuitability).slice(0, 10);
  }

  public findBestGreenLocations(minSize: number = 5): Array<{ x: number; y: number; avgSuitability: number }> {
    const suitability = this.computeGreenSuitability();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgSuitability: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            total += suitability[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgSuitability: total / count });
      }
    }

    return areas.sort((a, b) => b.avgSuitability - a.avgSuitability).slice(0, 10);
  }

  public findBestFairwayRoutes(startX: number, startY: number, endX: number, endY: number): Array<{ x: number; y: number }> {
    const suitability = this.computeFairwaySuitability();

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }>; cost: number }> = [
      { x: startX, y: startY, path: [{ x: startX, y: startY }], cost: 0 }
    ];

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (current.x === endX && current.y === endY) {
        return current.path;
      }

      for (const n of neighbors) {
        const nx = current.x + n.dx;
        const ny = current.y + n.dy;

        if (!this.isValidGridPosition(nx, ny)) continue;
        if (visited.has(`${nx},${ny}`)) continue;

        const suit = suitability[ny]?.[nx] ?? 0;
        const moveCost = 1 / (suit + 0.1);
        const dist = Math.sqrt(n.dx * n.dx + n.dy * n.dy);
        const heuristic = Math.sqrt(Math.pow(endX - nx, 2) + Math.pow(endY - ny, 2));

        queue.push({
          x: nx,
          y: ny,
          path: [...current.path, { x: nx, y: ny }],
          cost: current.cost + moveCost * dist + heuristic * 0.5
        });
      }
    }

    return [];
  }

  public computeDiurnalShadowPattern(
    latitude: number = 45,
    dayOfYear: number = 172,
    hourInterval: number = 1
  ): number[][] {
    const { width, height, elevation } = this.courseData;
    const shadowHours: number[][] = [];

    for (let y = 0; y < height; y++) {
      shadowHours[y] = new Array(width).fill(0);
    }

    if (!elevation) return shadowHours;

    const latRad = latitude * (Math.PI / 180);
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * (Math.PI / 180);

    const sunriseHourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination));
    const sunriseHour = 12 - (sunriseHourAngle * 12 / Math.PI);
    const sunsetHour = 12 + (sunriseHourAngle * 12 / Math.PI);

    let sampleCount = 0;

    for (let hour = sunriseHour; hour <= sunsetHour; hour += hourInterval) {
      const hourAngle = (hour - 12) * 15 * (Math.PI / 180);
      const sinAlt = Math.sin(latRad) * Math.sin(declination) +
        Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);
      const altitude = Math.asin(sinAlt) * (180 / Math.PI);

      if (altitude <= 0) continue;

      const cosAz = (Math.sin(declination) - Math.sin(latRad) * sinAlt) /
        (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
      let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
      if (hour > 12) azimuth = 360 - azimuth;

      const shadowMap = this.computeSolarExposureWithShadows(azimuth, altitude);
      sampleCount++;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (shadowMap[y][x] < 0.5) {
            shadowHours[y][x] += hourInterval;
          }
        }
      }
    }

    return shadowHours;
  }

  public computeShadowConsistency(latitude: number = 45, dayOfYear: number = 172): number[][] {
    const { width, height, elevation } = this.courseData;
    const consistency: number[][] = [];

    for (let y = 0; y < height; y++) {
      consistency[y] = new Array(width).fill(0);
    }

    if (!elevation) return consistency;

    const morningPattern = this.computeDiurnalShadowPattern(latitude, dayOfYear, 0.5);
    const latRad = latitude * (Math.PI / 180);
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * (Math.PI / 180);
    const sunriseHourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination));
    const daylightHours = (2 * sunriseHourAngle * 12 / Math.PI);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const shadowTime = morningPattern[y][x];
        const shadowRatio = shadowTime / daylightHours;

        if (shadowRatio < 0.1) {
          consistency[y][x] = 1;
        } else if (shadowRatio > 0.9) {
          consistency[y][x] = 1;
        } else {
          consistency[y][x] = 1 - 2 * Math.abs(shadowRatio - 0.5);
        }
      }
    }

    return consistency;
  }

  public classifyShadowPattern(gridX: number, gridY: number, shadowHours: number[][], daylightHours: number): 'full_sun' | 'mostly_sun' | 'partial_shade' | 'mostly_shade' | 'full_shade' {
    if (!this.isValidGridPosition(gridX, gridY)) return 'partial_shade';

    const hours = shadowHours[gridY][gridX];
    const ratio = hours / daylightHours;

    if (ratio < 0.1) return 'full_sun';
    if (ratio < 0.3) return 'mostly_sun';
    if (ratio < 0.7) return 'partial_shade';
    if (ratio < 0.9) return 'mostly_shade';
    return 'full_shade';
  }

  public getDiurnalShadowAnalysis(latitude: number = 45, dayOfYear: number = 172): DiurnalShadowAnalysis {
    const shadowHours = this.computeDiurnalShadowPattern(latitude, dayOfYear);
    const consistency = this.computeShadowConsistency(latitude, dayOfYear);
    const { width, height } = this.courseData;

    const latRad = latitude * (Math.PI / 180);
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * (Math.PI / 180);
    const sunriseHourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination));
    const daylightHours = (2 * sunriseHourAngle * 12 / Math.PI);

    let minShadowHours = Infinity;
    let maxShadowHours = 0;
    let totalShadowHours = 0;
    let fullSunCount = 0;
    let mostlySunCount = 0;
    let partialShadeCount = 0;
    let mostlyShadeCount = 0;
    let fullShadeCount = 0;
    let totalConsistency = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hours = shadowHours[y][x];
        minShadowHours = Math.min(minShadowHours, hours);
        maxShadowHours = Math.max(maxShadowHours, hours);
        totalShadowHours += hours;
        totalConsistency += consistency[y][x];

        const classification = this.classifyShadowPattern(x, y, shadowHours, daylightHours);
        switch (classification) {
          case 'full_sun': fullSunCount++; break;
          case 'mostly_sun': mostlySunCount++; break;
          case 'partial_shade': partialShadeCount++; break;
          case 'mostly_shade': mostlyShadeCount++; break;
          case 'full_shade': fullShadeCount++; break;
        }
      }
    }

    const totalTiles = width * height;

    return {
      daylightHours,
      minShadowHours,
      maxShadowHours,
      avgShadowHours: totalShadowHours / totalTiles,
      fullSunTileCount: fullSunCount,
      mostlySunTileCount: mostlySunCount,
      partialShadeTileCount: partialShadeCount,
      mostlyShadeTileCount: mostlyShadeCount,
      fullShadeTileCount: fullShadeCount,
      avgConsistency: totalConsistency / totalTiles,
      sunnyPercentage: ((fullSunCount + mostlySunCount) / totalTiles) * 100
    };
  }

  public findConsistentlySunnyAreas(latitude: number = 45, dayOfYear: number = 172, minSize: number = 5): Array<{ x: number; y: number; avgSunHours: number }> {
    const shadowHours = this.computeDiurnalShadowPattern(latitude, dayOfYear);
    const { width, height } = this.courseData;

    const latRad = latitude * (Math.PI / 180);
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81)) * (Math.PI / 180);
    const sunriseHourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination));
    const daylightHours = (2 * sunriseHourAngle * 12 / Math.PI);

    const areas: Array<{ x: number; y: number; avgSunHours: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let totalSun = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            const shadow = shadowHours[y + dy]?.[x + dx] ?? daylightHours;
            totalSun += (daylightHours - shadow);
            count++;
          }
        }

        areas.push({ x, y, avgSunHours: totalSun / count });
      }
    }

    return areas.sort((a, b) => b.avgSunHours - a.avgSunHours).slice(0, 10);
  }

  public findConsistentlyShadyAreas(latitude: number = 45, dayOfYear: number = 172, minSize: number = 5): Array<{ x: number; y: number; avgShadeHours: number }> {
    const shadowHours = this.computeDiurnalShadowPattern(latitude, dayOfYear);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgShadeHours: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let totalShade = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            totalShade += shadowHours[y + dy]?.[x + dx] ?? 0;
            count++;
          }
        }

        areas.push({ x, y, avgShadeHours: totalShade / count });
      }
    }

    return areas.sort((a, b) => b.avgShadeHours - a.avgShadeHours).slice(0, 10);
  }

  public getSeasonDayOfYear(season: 'spring' | 'summer' | 'autumn' | 'winter'): number {
    switch (season) {
      case 'spring': return 80;
      case 'summer': return 172;
      case 'autumn': return 266;
      case 'winter': return 355;
    }
  }

  public computeSeasonalSunExposure(latitude: number = 45): { spring: number[][]; summer: number[][]; autumn: number[][]; winter: number[][] } {
    return {
      spring: this.computeDailyInsolation(latitude, this.getSeasonDayOfYear('spring')),
      summer: this.computeDailyInsolation(latitude, this.getSeasonDayOfYear('summer')),
      autumn: this.computeDailyInsolation(latitude, this.getSeasonDayOfYear('autumn')),
      winter: this.computeDailyInsolation(latitude, this.getSeasonDayOfYear('winter'))
    };
  }

  public computeSeasonalFrostRisk(): { spring: number[][]; summer: number[][]; autumn: number[][]; winter: number[][] } {
    const springTemp = 2;
    const summerTemp = 15;
    const autumnTemp = 5;
    const winterTemp = -8;

    return {
      spring: this.computeFrostRisk(springTemp),
      summer: this.computeFrostRisk(summerTemp),
      autumn: this.computeFrostRisk(autumnTemp),
      winter: this.computeFrostRisk(winterTemp)
    };
  }

  public computeAnnualSunVariation(): number[][] {
    const { width, height, elevation } = this.courseData;
    const variation: number[][] = [];

    for (let y = 0; y < height; y++) {
      variation[y] = new Array(width).fill(0);
    }

    if (!elevation) return variation;

    const seasonal = this.computeSeasonalSunExposure();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const values = [
          seasonal.spring[y]?.[x] ?? 0,
          seasonal.summer[y]?.[x] ?? 0,
          seasonal.autumn[y]?.[x] ?? 0,
          seasonal.winter[y]?.[x] ?? 0
        ];
        const min = Math.min(...values);
        const max = Math.max(...values);
        variation[y][x] = max - min;
      }
    }

    return variation;
  }

  public classifySeasonalPattern(gridX: number, gridY: number): 'year_round_sunny' | 'year_round_shaded' | 'summer_sunny' | 'variable' {
    if (!this.isValidGridPosition(gridX, gridY)) return 'variable';

    const seasonal = this.computeSeasonalSunExposure();
    const summer = seasonal.summer[gridY]?.[gridX] ?? 0;
    const winter = seasonal.winter[gridY]?.[gridX] ?? 0;

    const avgSummer = this.getArrayAverage(seasonal.summer);
    const avgWinter = this.getArrayAverage(seasonal.winter);

    if (summer > avgSummer * 1.2 && winter > avgWinter * 1.2) {
      return 'year_round_sunny';
    }
    if (summer < avgSummer * 0.8 && winter < avgWinter * 0.8) {
      return 'year_round_shaded';
    }
    if (summer > avgSummer * 1.2 && winter < avgWinter * 0.8) {
      return 'summer_sunny';
    }
    return 'variable';
  }

  private getArrayAverage(arr: number[][]): number {
    let total = 0;
    let count = 0;
    for (const row of arr) {
      for (const val of row) {
        total += val;
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }

  public getSeasonalAnalysis(latitude: number = 45): SeasonalTerrainAnalysis {
    const sunExposure = this.computeSeasonalSunExposure(latitude);
    const frostRisk = this.computeSeasonalFrostRisk();
    const annualVariation = this.computeAnnualSunVariation();
    const { width, height } = this.courseData;

    const calcStats = (arr: number[][]) => {
      let min = Infinity, max = 0, total = 0, count = 0;
      for (const row of arr) {
        for (const val of row) {
          min = Math.min(min, val);
          max = Math.max(max, val);
          total += val;
          count++;
        }
      }
      return { min, max, avg: count > 0 ? total / count : 0 };
    };

    const springSun = calcStats(sunExposure.spring);
    const summerSun = calcStats(sunExposure.summer);
    const autumnSun = calcStats(sunExposure.autumn);
    const winterSun = calcStats(sunExposure.winter);

    const springFrost = calcStats(frostRisk.spring);
    const summerFrost = calcStats(frostRisk.summer);
    const autumnFrost = calcStats(frostRisk.autumn);
    const winterFrost = calcStats(frostRisk.winter);

    const variationStats = calcStats(annualVariation);

    let yearRoundSunny = 0, yearRoundShaded = 0, summerSunny = 0, variable = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pattern = this.classifySeasonalPattern(x, y);
        switch (pattern) {
          case 'year_round_sunny': yearRoundSunny++; break;
          case 'year_round_shaded': yearRoundShaded++; break;
          case 'summer_sunny': summerSunny++; break;
          case 'variable': variable++; break;
        }
      }
    }

    return {
      springSunAvg: springSun.avg,
      summerSunAvg: summerSun.avg,
      autumnSunAvg: autumnSun.avg,
      winterSunAvg: winterSun.avg,
      springFrostRiskAvg: springFrost.avg,
      summerFrostRiskAvg: summerFrost.avg,
      autumnFrostRiskAvg: autumnFrost.avg,
      winterFrostRiskAvg: winterFrost.avg,
      annualSunVariationAvg: variationStats.avg,
      yearRoundSunnyCount: yearRoundSunny,
      yearRoundShadedCount: yearRoundShaded,
      summerSunnyOnlyCount: summerSunny,
      variablePatternCount: variable
    };
  }

  public findBestYearRoundSunAreas(latitude: number = 45, minSize: number = 5): Array<{ x: number; y: number; avgAnnualSun: number }> {
    const seasonal = this.computeSeasonalSunExposure(latitude);
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgAnnualSun: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            const spring = seasonal.spring[y + dy]?.[x + dx] ?? 0;
            const summer = seasonal.summer[y + dy]?.[x + dx] ?? 0;
            const autumn = seasonal.autumn[y + dy]?.[x + dx] ?? 0;
            const winter = seasonal.winter[y + dy]?.[x + dx] ?? 0;
            total += (spring + summer + autumn + winter) / 4;
            count++;
          }
        }

        areas.push({ x, y, avgAnnualSun: total / count });
      }
    }

    return areas.sort((a, b) => b.avgAnnualSun - a.avgAnnualSun).slice(0, 10);
  }

  public findLowestAnnualFrostRisk(minSize: number = 5): Array<{ x: number; y: number; avgFrostRisk: number }> {
    const seasonal = this.computeSeasonalFrostRisk();
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; avgFrostRisk: number }> = [];

    for (let y = 0; y <= height - minSize; y++) {
      for (let x = 0; x <= width - minSize; x++) {
        let total = 0;
        let count = 0;

        for (let dy = 0; dy < minSize; dy++) {
          for (let dx = 0; dx < minSize; dx++) {
            const spring = seasonal.spring[y + dy]?.[x + dx] ?? 0;
            const summer = seasonal.summer[y + dy]?.[x + dx] ?? 0;
            const autumn = seasonal.autumn[y + dy]?.[x + dx] ?? 0;
            const winter = seasonal.winter[y + dy]?.[x + dx] ?? 0;
            total += (spring + summer + autumn + winter) / 4;
            count++;
          }
        }

        areas.push({ x, y, avgFrostRisk: total / count });
      }
    }

    return areas.sort((a, b) => a.avgFrostRisk - b.avgFrostRisk).slice(0, 10);
  }

  public computeMicroclimateFactors(gridX: number, gridY: number): MicroclimateFactors {
    if (!this.isValidGridPosition(gridX, gridY)) {
      return { sunExposure: 0, windExposure: 0, frostRisk: 0, drainageQuality: 0, elevation: 0 };
    }

    const { elevation } = this.courseData;
    if (!elevation) {
      return { sunExposure: 0, windExposure: 0, frostRisk: 0, drainageQuality: 0, elevation: 0 };
    }

    const solarData = this.computeDailyInsolation(45, 172);
    const sunExposure = solarData[gridY]?.[gridX] ?? 0;

    const windData = this.computeWindExposure(270);
    const windExposure = windData[gridY]?.[gridX] ?? 0;

    const frostData = this.computeFrostRisk();
    const frostRisk = frostData[gridY]?.[gridX] ?? 0;

    const flowAcc = this.computeFlowAccumulation();
    const drainage = flowAcc[gridY]?.[gridX] ?? 0;
    const drainageQuality = Math.max(0, 1 - Math.min(drainage / 20, 1));

    const elev = elevation[gridY][gridX];

    return { sunExposure, windExposure, frostRisk, drainageQuality, elevation: elev };
  }

  public classifyMicroclimate(gridX: number, gridY: number): MicroclimateZone {
    const factors = this.computeMicroclimateFactors(gridX, gridY);

    const avgSun = this.getArrayAverage(this.computeDailyInsolation(45, 172));
    const avgWind = this.getArrayAverage(this.computeWindExposure(270));
    const avgFrost = this.getArrayAverage(this.computeFrostRisk());

    const isHighSun = factors.sunExposure > avgSun * 1.2;
    const isLowSun = factors.sunExposure < avgSun * 0.8;
    const isHighWind = factors.windExposure > avgWind * 1.3;
    const isLowWind = factors.windExposure < avgWind * 0.7;
    const isHighFrost = factors.frostRisk > avgFrost * 1.3;
    const isPoorDrainage = factors.drainageQuality < 0.4;

    if (isHighSun && isLowWind && !isHighFrost && !isPoorDrainage) {
      return 'warm_sheltered';
    }
    if (isHighSun && isHighWind && !isHighFrost) {
      return 'warm_exposed';
    }
    if (isLowSun && isLowWind && !isPoorDrainage) {
      return 'cool_sheltered';
    }
    if (isLowSun && isHighWind) {
      return 'cool_exposed';
    }
    if (isHighFrost || isPoorDrainage) {
      return 'frost_prone';
    }
    if (isPoorDrainage && isLowSun) {
      return 'wet_shaded';
    }
    return 'transitional';
  }

  public computeMicroclimateMap(): MicroclimateZone[][] {
    const { width, height, elevation } = this.courseData;
    const map: MicroclimateZone[][] = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        map[y][x] = elevation ? this.classifyMicroclimate(x, y) : 'transitional';
      }
    }

    return map;
  }

  public getMicroclimateAnalysis(): MicroclimateAnalysis {
    const map = this.computeMicroclimateMap();
    const { width, height } = this.courseData;

    const counts: Record<MicroclimateZone, number> = {
      'warm_sheltered': 0,
      'warm_exposed': 0,
      'cool_sheltered': 0,
      'cool_exposed': 0,
      'frost_prone': 0,
      'wet_shaded': 0,
      'transitional': 0
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        counts[map[y][x]]++;
      }
    }

    const zoneCount = Object.values(counts).filter(c => c > 0).length;

    return {
      warmShelteredCount: counts['warm_sheltered'],
      warmExposedCount: counts['warm_exposed'],
      coolShelteredCount: counts['cool_sheltered'],
      coolExposedCount: counts['cool_exposed'],
      frostProneCount: counts['frost_prone'],
      wetShadedCount: counts['wet_shaded'],
      transitionalCount: counts['transitional'],
      dominantZone: (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as MicroclimateZone),
      zoneCount,
      diversityIndex: zoneCount / 7
    };
  }

  public findMicroclimateZoneBoundaries(): Array<{ x: number; y: number; zone: MicroclimateZone; adjacentZone: MicroclimateZone }> {
    const map = this.computeMicroclimateMap();
    const { width, height } = this.courseData;
    const boundaries: Array<{ x: number; y: number; zone: MicroclimateZone; adjacentZone: MicroclimateZone }> = [];

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const zone = map[y][x];
        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          if (this.isValidGridPosition(nx, ny)) {
            const adjacentZone = map[ny][nx];
            if (zone !== adjacentZone) {
              boundaries.push({ x, y, zone, adjacentZone });
            }
          }
        }
      }
    }

    return boundaries;
  }

  public findLargestMicroclimateZone(targetZone: MicroclimateZone): Array<{ x: number; y: number }> {
    const map = this.computeMicroclimateMap();
    const { width, height } = this.courseData;
    const visited = new Set<string>();
    let largestRegion: Array<{ x: number; y: number }> = [];

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key) || map[y][x] !== targetZone) continue;

        const region: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const curKey = `${current.x},${current.y}`;
          if (visited.has(curKey)) continue;
          visited.add(curKey);
          region.push(current);

          for (const n of neighbors) {
            const nx = current.x + n.dx;
            const ny = current.y + n.dy;
            if (this.isValidGridPosition(nx, ny) && map[ny][nx] === targetZone && !visited.has(`${nx},${ny}`)) {
              queue.push({ x: nx, y: ny });
            }
          }
        }

        if (region.length > largestRegion.length) {
          largestRegion = region;
        }
      }
    }

    return largestRegion;
  }

  public computeErosionRisk(rainfallIntensity: number = 1.0): number[][] {
    const { width, height } = this.courseData;
    const erosionRisk: number[][] = [];

    const flowAccumulation = this.computeFlowAccumulation();

    for (let y = 0; y < height; y++) {
      erosionRisk[y] = [];
      for (let x = 0; x < width; x++) {
        const slope = this.getSlopeAngle(x, y);
        const slopeRad = slope * Math.PI / 180;

        const slopeFactor = Math.pow(Math.sin(slopeRad), 0.8) * Math.pow(Math.cos(slopeRad), 0.1);

        const flowFactor = Math.min(1.0, flowAccumulation[y][x] / 20);

        const terrainType = this.getTerrainTypeAt(x, y);
        let coverFactor = 1.0;
        if (terrainType === 'fairway' || terrainType === 'rough') {
          coverFactor = 0.3;
        } else if (terrainType === 'green') {
          coverFactor = 0.2;
        } else if (terrainType === 'bunker') {
          coverFactor = 1.5;
        } else if (terrainType === 'water') {
          coverFactor = 0.0;
        }

        const risk = rainfallIntensity * slopeFactor * (0.4 + 0.6 * flowFactor) * coverFactor;
        erosionRisk[y][x] = Math.min(1.0, Math.max(0, risk));
      }
    }

    return erosionRisk;
  }

  public findErosionHotspots(threshold: number = 0.6, rainfallIntensity: number = 1.0): Array<{ x: number; y: number; riskLevel: number }> {
    const erosionRisk = this.computeErosionRisk(rainfallIntensity);
    const { width, height } = this.courseData;
    const hotspots: Array<{ x: number; y: number; riskLevel: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (erosionRisk[y][x] >= threshold) {
          hotspots.push({ x, y, riskLevel: erosionRisk[y][x] });
        }
      }
    }

    hotspots.sort((a, b) => b.riskLevel - a.riskLevel);
    return hotspots;
  }

  public classifyErosionRisk(gridX: number, gridY: number, rainfallIntensity: number = 1.0): 'negligible' | 'low' | 'moderate' | 'high' | 'severe' {
    const erosionRisk = this.computeErosionRisk(rainfallIntensity);
    const risk = erosionRisk[gridY]?.[gridX] ?? 0;

    if (risk < 0.1) return 'negligible';
    if (risk < 0.3) return 'low';
    if (risk < 0.5) return 'moderate';
    if (risk < 0.7) return 'high';
    return 'severe';
  }

  public computeSedimentTransportPath(startX: number, startY: number, maxSteps: number = 100): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let currentX = startX;
    let currentY = startY;

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: -1 }
    ];

    for (let step = 0; step < maxSteps; step++) {
      const currentElev = this.getElevationAt(currentX, currentY);
      let steepestGradient = 0;
      let nextX = currentX;
      let nextY = currentY;

      for (const n of neighbors) {
        const nx = currentX + n.dx;
        const ny = currentY + n.dy;
        if (!this.isValidGridPosition(nx, ny)) continue;

        const neighborElev = this.getElevationAt(nx, ny);
        const distance = Math.sqrt(n.dx * n.dx + n.dy * n.dy);
        const gradient = (currentElev - neighborElev) / distance;

        if (gradient > steepestGradient) {
          steepestGradient = gradient;
          nextX = nx;
          nextY = ny;
        }
      }

      if (nextX === currentX && nextY === currentY) break;

      const terrainType = this.getTerrainTypeAt(nextX, nextY);
      if (terrainType === 'water') {
        path.push({ x: nextX, y: nextY });
        break;
      }

      path.push({ x: nextX, y: nextY });
      currentX = nextX;
      currentY = nextY;
    }

    return path;
  }

  public getErosionAnalysis(rainfallIntensity: number = 1.0): ErosionAnalysis {
    const erosionRisk = this.computeErosionRisk(rainfallIntensity);
    const { width, height } = this.courseData;

    const counts = {
      negligible: 0,
      low: 0,
      moderate: 0,
      high: 0,
      severe: 0
    };

    let totalRisk = 0;
    let maxRisk = 0;
    let maxRiskLocation = { x: 0, y: 0 };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const risk = erosionRisk[y][x];
        totalRisk += risk;

        if (risk > maxRisk) {
          maxRisk = risk;
          maxRiskLocation = { x, y };
        }

        if (risk < 0.1) counts.negligible++;
        else if (risk < 0.3) counts.low++;
        else if (risk < 0.5) counts.moderate++;
        else if (risk < 0.7) counts.high++;
        else counts.severe++;
      }
    }

    const totalTiles = width * height;

    return {
      averageRisk: totalRisk / totalTiles,
      maxRisk,
      maxRiskLocation,
      negligibleCount: counts.negligible,
      lowRiskCount: counts.low,
      moderateRiskCount: counts.moderate,
      highRiskCount: counts.high,
      severeRiskCount: counts.severe,
      atRiskPercentage: ((counts.moderate + counts.high + counts.severe) / totalTiles) * 100
    };
  }

  public findErosionBarrierLocations(rainfallIntensity: number = 1.0): Array<{ x: number; y: number; priority: number }> {
    const erosionRisk = this.computeErosionRisk(rainfallIntensity);
    const flowAccumulation = this.computeFlowAccumulation();
    const { width, height } = this.courseData;

    const barrierLocations: Array<{ x: number; y: number; priority: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (erosionRisk[y][x] < 0.5) continue;

        const downstreamFlow = flowAccumulation[y][x];
        if (downstreamFlow < 3) continue;

        const terrainType = this.getTerrainTypeAt(x, y);
        if (terrainType === 'water' || terrainType === 'bunker') continue;

        const priority = erosionRisk[y][x] * (1 + Math.log(1 + downstreamFlow) / 3);
        barrierLocations.push({ x, y, priority });
      }
    }

    barrierLocations.sort((a, b) => b.priority - a.priority);
    return barrierLocations.slice(0, 20);
  }

  public computeSurfaceWaterAccumulation(rainfallAmount: number = 1.0, iterations: number = 50): number[][] {
    const { width, height } = this.courseData;
    const waterDepth: number[][] = [];

    for (let y = 0; y < height; y++) {
      waterDepth[y] = [];
      for (let x = 0; x < width; x++) {
        waterDepth[y][x] = rainfallAmount;
      }
    }

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    for (let iter = 0; iter < iterations; iter++) {
      const newWater: number[][] = [];
      for (let y = 0; y < height; y++) {
        newWater[y] = [];
        for (let x = 0; x < width; x++) {
          newWater[y][x] = waterDepth[y][x];
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (waterDepth[y][x] <= 0) continue;

          const currentElev = this.getElevationAt(x, y);
          const waterSurface = currentElev + waterDepth[y][x];

          let totalOutflow = 0;
          const outflows: Array<{ nx: number; ny: number; amount: number }> = [];

          for (const n of neighbors) {
            const nx = x + n.dx;
            const ny = y + n.dy;
            if (!this.isValidGridPosition(nx, ny)) continue;

            const neighborElev = this.getElevationAt(nx, ny);
            const neighborWaterSurface = neighborElev + waterDepth[ny][nx];

            if (waterSurface > neighborWaterSurface) {
              const diff = waterSurface - neighborWaterSurface;
              const flow = Math.min(waterDepth[y][x] * 0.25, diff * 0.5);
              if (flow > 0.001) {
                outflows.push({ nx, ny, amount: flow });
                totalOutflow += flow;
              }
            }
          }

          if (totalOutflow > waterDepth[y][x]) {
            const scale = waterDepth[y][x] / totalOutflow;
            for (const outflow of outflows) {
              outflow.amount *= scale;
            }
            totalOutflow = waterDepth[y][x];
          }

          newWater[y][x] -= totalOutflow;
          for (const outflow of outflows) {
            newWater[outflow.ny][outflow.nx] += outflow.amount;
          }
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          waterDepth[y][x] = newWater[y][x];
        }
      }
    }

    return waterDepth;
  }

  public findPondingAreas(rainfallAmount: number = 1.0, threshold: number = 0.5): Array<{ x: number; y: number; depth: number }> {
    const waterDepth = this.computeSurfaceWaterAccumulation(rainfallAmount);
    const { width, height } = this.courseData;
    const pondingAreas: Array<{ x: number; y: number; depth: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (waterDepth[y][x] >= threshold) {
          pondingAreas.push({ x, y, depth: waterDepth[y][x] });
        }
      }
    }

    pondingAreas.sort((a, b) => b.depth - a.depth);
    return pondingAreas;
  }

  public classifyPondingRisk(gridX: number, gridY: number, rainfallAmount: number = 1.0): 'none' | 'minimal' | 'moderate' | 'significant' | 'severe' {
    const waterDepth = this.computeSurfaceWaterAccumulation(rainfallAmount);
    const depth = waterDepth[gridY]?.[gridX] ?? 0;

    if (depth < 0.1) return 'none';
    if (depth < 0.3) return 'minimal';
    if (depth < 0.6) return 'moderate';
    if (depth < 1.0) return 'significant';
    return 'severe';
  }

  public getPondingAnalysis(rainfallAmount: number = 1.0): PondingAnalysis {
    const waterDepth = this.computeSurfaceWaterAccumulation(rainfallAmount);
    const { width, height } = this.courseData;

    const counts = {
      none: 0,
      minimal: 0,
      moderate: 0,
      significant: 0,
      severe: 0
    };

    let totalDepth = 0;
    let maxDepth = 0;
    let maxDepthLocation = { x: 0, y: 0 };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const depth = waterDepth[y][x];
        totalDepth += depth;

        if (depth > maxDepth) {
          maxDepth = depth;
          maxDepthLocation = { x, y };
        }

        if (depth < 0.1) counts.none++;
        else if (depth < 0.3) counts.minimal++;
        else if (depth < 0.6) counts.moderate++;
        else if (depth < 1.0) counts.significant++;
        else counts.severe++;
      }
    }

    const totalTiles = width * height;

    return {
      averageDepth: totalDepth / totalTiles,
      maxDepth,
      maxDepthLocation,
      noneCount: counts.none,
      minimalCount: counts.minimal,
      moderateCount: counts.moderate,
      significantCount: counts.significant,
      severeCount: counts.severe,
      pondingPercentage: ((counts.moderate + counts.significant + counts.severe) / totalTiles) * 100
    };
  }

  public findDrainageOutlets(rainfallAmount: number = 1.0): Array<{ x: number; y: number }> {
    const waterDepth = this.computeSurfaceWaterAccumulation(rainfallAmount);
    const { width, height } = this.courseData;
    const outlets: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          if (waterDepth[y][x] > 0.1) {
            outlets.push({ x, y });
          }
        }

        const terrainType = this.getTerrainTypeAt(x, y);
        if (terrainType === 'water' && waterDepth[y][x] > 0.1) {
          outlets.push({ x, y });
        }
      }
    }

    return outlets;
  }

  public findOptimalDrainLocations(rainfallAmount: number = 1.0, count: number = 5): Array<{ x: number; y: number; impact: number }> {
    const waterDepth = this.computeSurfaceWaterAccumulation(rainfallAmount);
    const { width, height } = this.courseData;

    const candidates: Array<{ x: number; y: number; impact: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (waterDepth[y][x] < 0.3) continue;

        const terrainType = this.getTerrainTypeAt(x, y);
        if (terrainType === 'water' || terrainType === 'bunker') continue;

        let neighboringWater = 0;
        const neighbors = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
        ];
        for (const n of neighbors) {
          neighboringWater += waterDepth[y + n.dy]?.[x + n.dx] ?? 0;
        }

        const impact = waterDepth[y][x] + neighboringWater * 0.5;
        candidates.push({ x, y, impact });
      }
    }

    candidates.sort((a, b) => b.impact - a.impact);
    return candidates.slice(0, count);
  }

  public computeVisibilityFromPoint(viewX: number, viewY: number, viewerHeight: number = 1.8): boolean[][] {
    const { width, height } = this.courseData;
    const visibility: boolean[][] = [];

    const viewerElev = this.getElevationAt(viewX, viewY) + viewerHeight;

    for (let y = 0; y < height; y++) {
      visibility[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === viewX && y === viewY) {
          visibility[y][x] = true;
          continue;
        }
        visibility[y][x] = this.isLineOfSightClear(viewX, viewY, viewerElev, x, y);
      }
    }

    return visibility;
  }

  private isLineOfSightClear(x1: number, y1: number, viewerElev: number, x2: number, y2: number): boolean {
    const targetElev = this.getElevationAt(x2, y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return true;

    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
    const stepX = dx / steps;
    const stepY = dy / steps;
    const elevStep = (targetElev - viewerElev) / steps;

    for (let i = 1; i < steps; i++) {
      const checkX = x1 + stepX * i;
      const checkY = y1 + stepY * i;
      const expectedElev = viewerElev + elevStep * i;

      const terrainElev = this.getBilinearElevation(checkX, checkY);

      if (terrainElev > expectedElev + 0.1) {
        return false;
      }
    }

    return true;
  }

  public computeViewshedPercentage(viewX: number, viewY: number, viewerHeight: number = 1.8): number {
    const visibility = this.computeVisibilityFromPoint(viewX, viewY, viewerHeight);
    const { width, height } = this.courseData;

    let visibleCount = 0;
    let totalCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        totalCount++;
        if (visibility[y][x]) visibleCount++;
      }
    }

    return (visibleCount / totalCount) * 100;
  }

  public findHighVisibilityPoints(viewerHeight: number = 1.8, topN: number = 10): Array<{ x: number; y: number; visibilityPercent: number }> {
    const { width, height } = this.courseData;
    const results: Array<{ x: number; y: number; visibilityPercent: number }> = [];

    const step = Math.max(1, Math.floor(Math.min(width, height) / 20));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const visibilityPercent = this.computeViewshedPercentage(x, y, viewerHeight);
        results.push({ x, y, visibilityPercent });
      }
    }

    results.sort((a, b) => b.visibilityPercent - a.visibilityPercent);
    return results.slice(0, topN);
  }

  public computeMultiPointVisibility(viewerLocations: Array<{ x: number; y: number }>, viewerHeight: number = 1.8): number[][] {
    const { width, height } = this.courseData;
    const combinedVisibility: number[][] = [];

    for (let y = 0; y < height; y++) {
      combinedVisibility[y] = [];
      for (let x = 0; x < width; x++) {
        combinedVisibility[y][x] = 0;
      }
    }

    for (const viewer of viewerLocations) {
      const visibility = this.computeVisibilityFromPoint(viewer.x, viewer.y, viewerHeight);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (visibility[y][x]) {
            combinedVisibility[y][x]++;
          }
        }
      }
    }

    return combinedVisibility;
  }

  public classifyVisibility(gridX: number, gridY: number, viewerX: number, viewerY: number, viewerHeight: number = 1.8): 'visible' | 'partially_obscured' | 'hidden' {
    const visibility = this.computeVisibilityFromPoint(viewerX, viewerY, viewerHeight);

    if (visibility[gridY]?.[gridX]) return 'visible';

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    let neighborVisible = 0;
    for (const n of neighbors) {
      const nx = gridX + n.dx;
      const ny = gridY + n.dy;
      if (this.isValidGridPosition(nx, ny) && visibility[ny][nx]) {
        neighborVisible++;
      }
    }

    if (neighborVisible > 0) return 'partially_obscured';
    return 'hidden';
  }

  public getVisibilityAnalysis(viewerX: number, viewerY: number, viewerHeight: number = 1.8): VisibilityAnalysis {
    const visibility = this.computeVisibilityFromPoint(viewerX, viewerY, viewerHeight);
    const { width, height } = this.courseData;

    let visibleCount = 0;
    let hiddenCount = 0;
    let farthestVisible = { x: viewerX, y: viewerY, distance: 0 };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visibility[y][x]) {
          visibleCount++;
          const distance = Math.sqrt((x - viewerX) ** 2 + (y - viewerY) ** 2);
          if (distance > farthestVisible.distance) {
            farthestVisible = { x, y, distance };
          }
        } else {
          hiddenCount++;
        }
      }
    }

    const totalTiles = width * height;

    return {
      visibleCount,
      hiddenCount,
      visibilityPercentage: (visibleCount / totalTiles) * 100,
      farthestVisiblePoint: farthestVisible,
      viewerLocation: { x: viewerX, y: viewerY },
      viewerHeight
    };
  }

  public findBlindSpots(viewerLocations: Array<{ x: number; y: number }>, viewerHeight: number = 1.8): Array<{ x: number; y: number }> {
    const multiVisibility = this.computeMultiPointVisibility(viewerLocations, viewerHeight);
    const { width, height } = this.courseData;
    const blindSpots: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (multiVisibility[y][x] === 0) {
          blindSpots.push({ x, y });
        }
      }
    }

    return blindSpots;
  }

  public computeTerrainFrequencyComponents(windowSize: number = 8): FrequencyAnalysis {
    const { width, height } = this.courseData;

    let lowFreqEnergy = 0;
    let midFreqEnergy = 0;
    let highFreqEnergy = 0;

    for (let y = 0; y < height - windowSize; y += windowSize / 2) {
      for (let x = 0; x < width - windowSize; x += windowSize / 2) {
        const window = this.extractElevationWindow(x, y, windowSize);
        const { low, mid, high } = this.analyzeWindowFrequencies(window);
        lowFreqEnergy += low;
        midFreqEnergy += mid;
        highFreqEnergy += high;
      }
    }

    const totalEnergy = lowFreqEnergy + midFreqEnergy + highFreqEnergy || 1;

    return {
      lowFrequencyRatio: lowFreqEnergy / totalEnergy,
      midFrequencyRatio: midFreqEnergy / totalEnergy,
      highFrequencyRatio: highFreqEnergy / totalEnergy,
      dominantScale: lowFreqEnergy > midFreqEnergy && lowFreqEnergy > highFreqEnergy ? 'coarse' :
                     midFreqEnergy > highFreqEnergy ? 'medium' : 'fine',
      roughnessIndex: highFreqEnergy / (lowFreqEnergy + 0.001)
    };
  }

  private extractElevationWindow(startX: number, startY: number, size: number): number[][] {
    const window: number[][] = [];
    for (let dy = 0; dy < size; dy++) {
      window[dy] = [];
      for (let dx = 0; dx < size; dx++) {
        const x = Math.min(startX + dx, this.courseData.width - 1);
        const y = Math.min(startY + dy, this.courseData.height - 1);
        window[dy][dx] = this.getElevationAt(x, y);
      }
    }
    return window;
  }

  private analyzeWindowFrequencies(window: number[][]): { low: number; mid: number; high: number } {
    const size = window.length;
    let meanElev = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        meanElev += window[y][x];
      }
    }
    meanElev /= (size * size);

    let variance = 0;
    let localVariance = 0;
    let microVariance = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const diff = window[y][x] - meanElev;
        variance += diff * diff;

        if (x > 0 && y > 0) {
          const localDiff = window[y][x] - window[y - 1][x - 1];
          localVariance += localDiff * localDiff;
        }

        if (x > 0) {
          const microDiff = window[y][x] - window[y][x - 1];
          microVariance += microDiff * microDiff;
        }
      }
    }

    return {
      low: variance / (size * size),
      mid: localVariance / ((size - 1) * (size - 1) || 1),
      high: microVariance / (size * (size - 1) || 1)
    };
  }

  public classifyRoughness(gridX: number, gridY: number, radius: number = 3): 'smooth' | 'slight' | 'moderate' | 'rough' | 'very_rough' {
    const roughness = this.getLocalRoughness(gridX, gridY, radius);

    if (roughness < 0.05) return 'smooth';
    if (roughness < 0.15) return 'slight';
    if (roughness < 0.3) return 'moderate';
    if (roughness < 0.5) return 'rough';
    return 'very_rough';
  }

  public getRoughnessAnalysis(radius: number = 3): RoughnessAnalysis {
    const roughnessMap = this.computeRoughnessMap(radius);
    const { width, height } = this.courseData;

    const counts = {
      smooth: 0,
      slight: 0,
      moderate: 0,
      rough: 0,
      very_rough: 0
    };

    let totalRoughness = 0;
    let maxRoughness = 0;
    let maxRoughnessLocation = { x: 0, y: 0 };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const roughness = roughnessMap[y][x];
        totalRoughness += roughness;

        if (roughness > maxRoughness) {
          maxRoughness = roughness;
          maxRoughnessLocation = { x, y };
        }

        if (roughness < 0.05) counts.smooth++;
        else if (roughness < 0.15) counts.slight++;
        else if (roughness < 0.3) counts.moderate++;
        else if (roughness < 0.5) counts.rough++;
        else counts.very_rough++;
      }
    }

    const totalTiles = width * height;

    return {
      averageRoughness: totalRoughness / totalTiles,
      maxRoughness,
      maxRoughnessLocation,
      smoothCount: counts.smooth,
      slightCount: counts.slight,
      moderateCount: counts.moderate,
      roughCount: counts.rough,
      veryRoughCount: counts.very_rough,
      smoothPercentage: (counts.smooth / totalTiles) * 100
    };
  }

  public findRoughPatches(threshold: number = 0.3, radius: number = 3): Array<{ x: number; y: number; roughness: number }> {
    const roughnessMap = this.computeRoughnessMap(radius);
    const { width, height } = this.courseData;
    const patches: Array<{ x: number; y: number; roughness: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (roughnessMap[y][x] >= threshold) {
          patches.push({ x, y, roughness: roughnessMap[y][x] });
        }
      }
    }

    patches.sort((a, b) => b.roughness - a.roughness);
    return patches;
  }

  public detectTerrainTypeEdges(): Array<{ x: number; y: number; fromType: string; toType: string; direction: string }> {
    const { width, height } = this.courseData;
    const edges: Array<{ x: number; y: number; fromType: string; toType: string; direction: string }> = [];

    const directions = [
      { dx: 1, dy: 0, name: 'east' },
      { dx: 0, dy: 1, name: 'south' }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentType = this.getTerrainTypeAt(x, y);

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (!this.isValidGridPosition(nx, ny)) continue;

          const neighborType = this.getTerrainTypeAt(nx, ny);
          if (currentType !== neighborType) {
            edges.push({
              x, y,
              fromType: currentType,
              toType: neighborType,
              direction: dir.name
            });
          }
        }
      }
    }

    return edges;
  }

  public detectElevationEdges(minDelta: number = 0.5): Array<{ x: number; y: number; elevDelta: number; direction: string }> {
    const { width, height } = this.courseData;
    const edges: Array<{ x: number; y: number; elevDelta: number; direction: string }> = [];

    const directions = [
      { dx: 1, dy: 0, name: 'east' },
      { dx: 0, dy: 1, name: 'south' }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentElev = this.getElevationAt(x, y);

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (!this.isValidGridPosition(nx, ny)) continue;

          const neighborElev = this.getElevationAt(nx, ny);
          const delta = Math.abs(currentElev - neighborElev);

          if (delta >= minDelta) {
            edges.push({
              x, y,
              elevDelta: delta,
              direction: dir.name
            });
          }
        }
      }
    }

    return edges;
  }

  public computeEdgeDensityMap(): number[][] {
    const { width, height } = this.courseData;
    const densityMap: number[][] = [];
    const radius = 2;

    for (let y = 0; y < height; y++) {
      densityMap[y] = [];
      for (let x = 0; x < width; x++) {
        let edgeCount = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.isValidGridPosition(nx, ny)) continue;

            const currentType = this.getTerrainTypeAt(nx, ny);
            if (nx + 1 < width && this.getTerrainTypeAt(nx + 1, ny) !== currentType) edgeCount++;
            if (ny + 1 < height && this.getTerrainTypeAt(nx, ny + 1) !== currentType) edgeCount++;
          }
        }

        densityMap[y][x] = edgeCount / ((2 * radius + 1) * (2 * radius + 1));
      }
    }

    return densityMap;
  }

  public findBoundaryZones(bufferDistance: number = 2): Set<string> {
    const typeEdges = this.detectTerrainTypeEdges();
    const boundaryZone = new Set<string>();

    for (const edge of typeEdges) {
      for (let dy = -bufferDistance; dy <= bufferDistance; dy++) {
        for (let dx = -bufferDistance; dx <= bufferDistance; dx++) {
          const bx = edge.x + dx;
          const by = edge.y + dy;
          if (this.isValidGridPosition(bx, by)) {
            boundaryZone.add(`${bx},${by}`);
          }
        }
      }
    }

    return boundaryZone;
  }

  public classifyEdgeType(gridX: number, gridY: number): 'interior' | 'edge' | 'corner' | 'boundary' {
    const currentType = this.getTerrainTypeAt(gridX, gridY);
    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    let differentCount = 0;
    let adjacentDifferent = false;

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      const nx = gridX + n.dx;
      const ny = gridY + n.dy;

      if (!this.isValidGridPosition(nx, ny)) {
        differentCount++;
        continue;
      }

      if (this.getTerrainTypeAt(nx, ny) !== currentType) {
        differentCount++;
        const nextIdx = (i + 1) % neighbors.length;
        const next = neighbors[nextIdx];
        const nnx = gridX + next.dx;
        const nny = gridY + next.dy;
        if (this.isValidGridPosition(nnx, nny) && this.getTerrainTypeAt(nnx, nny) !== currentType) {
          adjacentDifferent = true;
        }
      }
    }

    if (differentCount === 0) return 'interior';
    if (differentCount >= 3) return 'boundary';
    if (adjacentDifferent) return 'corner';
    return 'edge';
  }

  public getEdgeAnalysis(): EdgeAnalysis {
    const typeEdges = this.detectTerrainTypeEdges();
    const elevEdges = this.detectElevationEdges();
    const { width, height } = this.courseData;

    const edgeTypes = {
      interior: 0,
      edge: 0,
      corner: 0,
      boundary: 0
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        edgeTypes[this.classifyEdgeType(x, y)]++;
      }
    }

    const transitionCounts: Map<string, number> = new Map();
    for (const edge of typeEdges) {
      const key = `${edge.fromType}->${edge.toType}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    }

    let mostCommonTransition = '';
    let maxCount = 0;
    for (const [key, count] of transitionCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonTransition = key;
      }
    }

    return {
      terrainTypeEdgeCount: typeEdges.length,
      elevationEdgeCount: elevEdges.length,
      interiorCount: edgeTypes.interior,
      edgeCount: edgeTypes.edge,
      cornerCount: edgeTypes.corner,
      boundaryCount: edgeTypes.boundary,
      mostCommonTransition,
      transitionCount: transitionCounts.size
    };
  }

  public findIsolatedPatches(terrainType: string, minSize: number = 1, maxSize: number = 9): Array<Array<{ x: number; y: number }>> {
    const { width, height } = this.courseData;
    const visited = new Set<string>();
    const patches: Array<Array<{ x: number; y: number }>> = [];

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (this.getTerrainTypeAt(x, y) !== terrainType) continue;

        const patch: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const curKey = `${current.x},${current.y}`;
          if (visited.has(curKey)) continue;
          visited.add(curKey);
          patch.push(current);

          for (const n of neighbors) {
            const nx = current.x + n.dx;
            const ny = current.y + n.dy;
            if (this.isValidGridPosition(nx, ny) &&
                this.getTerrainTypeAt(nx, ny) === terrainType &&
                !visited.has(`${nx},${ny}`)) {
              queue.push({ x: nx, y: ny });
            }
          }
        }

        if (patch.length >= minSize && patch.length <= maxSize) {
          patches.push(patch);
        }
      }
    }

    return patches;
  }

  public generateContourLines(interval: number = 0.5): ContourLine[] {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return [];

    let minElev = Infinity;
    let maxElev = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }
    }

    const contours: ContourLine[] = [];
    const startLevel = Math.ceil(minElev / interval) * interval;

    for (let level = startLevel; level <= maxElev; level += interval) {
      const segments = this.traceContourAtLevel(level);
      if (segments.length > 0) {
        contours.push({
          elevation: level,
          segments,
          isMajor: Math.abs(level % (interval * 5)) < 0.001
        });
      }
    }

    return contours;
  }

  private traceContourAtLevel(level: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const { width, height } = this.courseData;
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const corners = [
          { x, y, elev: this.getElevationAt(x, y) },
          { x: x + 1, y, elev: this.getElevationAt(x + 1, y) },
          { x: x + 1, y: y + 1, elev: this.getElevationAt(x + 1, y + 1) },
          { x, y: y + 1, elev: this.getElevationAt(x, y + 1) }
        ];

        const cellSegments = this.marchingSquaresCell(corners, level);
        segments.push(...cellSegments);
      }
    }

    return segments;
  }

  private marchingSquaresCell(corners: Array<{ x: number; y: number; elev: number }>, level: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const above = corners.map(c => c.elev >= level);
    const caseIndex = (above[0] ? 1 : 0) + (above[1] ? 2 : 0) + (above[2] ? 4 : 0) + (above[3] ? 8 : 0);

    if (caseIndex === 0 || caseIndex === 15) return [];

    const interpolate = (c1: typeof corners[0], c2: typeof corners[0]): { x: number; y: number } => {
      const t = (level - c1.elev) / (c2.elev - c1.elev);
      return {
        x: c1.x + t * (c2.x - c1.x),
        y: c1.y + t * (c2.y - c1.y)
      };
    };

    const edges = [
      () => interpolate(corners[0], corners[1]),
      () => interpolate(corners[1], corners[2]),
      () => interpolate(corners[2], corners[3]),
      () => interpolate(corners[3], corners[0])
    ];

    const lookupTable: { [key: number]: number[][] } = {
      1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
      5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
      9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]],
      13: [[1, 0]], 14: [[0, 3]]
    };

    const edgePairs = lookupTable[caseIndex] || [];
    return edgePairs.map(pair => {
      const p1 = edges[pair[0]]();
      const p2 = edges[pair[1]]();
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    });
  }

  public getContourAnalysis(interval: number = 0.5): ContourAnalysis {
    const contours = this.generateContourLines(interval);
    const { width, height } = this.courseData;

    let minElev = Infinity;
    let maxElev = -Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
      }
    }

    let totalLength = 0;
    for (const contour of contours) {
      for (const seg of contour.segments) {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    }

    const majorContours = contours.filter(c => c.isMajor);
    const minorContours = contours.filter(c => !c.isMajor);

    return {
      contourCount: contours.length,
      majorContourCount: majorContours.length,
      minorContourCount: minorContours.length,
      totalContourLength: totalLength,
      elevationRange: maxElev - minElev,
      interval,
      densestContourLevel: this.findDensestContourLevel(contours),
      averageContourSpacing: totalLength / (contours.length || 1)
    };
  }

  private findDensestContourLevel(contours: ContourLine[]): number {
    let maxLength = 0;
    let densestLevel = 0;

    for (const contour of contours) {
      let length = 0;
      for (const seg of contour.segments) {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        length += Math.sqrt(dx * dx + dy * dy);
      }

      if (length > maxLength) {
        maxLength = length;
        densestLevel = contour.elevation;
      }
    }

    return densestLevel;
  }

  public findContourCrossings(x1: number, y1: number, x2: number, y2: number, interval: number = 0.5): Array<{ x: number; y: number; elevation: number }> {
    const crossings: Array<{ x: number; y: number; elevation: number }> = [];

    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
    if (steps === 0) return crossings;

    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;

    let prevElev = this.getBilinearElevation(x1, y1);
    let prevContour = Math.floor(prevElev / interval);

    for (let i = 1; i <= steps; i++) {
      const x = x1 + dx * i;
      const y = y1 + dy * i;
      const elev = this.getBilinearElevation(x, y);
      const currentContour = Math.floor(elev / interval);

      if (currentContour !== prevContour) {
        const contourElev = Math.max(prevContour, currentContour) * interval;
        const t = (contourElev - prevElev) / (elev - prevElev);
        crossings.push({
          x: x - dx + dx * t,
          y: y - dy + dy * t,
          elevation: contourElev
        });
      }

      prevElev = elev;
      prevContour = currentContour;
    }

    return crossings;
  }

  public generateElevationProfile(path: Array<{ x: number; y: number }>, sampleInterval: number = 0.5): ElevationProfile {
    if (path.length < 2) {
      return {
        samples: [],
        totalDistance: 0,
        elevationGain: 0,
        elevationLoss: 0,
        maxElevation: 0,
        minElevation: 0,
        averageGrade: 0,
        maxGrade: 0,
        gradeChanges: []
      };
    }

    const samples: Array<{ distance: number; elevation: number; x: number; y: number; grade: number }> = [];
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let maxElevation = -Infinity;
    let minElevation = Infinity;
    let maxGrade = 0;
    const gradeChanges: Array<{ distance: number; grade: number; type: 'uphill' | 'downhill' | 'flat' }> = [];

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      const segmentSamples = Math.max(1, Math.ceil(segmentLength / sampleInterval));

      for (let s = 0; s <= segmentSamples; s++) {
        if (i > 0 && s === 0) continue;

        const t = s / segmentSamples;
        const x = start.x + dx * t;
        const y = start.y + dy * t;
        const elev = this.getBilinearElevation(x, y);
        const sampleDistance = totalDistance + t * segmentLength;

        let grade = 0;
        if (samples.length > 0) {
          const prevSample = samples[samples.length - 1];
          const distDiff = sampleDistance - prevSample.distance;
          if (distDiff > 0.001) {
            grade = ((elev - prevSample.elevation) / distDiff) * 100;
            maxGrade = Math.max(maxGrade, Math.abs(grade));

            const elevDiff = elev - prevSample.elevation;
            if (elevDiff > 0) elevationGain += elevDiff;
            else elevationLoss += Math.abs(elevDiff);
          }
        }

        samples.push({ distance: sampleDistance, elevation: elev, x, y, grade });
        maxElevation = Math.max(maxElevation, elev);
        minElevation = Math.min(minElevation, elev);
      }

      totalDistance += segmentLength;
    }

    let prevType: 'uphill' | 'downhill' | 'flat' | null = null;
    for (const sample of samples) {
      const type = sample.grade > 2 ? 'uphill' : sample.grade < -2 ? 'downhill' : 'flat';
      if (type !== prevType) {
        gradeChanges.push({ distance: sample.distance, grade: sample.grade, type });
        prevType = type;
      }
    }

    const averageGrade = samples.length > 1 ?
      ((samples[samples.length - 1].elevation - samples[0].elevation) / totalDistance) * 100 : 0;

    return {
      samples,
      totalDistance,
      elevationGain,
      elevationLoss,
      maxElevation,
      minElevation,
      averageGrade,
      maxGrade,
      gradeChanges
    };
  }

  public generateProfileFromPoints(x1: number, y1: number, x2: number, y2: number, sampleInterval: number = 0.5): ElevationProfile {
    return this.generateElevationProfile([{ x: x1, y: y1 }, { x: x2, y: y2 }], sampleInterval);
  }

  public findSteepestSection(profile: ElevationProfile, minLength: number = 3): { startDistance: number; endDistance: number; averageGrade: number } | null {
    const samples = profile.samples;
    if (samples.length < 2) return null;

    let maxAbsGrade = 0;
    let steepestStart = 0;
    let steepestEnd = 0;

    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        const distance = samples[j].distance - samples[i].distance;
        if (distance < minLength) continue;

        const elevChange = samples[j].elevation - samples[i].elevation;
        const grade = Math.abs((elevChange / distance) * 100);

        if (grade > maxAbsGrade) {
          maxAbsGrade = grade;
          steepestStart = samples[i].distance;
          steepestEnd = samples[j].distance;
        }
      }
    }

    if (maxAbsGrade === 0) return null;

    const startIdx = samples.findIndex(s => s.distance === steepestStart);
    const endIdx = samples.findIndex(s => s.distance === steepestEnd);
    const actualGrade = ((samples[endIdx].elevation - samples[startIdx].elevation) / (steepestEnd - steepestStart)) * 100;

    return {
      startDistance: steepestStart,
      endDistance: steepestEnd,
      averageGrade: actualGrade
    };
  }

  public findFlatSections(profile: ElevationProfile, maxGrade: number = 2, minLength: number = 5): Array<{ startDistance: number; endDistance: number; length: number }> {
    const samples = profile.samples;
    const flatSections: Array<{ startDistance: number; endDistance: number; length: number }> = [];

    let sectionStart: number | null = null;

    for (let i = 0; i < samples.length; i++) {
      const isFlat = Math.abs(samples[i].grade) <= maxGrade;

      if (isFlat && sectionStart === null) {
        sectionStart = samples[i].distance;
      } else if (!isFlat && sectionStart !== null) {
        const sectionEnd = samples[i - 1].distance;
        const length = sectionEnd - sectionStart;
        if (length >= minLength) {
          flatSections.push({ startDistance: sectionStart, endDistance: sectionEnd, length });
        }
        sectionStart = null;
      }
    }

    if (sectionStart !== null) {
      const sectionEnd = samples[samples.length - 1].distance;
      const length = sectionEnd - sectionStart;
      if (length >= minLength) {
        flatSections.push({ startDistance: sectionStart, endDistance: sectionEnd, length });
      }
    }

    return flatSections;
  }

  public getProfileAnalysis(profile: ElevationProfile): ProfileAnalysis {
    const steepestSection = this.findSteepestSection(profile);
    const flatSections = this.findFlatSections(profile);

    let totalFlatLength = 0;
    for (const section of flatSections) {
      totalFlatLength += section.length;
    }

    return {
      totalDistance: profile.totalDistance,
      netElevationChange: profile.samples.length > 1 ?
        profile.samples[profile.samples.length - 1].elevation - profile.samples[0].elevation : 0,
      elevationGain: profile.elevationGain,
      elevationLoss: profile.elevationLoss,
      averageGrade: profile.averageGrade,
      maxGrade: profile.maxGrade,
      gradeChangeCount: profile.gradeChanges.length,
      flatSectionCount: flatSections.length,
      flatPercentage: (totalFlatLength / profile.totalDistance) * 100,
      steepestSection: steepestSection ? steepestSection.averageGrade : 0,
      difficulty: this.classifyProfileDifficulty(profile)
    };
  }

  private classifyProfileDifficulty(profile: ElevationProfile): 'flat' | 'easy' | 'moderate' | 'challenging' | 'difficult' {
    const totalClimb = profile.elevationGain + profile.elevationLoss;
    const maxGrade = profile.maxGrade;

    if (totalClimb < 1 && maxGrade < 3) return 'flat';
    if (totalClimb < 3 && maxGrade < 8) return 'easy';
    if (totalClimb < 6 && maxGrade < 15) return 'moderate';
    if (totalClimb < 10 || maxGrade < 25) return 'challenging';
    return 'difficult';
  }

  public computeGaussianSmoothedElevation(gridX: number, gridY: number, sigma: number = 1.0): number {
    const radius = Math.ceil(sigma * 3);
    let weightSum = 0;
    let elevSum = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (!this.isValidGridPosition(nx, ny)) continue;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));

        elevSum += this.getElevationAt(nx, ny) * weight;
        weightSum += weight;
      }
    }

    return weightSum > 0 ? elevSum / weightSum : this.getElevationAt(gridX, gridY);
  }

  public computeSmoothedElevationMap(sigma: number = 1.0): number[][] {
    const { width, height } = this.courseData;
    const smoothed: number[][] = [];

    for (let y = 0; y < height; y++) {
      smoothed[y] = [];
      for (let x = 0; x < width; x++) {
        smoothed[y][x] = this.computeGaussianSmoothedElevation(x, y, sigma);
      }
    }

    return smoothed;
  }

  public computeSmoothingDelta(gridX: number, gridY: number, sigma: number = 1.0): number {
    const original = this.getElevationAt(gridX, gridY);
    const smoothed = this.computeGaussianSmoothedElevation(gridX, gridY, sigma);
    return smoothed - original;
  }

  public findAreasNeedingSmoothing(threshold: number = 0.3, sigma: number = 1.0): Array<{ x: number; y: number; delta: number }> {
    const { width, height } = this.courseData;
    const areas: Array<{ x: number; y: number; delta: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const delta = Math.abs(this.computeSmoothingDelta(x, y, sigma));
        if (delta >= threshold) {
          areas.push({ x, y, delta });
        }
      }
    }

    areas.sort((a, b) => b.delta - a.delta);
    return areas;
  }

  public computeSmoothGradient(gridX: number, gridY: number, sigma: number = 1.0): { dx: number; dy: number; magnitude: number; direction: number } {
    const h = 0.5;
    const smoothedCenter = this.computeGaussianSmoothedElevation(gridX, gridY, sigma);

    let smoothedRight = smoothedCenter;
    let smoothedUp = smoothedCenter;

    if (this.isValidGridPosition(gridX + 1, gridY)) {
      smoothedRight = this.computeGaussianSmoothedElevation(gridX + 1, gridY, sigma);
    }
    if (this.isValidGridPosition(gridX, gridY + 1)) {
      smoothedUp = this.computeGaussianSmoothedElevation(gridX, gridY + 1, sigma);
    }

    const dx = (smoothedRight - smoothedCenter) / h;
    const dy = (smoothedUp - smoothedCenter) / h;
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    const direction = Math.atan2(dy, dx) * (180 / Math.PI);

    return { dx, dy, magnitude, direction };
  }

  public computeLaplacianSmoothing(gridX: number, gridY: number): number {
    const center = this.getElevationAt(gridX, gridY);
    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    let neighborSum = 0;
    let count = 0;

    for (const n of neighbors) {
      const nx = gridX + n.dx;
      const ny = gridY + n.dy;
      if (this.isValidGridPosition(nx, ny)) {
        neighborSum += this.getElevationAt(nx, ny);
        count++;
      }
    }

    return count > 0 ? (neighborSum / count) - center : 0;
  }

  public getSmoothingAnalysis(sigma: number = 1.0): SmoothingAnalysis {
    const { width, height } = this.courseData;

    let totalDelta = 0;
    let maxDelta = 0;
    let maxDeltaLocation = { x: 0, y: 0 };
    let smoothAreasCount = 0;
    let roughAreasCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const delta = Math.abs(this.computeSmoothingDelta(x, y, sigma));
        totalDelta += delta;

        if (delta > maxDelta) {
          maxDelta = delta;
          maxDeltaLocation = { x, y };
        }

        if (delta < 0.1) smoothAreasCount++;
        else roughAreasCount++;
      }
    }

    const totalTiles = width * height;

    return {
      averageDelta: totalDelta / totalTiles,
      maxDelta,
      maxDeltaLocation,
      smoothAreasCount,
      roughAreasCount,
      smoothnessPercentage: (smoothAreasCount / totalTiles) * 100,
      recommendedSigma: maxDelta > 0.5 ? sigma * 1.5 : sigma
    };
  }

  public computeCubicInterpolatedElevation(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;

    const getElev = (gx: number, gy: number): number => {
      const cx = Math.max(0, Math.min(this.courseData.width - 1, gx));
      const cy = Math.max(0, Math.min(this.courseData.height - 1, gy));
      return this.getElevationAt(cx, cy);
    };

    const cubicInterp = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
      const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
      const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      const c = -0.5 * p0 + 0.5 * p2;
      const d = p1;
      return a * t * t * t + b * t * t + c * t + d;
    };

    const rows: number[] = [];
    for (let j = -1; j <= 2; j++) {
      const p0 = getElev(x0 - 1, y0 + j);
      const p1 = getElev(x0, y0 + j);
      const p2 = getElev(x0 + 1, y0 + j);
      const p3 = getElev(x0 + 2, y0 + j);
      rows.push(cubicInterp(p0, p1, p2, p3, tx));
    }

    return cubicInterp(rows[0], rows[1], rows[2], rows[3], ty);
  }

  public classifyTileGeometry(gridX: number, gridY: number): TileGeometryType {
    const corners = this.getCornerHeights(gridX, gridY);
    const { nw, ne, se, sw } = corners;
    const heights = [nw, ne, se, sw];
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    const delta = maxH - minH;

    if (delta === 0) return 'flat';
    if (delta > 1) return 'cliff';

    const uniqueHeights = new Set(heights).size;

    if (uniqueHeights === 2) {
      if ((nw === ne && sw === se) || (nw === sw && ne === se)) {
        return 'ramp';
      }
      if ((nw === ne && ne === sw) || (nw === ne && ne === se) ||
          (ne === se && se === sw) || (nw === sw && sw === se)) {
        return 'corner';
      }
    }

    if (uniqueHeights === 3) {
      return 'valley';
    }

    return 'complex';
  }

  public getTileGeometryMap(): TileGeometryType[][] {
    const { width, height } = this.courseData;
    const map: TileGeometryType[][] = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        map[y][x] = this.classifyTileGeometry(x, y);
      }
    }

    return map;
  }

  public getTileStatistics(): TileStatistics {
    const { width, height } = this.courseData;
    const counts: { [key in TileGeometryType]: number } = {
      flat: 0,
      ramp: 0,
      corner: 0,
      valley: 0,
      cliff: 0,
      complex: 0
    };

    const terrainTypeCounts: { [key: string]: number } = {};

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        counts[this.classifyTileGeometry(x, y)]++;

        const terrainType = this.getTerrainTypeAt(x, y);
        terrainTypeCounts[terrainType] = (terrainTypeCounts[terrainType] || 0) + 1;
      }
    }

    const totalTiles = width * height;

    return {
      totalTiles,
      flatCount: counts.flat,
      rampCount: counts.ramp,
      cornerCount: counts.corner,
      valleyCount: counts.valley,
      cliffCount: counts.cliff,
      complexCount: counts.complex,
      flatPercentage: (counts.flat / totalTiles) * 100,
      slopedPercentage: ((counts.ramp + counts.corner + counts.valley) / totalTiles) * 100,
      cliffPercentage: (counts.cliff / totalTiles) * 100,
      terrainTypeCounts,
      dominantTerrainType: Object.entries(terrainTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
    };
  }

  public findTilesByGeometry(geometryType: TileGeometryType): Array<{ x: number; y: number }> {
    const { width, height } = this.courseData;
    const tiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.classifyTileGeometry(x, y) === geometryType) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  public getTileComplexityScore(gridX: number, gridY: number): number {
    const geometry = this.classifyTileGeometry(gridX, gridY);
    const baseScores: { [key in TileGeometryType]: number } = {
      flat: 0,
      ramp: 1,
      corner: 2,
      valley: 3,
      cliff: 4,
      complex: 5
    };

    let score = baseScores[geometry];

    const neighbors = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];

    for (const n of neighbors) {
      const nx = gridX + n.dx;
      const ny = gridY + n.dy;
      if (this.isValidGridPosition(nx, ny)) {
        const neighborGeometry = this.classifyTileGeometry(nx, ny);
        if (neighborGeometry !== geometry) {
          score += 0.5;
        }
      }
    }

    return score;
  }

  public getComplexityHotspots(threshold: number = 3): Array<{ x: number; y: number; score: number }> {
    const { width, height } = this.courseData;
    const hotspots: Array<{ x: number; y: number; score: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const score = this.getTileComplexityScore(x, y);
        if (score >= threshold) {
          hotspots.push({ x, y, score });
        }
      }
    }

    hotspots.sort((a, b) => b.score - a.score);
    return hotspots;
  }

  public getGeometryTransitions(): Array<{ x: number; y: number; from: TileGeometryType; to: TileGeometryType }> {
    const { width, height } = this.courseData;
    const transitions: Array<{ x: number; y: number; from: TileGeometryType; to: TileGeometryType }> = [];

    const directions = [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currentGeometry = this.classifyTileGeometry(x, y);

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (!this.isValidGridPosition(nx, ny)) continue;

          const neighborGeometry = this.classifyTileGeometry(nx, ny);
          if (currentGeometry !== neighborGeometry) {
            transitions.push({ x, y, from: currentGeometry, to: neighborGeometry });
          }
        }
      }
    }

    return transitions;
  }

  public findRegionsByPredicate(
    predicate: (x: number, y: number) => boolean
  ): Array<Array<{ x: number; y: number }>> {
    const { width, height } = this.courseData;
    const visited = new Set<string>();
    const regions: Array<Array<{ x: number; y: number }>> = [];

    const key = (x: number, y: number) => `${x},${y}`;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (visited.has(key(x, y)) || !predicate(x, y)) continue;

        const region: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const k = key(current.x, current.y);
          if (visited.has(k)) continue;
          visited.add(k);

          if (!predicate(current.x, current.y)) continue;
          region.push(current);

          const directions = [
            { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
          ];
          for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (this.isValidGridPosition(nx, ny) && !visited.has(key(nx, ny))) {
              queue.push({ x: nx, y: ny });
            }
          }
        }

        if (region.length > 0) {
          regions.push(region);
        }
      }
    }

    return regions.sort((a, b) => b.length - a.length);
  }

  public findTerrainTypeRegions(terrainType: TerrainType): Array<Array<{ x: number; y: number }>> {
    return this.findRegionsByPredicate((x, y) => this.getTerrainTypeAt(x, y) === terrainType);
  }

  public findElevationBandRegions(minElev: number, maxElev: number): Array<Array<{ x: number; y: number }>> {
    return this.findRegionsByPredicate((x, y) => {
      const elev = this.getElevationAt(x, y);
      return elev >= minElev && elev <= maxElev;
    });
  }

  public findFlatRegions(maxSlope: number = 5): Array<Array<{ x: number; y: number }>> {
    return this.findRegionsByPredicate((x, y) => this.getSlopeAngle(x, y) <= maxSlope);
  }

  public getRegionStatistics(region: Array<{ x: number; y: number }>): RegionStatistics {
    if (region.length === 0) {
      return {
        size: 0,
        centroid: { x: 0, y: 0 },
        boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
        avgElevation: 0,
        minElevation: 0,
        maxElevation: 0,
        avgSlope: 0,
        maxSlope: 0,
        perimeter: 0,
        compactness: 0,
        dominantTerrainType: 'fairway'
      };
    }

    let sumX = 0, sumY = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumElev = 0, minElev = Infinity, maxElev = -Infinity;
    let sumSlope = 0, maxSlope = 0;
    const terrainCounts: { [key: string]: number } = {};

    for (const p of region) {
      sumX += p.x;
      sumY += p.y;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);

      const elev = this.getElevationAt(p.x, p.y);
      sumElev += elev;
      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);

      const slope = this.getSlopeAngle(p.x, p.y);
      sumSlope += slope;
      maxSlope = Math.max(maxSlope, slope);

      const terrainType = this.getTerrainTypeAt(p.x, p.y);
      terrainCounts[terrainType] = (terrainCounts[terrainType] || 0) + 1;
    }

    const regionSet = new Set(region.map(p => `${p.x},${p.y}`));
    let perimeter = 0;
    for (const p of region) {
      const directions = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
      ];
      for (const dir of directions) {
        const nx = p.x + dir.dx;
        const ny = p.y + dir.dy;
        if (!regionSet.has(`${nx},${ny}`)) {
          perimeter++;
        }
      }
    }

    const area = region.length;
    const compactness = area > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;

    let dominantTerrainType: TerrainType = 'fairway';
    let maxCount = 0;
    for (const [type, count] of Object.entries(terrainCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantTerrainType = type as TerrainType;
      }
    }

    return {
      size: region.length,
      centroid: { x: sumX / region.length, y: sumY / region.length },
      boundingBox: {
        minX, maxX, minY, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      },
      avgElevation: sumElev / region.length,
      minElevation: minElev,
      maxElevation: maxElev,
      avgSlope: sumSlope / region.length,
      maxSlope,
      perimeter,
      compactness,
      dominantTerrainType
    };
  }

  public getConnectivityAnalysis(): ConnectivityAnalysis {
    const fairwayRegions = this.findTerrainTypeRegions('fairway');
    const roughRegions = this.findTerrainTypeRegions('rough');
    const greenRegions = this.findTerrainTypeRegions('green');
    const bunkerRegions = this.findTerrainTypeRegions('bunker');
    const waterRegions = this.findTerrainTypeRegions('water');
    const flatRegions = this.findFlatRegions(10);

    const largestFairway = fairwayRegions.length > 0 ? this.getRegionStatistics(fairwayRegions[0]) : null;
    const largestGreen = greenRegions.length > 0 ? this.getRegionStatistics(greenRegions[0]) : null;

    const { width, height } = this.courseData;
    const totalTiles = width * height;

    return {
      fairwayRegionCount: fairwayRegions.length,
      roughRegionCount: roughRegions.length,
      greenRegionCount: greenRegions.length,
      bunkerRegionCount: bunkerRegions.length,
      waterRegionCount: waterRegions.length,
      flatRegionCount: flatRegions.length,
      largestFairwayRegion: largestFairway,
      largestGreenRegion: largestGreen,
      fragmentationIndex: (fairwayRegions.length + greenRegions.length) / totalTiles * 100,
      totalTiles
    };
  }

  public findRegionBoundaries(region: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const regionSet = new Set(region.map(p => `${p.x},${p.y}`));
    const boundaries: Array<{ x: number; y: number }> = [];

    for (const p of region) {
      const directions = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
      ];
      for (const dir of directions) {
        const nx = p.x + dir.dx;
        const ny = p.y + dir.dy;
        if (!regionSet.has(`${nx},${ny}`)) {
          boundaries.push(p);
          break;
        }
      }
    }

    return boundaries;
  }

  public getVertexElevation(vertexX: number, vertexY: number): number {
    const { width, height, elevation } = this.courseData;
    if (!elevation) return 0;

    const clampedX = Math.max(0, Math.min(width - 1, Math.floor(vertexX)));
    const clampedY = Math.max(0, Math.min(height - 1, Math.floor(vertexY)));

    return elevation[clampedY][clampedX] * ELEVATION_HEIGHT;
  }

  public getVertexNeighborHeights(vertexX: number, vertexY: number): { n: number; e: number; s: number; w: number } {
    return {
      n: this.getVertexElevation(vertexX, vertexY - 1),
      e: this.getVertexElevation(vertexX + 1, vertexY),
      s: this.getVertexElevation(vertexX, vertexY + 1),
      w: this.getVertexElevation(vertexX - 1, vertexY)
    };
  }

  public classifyVertex(vertexX: number, vertexY: number): VertexClassification {
    const centerElev = this.getVertexElevation(vertexX, vertexY);
    const neighbors = this.getVertexNeighborHeights(vertexX, vertexY);
    const neighborValues = [neighbors.n, neighbors.e, neighbors.s, neighbors.w];

    const higherCount = neighborValues.filter(n => n > centerElev).length;
    const lowerCount = neighborValues.filter(n => n < centerElev).length;
    const equalCount = neighborValues.filter(n => n === centerElev).length;

    if (lowerCount === 4) return 'peak';
    if (higherCount === 4) return 'pit';
    if (lowerCount >= 2 && higherCount === 0) return 'local_high';
    if (higherCount >= 2 && lowerCount === 0) return 'local_low';

    const oppositeHigher = (neighbors.n > centerElev && neighbors.s > centerElev) ||
                           (neighbors.e > centerElev && neighbors.w > centerElev);
    const oppositeLower = (neighbors.n < centerElev && neighbors.s < centerElev) ||
                          (neighbors.e < centerElev && neighbors.w < centerElev);

    if (oppositeHigher && oppositeLower) return 'saddle';
    if (oppositeLower) return 'ridge';
    if (oppositeHigher) return 'valley';

    if (equalCount >= 3) return 'flat';
    return 'slope';
  }

  public findVertexPeaks(): Array<{ x: number; y: number; elevation: number }> {
    const { width, height } = this.courseData;
    const peaks: Array<{ x: number; y: number; elevation: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (this.classifyVertex(x, y) === 'peak') {
          peaks.push({ x, y, elevation: this.getVertexElevation(x, y) });
        }
      }
    }

    return peaks.sort((a, b) => b.elevation - a.elevation);
  }

  public findVertexPits(): Array<{ x: number; y: number; elevation: number }> {
    const { width, height } = this.courseData;
    const pits: Array<{ x: number; y: number; elevation: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (this.classifyVertex(x, y) === 'pit') {
          pits.push({ x, y, elevation: this.getVertexElevation(x, y) });
        }
      }
    }

    return pits.sort((a, b) => a.elevation - b.elevation);
  }

  public findVertexSaddles(): Array<{ x: number; y: number; elevation: number }> {
    const { width, height } = this.courseData;
    const saddles: Array<{ x: number; y: number; elevation: number }> = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (this.classifyVertex(x, y) === 'saddle') {
          saddles.push({ x, y, elevation: this.getVertexElevation(x, y) });
        }
      }
    }

    return saddles;
  }

  public traceRidgeLine(startX: number, startY: number, maxSteps: number = 100): Array<{ x: number; y: number }> {
    const ridge: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    let currentX = startX;
    let currentY = startY;

    for (let step = 0; step < maxSteps; step++) {
      const currentElev = this.getVertexElevation(currentX, currentY);
      const directions = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
      ];

      let bestNext: { x: number; y: number } | null = null;
      let bestElev = -Infinity;

      for (const dir of directions) {
        const nx = currentX + dir.dx;
        const ny = currentY + dir.dy;
        const key = `${nx},${ny}`;

        if (!this.isValidGridPosition(nx, ny) || visited.has(key)) continue;

        const nElev = this.getVertexElevation(nx, ny);
        if (nElev >= currentElev - ELEVATION_HEIGHT && nElev > bestElev) {
          bestElev = nElev;
          bestNext = { x: nx, y: ny };
        }
      }

      if (!bestNext || bestElev < currentElev - ELEVATION_HEIGHT) break;

      visited.add(`${bestNext.x},${bestNext.y}`);
      ridge.push(bestNext);
      currentX = bestNext.x;
      currentY = bestNext.y;
    }

    return ridge;
  }

  public getVertexStatistics(): VertexStatistics {
    const { width, height } = this.courseData;
    const counts: { [key in VertexClassification]: number } = {
      peak: 0, pit: 0, ridge: 0, valley: 0, saddle: 0,
      slope: 0, flat: 0, local_high: 0, local_low: 0
    };

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const classification = this.classifyVertex(x, y);
        counts[classification]++;
      }
    }

    const totalVertices = (width - 2) * (height - 2);
    const peaks = this.findVertexPeaks();
    const pits = this.findVertexPits();

    return {
      totalVertices,
      peakCount: counts.peak,
      pitCount: counts.pit,
      ridgeCount: counts.ridge,
      valleyCount: counts.valley,
      saddleCount: counts.saddle,
      slopeCount: counts.slope,
      flatCount: counts.flat,
      highestPeak: peaks.length > 0 ? peaks[0] : null,
      lowestPit: pits.length > 0 ? pits[0] : null,
      ruggednessIndex: (counts.peak + counts.pit + counts.saddle) / totalVertices
    };
  }

  public batchQueryTiles(
    positions: Array<{ x: number; y: number }>,
    options: BatchQueryOptions = {}
  ): TileBatchResult[] {
    const {
      includeElevation = true,
      includeSlope = true,
      includeTerrainType = true,
      includeCornerHeights = false,
      includePhysics = false,
      includeGeometry = false
    } = options;

    return positions.map(pos => {
      const result: TileBatchResult = {
        x: pos.x,
        y: pos.y,
        valid: this.isValidGridPosition(pos.x, pos.y)
      };

      if (!result.valid) return result;

      if (includeElevation) {
        result.elevation = this.getElevationAt(pos.x, pos.y);
      }
      if (includeSlope) {
        result.slopeAngle = this.getSlopeAngle(pos.x, pos.y);
        const slopeVec = this.getSlopeVectorAt(pos.x, pos.y);
        result.slopeDirection = slopeVec.direction;
      }
      if (includeTerrainType) {
        result.terrainType = this.getTerrainTypeAt(pos.x, pos.y);
      }
      if (includeCornerHeights) {
        result.cornerHeights = this.getCornerHeights(pos.x, pos.y);
      }
      if (includePhysics) {
        result.physics = this.getSurfacePhysicsAt(pos.x, pos.y);
      }
      if (includeGeometry) {
        result.geometryType = this.classifyTileGeometry(pos.x, pos.y);
      }

      return result;
    });
  }

  public queryTileArea(
    centerX: number,
    centerY: number,
    radius: number,
    options: BatchQueryOptions = {}
  ): TileAreaResult {
    const positions: Array<{ x: number; y: number }> = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (this.isValidGridPosition(x, y)) {
          positions.push({ x, y });
        }
      }
    }

    const tiles = this.batchQueryTiles(positions, options);
    const validTiles = tiles.filter(t => t.valid);

    let sumElev = 0, sumSlope = 0;
    let minElev = Infinity, maxElev = -Infinity;
    let maxSlope = 0;
    const terrainCounts: { [key: string]: number } = {};

    for (const tile of validTiles) {
      if (tile.elevation !== undefined) {
        sumElev += tile.elevation;
        minElev = Math.min(minElev, tile.elevation);
        maxElev = Math.max(maxElev, tile.elevation);
      }
      if (tile.slopeAngle !== undefined) {
        sumSlope += tile.slopeAngle;
        maxSlope = Math.max(maxSlope, tile.slopeAngle);
      }
      if (tile.terrainType) {
        terrainCounts[tile.terrainType] = (terrainCounts[tile.terrainType] || 0) + 1;
      }
    }

    let dominantTerrainType: TerrainType = 'fairway';
    let maxCount = 0;
    for (const [type, count] of Object.entries(terrainCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantTerrainType = type as TerrainType;
      }
    }

    return {
      center: { x: centerX, y: centerY },
      radius,
      tiles,
      tileCount: validTiles.length,
      avgElevation: validTiles.length > 0 ? sumElev / validTiles.length : 0,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      avgSlope: validTiles.length > 0 ? sumSlope / validTiles.length : 0,
      maxSlope,
      dominantTerrainType,
      terrainCounts
    };
  }

  public queryTileLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: BatchQueryOptions = {}
  ): TileLineResult {
    const positions: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const steps = Math.max(dx, dy);

    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      if (positions.length === 0 || positions[positions.length - 1].x !== x || positions[positions.length - 1].y !== y) {
        positions.push({ x, y });
      }
    }

    const tiles = this.batchQueryTiles(positions, options);
    const validTiles = tiles.filter(t => t.valid);

    let totalElevationChange = 0;
    let maxSlope = 0;
    let terrainTransitions = 0;
    let prevTerrainType: string | undefined;

    for (let i = 0; i < validTiles.length; i++) {
      const tile = validTiles[i];
      if (tile.slopeAngle !== undefined && tile.slopeAngle > maxSlope) {
        maxSlope = tile.slopeAngle;
      }
      const prevTile = validTiles[i - 1];
      if (i > 0 && prevTile && prevTile.elevation !== undefined && tile.elevation !== undefined) {
        totalElevationChange += Math.abs(tile.elevation - prevTile.elevation);
      }
      if (tile.terrainType && prevTerrainType && tile.terrainType !== prevTerrainType) {
        terrainTransitions++;
      }
      prevTerrainType = tile.terrainType;
    }

    const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    return {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      tiles,
      tileCount: validTiles.length,
      lineLength,
      totalElevationChange,
      avgElevationChange: validTiles.length > 1 ? totalElevationChange / (validTiles.length - 1) : 0,
      maxSlope,
      terrainTransitions
    };
  }

  public computeAreaStatistics(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): AreaStatistics {
    const positions: Array<{ x: number; y: number }> = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isValidGridPosition(x, y)) {
          positions.push({ x, y });
        }
      }
    }

    const tiles = this.batchQueryTiles(positions, {
      includeElevation: true,
      includeSlope: true,
      includeTerrainType: true,
      includeGeometry: true
    });

    const validTiles = tiles.filter(t => t.valid);

    let sumElev = 0, sumSlope = 0;
    let minElev = Infinity, maxElev = -Infinity;
    let maxSlope = 0;
    const terrainCounts: { [key: string]: number } = {};
    const geometryCounts: { [key: string]: number } = {};

    for (const tile of validTiles) {
      if (tile.elevation !== undefined) {
        sumElev += tile.elevation;
        minElev = Math.min(minElev, tile.elevation);
        maxElev = Math.max(maxElev, tile.elevation);
      }
      if (tile.slopeAngle !== undefined) {
        sumSlope += tile.slopeAngle;
        maxSlope = Math.max(maxSlope, tile.slopeAngle);
      }
      if (tile.terrainType) {
        terrainCounts[tile.terrainType] = (terrainCounts[tile.terrainType] || 0) + 1;
      }
      if (tile.geometryType) {
        geometryCounts[tile.geometryType] = (geometryCounts[tile.geometryType] || 0) + 1;
      }
    }

    return {
      bounds: { minX, minY, maxX, maxY },
      tileCount: validTiles.length,
      avgElevation: validTiles.length > 0 ? sumElev / validTiles.length : 0,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      elevationRange: maxElev - minElev,
      avgSlope: validTiles.length > 0 ? sumSlope / validTiles.length : 0,
      maxSlope,
      terrainCounts,
      geometryCounts
    };
  }

  public compareAreaStatistics(
    area1: { minX: number; minY: number; maxX: number; maxY: number },
    area2: { minX: number; minY: number; maxX: number; maxY: number }
  ): AreaComparison {
    const stats1 = this.computeAreaStatistics(area1.minX, area1.minY, area1.maxX, area1.maxY);
    const stats2 = this.computeAreaStatistics(area2.minX, area2.minY, area2.maxX, area2.maxY);

    const terrainDifferences: { [key: string]: number } = {};
    const allTerrainTypes = new Set([
      ...Object.keys(stats1.terrainCounts),
      ...Object.keys(stats2.terrainCounts)
    ]);
    for (const type of allTerrainTypes) {
      const count1 = stats1.terrainCounts[type] || 0;
      const count2 = stats2.terrainCounts[type] || 0;
      if (count1 !== count2) {
        terrainDifferences[type] = count2 - count1;
      }
    }

    const geometryDifferences: { [key: string]: number } = {};
    const allGeometryTypes = new Set([
      ...Object.keys(stats1.geometryCounts),
      ...Object.keys(stats2.geometryCounts)
    ]);
    for (const type of allGeometryTypes) {
      const count1 = stats1.geometryCounts[type] || 0;
      const count2 = stats2.geometryCounts[type] || 0;
      if (count1 !== count2) {
        geometryDifferences[type] = count2 - count1;
      }
    }

    return {
      area1Stats: stats1,
      area2Stats: stats2,
      elevationDifference: stats2.avgElevation - stats1.avgElevation,
      slopeDifference: stats2.avgSlope - stats1.avgSlope,
      terrainDifferences,
      geometryDifferences,
      area1HasMoreSlopes: stats1.avgSlope > stats2.avgSlope,
      area2HasMoreSlopes: stats2.avgSlope > stats1.avgSlope,
      elevationRangeDifference: stats2.elevationRange - stats1.elevationRange
    };
  }

  public computeElevationHistogram(
    binSize: number = 0.5,
    minX?: number,
    minY?: number,
    maxX?: number,
    maxY?: number
  ): ElevationHistogram {
    const { width, height } = this.courseData;
    const x1 = minX ?? 0;
    const y1 = minY ?? 0;
    const x2 = maxX ?? width - 1;
    const y2 = maxY ?? height - 1;

    const bins: { [key: string]: number } = {};
    let minElev = Infinity;
    let maxElev = -Infinity;
    let sumElev = 0;
    let count = 0;

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (!this.isValidGridPosition(x, y)) continue;
        const elev = this.getElevationAt(x, y);
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
        sumElev += elev;
        count++;

        const binKey = Math.floor(elev / binSize) * binSize;
        bins[binKey] = (bins[binKey] || 0) + 1;
      }
    }

    const sortedBins = Object.keys(bins)
      .map(k => ({ elevation: parseFloat(k), count: bins[k] }))
      .sort((a, b) => a.elevation - b.elevation);

    let peakBin = sortedBins[0]?.elevation || 0;
    let peakCount = 0;
    for (const bin of sortedBins) {
      if (bin.count > peakCount) {
        peakCount = bin.count;
        peakBin = bin.elevation;
      }
    }

    return {
      bins: sortedBins,
      binSize,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      avgElevation: count > 0 ? sumElev / count : 0,
      peakElevation: peakBin,
      totalCount: count
    };
  }

  public computeSlopeHistogram(
    binSize: number = 5,
    minX?: number,
    minY?: number,
    maxX?: number,
    maxY?: number
  ): SlopeHistogram {
    const { width, height } = this.courseData;
    const x1 = minX ?? 0;
    const y1 = minY ?? 0;
    const x2 = maxX ?? width - 1;
    const y2 = maxY ?? height - 1;

    const bins: { [key: string]: number } = {};
    let minSlope = Infinity;
    let maxSlope = -Infinity;
    let sumSlope = 0;
    let count = 0;

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (!this.isValidGridPosition(x, y)) continue;
        const slope = this.getSlopeAngle(x, y);
        minSlope = Math.min(minSlope, slope);
        maxSlope = Math.max(maxSlope, slope);
        sumSlope += slope;
        count++;

        const binKey = Math.floor(slope / binSize) * binSize;
        bins[binKey] = (bins[binKey] || 0) + 1;
      }
    }

    const sortedBins = Object.keys(bins)
      .map(k => ({ slope: parseFloat(k), count: bins[k] }))
      .sort((a, b) => a.slope - b.slope);

    let flatCount = 0;
    let moderateCount = 0;
    let steepCount = 0;
    for (const bin of sortedBins) {
      if (bin.slope < 10) flatCount += bin.count;
      else if (bin.slope < 30) moderateCount += bin.count;
      else steepCount += bin.count;
    }

    return {
      bins: sortedBins,
      binSize,
      minSlope: minSlope === Infinity ? 0 : minSlope,
      maxSlope: maxSlope === -Infinity ? 0 : maxSlope,
      avgSlope: count > 0 ? sumSlope / count : 0,
      flatCount,
      moderateCount,
      steepCount,
      totalCount: count
    };
  }

  public findSimilarAreas(
    sourceX: number,
    sourceY: number,
    sourceSize: number,
    searchRadius: number = 20,
    tolerance: number = 0.2
  ): Array<{ x: number; y: number; similarity: number }> {
    const sourceStats = this.computeAreaStatistics(
      sourceX - Math.floor(sourceSize / 2),
      sourceY - Math.floor(sourceSize / 2),
      sourceX + Math.floor(sourceSize / 2),
      sourceY + Math.floor(sourceSize / 2)
    );

    const results: Array<{ x: number; y: number; similarity: number }> = [];
    const halfSize = Math.floor(sourceSize / 2);

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        if (dx === 0 && dy === 0) continue;

        const cx = sourceX + dx;
        const cy = sourceY + dy;

        if (!this.isValidGridPosition(cx - halfSize, cy - halfSize) ||
            !this.isValidGridPosition(cx + halfSize, cy + halfSize)) continue;

        const targetStats = this.computeAreaStatistics(
          cx - halfSize, cy - halfSize,
          cx + halfSize, cy + halfSize
        );

        const elevDiff = Math.abs(targetStats.avgElevation - sourceStats.avgElevation) / (sourceStats.avgElevation + 0.1);
        const slopeDiff = Math.abs(targetStats.avgSlope - sourceStats.avgSlope) / (sourceStats.avgSlope + 0.1);
        const rangeDiff = Math.abs(targetStats.elevationRange - sourceStats.elevationRange) / (sourceStats.elevationRange + 0.1);

        const similarity = 1 - (elevDiff + slopeDiff + rangeDiff) / 3;

        if (similarity > 1 - tolerance) {
          results.push({ x: cx, y: cy, similarity });
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  public getTerrainSummary(): TerrainSummary {
    const { width, height } = this.courseData;
    const stats = this.computeAreaStatistics(0, 0, width - 1, height - 1);
    const tileStats = this.getTileStatistics();
    const vertexStats = this.getVertexStatistics();

    return {
      dimensions: { width, height },
      totalTiles: width * height,
      ...stats,
      tileStatistics: tileStats,
      vertexStatistics: vertexStats,
      hasSteepSlopes: stats.maxSlope > 30,
      hasWater: (stats.terrainCounts['water'] || 0) > 0,
      hasBunkers: (stats.terrainCounts['bunker'] || 0) > 0,
      hasCliffs: (stats.geometryCounts['cliff'] || 0) > 0
    };
  }

  public validateTerrain(): TerrainValidationResult {
    const { width, height } = this.courseData;
    const issues: TerrainValidationIssue[] = [];
    const maxSlopeDelta = 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = this.getCornerHeights(x, y);
        const { nw, ne, se, sw } = corners;
        const heights = [nw, ne, se, sw];
        const minH = Math.min(...heights);
        const maxH = Math.max(...heights);
        const delta = maxH - minH;

        if (delta > maxSlopeDelta) {
          issues.push({
            type: 'excessive_slope',
            severity: 'warning',
            x, y,
            message: `Tile exceeds max slope delta (${delta} > ${maxSlopeDelta})`,
            details: { delta, corners }
          });
        }

        if (heights.some(h => h < 0)) {
          issues.push({
            type: 'negative_elevation',
            severity: 'error',
            x, y,
            message: 'Tile has negative elevation',
            details: { corners }
          });
        }

        const terrainType = this.getTerrainTypeAt(x, y);
        if (!terrainType) {
          issues.push({
            type: 'invalid_terrain',
            severity: 'error',
            x, y,
            message: 'Tile has invalid terrain type'
          });
        }
      }
    }

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const current = this.getCornerHeights(x, y);
        const right = this.getCornerHeights(x + 1, y);
        const below = this.getCornerHeights(x, y + 1);

        if (current.ne !== right.nw || current.se !== right.sw) {
          issues.push({
            type: 'edge_mismatch',
            severity: 'error',
            x, y,
            message: `Edge mismatch between (${x},${y}) and (${x + 1},${y})`,
            details: { current, right }
          });
        }

        if (current.sw !== below.nw || current.se !== below.ne) {
          issues.push({
            type: 'edge_mismatch',
            severity: 'error',
            x, y,
            message: `Edge mismatch between (${x},${y}) and (${x},${y + 1})`,
            details: { current, below }
          });
        }
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return {
      valid: errorCount === 0,
      issues,
      errorCount,
      warningCount,
      totalIssues: issues.length,
      checkedTiles: width * height
    };
  }

  public findExcessiveSlopes(maxDelta: number = 2): Array<{ x: number; y: number; delta: number }> {
    const { width, height } = this.courseData;
    const excessive: Array<{ x: number; y: number; delta: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const corners = this.getCornerHeights(x, y);
        const { nw, ne, se, sw } = corners;
        const heights = [nw, ne, se, sw];
        const delta = Math.max(...heights) - Math.min(...heights);

        if (delta > maxDelta) {
          excessive.push({ x, y, delta });
        }
      }
    }

    return excessive.sort((a, b) => b.delta - a.delta);
  }

  public findTerrainAnomalies(): TerrainAnomalies {
    const { width, height } = this.courseData;

    const isolatedTiles: Array<{ x: number; y: number; terrainType: TerrainType }> = [];
    const unreachableTiles: Array<{ x: number; y: number }> = [];
    const extremeSlopes: Array<{ x: number; y: number; slope: number }> = [];
    const suspiciousTransitions: Array<{ x: number; y: number; from: TerrainType; to: TerrainType }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainType = this.getTerrainTypeAt(x, y);

        let sameTypeNeighbors = 0;
        const directions = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
        ];

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (this.isValidGridPosition(nx, ny) && this.getTerrainTypeAt(nx, ny) === terrainType) {
            sameTypeNeighbors++;
          }
        }

        if (sameTypeNeighbors === 0 && terrainType !== 'green' && terrainType !== 'bunker') {
          isolatedTiles.push({ x, y, terrainType });
        }

        const slope = this.getSlopeAngle(x, y);
        if (slope > 60) {
          extremeSlopes.push({ x, y, slope });
        }

        if (terrainType === 'green') {
          for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isValidGridPosition(nx, ny)) {
              const neighborType = this.getTerrainTypeAt(nx, ny);
              if (neighborType === 'water' || neighborType === 'bunker') {
                suspiciousTransitions.push({ x, y, from: terrainType, to: neighborType });
              }
            }
          }
        }
      }
    }

    return {
      isolatedTiles,
      unreachableTiles,
      extremeSlopes,
      suspiciousTransitions,
      totalAnomalies: isolatedTiles.length + unreachableTiles.length + extremeSlopes.length + suspiciousTransitions.length
    };
  }

  public repairTerrainIssue(x: number, y: number, issueType: string): boolean {
    if (!this.isValidGridPosition(x, y)) return false;

    switch (issueType) {
      case 'excessive_slope': {
        const directions = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
        ];

        let neighborAvg = 0;
        let neighborCount = 0;
        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (this.isValidGridPosition(nx, ny)) {
            neighborAvg += this.getElevationAt(nx, ny);
            neighborCount++;
          }
        }

        if (neighborCount > 0) {
          const targetElev = Math.round(neighborAvg / neighborCount);
          this.setElevationWithHistory(x, y, targetElev);
        }

        return true;
      }
      default:
        return false;
    }
  }

  public getTerrainHealth(): TerrainHealth {
    const validation = this.validateTerrain();
    const anomalies = this.findTerrainAnomalies();
    const excessiveSlopes = this.findExcessiveSlopes();

    const totalChecks = validation.checkedTiles;
    const totalProblems = validation.totalIssues + anomalies.totalAnomalies;
    const healthScore = totalChecks > 0 ? Math.max(0, 100 - (totalProblems / totalChecks) * 100) : 100;

    return {
      healthScore,
      validation,
      anomalies,
      excessiveSlopeCount: excessiveSlopes.length,
      status: healthScore >= 90 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical'
    };
  }

  public smoothTerrainArea(centerX: number, centerY: number, radius: number, strength: number = 0.5): number {
    const clampedStrength = Math.max(0, Math.min(1, strength));
    let modifiedCount = 0;

    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    const originalElevations: Map<string, number> = new Map();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist <= radius) {
          originalElevations.set(`${x},${y}`, this.getElevationAt(x, y));
        }
      }
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist > radius) continue;

        const falloff = 1 - (dist / radius);
        const effectiveStrength = clampedStrength * falloff;

        let neighborSum = 0;
        let neighborCount = 0;
        const directions = [
          { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
          { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
        ];

        for (const dir of directions) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          const key = `${nx},${ny}`;
          if (originalElevations.has(key)) {
            neighborSum += originalElevations.get(key)!;
            neighborCount++;
          } else if (this.isValidGridPosition(nx, ny)) {
            neighborSum += this.getElevationAt(nx, ny);
            neighborCount++;
          }
        }

        if (neighborCount > 0) {
          const currentElev = originalElevations.get(`${x},${y}`) ?? this.getElevationAt(x, y);
          const avgNeighbor = neighborSum / neighborCount;
          const targetElev = currentElev + (avgNeighbor - currentElev) * effectiveStrength;
          const newElev = Math.round(targetElev);

          if (newElev !== currentElev) {
            this.setElevationWithHistory(x, y, newElev);
            modifiedCount++;
          }
        }
      }
    }

    return modifiedCount;
  }

  public blendTerrainToTarget(centerX: number, centerY: number, radius: number, targetElevation: number, strength: number = 0.5): number {
    const clampedStrength = Math.max(0, Math.min(1, strength));
    let modifiedCount = 0;

    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist > radius) continue;

        const falloff = 1 - (dist / radius);
        const effectiveStrength = clampedStrength * falloff;

        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.round(currentElev + (targetElevation - currentElev) * effectiveStrength);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public flattenTerrainArea(minX: number, minY: number, maxX: number, maxY: number, targetElevation?: number): number {
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(this.courseData.width - 1, maxX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(this.courseData.height - 1, maxY);

    let elevation = targetElevation;
    if (elevation === undefined) {
      let sum = 0;
      let count = 0;
      for (let y = clampedMinY; y <= clampedMaxY; y++) {
        for (let x = clampedMinX; x <= clampedMaxX; x++) {
          sum += this.getElevationAt(x, y);
          count++;
        }
      }
      elevation = count > 0 ? Math.round(sum / count) : 0;
    }

    let modifiedCount = 0;
    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        if (currentElev !== elevation) {
          this.setElevationWithHistory(x, y, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createTerrainGradient(x1: number, y1: number, elev1: number, x2: number, y2: number, elev2: number, width: number = 1): number {
    let modifiedCount = 0;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;

    const steps = Math.ceil(length);
    const perpX = -dy / length;
    const perpY = dx / length;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const centerX = Math.round(x1 + dx * t);
      const centerY = Math.round(y1 + dy * t);
      const elevation = Math.round(elev1 + (elev2 - elev1) * t);

      for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
        const px = Math.round(centerX + perpX * w);
        const py = Math.round(centerY + perpY * w);

        if (this.isValidGridPosition(px, py)) {
          const currentElev = this.getElevationAt(px, py);
          if (currentElev !== elevation) {
            this.setElevationWithHistory(px, py, elevation);
            modifiedCount++;
          }
        }
      }
    }

    return modifiedCount;
  }

  public createTerrainRamp(x1: number, y1: number, x2: number, y2: number, width: number = 1): number {
    const elev1 = this.getElevationAt(x1, y1);
    const elev2 = this.getElevationAt(x2, y2);
    return this.createTerrainGradient(x1, y1, elev1, x2, y2, elev2, width);
  }

  public noisifyTerrain(minX: number, minY: number, maxX: number, maxY: number, amplitude: number = 1): number {
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(this.courseData.width - 1, maxX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(this.courseData.height - 1, maxY);

    let modifiedCount = 0;
    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const currentElev = this.getElevationAt(x, y);
        const noise = Math.round((Math.random() - 0.5) * 2 * amplitude);
        const newElev = Math.max(0, currentElev + noise);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public erodeTerrainArea(centerX: number, centerY: number, radius: number, iterations: number = 1): number {
    let totalModified = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const minX = Math.max(0, centerX - radius);
      const maxX = Math.min(this.courseData.width - 1, centerX + radius);
      const minY = Math.max(0, centerY - radius);
      const maxY = Math.min(this.courseData.height - 1, centerY + radius);

      const changes: Array<{ x: number; y: number; newElev: number }> = [];

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (dist > radius) continue;

          const currentElev = this.getElevationAt(x, y);
          let lowestNeighbor = currentElev;

          const directions = [
            { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
          ];

          for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isValidGridPosition(nx, ny)) {
              const neighborElev = this.getElevationAt(nx, ny);
              if (neighborElev < lowestNeighbor) {
                lowestNeighbor = neighborElev;
              }
            }
          }

          if (lowestNeighbor < currentElev - 1) {
            changes.push({ x, y, newElev: currentElev - 1 });
          }
        }
      }

      for (const change of changes) {
        this.setElevationWithHistory(change.x, change.y, change.newElev);
        totalModified++;
      }
    }

    return totalModified;
  }

  public createSmoothHill(centerX: number, centerY: number, radius: number, height: number, falloff: 'linear' | 'smooth' | 'steep' = 'smooth'): number {
    let modifiedCount = 0;
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist > radius) continue;

        const t = dist / radius;
        let factor: number;
        switch (falloff) {
          case 'linear':
            factor = 1 - t;
            break;
          case 'steep':
            factor = Math.pow(1 - t, 0.5);
            break;
          case 'smooth':
          default:
            factor = Math.cos(t * Math.PI / 2);
            break;
        }

        const elevChange = Math.round(height * factor);
        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createSmoothValley(centerX: number, centerY: number, radius: number, depth: number, falloff: 'linear' | 'smooth' | 'steep' = 'smooth'): number {
    return this.createSmoothHill(centerX, centerY, radius, -depth, falloff);
  }

  public createSmoothPlateau(minX: number, minY: number, maxX: number, maxY: number, height: number, edgeWidth: number = 2): number {
    let modifiedCount = 0;
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(this.courseData.width - 1, maxX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(this.courseData.height - 1, maxY);

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        const distToEdge = Math.min(
          x - clampedMinX,
          clampedMaxX - x,
          y - clampedMinY,
          clampedMaxY - y
        );

        let factor: number;
        if (edgeWidth <= 0 || distToEdge >= edgeWidth) {
          factor = 1;
        } else {
          factor = distToEdge / edgeWidth;
        }

        const elevChange = Math.round(height * factor);
        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createTerrainRidge(x1: number, y1: number, x2: number, y2: number, width: number, height: number): number {
    let modifiedCount = 0;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;

    const nx = dx / length;
    const ny = dy / length;
    const perpX = -ny;
    const perpY = nx;

    const halfWidth = width / 2;
    const steps = Math.ceil(length);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lineX = x1 + dx * t;
      const lineY = y1 + dy * t;

      for (let w = -halfWidth; w <= halfWidth; w += 0.5) {
        const px = Math.round(lineX + perpX * w);
        const py = Math.round(lineY + perpY * w);

        if (!this.isValidGridPosition(px, py)) continue;

        const distFromCenter = Math.abs(w);
        const factor = Math.cos((distFromCenter / halfWidth) * Math.PI / 2);
        const elevChange = Math.round(height * factor);

        const currentElev = this.getElevationAt(px, py);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(px, py, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createCrater(centerX: number, centerY: number, outerRadius: number, innerRadius: number, rimHeight: number, floorDepth: number): number {
    let modifiedCount = 0;
    const radius = outerRadius;
    const minX = Math.max(0, centerX - radius);
    const maxX = Math.min(this.courseData.width - 1, centerX + radius);
    const minY = Math.max(0, centerY - radius);
    const maxY = Math.min(this.courseData.height - 1, centerY + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist > outerRadius) continue;

        let elevChange: number;
        if (dist <= innerRadius) {
          const t = dist / innerRadius;
          elevChange = Math.round(-floorDepth * (1 - t * 0.3));
        } else {
          const t = (dist - innerRadius) / (outerRadius - innerRadius);
          const rimFactor = Math.sin(t * Math.PI);
          elevChange = Math.round(rimHeight * rimFactor - floorDepth * (1 - t));
        }

        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createTerrainWave(startX: number, startY: number, endX: number, endY: number, amplitude: number, wavelength: number, width: number): number {
    let modifiedCount = 0;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return 0;

    const nx = dx / length;
    const ny = dy / length;
    const perpX = -ny;
    const perpY = nx;

    const halfWidth = width / 2;
    const steps = Math.ceil(length);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lineX = startX + dx * t;
      const lineY = startY + dy * t;
      const distAlongLine = length * t;

      const waveValue = Math.sin((distAlongLine / wavelength) * 2 * Math.PI);

      for (let w = -halfWidth; w <= halfWidth; w += 0.5) {
        const px = Math.round(lineX + perpX * w);
        const py = Math.round(lineY + perpY * w);

        if (!this.isValidGridPosition(px, py)) continue;

        const distFromCenter = Math.abs(w);
        const widthFactor = Math.cos((distFromCenter / halfWidth) * Math.PI / 2);
        const elevChange = Math.round(amplitude * waveValue * widthFactor);

        const currentElev = this.getElevationAt(px, py);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(px, py, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public createTerrainNoise(minX: number, minY: number, maxX: number, maxY: number, scale: number, octaves: number = 3, amplitude: number = 2): number {
    let modifiedCount = 0;
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(this.courseData.width - 1, maxX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(this.courseData.height - 1, maxY);

    const seed = Math.random() * 1000;

    for (let y = clampedMinY; y <= clampedMaxY; y++) {
      for (let x = clampedMinX; x <= clampedMaxX; x++) {
        let noiseValue = 0;
        let freq = 1;
        let amp = 1;
        let maxAmp = 0;

        for (let o = 0; o < octaves; o++) {
          const nx = (x / scale) * freq + seed;
          const ny = (y / scale) * freq + seed;
          const n = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
          noiseValue += (n - Math.floor(n) - 0.5) * 2 * amp;
          maxAmp += amp;
          freq *= 2;
          amp *= 0.5;
        }

        noiseValue /= maxAmp;
        const elevChange = Math.round(noiseValue * amplitude);

        const currentElev = this.getElevationAt(x, y);
        const newElev = Math.max(0, currentElev + elevChange);

        if (newElev !== currentElev) {
          this.setElevationWithHistory(x, y, newElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public findPathWithCost(startX: number, startY: number, endX: number, endY: number, maxSlope: number = 45): TerrainPathResult | null {
    if (!this.isValidGridPosition(startX, startY) || !this.isValidGridPosition(endX, endY)) {
      return null;
    }

    const openSet: Array<{ x: number; y: number; g: number; h: number; f: number; parent: { x: number; y: number } | null }> = [];
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();

    const heuristic = (x: number, y: number) => {
      const dx = Math.abs(x - endX);
      const dy = Math.abs(y - endY);
      return dx + dy;
    };

    const startKey = `${startX},${startY}`;
    gScores.set(startKey, 0);
    openSet.push({ x: startX, y: startY, g: 0, h: heuristic(startX, startY), f: heuristic(startX, startY), parent: null });

    const cameFrom = new Map<string, { x: number; y: number }>();

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = `${current.x},${current.y}`;

      if (current.x === endX && current.y === endY) {
        const path: Array<{ x: number; y: number }> = [];
        let node: { x: number; y: number } | undefined = { x: current.x, y: current.y };
        while (node) {
          path.unshift(node);
          node = cameFrom.get(`${node.x},${node.y}`);
        }

        let totalElevationChange = 0;
        let maxSlopeAngle = 0;
        for (let i = 1; i < path.length; i++) {
          const elev1 = this.getElevationAt(path[i - 1].x, path[i - 1].y);
          const elev2 = this.getElevationAt(path[i].x, path[i].y);
          totalElevationChange += Math.abs(elev2 - elev1);
          const slopeAngle = Math.atan2(Math.abs(elev2 - elev1), 1) * 180 / Math.PI;
          maxSlopeAngle = Math.max(maxSlopeAngle, slopeAngle);
        }

        return {
          path,
          totalCost: gScores.get(currentKey) ?? 0,
          pathLength: path.length,
          totalElevationChange,
          maxSlopeAngle,
          found: true
        };
      }

      closedSet.add(currentKey);

      const directions = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
        { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
      ];

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const neighborKey = `${nx},${ny}`;

        if (!this.isValidGridPosition(nx, ny) || closedSet.has(neighborKey)) continue;

        const currentElev = this.getElevationAt(current.x, current.y);
        const neighborElev = this.getElevationAt(nx, ny);
        const dist = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
        const slopeAngle = Math.atan2(Math.abs(neighborElev - currentElev), dist) * 180 / Math.PI;

        if (slopeAngle > maxSlope) continue;

        const terrainType = this.getTerrainTypeAt(nx, ny);
        if (terrainType === 'water') continue;

        const moveCost = dist + Math.abs(neighborElev - currentElev) * 0.5;
        const tentativeG = (gScores.get(currentKey) ?? 0) + moveCost;
        const neighborG = gScores.get(neighborKey) ?? Infinity;

        if (tentativeG < neighborG) {
          cameFrom.set(neighborKey, { x: current.x, y: current.y });
          gScores.set(neighborKey, tentativeG);
          const h = heuristic(nx, ny);
          const existingIndex = openSet.findIndex(n => n.x === nx && n.y === ny);
          if (existingIndex >= 0) {
            openSet[existingIndex] = { x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: { x: current.x, y: current.y } };
          } else {
            openSet.push({ x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: { x: current.x, y: current.y } });
          }
        }
      }
    }

    return { path: [], totalCost: Infinity, pathLength: 0, totalElevationChange: 0, maxSlopeAngle: 0, found: false };
  }

  public checkLineOfSightSimple(x1: number, y1: number, height1: number, x2: number, y2: number, height2: number): SimpleLineOfSightResult {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) {
      return { visible: true, blockedAt: null, minClearance: Infinity, obstructions: [] };
    }

    const steps = Math.ceil(distance * 2);
    const obstructions: Array<{ x: number; y: number; elevation: number; clearance: number }> = [];
    let minClearance = Infinity;
    let blockedAt: { x: number; y: number } | null = null;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const gridX = Math.round(px);
      const gridY = Math.round(py);

      if (!this.isValidGridPosition(gridX, gridY)) continue;

      const rayHeight = height1 + (height2 - height1) * t;
      const terrainElev = this.getElevationAt(gridX, gridY);
      const clearance = rayHeight - terrainElev;

      if (clearance < minClearance) {
        minClearance = clearance;
      }

      if (clearance < 0) {
        obstructions.push({ x: gridX, y: gridY, elevation: terrainElev, clearance });
        if (!blockedAt) {
          blockedAt = { x: gridX, y: gridY };
        }
      }
    }

    return {
      visible: blockedAt === null,
      blockedAt,
      minClearance,
      obstructions
    };
  }

  public getVisibleTilesFromPoint(viewX: number, viewY: number, viewHeight: number, maxDistance: number): SimpleVisibilityMap {
    const visibleTiles: Array<{ x: number; y: number; distance: number; clearance: number }> = [];
    const hiddenTiles: Array<{ x: number; y: number; distance: number; reason: string }> = [];

    const minX = Math.max(0, Math.floor(viewX - maxDistance));
    const maxX = Math.min(this.courseData.width - 1, Math.ceil(viewX + maxDistance));
    const minY = Math.max(0, Math.floor(viewY - maxDistance));
    const maxY = Math.min(this.courseData.height - 1, Math.ceil(viewY + maxDistance));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x === viewX && y === viewY) continue;

        const distance = Math.sqrt((x - viewX) ** 2 + (y - viewY) ** 2);
        if (distance > maxDistance) continue;

        const targetElev = this.getElevationAt(x, y);
        const los = this.checkLineOfSightSimple(viewX, viewY, viewHeight, x, y, targetElev);

        if (los.visible) {
          visibleTiles.push({ x, y, distance, clearance: los.minClearance });
        } else {
          hiddenTiles.push({ x, y, distance, reason: 'terrain_blocked' });
        }
      }
    }

    return {
      viewpoint: { x: viewX, y: viewY, height: viewHeight },
      maxDistance,
      visibleCount: visibleTiles.length,
      hiddenCount: hiddenTiles.length,
      visibilityRatio: visibleTiles.length / (visibleTiles.length + hiddenTiles.length),
      visibleTiles,
      hiddenTiles
    };
  }

  public findBestViewpointsForTarget(targetX: number, targetY: number, searchRadius: number, minHeight: number = 0): Array<ViewpointScore> {
    const viewpoints: Array<ViewpointScore> = [];

    const minX = Math.max(0, targetX - searchRadius);
    const maxX = Math.min(this.courseData.width - 1, targetX + searchRadius);
    const minY = Math.max(0, targetY - searchRadius);
    const maxY = Math.min(this.courseData.height - 1, targetY + searchRadius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x === targetX && y === targetY) continue;

        const distance = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
        if (distance > searchRadius) continue;

        const viewElev = this.getElevationAt(x, y);
        if (viewElev < minHeight) continue;

        const targetElev = this.getElevationAt(targetX, targetY);
        const viewHeight = viewElev + 1.5;
        const los = this.checkLineOfSightSimple(x, y, viewHeight, targetX, targetY, targetElev);

        if (los.visible) {
          const elevAdvantage = viewElev - targetElev;
          const score = los.minClearance + elevAdvantage * 0.5 - distance * 0.1;

          viewpoints.push({
            x, y,
            elevation: viewElev,
            distance,
            clearance: los.minClearance,
            score,
            canSeeTarget: true
          });
        }
      }
    }

    viewpoints.sort((a, b) => b.score - a.score);
    return viewpoints.slice(0, 10);
  }

  public computeDetailedShadowMap(sunAngle: number, sunAzimuth: number): DetailedShadowMapResult {
    const shadowedTiles: Array<{ x: number; y: number; shadowDepth: number }> = [];
    const litTiles: Array<{ x: number; y: number; illumination: number }> = [];

    const sunRad = sunAngle * Math.PI / 180;
    const azRad = sunAzimuth * Math.PI / 180;
    const sunDirX = Math.cos(azRad);
    const sunDirY = Math.sin(azRad);
    const sunTan = Math.tan(sunRad);

    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        const tileElev = this.getElevationAt(x, y);
        let inShadow = false;
        let shadowDepth = 0;

        for (let dist = 1; dist < 50; dist++) {
          const checkX = Math.round(x - sunDirX * dist);
          const checkY = Math.round(y - sunDirY * dist);

          if (!this.isValidGridPosition(checkX, checkY)) break;

          const checkElev = this.getElevationAt(checkX, checkY);
          const requiredHeight = tileElev + dist * sunTan;

          if (checkElev > requiredHeight) {
            inShadow = true;
            shadowDepth = checkElev - requiredHeight;
            break;
          }
        }

        if (inShadow) {
          shadowedTiles.push({ x, y, shadowDepth });
        } else {
          const slope = this.getSlopeVectorAt(x, y);
          const slopeX = slope.magnitude * Math.cos(slope.direction * Math.PI / 180);
          const slopeY = slope.magnitude * Math.sin(slope.direction * Math.PI / 180);
          const dotProduct = Math.cos(sunRad) + (slopeX * sunDirX + slopeY * sunDirY) * Math.sin(sunRad);
          const illumination = Math.max(0, dotProduct);
          litTiles.push({ x, y, illumination });
        }
      }
    }

    return {
      sunAngle,
      sunAzimuth,
      shadowedCount: shadowedTiles.length,
      litCount: litTiles.length,
      shadowCoverage: shadowedTiles.length / (this.courseData.width * this.courseData.height),
      shadowedTiles,
      litTiles
    };
  }

  public mirrorTerrainAreaHorizontal(sourceMinX: number, sourceMinY: number, sourceMaxX: number, sourceMaxY: number, targetX: number, targetY: number): number {
    let modifiedCount = 0;
    const width = sourceMaxX - sourceMinX + 1;
    const height = sourceMaxY - sourceMinY + 1;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const sx = sourceMinX + dx;
        const sy = sourceMinY + dy;
        const tx = targetX + (width - 1 - dx);
        const ty = targetY + dy;

        if (!this.isValidGridPosition(sx, sy) || !this.isValidGridPosition(tx, ty)) continue;

        const elevation = this.getElevationAt(sx, sy);
        const currentElev = this.getElevationAt(tx, ty);
        if (elevation !== currentElev) {
          this.setElevationWithHistory(tx, ty, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public mirrorTerrainAreaVertical(sourceMinX: number, sourceMinY: number, sourceMaxX: number, sourceMaxY: number, targetX: number, targetY: number): number {
    let modifiedCount = 0;
    const width = sourceMaxX - sourceMinX + 1;
    const height = sourceMaxY - sourceMinY + 1;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const sx = sourceMinX + dx;
        const sy = sourceMinY + dy;
        const tx = targetX + dx;
        const ty = targetY + (height - 1 - dy);

        if (!this.isValidGridPosition(sx, sy) || !this.isValidGridPosition(tx, ty)) continue;

        const elevation = this.getElevationAt(sx, sy);
        const currentElev = this.getElevationAt(tx, ty);
        if (elevation !== currentElev) {
          this.setElevationWithHistory(tx, ty, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public rotateTerrain90(sourceMinX: number, sourceMinY: number, sourceMaxX: number, sourceMaxY: number, targetX: number, targetY: number, clockwise: boolean = true): number {
    let modifiedCount = 0;
    const width = sourceMaxX - sourceMinX + 1;
    const height = sourceMaxY - sourceMinY + 1;

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const sx = sourceMinX + dx;
        const sy = sourceMinY + dy;

        let tx: number, ty: number;
        if (clockwise) {
          tx = targetX + (height - 1 - dy);
          ty = targetY + dx;
        } else {
          tx = targetX + dy;
          ty = targetY + (width - 1 - dx);
        }

        if (!this.isValidGridPosition(sx, sy) || !this.isValidGridPosition(tx, ty)) continue;

        const elevation = this.getElevationAt(sx, sy);
        const currentElev = this.getElevationAt(tx, ty);
        if (elevation !== currentElev) {
          this.setElevationWithHistory(tx, ty, elevation);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public checkTerrainSymmetry(minX: number, minY: number, maxX: number, maxY: number, axis: 'horizontal' | 'vertical' | 'both'): TerrainSymmetryResult {
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    let horizontalMatches = 0;
    let horizontalTotal = 0;
    let verticalMatches = 0;
    let verticalTotal = 0;
    const asymmetricTiles: Array<{ x: number; y: number; mirrorX: number; mirrorY: number; diff: number }> = [];

    if (axis === 'horizontal' || axis === 'both') {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < Math.floor(width / 2); dx++) {
          const x1 = minX + dx;
          const x2 = maxX - dx;
          const y = minY + dy;

          if (!this.isValidGridPosition(x1, y) || !this.isValidGridPosition(x2, y)) continue;

          const elev1 = this.getElevationAt(x1, y);
          const elev2 = this.getElevationAt(x2, y);
          horizontalTotal++;

          if (elev1 === elev2) {
            horizontalMatches++;
          } else {
            asymmetricTiles.push({ x: x1, y, mirrorX: x2, mirrorY: y, diff: Math.abs(elev2 - elev1) });
          }
        }
      }
    }

    if (axis === 'vertical' || axis === 'both') {
      for (let dy = 0; dy < Math.floor(height / 2); dy++) {
        for (let dx = 0; dx < width; dx++) {
          const x = minX + dx;
          const y1 = minY + dy;
          const y2 = maxY - dy;

          if (!this.isValidGridPosition(x, y1) || !this.isValidGridPosition(x, y2)) continue;

          const elev1 = this.getElevationAt(x, y1);
          const elev2 = this.getElevationAt(x, y2);
          verticalTotal++;

          if (elev1 === elev2) {
            verticalMatches++;
          } else if (axis === 'vertical') {
            asymmetricTiles.push({ x, y: y1, mirrorX: x, mirrorY: y2, diff: Math.abs(elev2 - elev1) });
          }
        }
      }
    }

    const horizontalSymmetry = horizontalTotal > 0 ? horizontalMatches / horizontalTotal : 1;
    const verticalSymmetry = verticalTotal > 0 ? verticalMatches / verticalTotal : 1;

    return {
      horizontalSymmetry,
      verticalSymmetry,
      overallSymmetry: (horizontalSymmetry + verticalSymmetry) / 2,
      horizontalMatches,
      horizontalTotal,
      verticalMatches,
      verticalTotal,
      asymmetricTiles,
      isPerfectlySymmetric: horizontalSymmetry === 1 && verticalSymmetry === 1
    };
  }

  public enforceSymmetry(minX: number, minY: number, maxX: number, maxY: number, axis: 'horizontal' | 'vertical', preferHigher: boolean = true): number {
    let modifiedCount = 0;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    if (axis === 'horizontal') {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < Math.floor(width / 2); dx++) {
          const x1 = minX + dx;
          const x2 = maxX - dx;
          const y = minY + dy;

          if (!this.isValidGridPosition(x1, y) || !this.isValidGridPosition(x2, y)) continue;

          const elev1 = this.getElevationAt(x1, y);
          const elev2 = this.getElevationAt(x2, y);

          if (elev1 !== elev2) {
            const targetElev = preferHigher ? Math.max(elev1, elev2) : Math.min(elev1, elev2);
            if (elev1 !== targetElev) {
              this.setElevationWithHistory(x1, y, targetElev);
              modifiedCount++;
            }
            if (elev2 !== targetElev) {
              this.setElevationWithHistory(x2, y, targetElev);
              modifiedCount++;
            }
          }
        }
      }
    } else {
      for (let dy = 0; dy < Math.floor(height / 2); dy++) {
        for (let dx = 0; dx < width; dx++) {
          const x = minX + dx;
          const y1 = minY + dy;
          const y2 = maxY - dy;

          if (!this.isValidGridPosition(x, y1) || !this.isValidGridPosition(x, y2)) continue;

          const elev1 = this.getElevationAt(x, y1);
          const elev2 = this.getElevationAt(x, y2);

          if (elev1 !== elev2) {
            const targetElev = preferHigher ? Math.max(elev1, elev2) : Math.min(elev1, elev2);
            if (elev1 !== targetElev) {
              this.setElevationWithHistory(x, y1, targetElev);
              modifiedCount++;
            }
            if (elev2 !== targetElev) {
              this.setElevationWithHistory(x, y2, targetElev);
              modifiedCount++;
            }
          }
        }
      }
    }

    return modifiedCount;
  }

  public tileTerrainPattern(sourceMinX: number, sourceMinY: number, sourceMaxX: number, sourceMaxY: number, targetMinX: number, targetMinY: number, targetMaxX: number, targetMaxY: number): number {
    let modifiedCount = 0;
    const patternWidth = sourceMaxX - sourceMinX + 1;
    const patternHeight = sourceMaxY - sourceMinY + 1;

    for (let ty = targetMinY; ty <= targetMaxY; ty++) {
      for (let tx = targetMinX; tx <= targetMaxX; tx++) {
        if (!this.isValidGridPosition(tx, ty)) continue;

        const px = ((tx - targetMinX) % patternWidth + patternWidth) % patternWidth;
        const py = ((ty - targetMinY) % patternHeight + patternHeight) % patternHeight;
        const sx = sourceMinX + px;
        const sy = sourceMinY + py;

        if (!this.isValidGridPosition(sx, sy)) continue;

        const sourceElev = this.getElevationAt(sx, sy);
        const currentElev = this.getElevationAt(tx, ty);

        if (sourceElev !== currentElev) {
          this.setElevationWithHistory(tx, ty, sourceElev);
          modifiedCount++;
        }
      }
    }

    return modifiedCount;
  }

  public generateContourLineSet(interval: number = 1, minElev?: number, maxElev?: number): ContourLineSet {
    const actualMinElev = minElev ?? 0;
    const actualMaxElev = maxElev ?? this.getMaxElevation();
    const contours: ContourLine[] = [];

    for (let elev = actualMinElev; elev <= actualMaxElev; elev += interval) {
      const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

      for (let y = 0; y < this.courseData.height - 1; y++) {
        for (let x = 0; x < this.courseData.width - 1; x++) {
          const e00 = this.getElevationAt(x, y);
          const e10 = this.getElevationAt(x + 1, y);
          const e01 = this.getElevationAt(x, y + 1);
          const e11 = this.getElevationAt(x + 1, y + 1);

          const cellSegments = this.computeMarchingSquaresCell(x, y, e00, e10, e01, e11, elev);
          segments.push(...cellSegments);
        }
      }

      if (segments.length > 0) {
        contours.push({
          elevation: elev,
          segments,
          isMajor: elev % (interval * 5) === 0
        });
      }
    }

    return {
      interval,
      minElevation: actualMinElev,
      maxElevation: actualMaxElev,
      contourCount: contours.length,
      contours
    };
  }

  private computeMarchingSquaresCell(x: number, y: number, e00: number, e10: number, e01: number, e11: number, threshold: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    const b00 = e00 >= threshold ? 1 : 0;
    const b10 = e10 >= threshold ? 1 : 0;
    const b01 = e01 >= threshold ? 1 : 0;
    const b11 = e11 >= threshold ? 1 : 0;
    const index = b00 | (b10 << 1) | (b01 << 2) | (b11 << 3);

    if (index === 0 || index === 15) return segments;

    const lerp = (v1: number, v2: number, t: number) => v1 + (v2 - v1) * t;
    const getT = (v1: number, v2: number) => (v1 === v2) ? 0.5 : (threshold - v1) / (v2 - v1);

    const left = { x: x, y: lerp(y, y + 1, getT(e00, e01)) };
    const right = { x: x + 1, y: lerp(y, y + 1, getT(e10, e11)) };
    const top = { x: lerp(x, x + 1, getT(e00, e10)), y: y };
    const bottom = { x: lerp(x, x + 1, getT(e01, e11)), y: y + 1 };

    const addSegment = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    };

    switch (index) {
      case 1: case 14: addSegment(left, top); break;
      case 2: case 13: addSegment(top, right); break;
      case 3: case 12: addSegment(left, right); break;
      case 4: case 11: addSegment(bottom, left); break;
      case 5: case 10: addSegment(top, left); addSegment(bottom, right); break;
      case 6: case 9: addSegment(top, bottom); break;
      case 7: case 8: addSegment(bottom, right); break;
    }

    return segments;
  }

  public getElevationBands(bandSize: number = 1): ElevationBandSet {
    const maxElev = this.getMaxElevation();
    const bands: ElevationBand[] = [];

    for (let minElev = 0; minElev <= maxElev; minElev += bandSize) {
      const maxBandElev = minElev + bandSize;
      const tiles: Array<{ x: number; y: number }> = [];

      for (let y = 0; y < this.courseData.height; y++) {
        for (let x = 0; x < this.courseData.width; x++) {
          const elev = this.getElevationAt(x, y);
          if (elev >= minElev && elev < maxBandElev) {
            tiles.push({ x, y });
          }
        }
      }

      if (tiles.length > 0) {
        bands.push({
          minElevation: minElev,
          maxElevation: maxBandElev,
          tileCount: tiles.length,
          tiles,
          percentage: tiles.length / (this.courseData.width * this.courseData.height) * 100
        });
      }
    }

    return {
      bandSize,
      bandCount: bands.length,
      totalTiles: this.courseData.width * this.courseData.height,
      bands
    };
  }

  public findElevationBoundaries(): ElevationBoundarySet {
    const boundaries: Array<{ x: number; y: number; elevDiff: number; direction: 'horizontal' | 'vertical' }> = [];

    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width - 1; x++) {
        const e1 = this.getElevationAt(x, y);
        const e2 = this.getElevationAt(x + 1, y);
        if (e1 !== e2) {
          boundaries.push({ x, y, elevDiff: Math.abs(e2 - e1), direction: 'horizontal' });
        }
      }
    }

    for (let y = 0; y < this.courseData.height - 1; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        const e1 = this.getElevationAt(x, y);
        const e2 = this.getElevationAt(x, y + 1);
        if (e1 !== e2) {
          boundaries.push({ x, y, elevDiff: Math.abs(e2 - e1), direction: 'vertical' });
        }
      }
    }

    const maxDiff = boundaries.length > 0 ? Math.max(...boundaries.map(b => b.elevDiff)) : 0;
    const avgDiff = boundaries.length > 0 ? boundaries.reduce((sum, b) => sum + b.elevDiff, 0) / boundaries.length : 0;

    return {
      boundaryCount: boundaries.length,
      maxElevationDiff: maxDiff,
      avgElevationDiff: avgDiff,
      boundaries
    };
  }

  public traceContourAtPoint(x: number, y: number, elevation?: number): ContourTrace {
    const startElev = elevation ?? this.getElevationAt(x, y);
    const points: Array<{ x: number; y: number }> = [];
    const visited = new Set<string>();

    let currentX = x;
    let currentY = y;
    let iterations = 0;
    const maxIterations = this.courseData.width * this.courseData.height;

    while (iterations < maxIterations) {
      const key = `${currentX},${currentY}`;
      if (visited.has(key)) break;

      visited.add(key);
      points.push({ x: currentX, y: currentY });

      const directions = [
        { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }
      ];

      let found = false;
      for (const dir of directions) {
        const nx = currentX + dir.dx;
        const ny = currentY + dir.dy;
        const nkey = `${nx},${ny}`;

        if (!this.isValidGridPosition(nx, ny) || visited.has(nkey)) continue;

        const nElev = this.getElevationAt(nx, ny);
        if (nElev === startElev) {
          currentX = nx;
          currentY = ny;
          found = true;
          break;
        }
      }

      if (!found) break;
      iterations++;
    }

    const isClosed = points.length > 2 &&
      Math.abs(points[0].x - points[points.length - 1].x) <= 1 &&
      Math.abs(points[0].y - points[points.length - 1].y) <= 1;

    let perimeter = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      elevation: startElev,
      points,
      pointCount: points.length,
      isClosed,
      perimeter
    };
  }

  public getTerrainGradientMap(): TerrainGradientMap {
    const gradients: Array<{ x: number; y: number; magnitude: number; direction: number }> = [];
    let maxMagnitude = 0;
    let sumMagnitude = 0;

    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        const slope = this.getSlopeVectorAt(x, y);
        gradients.push({
          x, y,
          magnitude: slope.magnitude,
          direction: slope.direction
        });
        maxMagnitude = Math.max(maxMagnitude, slope.magnitude);
        sumMagnitude += slope.magnitude;
      }
    }

    return {
      width: this.courseData.width,
      height: this.courseData.height,
      maxMagnitude,
      avgMagnitude: sumMagnitude / gradients.length,
      gradients
    };
  }

  private getMaxElevation(): number {
    let max = 0;
    for (let y = 0; y < this.courseData.height; y++) {
      for (let x = 0; x < this.courseData.width; x++) {
        max = Math.max(max, this.getElevationAt(x, y));
      }
    }
    return max;
  }

  public getDetailedTerrainProfile(x1: number, y1: number, x2: number, y2: number, numSamples: number = 50): TerrainProfile {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    const samples: TerrainProfileSample[] = [];

    let minElev = Infinity;
    let maxElev = -Infinity;
    let totalAscent = 0;
    let totalDescent = 0;
    let prevElev: number | null = null;

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      const gridX = Math.round(x);
      const gridY = Math.round(y);
      const distance = totalDistance * t;

      const elev = this.isValidGridPosition(gridX, gridY) ? this.getElevationAt(gridX, gridY) : 0;
      const slope = this.isValidGridPosition(gridX, gridY) ? this.getSlopeVectorAt(gridX, gridY) : { angle: 0, direction: 0, magnitude: 0 };
      const terrainType = this.isValidGridPosition(gridX, gridY) ? this.getTerrainTypeAt(gridX, gridY) : 'fairway';

      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);

      if (prevElev !== null) {
        const diff = elev - prevElev;
        if (diff > 0) totalAscent += diff;
        else totalDescent += Math.abs(diff);
      }
      prevElev = elev;

      samples.push({
        x: gridX,
        y: gridY,
        distance,
        elevation: elev,
        slopeAngle: slope.angle,
        terrainType: terrainType as TerrainType
      });
    }

    const elevationChange = samples.length > 0 ? samples[samples.length - 1].elevation - samples[0].elevation : 0;
    const avgGrade = totalDistance > 0 ? (elevationChange / totalDistance) * 100 : 0;

    return {
      startX: x1,
      startY: y1,
      endX: x2,
      endY: y2,
      totalDistance,
      numSamples: samples.length,
      samples,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      elevationChange,
      totalAscent,
      totalDescent,
      avgGrade
    };
  }

  public getTerrainCrossSection(centerX: number, centerY: number, direction: number, length: number, numSamples: number = 30): TerrainCrossSection {
    const radians = direction * Math.PI / 180;
    const halfLength = length / 2;

    const x1 = centerX - Math.cos(radians) * halfLength;
    const y1 = centerY - Math.sin(radians) * halfLength;
    const x2 = centerX + Math.cos(radians) * halfLength;
    const y2 = centerY + Math.sin(radians) * halfLength;

    const profile = this.getDetailedTerrainProfile(x1, y1, x2, y2, numSamples);

    const leftSamples = profile.samples.slice(0, Math.floor(numSamples / 2) + 1);
    const rightSamples = profile.samples.slice(Math.floor(numSamples / 2));

    const leftAvgElev = leftSamples.reduce((sum, s) => sum + s.elevation, 0) / leftSamples.length;
    const rightAvgElev = rightSamples.reduce((sum, s) => sum + s.elevation, 0) / rightSamples.length;
    const tilt = rightAvgElev - leftAvgElev;

    return {
      centerX,
      centerY,
      direction,
      length,
      profile,
      leftAvgElevation: leftAvgElev,
      rightAvgElevation: rightAvgElev,
      tilt,
      isLevel: Math.abs(tilt) < 0.5
    };
  }

  public analyzeTerrainAlongPath(path: Array<{ x: number; y: number }>): TerrainPathAnalysis {
    if (path.length < 2) {
      return {
        path,
        totalDistance: 0,
        profiles: [],
        totalAscent: 0,
        totalDescent: 0,
        minElevation: 0,
        maxElevation: 0,
        avgSlope: 0,
        maxSlope: 0,
        terrainTypeCounts: {}
      };
    }

    const profiles: TerrainProfile[] = [];
    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let minElev = Infinity;
    let maxElev = -Infinity;
    let maxSlope = 0;
    let slopeSum = 0;
    let slopeCount = 0;
    const terrainTypeCounts: Record<string, number> = {};

    for (let i = 0; i < path.length - 1; i++) {
      const profile = this.getDetailedTerrainProfile(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, 10);
      profiles.push(profile);

      totalDistance += profile.totalDistance;
      totalAscent += profile.totalAscent;
      totalDescent += profile.totalDescent;
      minElev = Math.min(minElev, profile.minElevation);
      maxElev = Math.max(maxElev, profile.maxElevation);

      for (const sample of profile.samples) {
        maxSlope = Math.max(maxSlope, Math.abs(sample.slopeAngle));
        slopeSum += Math.abs(sample.slopeAngle);
        slopeCount++;

        const type = sample.terrainType;
        terrainTypeCounts[type] = (terrainTypeCounts[type] || 0) + 1;
      }
    }

    return {
      path,
      totalDistance,
      profiles,
      totalAscent,
      totalDescent,
      minElevation: minElev === Infinity ? 0 : minElev,
      maxElevation: maxElev === -Infinity ? 0 : maxElev,
      avgSlope: slopeCount > 0 ? slopeSum / slopeCount : 0,
      maxSlope,
      terrainTypeCounts
    };
  }

  public findSteepestPath(x1: number, y1: number, x2: number, y2: number): SteepestPathResult {
    const profile = this.getDetailedTerrainProfile(x1, y1, x2, y2, 100);
    let steepestSegmentStart = 0;
    let steepestSegmentEnd = 0;
    let maxSlopeMagnitude = 0;

    for (let i = 1; i < profile.samples.length; i++) {
      const elevDiff = Math.abs(profile.samples[i].elevation - profile.samples[i - 1].elevation);
      const distDiff = profile.samples[i].distance - profile.samples[i - 1].distance;
      const slope = distDiff > 0 ? elevDiff / distDiff : 0;

      if (slope > maxSlopeMagnitude) {
        maxSlopeMagnitude = slope;
        steepestSegmentStart = i - 1;
        steepestSegmentEnd = i;
      }
    }

    const startSample = profile.samples[steepestSegmentStart];
    const endSample = profile.samples[steepestSegmentEnd];

    return {
      startX: startSample?.x ?? x1,
      startY: startSample?.y ?? y1,
      endX: endSample?.x ?? x2,
      endY: endSample?.y ?? y2,
      slopeMagnitude: maxSlopeMagnitude,
      slopeAngle: Math.atan(maxSlopeMagnitude) * 180 / Math.PI,
      elevationDiff: startSample && endSample ? Math.abs(endSample.elevation - startSample.elevation) : 0,
      segmentLength: startSample && endSample ? endSample.distance - startSample.distance : 0
    };
  }

  public getTerrainProfileGrid(minX: number, minY: number, maxX: number, maxY: number, gridSpacing: number = 5): TerrainProfileGrid {
    const horizontalProfiles: TerrainProfile[] = [];
    const verticalProfiles: TerrainProfile[] = [];

    for (let y = minY; y <= maxY; y += gridSpacing) {
      const profile = this.getDetailedTerrainProfile(minX, y, maxX, y, Math.ceil((maxX - minX) / gridSpacing));
      horizontalProfiles.push(profile);
    }

    for (let x = minX; x <= maxX; x += gridSpacing) {
      const profile = this.getDetailedTerrainProfile(x, minY, x, maxY, Math.ceil((maxY - minY) / gridSpacing));
      verticalProfiles.push(profile);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      gridSpacing,
      horizontalProfiles,
      verticalProfiles,
      horizontalCount: horizontalProfiles.length,
      verticalCount: verticalProfiles.length
    };
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

export interface ViewshedStatistics {
  visibleCount: number;
  hiddenCount: number;
  totalTiles: number;
  visibilityPercentage: number;
}

export interface SolarAnalysis {
  minInsolation: number;
  maxInsolation: number;
  avgInsolation: number;
  shadedTileCount: number;
  fullSunTileCount: number;
  partialSunTileCount: number;
  shadedPercentage: number;
  fullSunPercentage: number;
}

export interface WindExposureAnalysis {
  windDirection: number;
  minExposure: number;
  maxExposure: number;
  avgExposure: number;
  windwardTileCount: number;
  leewardTileCount: number;
  neutralTileCount: number;
  highlyExposedPercentage: number;
  shelteredPercentage: number;
}

export interface AccessibilityAnalysis {
  startPoint: { x: number; y: number };
  minAccessibilityCost: number;
  maxAccessibilityCost: number;
  avgAccessibilityCost: number;
  accessibleTileCount: number;
  inaccessibleTileCount: number;
  easyAccessCount: number;
  moderateAccessCount: number;
  difficultAccessCount: number;
  accessibilityPercentage: number;
}

export interface FrostAnalysis {
  nighttimeTemperature: number;
  minFrostRisk: number;
  maxFrostRisk: number;
  avgFrostRisk: number;
  frostPocketCount: number;
  noneRiskCount: number;
  lowRiskCount: number;
  moderateRiskCount: number;
  highRiskCount: number;
  severeRiskCount: number;
  atRiskPercentage: number;
}

export interface TerrainComplexityAnalysis {
  minComplexity: number;
  maxComplexity: number;
  avgComplexity: number;
  simpleTileCount: number;
  moderateTileCount: number;
  complexTileCount: number;
  veryComplexTileCount: number;
  peakCount: number;
  valleyCount: number;
  ridgeLineCount: number;
  overallComplexityScore: number;
}

export interface GolfSuitabilityAnalysis {
  teeMinSuitability: number;
  teeMaxSuitability: number;
  teeAvgSuitability: number;
  teeExcellentCount: number;
  greenMinSuitability: number;
  greenMaxSuitability: number;
  greenAvgSuitability: number;
  greenExcellentCount: number;
  fairwayMinSuitability: number;
  fairwayMaxSuitability: number;
  fairwayAvgSuitability: number;
  fairwayExcellentCount: number;
  overallPlayabilityScore: number;
}

export interface DiurnalShadowAnalysis {
  daylightHours: number;
  minShadowHours: number;
  maxShadowHours: number;
  avgShadowHours: number;
  fullSunTileCount: number;
  mostlySunTileCount: number;
  partialShadeTileCount: number;
  mostlyShadeTileCount: number;
  fullShadeTileCount: number;
  avgConsistency: number;
  sunnyPercentage: number;
}

export interface SeasonalTerrainAnalysis {
  springSunAvg: number;
  summerSunAvg: number;
  autumnSunAvg: number;
  winterSunAvg: number;
  springFrostRiskAvg: number;
  summerFrostRiskAvg: number;
  autumnFrostRiskAvg: number;
  winterFrostRiskAvg: number;
  annualSunVariationAvg: number;
  yearRoundSunnyCount: number;
  yearRoundShadedCount: number;
  summerSunnyOnlyCount: number;
  variablePatternCount: number;
}

export type MicroclimateZone = 'warm_sheltered' | 'warm_exposed' | 'cool_sheltered' | 'cool_exposed' | 'frost_prone' | 'wet_shaded' | 'transitional';

export interface MicroclimateFactors {
  sunExposure: number;
  windExposure: number;
  frostRisk: number;
  drainageQuality: number;
  elevation: number;
}

export interface MicroclimateAnalysis {
  warmShelteredCount: number;
  warmExposedCount: number;
  coolShelteredCount: number;
  coolExposedCount: number;
  frostProneCount: number;
  wetShadedCount: number;
  transitionalCount: number;
  dominantZone: MicroclimateZone;
  zoneCount: number;
  diversityIndex: number;
}

export interface ErosionAnalysis {
  averageRisk: number;
  maxRisk: number;
  maxRiskLocation: { x: number; y: number };
  negligibleCount: number;
  lowRiskCount: number;
  moderateRiskCount: number;
  highRiskCount: number;
  severeRiskCount: number;
  atRiskPercentage: number;
}

export interface PondingAnalysis {
  averageDepth: number;
  maxDepth: number;
  maxDepthLocation: { x: number; y: number };
  noneCount: number;
  minimalCount: number;
  moderateCount: number;
  significantCount: number;
  severeCount: number;
  pondingPercentage: number;
}

export interface VisibilityAnalysis {
  visibleCount: number;
  hiddenCount: number;
  visibilityPercentage: number;
  farthestVisiblePoint: { x: number; y: number; distance: number };
  viewerLocation: { x: number; y: number };
  viewerHeight: number;
}

export interface FrequencyAnalysis {
  lowFrequencyRatio: number;
  midFrequencyRatio: number;
  highFrequencyRatio: number;
  dominantScale: 'coarse' | 'medium' | 'fine';
  roughnessIndex: number;
}

export interface RoughnessAnalysis {
  averageRoughness: number;
  maxRoughness: number;
  maxRoughnessLocation: { x: number; y: number };
  smoothCount: number;
  slightCount: number;
  moderateCount: number;
  roughCount: number;
  veryRoughCount: number;
  smoothPercentage: number;
}

export interface EdgeAnalysis {
  terrainTypeEdgeCount: number;
  elevationEdgeCount: number;
  interiorCount: number;
  edgeCount: number;
  cornerCount: number;
  boundaryCount: number;
  mostCommonTransition: string;
  transitionCount: number;
}

export interface ContourLine {
  elevation: number;
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  isMajor: boolean;
}

export interface ContourAnalysis {
  contourCount: number;
  majorContourCount: number;
  minorContourCount: number;
  totalContourLength: number;
  elevationRange: number;
  interval: number;
  densestContourLevel: number;
  averageContourSpacing: number;
}

export interface ElevationProfile {
  samples: Array<{ distance: number; elevation: number; x: number; y: number; grade: number }>;
  totalDistance: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
  averageGrade: number;
  maxGrade: number;
  gradeChanges: Array<{ distance: number; grade: number; type: 'uphill' | 'downhill' | 'flat' }>;
}

export interface ProfileAnalysis {
  totalDistance: number;
  netElevationChange: number;
  elevationGain: number;
  elevationLoss: number;
  averageGrade: number;
  maxGrade: number;
  gradeChangeCount: number;
  flatSectionCount: number;
  flatPercentage: number;
  steepestSection: number;
  difficulty: 'flat' | 'easy' | 'moderate' | 'challenging' | 'difficult';
}

export interface SmoothingAnalysis {
  averageDelta: number;
  maxDelta: number;
  maxDeltaLocation: { x: number; y: number };
  smoothAreasCount: number;
  roughAreasCount: number;
  smoothnessPercentage: number;
  recommendedSigma: number;
}

export type TileGeometryType = 'flat' | 'ramp' | 'corner' | 'valley' | 'cliff' | 'complex';

export interface RegionStatistics {
  size: number;
  centroid: { x: number; y: number };
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  avgElevation: number;
  minElevation: number;
  maxElevation: number;
  avgSlope: number;
  maxSlope: number;
  perimeter: number;
  compactness: number;
  dominantTerrainType: TerrainType;
}

export interface ConnectivityAnalysis {
  fairwayRegionCount: number;
  roughRegionCount: number;
  greenRegionCount: number;
  bunkerRegionCount: number;
  waterRegionCount: number;
  flatRegionCount: number;
  largestFairwayRegion: RegionStatistics | null;
  largestGreenRegion: RegionStatistics | null;
  fragmentationIndex: number;
  totalTiles: number;
}

export type VertexClassification = 'peak' | 'pit' | 'ridge' | 'valley' | 'saddle' | 'slope' | 'flat' | 'local_high' | 'local_low';

export interface VertexStatistics {
  totalVertices: number;
  peakCount: number;
  pitCount: number;
  ridgeCount: number;
  valleyCount: number;
  saddleCount: number;
  slopeCount: number;
  flatCount: number;
  highestPeak: { x: number; y: number; elevation: number } | null;
  lowestPit: { x: number; y: number; elevation: number } | null;
  ruggednessIndex: number;
}

export interface BatchQueryOptions {
  includeElevation?: boolean;
  includeSlope?: boolean;
  includeTerrainType?: boolean;
  includeCornerHeights?: boolean;
  includePhysics?: boolean;
  includeGeometry?: boolean;
}

export interface TileBatchResult {
  x: number;
  y: number;
  valid: boolean;
  elevation?: number;
  slopeAngle?: number;
  slopeDirection?: number;
  terrainType?: TerrainType;
  cornerHeights?: CornerHeights;
  physics?: SurfacePhysics;
  geometryType?: TileGeometryType;
}

export interface TileAreaResult {
  center: { x: number; y: number };
  radius: number;
  tiles: TileBatchResult[];
  tileCount: number;
  avgElevation: number;
  minElevation: number;
  maxElevation: number;
  avgSlope: number;
  maxSlope: number;
  dominantTerrainType: TerrainType;
  terrainCounts: { [key: string]: number };
}

export interface TileLineResult {
  start: { x: number; y: number };
  end: { x: number; y: number };
  tiles: TileBatchResult[];
  tileCount: number;
  lineLength: number;
  totalElevationChange: number;
  avgElevationChange: number;
  maxSlope: number;
  terrainTransitions: number;
}

export interface AreaStatistics {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  tileCount: number;
  avgElevation: number;
  minElevation: number;
  maxElevation: number;
  elevationRange: number;
  avgSlope: number;
  maxSlope: number;
  terrainCounts: { [key: string]: number };
  geometryCounts: { [key: string]: number };
}

export interface AreaComparison {
  area1Stats: AreaStatistics;
  area2Stats: AreaStatistics;
  elevationDifference: number;
  slopeDifference: number;
  terrainDifferences: { [key: string]: number };
  geometryDifferences: { [key: string]: number };
  area1HasMoreSlopes: boolean;
  area2HasMoreSlopes: boolean;
  elevationRangeDifference: number;
}

export interface ElevationHistogram {
  bins: Array<{ elevation: number; count: number }>;
  binSize: number;
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  peakElevation: number;
  totalCount: number;
}

export interface SlopeHistogram {
  bins: Array<{ slope: number; count: number }>;
  binSize: number;
  minSlope: number;
  maxSlope: number;
  avgSlope: number;
  flatCount: number;
  moderateCount: number;
  steepCount: number;
  totalCount: number;
}

export interface TerrainSummary extends AreaStatistics {
  dimensions: { width: number; height: number };
  totalTiles: number;
  tileStatistics: TileStatistics;
  vertexStatistics: VertexStatistics;
  hasSteepSlopes: boolean;
  hasWater: boolean;
  hasBunkers: boolean;
  hasCliffs: boolean;
}

export interface TileStatistics {
  totalTiles: number;
  flatCount: number;
  rampCount: number;
  cornerCount: number;
  valleyCount: number;
  cliffCount: number;
  complexCount: number;
  flatPercentage: number;
  slopedPercentage: number;
  cliffPercentage: number;
  terrainTypeCounts: { [key: string]: number };
  dominantTerrainType: string;
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

export interface TerrainValidationIssue {
  type: 'excessive_slope' | 'negative_elevation' | 'invalid_terrain' | 'edge_mismatch' | 'isolated' | 'unreachable';
  severity: 'error' | 'warning' | 'info';
  x: number;
  y: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface TerrainValidationResult {
  valid: boolean;
  issues: TerrainValidationIssue[];
  errorCount: number;
  warningCount: number;
  totalIssues: number;
  checkedTiles: number;
}

export interface TerrainAnomalies {
  isolatedTiles: Array<{ x: number; y: number }>;
  unreachableTiles: Array<{ x: number; y: number }>;
  extremeSlopes: Array<{ x: number; y: number; slope: number }>;
  suspiciousTransitions: Array<{ x: number; y: number; from: string; to: string }>;
  totalAnomalies: number;
}

export interface TerrainHealth {
  healthScore: number;
  validation: TerrainValidationResult;
  anomalies: TerrainAnomalies;
  excessiveSlopeCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface TerrainPathResult {
  path: Array<{ x: number; y: number }>;
  totalCost: number;
  pathLength: number;
  totalElevationChange: number;
  maxSlopeAngle: number;
  found: boolean;
}

export interface SimpleLineOfSightResult {
  visible: boolean;
  blockedAt: { x: number; y: number } | null;
  minClearance: number;
  obstructions: Array<{ x: number; y: number; elevation: number; clearance: number }>;
}

export interface SimpleVisibilityMap {
  viewpoint: { x: number; y: number; height: number };
  maxDistance: number;
  visibleCount: number;
  hiddenCount: number;
  visibilityRatio: number;
  visibleTiles: Array<{ x: number; y: number; distance: number; clearance: number }>;
  hiddenTiles: Array<{ x: number; y: number; distance: number; reason: string }>;
}

export interface ViewpointScore {
  x: number;
  y: number;
  elevation: number;
  distance: number;
  clearance: number;
  score: number;
  canSeeTarget: boolean;
}

export interface DetailedShadowMapResult {
  sunAngle: number;
  sunAzimuth: number;
  shadowedCount: number;
  litCount: number;
  shadowCoverage: number;
  shadowedTiles: Array<{ x: number; y: number; shadowDepth: number }>;
  litTiles: Array<{ x: number; y: number; illumination: number }>;
}

export interface TerrainSymmetryResult {
  horizontalSymmetry: number;
  verticalSymmetry: number;
  overallSymmetry: number;
  horizontalMatches: number;
  horizontalTotal: number;
  verticalMatches: number;
  verticalTotal: number;
  asymmetricTiles: Array<{ x: number; y: number; mirrorX: number; mirrorY: number; diff: number }>;
  isPerfectlySymmetric: boolean;
}

export interface ContourLine {
  elevation: number;
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  isMajor: boolean;
}

export interface ContourLineSet {
  interval: number;
  minElevation: number;
  maxElevation: number;
  contourCount: number;
  contours: ContourLine[];
}

export interface ElevationBand {
  minElevation: number;
  maxElevation: number;
  tileCount: number;
  tiles: Array<{ x: number; y: number }>;
  percentage: number;
}

export interface ElevationBandSet {
  bandSize: number;
  bandCount: number;
  totalTiles: number;
  bands: ElevationBand[];
}

export interface ElevationBoundarySet {
  boundaryCount: number;
  maxElevationDiff: number;
  avgElevationDiff: number;
  boundaries: Array<{ x: number; y: number; elevDiff: number; direction: 'horizontal' | 'vertical' }>;
}

export interface ContourTrace {
  elevation: number;
  points: Array<{ x: number; y: number }>;
  pointCount: number;
  isClosed: boolean;
  perimeter: number;
}

export interface TerrainGradientMap {
  width: number;
  height: number;
  maxMagnitude: number;
  avgMagnitude: number;
  gradients: Array<{ x: number; y: number; magnitude: number; direction: number }>;
}

export interface TerrainProfileSample {
  x: number;
  y: number;
  distance: number;
  elevation: number;
  slopeAngle: number;
  terrainType: TerrainType;
}

export interface TerrainProfile {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  totalDistance: number;
  numSamples: number;
  samples: TerrainProfileSample[];
  minElevation: number;
  maxElevation: number;
  elevationChange: number;
  totalAscent: number;
  totalDescent: number;
  avgGrade: number;
}

export interface TerrainCrossSection {
  centerX: number;
  centerY: number;
  direction: number;
  length: number;
  profile: TerrainProfile;
  leftAvgElevation: number;
  rightAvgElevation: number;
  tilt: number;
  isLevel: boolean;
}

export interface TerrainPathAnalysis {
  path: Array<{ x: number; y: number }>;
  totalDistance: number;
  profiles: TerrainProfile[];
  totalAscent: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
  avgSlope: number;
  maxSlope: number;
  terrainTypeCounts: Record<string, number>;
}

export interface SteepestPathResult {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  slopeMagnitude: number;
  slopeAngle: number;
  elevationDiff: number;
  segmentLength: number;
}

export interface TerrainProfileGrid {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  gridSpacing: number;
  horizontalProfiles: TerrainProfile[];
  verticalProfiles: TerrainProfile[];
  horizontalCount: number;
  verticalCount: number;
}
