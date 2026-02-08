import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { gridTo3D } from "../engine/BabylonEngine";
import { ShapeTemplate, StampShape } from "../../core/shape-templates";
import { Vec3 } from "../../core/mesh-topology";

export type HighlightMode = 'vertex' | 'face' | 'edge' | 'none';

export interface VertexPositionProvider {
  getVertexPosition(vertexId: number): Vec3 | null;
  getVertexElevation(vertexId: number): number;
  getVertexIdsInWorldRadius?(worldX: number, worldZ: number, radius: number): number[];
}

export interface SelectionProvider {
  getSelectedVertices(): Set<number>;
}

export class TileHighlightSystem {
  private scene: Scene;
  private vertexProvider: VertexPositionProvider | null = null;
  private selectionProvider: SelectionProvider | null = null;
  private vertexMaterial: StandardMaterial | null = null;
  private selectedMaterial: StandardMaterial | null = null;
  private brushCircleMaterial: StandardMaterial | null = null;
  private brushCircleMesh: Mesh | null = null;
  private currentVertexId: number = -1;
  private currentWorldX: number = 0;
  private currentWorldZ: number = 0;
  private isValid: boolean = true;
  private brushSize: number = 0;
  private vertexMeshes: Mesh[] = [];
  private selectionMeshes: Mesh[] = [];
  private boxSelectMesh: Mesh | null = null;
  private stampPreviewMesh: Mesh | null = null;
  private stampPreviewTemplate: ShapeTemplate | null = null;
  private stampPreviewScale: number = 1;
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

  public setVertexHighlightPosition(vertexId: number, worldX?: number, worldZ?: number): void {
    if (vertexId === this.currentVertexId && worldX === this.currentWorldX && worldZ === this.currentWorldZ) {
      return;
    }

    this.currentVertexId = vertexId;
    if (worldX !== undefined) this.currentWorldX = worldX;
    if (worldZ !== undefined) this.currentWorldZ = worldZ;
    this.updateHighlight();
  }

  public refresh(): void {
    this.updateHighlight();
  }

  public clearHighlight(): void {
    this.currentVertexId = -1;
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
    if (this.stampPreviewMesh) {
      this.stampPreviewMesh.dispose();
      this.stampPreviewMesh = null;
    }
  }

  public setStampPreview(template: ShapeTemplate, scale: number): void {
    this.stampPreviewTemplate = template;
    this.stampPreviewScale = scale;
    this.updateHighlight();
  }

  public clearStampPreview(): void {
    this.stampPreviewTemplate = null;
    this.stampPreviewScale = 1;
    if (this.stampPreviewMesh) {
      this.stampPreviewMesh.dispose();
      this.stampPreviewMesh = null;
    }
  }

  private createStampPreviewMesh(
    worldX: number, worldZ: number, elevation: number
  ): Mesh {
    const template = this.stampPreviewTemplate!;
    const rings = template.rings;
    const baseRadius = template.baseRadius * this.stampPreviewScale;
    const aspectX = template.aspectX ?? 1;
    const aspectZ = template.aspectZ ?? 1;
    const kidneyStrength = template.kidneyStrength ?? 0.35;
    const center = gridTo3D(worldX, worldZ, elevation);
    const yOffset = 0.06;
    const thickness = 0.04;

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    for (const ring of rings) {
      const radius = baseRadius * ring.radiusFraction;
      const innerRadius = radius - thickness;
      const outerRadius = radius;
      const segments = ring.pointCount * 3;
      const baseIdx = positions.length / 3;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const outer = getShapePoint(template.shape, t, outerRadius, aspectX, aspectZ, kidneyStrength);
        const inner = getShapePoint(template.shape, t, innerRadius, aspectX, aspectZ, kidneyStrength);

        positions.push(
          center.x + inner.x, center.y + yOffset, center.z + inner.z,
          center.x + outer.x, center.y + yOffset, center.z + outer.z
        );
        colors.push(1, 0.8, 0.3, 0.3, 1, 0.8, 0.3, 0.3);
      }

      for (let i = 0; i < segments; i++) {
        const a = baseIdx + i * 2;
        const b = baseIdx + i * 2 + 1;
        const c = baseIdx + (i + 1) * 2;
        const d = baseIdx + (i + 1) * 2 + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh("stamp_preview", this.scene);
    vertexData.applyToMesh(mesh);
    mesh.material = this.brushCircleMaterial;
    mesh.useVertexColors = true;
    mesh.renderingGroupId = 1;

    return mesh;
  }

  private updateHighlight(): void {
    this.disposeHighlightMeshes();

    if (this.brushSize > 0 && !this.stampPreviewTemplate && (this.currentWorldX !== 0 || this.currentWorldZ !== 0)) {
      const elevation = this.vertexProvider && this.currentVertexId >= 0
        ? this.vertexProvider.getVertexElevation(this.currentVertexId)
        : 0;
      this.brushCircleMesh = this.createBrushCircleMesh(
        this.currentWorldX, this.currentWorldZ, this.brushSize, elevation
      );
    }

    if (this.stampPreviewTemplate && (this.currentWorldX !== 0 || this.currentWorldZ !== 0)) {
      const elevation = this.vertexProvider && this.currentVertexId >= 0
        ? this.vertexProvider.getVertexElevation(this.currentVertexId)
        : 0;
      this.stampPreviewMesh = this.createStampPreviewMesh(
        this.currentWorldX, this.currentWorldZ, elevation
      );
    }

    if (this.highlightMode === 'vertex') {
      this.updateVertexHighlight();
    }
  }

  private updateVertexHighlight(): void {
    if (!this.vertexProvider) return;

    const selectedVertices = this.selectionProvider?.getSelectedVertices() ?? new Set<number>();

    if (this.showSelectedVertices && selectedVertices.size > 0) {
      for (const vertexId of selectedVertices) {
        const isHovered = vertexId === this.currentVertexId;
        const mesh = this.createVertexHighlightMeshById(vertexId, isHovered, 'selected');
        if (mesh) {
          this.selectionMeshes.push(mesh);
        }
      }
    }

    if (this.currentVertexId < 0) return;

    let vertexIds: number[];
    if (this.brushSize > 0 && this.vertexProvider.getVertexIdsInWorldRadius) {
      vertexIds = this.vertexProvider.getVertexIdsInWorldRadius(this.currentWorldX, this.currentWorldZ, this.brushSize);
    } else {
      vertexIds = this.currentVertexId >= 0 ? [this.currentVertexId] : [];
    }

    if (!vertexIds.includes(this.currentVertexId) && this.currentVertexId >= 0) {
      vertexIds.push(this.currentVertexId);
    }

    for (const vertexId of vertexIds) {
      if (selectedVertices.has(vertexId)) continue;

      const isCenter = vertexId === this.currentVertexId;
      const mesh = this.createVertexHighlightMeshById(vertexId, isCenter, 'hovered');
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

  private createVertexHighlightMeshById(
    vertexId: number,
    isCenter: boolean,
    state: 'hovered' | 'selected' | 'box_select' = 'hovered'
  ): Mesh | null {
    if (!this.vertexProvider) return null;

    const pos = this.vertexProvider.getVertexPosition(vertexId);
    if (!pos) return null;

    const pos3D = gridTo3D(pos.x, pos.z, pos.y);

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

    const mesh = new Mesh(`vertex_${state}_${vertexId}`, this.scene);
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

function getShapePoint(
  shape: StampShape,
  t: number,
  radius: number,
  aspectX: number,
  aspectZ: number,
  kidneyStrength: number
): { x: number; z: number } {
  switch (shape) {
    case 'rectangle': {
      const halfW = radius * aspectX;
      const halfH = radius * aspectZ;
      const w = halfW * 2;
      const h = halfH * 2;
      const perimeter = 2 * (w + h);
      const dist = t * perimeter;
      if (dist < w) {
        return { x: -halfW + dist, z: -halfH };
      }
      if (dist < w + h) {
        return { x: halfW, z: -halfH + (dist - w) };
      }
      if (dist < w + h + w) {
        return { x: halfW - (dist - (w + h)), z: halfH };
      }
      return { x: -halfW, z: halfH - (dist - (w + h + w)) };
    }
    case 'kidney': {
      const angle = t * Math.PI * 2;
      const r = radius * (1 + kidneyStrength * Math.cos(angle));
      const x = Math.cos(angle) * r * aspectX;
      const z = Math.sin(angle) * r * aspectZ;
      const shift = -kidneyStrength * radius * 0.8 * aspectX;
      return { x: x + shift, z };
    }
    case 'oval':
    case 'circle':
    default: {
      const angle = t * Math.PI * 2;
      return {
        x: Math.cos(angle) * radius * aspectX,
        z: Math.sin(angle) * radius * aspectZ,
      };
    }
  }
}
