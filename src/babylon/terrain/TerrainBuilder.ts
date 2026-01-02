import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import { CourseData } from '../../data/courseData';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT, TERRAIN_CODES, TerrainType, getTerrainType, getSurfacePhysics, SurfacePhysics, getSlopeVector, getTileNormal } from '../../core/terrain';

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
    this.buildObstacles();
    this.buildRefillStation();
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

    const nwOffset = (corners.nw - baseElev) * ELEVATION_HEIGHT;
    const neOffset = (corners.ne - baseElev) * ELEVATION_HEIGHT;
    const seOffset = (corners.se - baseElev) * ELEVATION_HEIGHT;
    const swOffset = (corners.sw - baseElev) * ELEVATION_HEIGHT;

    positions.push(center.x, center.y + hh + nwOffset, center.z);
    positions.push(center.x + hw, center.y + neOffset, center.z);
    positions.push(center.x, center.y - hh + seOffset, center.z);
    positions.push(center.x - hw, center.y + swOffset, center.z);

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

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

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
        const elev = this.getElevationAt(x, y);
        const center = this.gridToScreen(x, y, elev);

        const tileOutline: Vector3[] = [
          new Vector3(center.x, center.y + hh, center.z - 0.1),
          new Vector3(center.x + hw, center.y, center.z - 0.1),
          new Vector3(center.x, center.y - hh, center.z - 0.1),
          new Vector3(center.x - hw, center.y, center.z - 0.1),
          new Vector3(center.x, center.y + hh, center.z - 0.1),
        ];
        lines.push(tileOutline);
      }
    }

    this.gridLines = MeshBuilder.CreateLineSystem('gridLines', { lines }, this.scene);
    this.gridLines.color = new Color3(0.1, 0.15, 0.05);
    this.gridLines.alpha = 0.2;
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
  }
}
