import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import { getVerticesInBrush, vertexKey } from "../../core/terrain-editor-logic";

export type HighlightMode = 'vertex' | 'face' | 'edge' | 'none';

export interface VertexPositionProvider {
  getVertexElevation(vx: number, vy: number): number;
  vertexToWorld(vx: number, vy: number): { x: number; z: number };
  getVertexDimensions(): { width: number; height: number };
  getVerticesInWorldRadius?(worldX: number, worldZ: number, radius: number): Array<{ vx: number; vy: number }>;
}

export interface SelectionProvider {
  getSelectedVertices(): Set<string>;
  getBoxSelectBounds(): { vx1: number; vy1: number; vx2: number; vy2: number } | null;
}

export class TileHighlightSystem {
  private scene: Scene;
  private vertexProvider: VertexPositionProvider | null = null;
  private selectionProvider: SelectionProvider | null = null;
  private vertexMaterial: StandardMaterial | null = null;
  private selectedMaterial: StandardMaterial | null = null;
  private brushCircleMaterial: StandardMaterial | null = null;
  private brushCircleMesh: Mesh | null = null;
  private currentVx: number = -1;
  private currentVy: number = -1;
  private currentWorldX: number = 0;
  private currentWorldZ: number = 0;
  private isValid: boolean = true;
  private brushSize: number = 0;
  private vertexMeshes: Mesh[] = [];
  private selectionMeshes: Mesh[] = [];
  private boxSelectMesh: Mesh | null = null;
  private highlightMode: HighlightMode = 'none';
  private showSelectedVertices: boolean = true;

  constructor(scene: Scene) {
    this.scene = scene;
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

    this.brushCircleMaterial = new StandardMaterial("brushCircleMat", this.scene);
    this.brushCircleMaterial.diffuseColor = new Color3(1, 1, 1);
    this.brushCircleMaterial.emissiveColor = new Color3(1, 1, 1);
    this.brushCircleMaterial.specularColor = new Color3(0, 0, 0);
    this.brushCircleMaterial.alpha = 1;
    this.brushCircleMaterial.disableLighting = true;
    this.brushCircleMaterial.backFaceCulling = false;
  }

  public setWorldPosition(worldX: number, worldZ: number): void {
    if (worldX === this.currentWorldX && worldZ === this.currentWorldZ) return;
    this.currentWorldX = worldX;
    this.currentWorldZ = worldZ;
    this.updateHighlight();
  }

  public setVertexHighlightPosition(vx: number, vy: number, worldX?: number, worldZ?: number): void {
    if (vx === this.currentVx && vy === this.currentVy && worldX === this.currentWorldX && worldZ === this.currentWorldZ) {
      return;
    }

    this.currentVx = vx;
    this.currentVy = vy;
    if (worldX !== undefined) this.currentWorldX = worldX;
    if (worldZ !== undefined) this.currentWorldZ = worldZ;
    this.updateHighlight();
  }

  public refresh(): void {
    this.updateHighlight();
  }

  public clearHighlight(): void {
    this.currentVx = -1;
    this.currentVy = -1;
    this.disposeHighlightMeshes();
  }

  public setHighlightValid(valid: boolean): void {
    if (this.isValid === valid) return;
    this.isValid = valid;
  }

  public setBrushSize(size: number): void {
    if (this.brushSize === size) return;
    this.brushSize = Math.max(0, size);
    this.updateHighlight();
  }

  private disposeHighlightMeshes(): void {
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
    if (this.brushCircleMesh) {
      this.brushCircleMesh.dispose();
      this.brushCircleMesh = null;
    }
  }

  private updateHighlight(): void {
    this.disposeHighlightMeshes();

    if (this.brushSize > 0 && (this.currentWorldX !== 0 || this.currentWorldZ !== 0)) {
      const elevation = this.vertexProvider
        ? this.vertexProvider.getVertexElevation(Math.max(0, this.currentVx), Math.max(0, this.currentVy))
        : 0;
      this.brushCircleMesh = this.createBrushCircleMesh(
        this.currentWorldX, this.currentWorldZ, this.brushSize, elevation
      );
    }

    if (this.highlightMode === 'vertex') {
      this.updateVertexHighlight();
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

    let vertices: Array<{ vx: number; vy: number }>;
    if (this.brushSize > 0 && this.vertexProvider.getVerticesInWorldRadius) {
      vertices = this.vertexProvider.getVerticesInWorldRadius(this.currentWorldX, this.currentWorldZ, this.brushSize);
    } else {
      const dims = this.vertexProvider.getVertexDimensions();
      vertices = getVerticesInBrush(
        this.currentVx,
        this.currentVy,
        this.brushSize,
        dims.width,
        dims.height
      );
    }

    if (!vertices.some(v => v.vx === this.currentVx && v.vy === this.currentVy)) {
      vertices.push({ vx: this.currentVx, vy: this.currentVy });
    }

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

  private createBrushCircleMesh(
    worldX: number, worldZ: number, radius: number, elevation: number
  ): Mesh {
    const segments = 48;
    const thickness = 0.04;
    const innerRadius = radius - thickness;
    const outerRadius = radius;
    const center = gridTo3D(worldX, worldZ, elevation);
    const yOffset = 0.06;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      positions.push(
        center.x + cos * innerRadius, center.y + yOffset, center.z + sin * innerRadius,
        center.x + cos * outerRadius, center.y + yOffset, center.z + sin * outerRadius
      );
      colors.push(1, 1, 1, 0.18, 1, 1, 1, 0.18);
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, d, a, d, c);
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh("brush_circle", this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.brushCircleMaterial;
    mesh.useVertexColors = true;
    mesh.renderingGroupId = 1;

    return mesh;
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

  public dispose(): void {
    this.disposeHighlightMeshes();
    if (this.vertexMaterial) {
      this.vertexMaterial.dispose();
      this.vertexMaterial = null;
    }
    if (this.selectedMaterial) {
      this.selectedMaterial.dispose();
      this.selectedMaterial = null;
    }
    if (this.brushCircleMaterial) {
      this.brushCircleMaterial.dispose();
      this.brushCircleMaterial = null;
    }
  }
}
