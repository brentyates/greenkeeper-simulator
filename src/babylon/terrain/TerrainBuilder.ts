import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import { CourseData } from '../../data/courseData';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from '../../core/terrain';

export class TerrainBuilder {
  private scene: Scene;
  private courseData: CourseData;
  private tileMeshes: Mesh[] = [];
  private gridLines: Mesh | null = null;

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
  }

  public build(): void {
    this.buildTiles();
    this.buildGridLines();
  }

  private buildTiles(): void {
    const { width, height, layout, elevation } = this.courseData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const terrainType = layout[y]?.[x] ?? 1;
        const elev = elevation?.[y]?.[x] ?? 0;

        const tile = this.createIsometricTile(x, y, elev, terrainType);
        this.tileMeshes.push(tile);

        if (elevation) {
          this.createSlopeFaces(x, y, elev, terrainType);
        }
      }
    }
  }

  private createIsometricTile(gridX: number, gridY: number, elevation: number, terrainType: number): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const centerX = (gridX - gridY) * (TILE_WIDTH / 2);
    const centerZ = (gridX + gridY) * (TILE_HEIGHT / 2);
    const baseY = elevation * ELEVATION_HEIGHT;

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    positions.push(centerX, baseY, centerZ - hh);
    positions.push(centerX + hw, baseY, centerZ);
    positions.push(centerX, baseY, centerZ + hh);
    positions.push(centerX - hw, baseY, centerZ);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const color = this.getTerrainColor(terrainType);
    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, 1);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`tile_${gridX}_${gridY}`, this.scene);
    vertexData.applyToMesh(mesh);

    const material = this.getTileMaterial(terrainType);
    mesh.material = material;
    mesh.useVertexColors = true;

    return mesh;
  }

  private createSlopeFaces(gridX: number, gridY: number, elevation: number, terrainType: number): void {
    const { width, height, elevation: elevData } = this.courseData;
    if (!elevData) return;

    const neighbors = [
      { dx: 0, dy: -1, dir: 'north' },
      { dx: 1, dy: 0, dir: 'east' },
      { dx: 0, dy: 1, dir: 'south' },
      { dx: -1, dy: 0, dir: 'west' },
    ];

    for (const { dx, dy, dir } of neighbors) {
      const nx = gridX + dx;
      const ny = gridY + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const neighborElev = elevData[ny]?.[nx] ?? 0;
      const elevDiff = elevation - neighborElev;

      if (elevDiff > 0) {
        this.createCliffFace(gridX, gridY, elevation, neighborElev, dir, terrainType);
      }
    }
  }

  private createCliffFace(gridX: number, gridY: number, topElev: number, bottomElev: number, direction: string, terrainType: number): void {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const centerX = (gridX - gridY) * (TILE_WIDTH / 2);
    const centerZ = (gridX + gridY) * (TILE_HEIGHT / 2);
    const topY = topElev * ELEVATION_HEIGHT;
    const bottomY = bottomElev * ELEVATION_HEIGHT;

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    let v0: Vector3, v1: Vector3, v2: Vector3, v3: Vector3;

    switch (direction) {
      case 'north':
        v0 = new Vector3(centerX - hw, topY, centerZ);
        v1 = new Vector3(centerX, topY, centerZ - hh);
        v2 = new Vector3(centerX, bottomY, centerZ - hh);
        v3 = new Vector3(centerX - hw, bottomY, centerZ);
        break;
      case 'east':
        v0 = new Vector3(centerX, topY, centerZ - hh);
        v1 = new Vector3(centerX + hw, topY, centerZ);
        v2 = new Vector3(centerX + hw, bottomY, centerZ);
        v3 = new Vector3(centerX, bottomY, centerZ - hh);
        break;
      case 'south':
        v0 = new Vector3(centerX + hw, topY, centerZ);
        v1 = new Vector3(centerX, topY, centerZ + hh);
        v2 = new Vector3(centerX, bottomY, centerZ + hh);
        v3 = new Vector3(centerX + hw, bottomY, centerZ);
        break;
      case 'west':
        v0 = new Vector3(centerX, topY, centerZ + hh);
        v1 = new Vector3(centerX - hw, topY, centerZ);
        v2 = new Vector3(centerX - hw, bottomY, centerZ);
        v3 = new Vector3(centerX, bottomY, centerZ + hh);
        break;
      default:
        return;
    }

    positions.push(v0.x, v0.y, v0.z);
    positions.push(v1.x, v1.y, v1.z);
    positions.push(v2.x, v2.y, v2.z);
    positions.push(v3.x, v3.y, v3.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const baseColor = this.getTerrainColor(terrainType);
    const darkColor = new Color3(baseColor.r * 0.6, baseColor.g * 0.6, baseColor.b * 0.6);
    for (let i = 0; i < 4; i++) {
      colors.push(darkColor.r, darkColor.g, darkColor.b, 1);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`cliff_${gridX}_${gridY}_${direction}`, this.scene);
    vertexData.applyToMesh(mesh);

    const material = this.getCliffMaterial();
    mesh.material = material;
    mesh.useVertexColors = true;

    this.tileMeshes.push(mesh);
  }

  private buildGridLines(): void {
    const { width, height, elevation } = this.courseData;
    const lines: Vector3[][] = [];

    for (let y = 0; y <= height; y++) {
      const linePoints: Vector3[] = [];
      for (let x = 0; x <= width; x++) {
        const elev = this.getElevationAt(Math.min(x, width - 1), Math.min(y, height - 1));
        const worldX = (x - y) * (TILE_WIDTH / 2);
        const worldZ = (x + y) * (TILE_HEIGHT / 2);
        const worldY = elev * ELEVATION_HEIGHT + 0.5;
        linePoints.push(new Vector3(worldX, worldY, worldZ));
      }
      lines.push(linePoints);
    }

    for (let x = 0; x <= width; x++) {
      const linePoints: Vector3[] = [];
      for (let y = 0; y <= height; y++) {
        const elev = this.getElevationAt(Math.min(x, width - 1), Math.min(y, height - 1));
        const worldX = (x - y) * (TILE_WIDTH / 2);
        const worldZ = (x + y) * (TILE_HEIGHT / 2);
        const worldY = elev * ELEVATION_HEIGHT + 0.5;
        linePoints.push(new Vector3(worldX, worldY, worldZ));
      }
      lines.push(linePoints);
    }

    this.gridLines = MeshBuilder.CreateLineSystem('gridLines', { lines }, this.scene);
    this.gridLines.color = new Color3(0, 0, 0);
    this.gridLines.alpha = 0.3;
  }

  private getTileMaterial(terrainType: number): StandardMaterial {
    const key = `tileMat_${terrainType}`;
    let material = this.scene.getMaterialByName(key) as StandardMaterial;

    if (!material) {
      material = new StandardMaterial(key, this.scene);
      material.diffuseColor = new Color3(1, 1, 1);
      material.specularColor = new Color3(0.1, 0.1, 0.1);
      material.emissiveColor = new Color3(0.15, 0.15, 0.15);
      material.backFaceCulling = false;
    }

    return material;
  }

  private getCliffMaterial(): StandardMaterial {
    const key = 'cliffMat';
    let material = this.scene.getMaterialByName(key) as StandardMaterial;

    if (!material) {
      material = new StandardMaterial(key, this.scene);
      material.diffuseColor = new Color3(1, 1, 1);
      material.specularColor = new Color3(0.05, 0.05, 0.05);
      material.emissiveColor = new Color3(0.1, 0.1, 0.1);
      material.backFaceCulling = false;
    }

    return material;
  }

  private getTerrainColor(terrainType: number): Color3 {
    switch (terrainType) {
      case 0: return new Color3(0.45, 0.75, 0.35);
      case 1: return new Color3(0.4, 0.6, 0.3);
      case 2: return new Color3(0.3, 0.8, 0.4);
      case 3: return new Color3(0.9, 0.85, 0.65);
      case 4: return new Color3(0.3, 0.5, 0.7);
      default: return new Color3(0.5, 0.65, 0.4);
    }
  }

  public getElevationAt(gridX: number, gridY: number): number {
    if (!this.courseData.elevation) return 0;
    const clampedX = Math.min(Math.max(0, gridX), this.courseData.width - 1);
    const clampedY = Math.min(Math.max(0, gridY), this.courseData.height - 1);
    return this.courseData.elevation[clampedY]?.[clampedX] ?? 0;
  }

  public gridToWorld(gridX: number, gridY: number, elevation?: number): Vector3 {
    const elev = elevation ?? this.getElevationAt(gridX, gridY);
    const worldX = (gridX - gridY) * (TILE_WIDTH / 2);
    const worldZ = (gridX + gridY) * (TILE_HEIGHT / 2);
    const worldY = elev * ELEVATION_HEIGHT;
    return new Vector3(worldX, worldY, worldZ);
  }

  public dispose(): void {
    for (const mesh of this.tileMeshes) {
      mesh.dispose();
    }
    this.tileMeshes = [];
    if (this.gridLines) {
      this.gridLines.dispose();
      this.gridLines = null;
    }
  }
}
