import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import { getCellsInBrush, getVerticesInBrush, vertexKey } from "../../core/terrain-editor-logic";

export type HighlightMode = 'cell' | 'vertex' | 'none';
export type VertexState = 'normal' | 'hovered' | 'selected' | 'selected_hovered';

export interface CornerHeightsProvider {
  getCornerHeights(
    gridX: number,
    gridY: number
  ): { nw: number; ne: number; se: number; sw: number };
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
  gridTo3D(gridX: number, gridY: number, elev: number): import("@babylonjs/core/Maths/math.vector").Vector3;
}

export interface VertexPositionProvider {
  getVertexElevation(vx: number, vy: number): number;
  vertexToWorld(vx: number, vy: number): { x: number; z: number };
  getVertexDimensions(): { width: number; height: number };
}

export interface SelectionProvider {
  getSelectedVertices(): Set<string>;
  getBoxSelectBounds(): { vx1: number; vy1: number; vx2: number; vy2: number } | null;
}

export class TileHighlightSystem {
  private scene: Scene;
  private cornerProvider: CornerHeightsProvider;
  private vertexProvider: VertexPositionProvider | null = null;
  private selectionProvider: SelectionProvider | null = null;
  private highlightMesh: Mesh | null = null;
  private highlightMaterial: StandardMaterial | null = null;
  private vertexMaterial: StandardMaterial | null = null;
  private selectedMaterial: StandardMaterial | null = null;
  private currentX: number = -1;
  private currentY: number = -1;
  private currentVx: number = -1;
  private currentVy: number = -1;
  private currentCorner: "nw" | "ne" | "se" | "sw" | null = null;
  private isValid: boolean = true;
  private brushSize: number = 0;
  private brushMeshes: Mesh[] = [];
  private vertexMeshes: Mesh[] = [];
  private selectionMeshes: Mesh[] = [];
  private boxSelectMesh: Mesh | null = null;
  private highlightMode: HighlightMode = 'cell';
  private showSelectedVertices: boolean = true;

  constructor(scene: Scene, cornerProvider: CornerHeightsProvider) {
    this.scene = scene;
    this.cornerProvider = cornerProvider;
    this.createMaterial();
  }

  public setVertexProvider(provider: VertexPositionProvider | null): void {
    this.vertexProvider = provider;
  }

  public setSelectionProvider(provider: SelectionProvider | null): void {
    this.selectionProvider = provider;
  }

  public setShowSelectedVertices(show: boolean): void {
    this.showSelectedVertices = show;
    this.updateHighlight();
  }

  public setHighlightMode(mode: HighlightMode): void {
    if (this.highlightMode === mode) return;
    this.highlightMode = mode;
    this.updateHighlight();
  }

  public getHighlightMode(): HighlightMode {
    return this.highlightMode;
  }

  private createMaterial(): void {
    this.highlightMaterial = new StandardMaterial("highlightMat", this.scene);
    this.highlightMaterial.diffuseColor = new Color3(0, 1, 0);
    this.highlightMaterial.emissiveColor = new Color3(0, 1, 0);
    this.highlightMaterial.specularColor = new Color3(0, 0, 0);
    this.highlightMaterial.alpha = 0.6;
    this.highlightMaterial.disableLighting = true;
    this.highlightMaterial.backFaceCulling = false;

    this.vertexMaterial = new StandardMaterial("vertexHighlightMat", this.scene);
    this.vertexMaterial.diffuseColor = new Color3(1, 1, 0);
    this.vertexMaterial.emissiveColor = new Color3(1, 1, 0);
    this.vertexMaterial.specularColor = new Color3(0, 0, 0);
    this.vertexMaterial.alpha = 0.8;
    this.vertexMaterial.disableLighting = true;
    this.vertexMaterial.backFaceCulling = false;

    this.selectedMaterial = new StandardMaterial("selectedVertexMat", this.scene);
    this.selectedMaterial.diffuseColor = new Color3(1, 0.5, 0);
    this.selectedMaterial.emissiveColor = new Color3(1, 0.5, 0);
    this.selectedMaterial.specularColor = new Color3(0, 0, 0);
    this.selectedMaterial.alpha = 0.9;
    this.selectedMaterial.disableLighting = true;
    this.selectedMaterial.backFaceCulling = false;
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

  public setVertexHighlightPosition(vx: number, vy: number): void {
    if (vx === this.currentVx && vy === this.currentVy) {
      return;
    }

    this.currentVx = vx;
    this.currentVy = vy;
    this.updateHighlight();
  }

  public refresh(): void {
    this.updateHighlight();
  }

  public clearHighlight(): void {
    this.currentX = -1;
    this.currentY = -1;
    this.currentVx = -1;
    this.currentVy = -1;
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
    this.brushSize = Math.max(0, size);
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
    for (const mesh of this.vertexMeshes) {
      mesh.dispose();
    }
    this.vertexMeshes = [];
    for (const mesh of this.selectionMeshes) {
      mesh.dispose();
    }
    this.selectionMeshes = [];
    if (this.boxSelectMesh) {
      this.boxSelectMesh.dispose();
      this.boxSelectMesh = null;
    }
  }

  private updateHighlight(): void {
    this.disposeHighlightMeshes();

    if (this.highlightMode === 'none') {
      return;
    }

    if (this.highlightMode === 'vertex') {
      this.updateVertexHighlight();
      return;
    }

    if (this.currentX >= 0 && this.currentY >= 0) {
      if (this.currentCorner) {
        this.highlightMesh = this.createHighlightCornerMesh(
          this.currentX,
          this.currentY,
          this.currentCorner
        );
      } else if (this.brushSize <= 0) {
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

  }

  private updateVertexHighlight(): void {
    if (!this.vertexProvider) return;

    const selectedVertices = this.selectionProvider?.getSelectedVertices() ?? new Set<string>();
    const boxBounds = this.selectionProvider?.getBoxSelectBounds() ?? null;

    if (this.showSelectedVertices && selectedVertices.size > 0) {
      for (const key of selectedVertices) {
        const [vxStr, vyStr] = key.split(',');
        const vx = parseInt(vxStr);
        const vy = parseInt(vyStr);
        const isHovered = vx === this.currentVx && vy === this.currentVy;
        const mesh = this.createVertexHighlightMesh(vx, vy, isHovered, 'selected');
        if (mesh) {
          this.selectionMeshes.push(mesh);
        }
      }
    }

    if (boxBounds) {
      this.createBoxSelectVisualization(boxBounds);
    }

    if (this.currentVx < 0 || this.currentVy < 0) return;

    const dims = this.vertexProvider.getVertexDimensions();
    const vertices = getVerticesInBrush(
      this.currentVx,
      this.currentVy,
      this.brushSize,
      dims.width,
      dims.height
    );

    for (const v of vertices) {
      const key = vertexKey(v.vx, v.vy);
      if (selectedVertices.has(key)) continue;

      const isCenter = v.vx === this.currentVx && v.vy === this.currentVy;
      const mesh = this.createVertexHighlightMesh(v.vx, v.vy, isCenter, 'hovered');
      if (mesh) {
        this.vertexMeshes.push(mesh);
      }
    }
  }

  private createBoxSelectVisualization(bounds: { vx1: number; vy1: number; vx2: number; vy2: number }): void {
    if (!this.vertexProvider) return;

    const minVx = Math.min(bounds.vx1, bounds.vx2);
    const maxVx = Math.max(bounds.vx1, bounds.vx2);
    const minVy = Math.min(bounds.vy1, bounds.vy2);
    const maxVy = Math.max(bounds.vy1, bounds.vy2);

    const dims = this.vertexProvider.getVertexDimensions();

    for (let vy = minVy; vy <= maxVy && vy < dims.height; vy++) {
      for (let vx = minVx; vx <= maxVx && vx < dims.width; vx++) {
        const key = vertexKey(vx, vy);
        const selectedVertices = this.selectionProvider?.getSelectedVertices() ?? new Set<string>();
        if (selectedVertices.has(key)) continue;

        const isHovered = vx === this.currentVx && vy === this.currentVy;
        const mesh = this.createVertexHighlightMesh(vx, vy, isHovered, 'box_select');
        if (mesh) {
          this.vertexMeshes.push(mesh);
        }
      }
    }
  }

  private createVertexHighlightMesh(
    vx: number,
    vy: number,
    isCenter: boolean,
    state: 'hovered' | 'selected' | 'box_select' = 'hovered'
  ): Mesh | null {
    if (!this.vertexProvider) return null;

    const worldPos = this.vertexProvider.vertexToWorld(vx, vy);
    const elevation = this.vertexProvider.getVertexElevation(vx, vy);
    const pos3D = gridTo3D(worldPos.x, worldPos.z, elevation);

    let size: number;
    let color: Color3;
    let alpha: number;
    let material = this.vertexMaterial;

    switch (state) {
      case 'selected':
        size = isCenter ? 0.14 : 0.10;
        color = isCenter ? new Color3(1, 0.6, 0) : new Color3(1, 0.5, 0);
        alpha = isCenter ? 0.95 : 0.85;
        material = this.selectedMaterial;
        break;
      case 'box_select':
        size = isCenter ? 0.12 : 0.08;
        color = new Color3(0.3, 0.8, 1);
        alpha = 0.6;
        break;
      case 'hovered':
      default:
        size = isCenter ? 0.12 : 0.08;
        color = isCenter
          ? (this.isValid ? new Color3(1, 1, 0) : new Color3(1, 0, 0))
          : (this.isValid ? new Color3(0.8, 1, 0.4) : new Color3(1, 0.3, 0.3));
        alpha = isCenter ? 0.9 : 0.6;
        break;
    }

    const yOffset = 0.05;
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    positions.push(pos3D.x, pos3D.y + yOffset, pos3D.z - size);
    positions.push(pos3D.x + size, pos3D.y + yOffset, pos3D.z);
    positions.push(pos3D.x, pos3D.y + yOffset, pos3D.z + size);
    positions.push(pos3D.x - size, pos3D.y + yOffset, pos3D.z);

    indices.push(0, 1, 2);
    indices.push(0, 2, 3);

    for (let i = 0; i < 4; i++) {
      colors.push(color.r, color.g, color.b, alpha);
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh(`vertex_${state}_${vx}_${vy}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.renderingGroupId = 1;

    return mesh;
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

    const center = this.cornerProvider.gridTo3D(cornerX, cornerZ, cornerElev);
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

    const nw = this.cornerProvider.gridTo3D(gridX, gridY, corners.nw);
    const ne = this.cornerProvider.gridTo3D(gridX + 1, gridY, corners.ne);
    const se = this.cornerProvider.gridTo3D(gridX + 1, gridY + 1, corners.se);
    const sw = this.cornerProvider.gridTo3D(gridX, gridY + 1, corners.sw);

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
    if (this.vertexMaterial) {
      this.vertexMaterial.dispose();
      this.vertexMaterial = null;
    }
    if (this.selectedMaterial) {
      this.selectedMaterial.dispose();
      this.selectedMaterial = null;
    }
  }
}
