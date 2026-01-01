import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import { CourseData } from '../../data/courseData';
import { TILE_WIDTH, TILE_HEIGHT, ELEVATION_HEIGHT } from '../../core/terrain';

export class TerrainBuilder {
  private scene: Scene;
  private courseData: CourseData;
  private terrainMesh: Mesh | null = null;

  constructor(scene: Scene, courseData: CourseData) {
    this.scene = scene;
    this.courseData = courseData;
  }

  public build(): Mesh {
    const { width, height, layout, elevation } = this.courseData;

    const subdivsX = width;
    const subdivsZ = height;

    const worldWidth = width * (TILE_WIDTH / 2);
    const worldDepth = height * (TILE_HEIGHT / 2);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];

    for (let z = 0; z <= subdivsZ; z++) {
      for (let x = 0; x <= subdivsX; x++) {
        const gridX = x;
        const gridY = z;

        const worldX = (gridX - gridY) * (TILE_WIDTH / 2);
        const worldZ = (gridX + gridY) * (TILE_HEIGHT / 2);

        let elevValue = 0;
        if (elevation && z < height && x < width) {
          elevValue = this.getInterpolatedElevation(x, z);
        } else if (elevation) {
          const clampedX = Math.min(x, width - 1);
          const clampedZ = Math.min(z, height - 1);
          elevValue = elevation[clampedZ]?.[clampedX] ?? 0;
        }

        const worldY = elevValue * ELEVATION_HEIGHT;

        positions.push(worldX, worldY, worldZ);

        uvs.push(x / subdivsX, z / subdivsZ);

        const terrainType = this.getTerrainTypeAt(x, z);
        const color = this.getTerrainColor(terrainType);
        colors.push(color.r, color.g, color.b, 1);
      }
    }

    for (let z = 0; z < subdivsZ; z++) {
      for (let x = 0; x < subdivsX; x++) {
        const topLeft = z * (subdivsX + 1) + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * (subdivsX + 1) + x;
        const bottomRight = bottomLeft + 1;

        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.colors = colors;

    const mesh = new Mesh('terrain', this.scene);
    vertexData.applyToMesh(mesh);

    const material = new StandardMaterial('terrainMat', this.scene);
    material.diffuseColor = new Color3(1, 1, 1);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    material.emissiveColor = new Color3(0.2, 0.2, 0.2);
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.useVertexColors = true;

    this.terrainMesh = mesh;
    return mesh;
  }

  private getInterpolatedElevation(x: number, z: number): number {
    const { elevation, width, height } = this.courseData;
    if (!elevation) return 0;

    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = Math.min(x0 + 1, width - 1);
    const z1 = Math.min(z0 + 1, height - 1);

    const fx = x - x0;
    const fz = z - z0;

    const e00 = elevation[z0]?.[x0] ?? 0;
    const e10 = elevation[z0]?.[x1] ?? 0;
    const e01 = elevation[z1]?.[x0] ?? 0;
    const e11 = elevation[z1]?.[x1] ?? 0;

    const top = e00 * (1 - fx) + e10 * fx;
    const bottom = e01 * (1 - fx) + e11 * fx;

    return top * (1 - fz) + bottom * fz;
  }

  private getTerrainTypeAt(x: number, z: number): number {
    const { layout, width, height } = this.courseData;
    const clampedX = Math.min(Math.max(0, x), width - 1);
    const clampedZ = Math.min(Math.max(0, z), height - 1);
    return layout[clampedZ]?.[clampedX] ?? 1;
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

  public getMesh(): Mesh | null {
    return this.terrainMesh;
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
    if (this.terrainMesh) {
      this.terrainMesh.dispose();
      this.terrainMesh = null;
    }
  }
}
