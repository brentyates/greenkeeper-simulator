import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import { getCellsInBrush } from "../../core/terrain-editor-logic";

export interface CornerHeightsProvider {
  getCornerHeights(
    gridX: number,
    gridY: number
  ): { nw: number; ne: number; se: number; sw: number };
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

export class TileHighlightSystem {
  private scene: Scene;
  private cornerProvider: CornerHeightsProvider;
  private highlightMesh: Mesh | null = null;
  private highlightMaterial: StandardMaterial | null = null;
  private currentX: number = -1;
  private currentY: number = -1;
  private currentCorner: "nw" | "ne" | "se" | "sw" | null = null;
  private isValid: boolean = true;
  private brushSize: number = 1;
  private brushMeshes: Mesh[] = [];

  constructor(scene: Scene, cornerProvider: CornerHeightsProvider) {
    this.scene = scene;
    this.cornerProvider = cornerProvider;
    this.createMaterial();
  }

  private createMaterial(): void {
    this.highlightMaterial = new StandardMaterial("highlightMat", this.scene);
    this.highlightMaterial.diffuseColor = new Color3(0, 1, 0);
    this.highlightMaterial.emissiveColor = new Color3(0, 1, 0);
    this.highlightMaterial.specularColor = new Color3(0, 0, 0);
    this.highlightMaterial.alpha = 0.6;
    this.highlightMaterial.disableLighting = true;
    this.highlightMaterial.backFaceCulling = false;
  }

  public setHighlightPosition(gridX: number, gridY: number): void {
    if (
      gridX === this.currentX &&
      gridY === this.currentY &&
      this.currentCorner === null
    ) {
      return;
    }

    this.currentX = gridX;
    this.currentY = gridY;
    this.currentCorner = null;
    this.updateHighlight();
  }

  public setHighlightCorner(
    gridX: number,
    gridY: number,
    corner: "nw" | "ne" | "se" | "sw" | null
  ): void {
    if (
      gridX === this.currentX &&
      gridY === this.currentY &&
      corner === this.currentCorner
    ) {
      return;
    }

    this.currentX = gridX;
    this.currentY = gridY;
    this.currentCorner = corner;
    this.updateHighlight();
  }

  public refresh(): void {
    this.updateHighlight();
  }

  public clearHighlight(): void {
    this.currentX = -1;
    this.currentY = -1;
    this.currentCorner = null;
    this.disposeHighlightMeshes();
  }

  public setHighlightValid(valid: boolean): void {
    if (this.isValid === valid) return;
    this.isValid = valid;

    if (this.highlightMaterial) {
      if (valid) {
        this.highlightMaterial.diffuseColor = new Color3(0, 1, 0);
        this.highlightMaterial.emissiveColor = new Color3(0, 1, 0);
      } else {
        this.highlightMaterial.diffuseColor = new Color3(1, 0, 0);
        this.highlightMaterial.emissiveColor = new Color3(1, 0, 0);
      }
    }
  }

  public setBrushSize(size: number): void {
    if (this.brushSize === size) return;
    this.brushSize = Math.max(1, size);
    this.updateHighlight();
  }

  private disposeHighlightMeshes(): void {
    if (this.highlightMesh) {
      this.highlightMesh.dispose();
      this.highlightMesh = null;
    }
    for (const mesh of this.brushMeshes) {
      mesh.dispose();
    }
    this.brushMeshes = [];
  }

  private updateHighlight(): void {
    this.disposeHighlightMeshes();

    if (this.currentX < 0 || this.currentY < 0) {
      return;
    }

    if (this.currentCorner) {
      this.highlightMesh = this.createHighlightCornerMesh(
        this.currentX,
        this.currentY,
        this.currentCorner
      );
    } else if (this.brushSize <= 1) {
      this.highlightMesh = this.createHighlightMeshAt(
        this.currentX,
        this.currentY
      );
    } else {
      const positions = getCellsInBrush(
        this.currentX,
        this.currentY,
        this.brushSize
      );
      for (const pos of positions) {
        const mesh = this.createHighlightMeshAt(pos.x, pos.y);
        if (mesh) {
          this.brushMeshes.push(mesh);
        }
      }
    }
  }


  private createHighlightCornerMesh(
    gridX: number,
    gridY: number,
    corner: "nw" | "ne" | "se" | "sw"
  ): Mesh | null {
    const corners = this.cornerProvider.getCornerHeights(gridX, gridY);

    let cornerX = gridX;
    let cornerZ = gridY;
    let cornerElev = 0;

    switch (corner) {
      case "nw":
        cornerElev = corners.nw;
        break;
      case "ne":
        cornerX += 1;
        cornerElev = corners.ne;
        break;
      case "se":
        cornerX += 1;
        cornerZ += 1;
        cornerElev = corners.se;
        break;
      case "sw":
        cornerZ += 1;
        cornerElev = corners.sw;
        break;
    }

    const center = gridTo3D(cornerX, cornerZ, cornerElev);
    const size = 0.15;
    const yOffset = 0.02;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    positions.push(center.x, center.y + yOffset, center.z - size);
    positions.push(center.x + size, center.y + yOffset, center.z);
    positions.push(center.x, center.y + yOffset, center.z + size);
    positions.push(center.x - size, center.y + yOffset, center.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const color = this.isValid ? new Color3(1, 1, 0) : new Color3(1, 0, 0);
    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, 0.8);
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh(`highlight_corner_${gridX}_${gridY}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.highlightMaterial;
    mesh.useVertexColors = true;
    mesh.renderingGroupId = 1;

    return mesh;
  }

  private createHighlightMeshAt(gridX: number, gridY: number): Mesh | null {
    const corners = this.cornerProvider.getCornerHeights(gridX, gridY);
    const yOffset = 0.02;

    const nw = gridTo3D(gridX, gridY, corners.nw);
    const ne = gridTo3D(gridX + 1, gridY, corners.ne);
    const se = gridTo3D(gridX + 1, gridY + 1, corners.se);
    const sw = gridTo3D(gridX, gridY + 1, corners.sw);

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    positions.push(nw.x, nw.y + yOffset, nw.z);
    positions.push(ne.x, ne.y + yOffset, ne.z);
    positions.push(se.x, se.y + yOffset, se.z);
    positions.push(sw.x, sw.y + yOffset, sw.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    const color = this.isValid ? new Color3(0, 1, 0) : new Color3(1, 0, 0);
    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, 0.4);
    }

    VertexData.ComputeNormals(positions, indices, normals);

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;

    const mesh = new Mesh(`highlight_${gridX}_${gridY}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.highlightMaterial;
    mesh.useVertexColors = true;
    mesh.renderingGroupId = 1;

    return mesh;
  }

  public getCurrentPosition(): { x: number; y: number } | null {
    if (this.currentX < 0 || this.currentY < 0) {
      return null;
    }
    return { x: this.currentX, y: this.currentY };
  }

  public dispose(): void {
    this.disposeHighlightMeshes();
    if (this.highlightMaterial) {
      this.highlightMaterial.dispose();
      this.highlightMaterial = null;
    }
  }
}
