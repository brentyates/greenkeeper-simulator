import { Scene, Vector3 } from "@babylonjs/core";

import {
  EditorTool,
  EditorMode,
  TopologyMode,
  SculptTool,
  EditorState,
  Vec3,
  InteractionMode,
  vertexKey,
  parseVertexKey,
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  applySculptTool,
  commitVertexModifications,
  isVertexSelected,
} from "../../core/terrain-editor-logic";

import {
  TerrainType,
  getTerrainType,
} from "../../core/terrain";
import {
  TileHighlightSystem,
  VertexPositionProvider,
  SelectionProvider,
} from "./TileHighlightSystem";

import { TerrainMeshTopology } from "../../core/mesh-topology";

export interface TerrainModifier {
  setElevationAt(x: number, y: number, elevation: number): void;
  setTerrainTypeAt(x: number, y: number, type: TerrainType): void;
  rebuildTileAndNeighbors(x: number, y: number): void;
  getVertexPosition?(vx: number, vy: number): Vec3 | null;
  setVertexPosition?(vx: number, vy: number, pos: Vec3): void;
  setVertexPositions?(changes: Array<{ vx: number; vy: number; pos: Vec3 }>): void;
  moveVertices?(vertices: Array<{ vx: number; vy: number }>, delta: Vec3): void;
  getVertexElevation?(vx: number, vy: number): number;
  setVertexElevation?(vx: number, vy: number, z: number): void;
  setVertexElevations?(changes: Array<{ vx: number; vy: number; z: number }>): void;
  worldToVertex?(worldX: number, worldZ: number): { vx: number; vy: number };
  findNearestVertex?(worldX: number, worldZ: number): { vx: number; vy: number; dist: number };
  vertexToWorld?(vx: number, vy: number): { x: number; z: number };
  getVertexDimensions?(): { width: number; height: number };
  getVertexPositionsGrid?(): Vec3[][];
  getVertexElevationsGrid?(): number[][];
  getLayoutGrid?(): number[][];
  getWorldDimensions?(): { width: number; height: number };
  rebuildMesh?(): void;
  paintTerrainType?(cells: Array<{ x: number; y: number }>, type: TerrainType): void;
  getTopology?(): TerrainMeshTopology | null;
  findNearestEdgeAt?(worldX: number, worldZ: number, maxDist?: number): { edgeId: number; t: number; dist: number } | null;
  setHoveredEdge?(edgeId: number | null): void;
  getHoveredEdge?(): number | null;
  selectEdge?(edgeId: number | null, additive?: boolean): void;
  getSelectedEdge?(): number | null;
  toggleEdgeSelection?(edgeId: number): void;
  selectAllEdges?(): void;
  deselectAllEdges?(): void;
  getSelectedEdgeIds?(): Set<number>;
  subdivideSelectedEdge?(): void;
  flipSelectedEdge?(): void;
  setFaceTerrain?(faceId: number, type: TerrainType): void;
  setTopologyMode?(mode: TopologyMode): void;
  getTopologyMode?(): TopologyMode;
  setHoveredFace?(faceId: number | null): void;
  getHoveredFace?(): number | null;
  selectFace?(faceId: number, additive?: boolean): void;
  deselectFace?(faceId: number): void;
  toggleFaceSelection?(faceId: number): void;
  clearSelectedFaces?(): void;
  getSelectedFaceIds?(): Set<number>;
  findFaceAtPosition?(worldX: number, worldZ: number): number | null;
  moveSelectedFaces?(dx: number, dy: number, dz: number): void;
  getSelectedFaceVertexIds?(): Set<number>;
  getSelectedEdgeVertexIds?(): Set<number>;
  getSelectedVerticesFromSelection?(): Array<{ vx: number; vy: number }>;
  collapseEdge?(edgeId: number): void;
  getFacesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  setBrushHoveredFaces?(faceIds: number[]): void;
  getEdgesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  setBrushHoveredEdges?(edgeIds: number[]): void;
  getVerticesInWorldRadius?(worldX: number, worldZ: number, radius: number): Array<{ vx: number; vy: number }>;
  getVerticesFromEdgesInBrush?(worldX: number, worldZ: number, radius: number): Array<{ vx: number; vy: number }>;
  getVerticesFromFacesInBrush?(worldX: number, worldZ: number, radius: number): Array<{ vx: number; vy: number }>;
  subdivideEdgeAt?(edgeId: number, t?: number): void;
  canDeleteTopologyVertex?(vertexId: number): boolean;
  deleteTopologyVertex?(vertexId: number): void;
  findNearestTopologyVertexAt?(worldX: number, worldZ: number): { vertexId: number; dist: number } | null;
  getTopologyVertexPosition?(vertexId: number): Vec3 | null;
  setTopologyVertexPosition?(vertexId: number, pos: Vec3): void;
  setHoveredTopologyVertex?(vertexId: number | null): void;
  getHoveredTopologyVertex?(): number | null;
}

export interface TerrainEditorCallbacks {
  onEnable?: () => void;
  onDisable?: () => void;
  onToolSelect?: (tool: EditorTool) => void;
  onToolChange?: (tool: EditorTool) => void;
  onModeChange?: (mode: EditorMode) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushStrengthChange?: (strength: number) => void;
  onModification?: (tiles: Array<{ x: number; y: number }>) => void;
  onSelectionChange?: (count: number) => void;
  onTopologyModeChange?: (mode: TopologyMode) => void;
  onInteractionModeChange?: (mode: InteractionMode) => void;
}

export class TerrainEditorSystem {
  private terrainModifier: TerrainModifier | null = null;
  private highlightSystem: TileHighlightSystem;
  private callbacks: TerrainEditorCallbacks = {};

  private state: EditorState;
  private boxSelectStart: { vx: number; vy: number } | null = null;
  private axisConstraint: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' = 'xz';
  private isMovingVertices: boolean = false;
  private moveStartWorldPos: { x: number; z: number } | null = null;
  private moveStartScreenY: number | null = null;
  private moveDragStartPositions: Map<string, Vec3> = new Map();

  private topologyMode: TopologyMode = 'vertex';
  private hoveredEdgeId: number | null = null;
  private hoveredTopologyVertexId: number | null = null;
  private selectedTopologyVertices: Set<number> = new Set();
  private hoveredFaceId: number | null = null;
  private selectedFaces: Set<number> = new Set();
  private meshResolution: number = 2.0;
  private lastWorldPos: { x: number; z: number } | null = null;

  constructor(scene: Scene) {
    this.state = createInitialEditorState();
    this.highlightSystem = new TileHighlightSystem(scene);
  }

  private getVertexDims(): { width: number; height: number } {
    return this.terrainModifier?.getVertexDimensions?.() ?? { width: 0, height: 0 };
  }

  private getWorldDims(): { width: number; height: number } {
    return this.terrainModifier?.getWorldDimensions?.() ?? { width: 0, height: 0 };
  }

  public setTerrainModifier(modifier: TerrainModifier): void {
    this.terrainModifier = modifier;

    if (modifier.getVertexDimensions) {
      const vertexProvider: VertexPositionProvider = {
        getVertexElevation: (vx, vy) => modifier.getVertexElevation!(vx, vy),
        vertexToWorld: (vx, vy) => modifier.vertexToWorld!(vx, vy),
        getVertexDimensions: () => modifier.getVertexDimensions!(),
        getVerticesInWorldRadius: modifier.getVerticesInWorldRadius
          ? (worldX, worldZ, radius) => modifier.getVerticesInWorldRadius!(worldX, worldZ, radius)
          : undefined,
      };
      this.highlightSystem.setVertexProvider(vertexProvider);

      const selectionProvider: SelectionProvider = {
        getSelectedVertices: () => this.state.selectedVertices,
        getBoxSelectBounds: () => {
            const bounds = this.getBoxSelectBounds();
            if (!bounds) return null;
            return { vx1: bounds.x1, vy1: bounds.y1, vx2: bounds.x2, vy2: bounds.y2 };
        },
      };
      this.highlightSystem.setSelectionProvider(selectionProvider);
    }
  }

  public setCallbacks(callbacks: TerrainEditorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setMeshResolution(res: number): void {
    this.meshResolution = res;
  }

  public enable(): void {
    if (this.state.enabled) return;

    this.state.enabled = true;
    this.highlightSystem.setBrushSize(this.getBrushRadius());
    this.setMode(this.state.mode);
    this.syncHighlightMode();

    this.callbacks.onEnable?.();
  }

  public disable(): void {
    if (!this.state.enabled) return;

    this.state.enabled = false;
    this.setTopologyMode('none');
    this.highlightSystem.clearHighlight();
    this.callbacks.onDisable?.();
  }

  public toggle(): void {
    if (this.state.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  public isEnabled(): boolean {
    return this.state.enabled;
  }


  public setMode(mode: EditorMode): void {
    this.state.mode = mode;

    if (mode === 'sculpt') {
      if (!isSculptTool(this.state.activeTool)) {
        this.state.activeTool = 'raise';
        this.callbacks.onToolChange?.('raise');
      }
      if (this.topologyMode === 'none') {
        this.setTopologyMode('vertex');
      }
    } else if (mode === 'paint') {
      if (!isTerrainBrush(this.state.activeTool)) {
        this.state.activeTool = 'terrain_fairway';
        this.callbacks.onToolChange?.('terrain_fairway');
      }
      this.setTopologyMode('face');
      if (this.state.interactionMode !== 'brush') {
        this.setInteractionMode('brush');
      }
    }

    this.callbacks.onModeChange?.(mode);
  }

  public getMode(): EditorMode {
    return this.state.mode;
  }

  public setTool(tool: EditorTool): void {
    if (this.state.activeTool === tool) return;
    this.state.activeTool = tool;

    if (isSculptTool(tool) && this.state.mode !== 'sculpt') {
      this.setMode('sculpt');
    } else if (isTerrainBrush(tool) && this.state.mode !== 'paint') {
      this.setMode('paint');
    }

    this.callbacks.onToolChange?.(tool);
  }

  public getTool(): EditorTool {
    return this.state.activeTool;
  }

  public getCurrentTool(): EditorTool {
    return this.state.activeTool;
  }

  public getActiveTool(): EditorTool {
    return this.state.activeTool;
  }

  public isMovingSelectedVertices(): boolean {
    return this.isMovingVertices;
  }

  public getInteractionMode(): InteractionMode {
    return this.state.interactionMode;
  }

  public setInteractionMode(mode: InteractionMode): void {
    if (this.state.interactionMode === mode) return;
    this.state.interactionMode = mode;

    if (mode === 'select') {
      this.highlightSystem.setBrushSize(0);
      this.terrainModifier?.setBrushHoveredFaces?.([]);
      this.terrainModifier?.setBrushHoveredEdges?.([]);
    } else {
      this.highlightSystem.setBrushSize(this.getBrushRadius());
    }

    this.highlightSystem.refresh();
    this.callbacks.onInteractionModeChange?.(mode);
  }

  public handleSelectClick(worldPos: { x: number; z: number }, shiftKey: boolean): void {
    if (!this.terrainModifier) return;

    if (this.topologyMode === 'vertex') {
      const nearest = this.terrainModifier.findNearestVertex?.(worldPos.x, worldPos.z);
      if (nearest) {
        if (shiftKey) {
          const key = vertexKey(nearest.vx, nearest.vy);
          if (this.state.selectedVertices.has(key)) {
            this.state.selectedVertices.delete(key);
          } else {
            this.state.selectedVertices.add(key);
          }
        } else {
          this.state.selectedVertices.clear();
          this.state.selectedVertices.add(vertexKey(nearest.vx, nearest.vy));
        }
        this.notifySelectionChange();
        this.highlightSystem.refresh();
      }
    } else if (this.topologyMode === 'edge') {
      const edgePick = this.terrainModifier.findNearestEdgeAt?.(worldPos.x, worldPos.z);
      if (edgePick) {
        if (shiftKey) {
          this.terrainModifier.toggleEdgeSelection?.(edgePick.edgeId);
        } else {
          this.terrainModifier.selectEdge?.(edgePick.edgeId);
        }
        this.hoveredEdgeId = edgePick.edgeId;
        this.notifySelectionChange();
        this.highlightSystem.refresh();
      }
    } else if (this.topologyMode === 'face') {
      const faceId = this.terrainModifier.findFaceAtPosition?.(worldPos.x, worldPos.z) ?? null;
      if (faceId !== null) {
        if (shiftKey) {
          this.toggleFaceSelection(faceId);
        } else {
          this.selectFace(faceId);
        }
        this.highlightSystem.refresh();
      }
    }
  }

  public getBrushSize(): number {
    return this.state.brushSize;
  }

  public setBrushSize(size: number): void {
    if (this.state.brushSize === size) return;
    this.state.brushSize = Math.max(1, Math.min(10, size));
    this.callbacks.onBrushSizeChange?.(this.state.brushSize);
    this.highlightSystem.setBrushSize(this.getBrushRadius());
    this.highlightSystem.refresh();
  }

  public setBrushStrength(strength: number): void {
    if (this.state.brushStrength === strength) return;
    this.state.brushStrength = Math.max(0.01, Math.min(1.0, strength));
    this.callbacks.onBrushStrengthChange?.(this.state.brushStrength);
  }

  public getBrushStrength(): number {
    return this.state.brushStrength;
  }

  public selectVertices(vertices: Array<{ vx: number; vy: number }>, additive: boolean = false): void {
    if (!additive) {
      this.state.selectedVertices.clear();
    }
    for (const v of vertices) {
      this.state.selectedVertices.add(vertexKey(v.vx, v.vy));
    }
    this.notifySelectionChange();
    this.highlightSystem.refresh();
  }

  public deselectVertices(): void {
    this.state.selectedVertices.clear();
    this.notifySelectionChange();
    this.highlightSystem.refresh();
  }

  public getSelectedVertices(): Array<{ vx: number; vy: number }> {
    const list: Array<{ vx: number; vy: number }> = [];
    this.state.selectedVertices.forEach(key => {
      list.push(parseVertexKey(key));
    });
    return list;
  }

  private notifySelectionChange(): void {
    const count = this.state.selectedVertices.size + this.selectedTopologyVertices.size + this.selectedFaces.size;
    this.callbacks.onSelectionChange?.(count);
  }

  private getBoxSelectBounds(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.boxSelectStart || !this.state.hoverVertex) return null;
    return {
      x1: Math.min(this.boxSelectStart.vx, this.state.hoverVertex.vx),
      y1: Math.min(this.boxSelectStart.vy, this.state.hoverVertex.vy),
      x2: Math.max(this.boxSelectStart.vx, this.state.hoverVertex.vx),
      y2: Math.max(this.boxSelectStart.vy, this.state.hoverVertex.vy),
    };
  }

  public selectAllVertices(): void {
    const { width, height } = this.getVertexDims();
    const vertices: Array<{ vx: number; vy: number }> = [];
    for (let vy = 0; vy < height; vy++) {
      for (let vx = 0; vx < width; vx++) {
        vertices.push({ vx, vy });
      }
    }
    this.selectVertices(vertices, false);
  }

  public deselectAllVertices(): void {
    this.deselectVertices();
  }

  public setAxisConstraint(constraint: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz'): void {
    this.axisConstraint = constraint;
  }

  public getAxisConstraint(): 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' {
    return this.axisConstraint;
  }

  public async moveSelectedVerticesBy(delta: Vec3): Promise<void> {
    if (!this.terrainModifier || this.state.selectedVertices.size === 0) return;
    this.terrainModifier.moveVertices?.(this.getSelectedVertices(), delta);
    this.terrainModifier.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public handleDeleteSelectedTopologyVertices(): void {
    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
        const res = this.meshResolution;
        const worldX = this.state.hoverVertex.vx * res;
        const worldZ = this.state.hoverVertex.vy * res;
        const nearest = this.terrainModifier?.findNearestTopologyVertexAt?.(worldX, worldZ);
        if (nearest && nearest.dist < 0.1) {
            this.terrainModifier?.deleteTopologyVertex?.(nearest.vertexId);
            this.terrainModifier?.rebuildMesh?.();
            this.highlightSystem.refresh();
        }
    }
  }

  public subdivideSelectedEdge(): void {
    if (this.hoveredEdgeId === null || !this.terrainModifier?.subdivideSelectedEdge) return;
    this.terrainModifier.subdivideSelectedEdge();
    this.highlightSystem.refresh();
  }

  public flipSelectedEdge(): void {
    if (this.hoveredEdgeId === null || !this.terrainModifier?.flipSelectedEdge) return;
    this.terrainModifier.flipSelectedEdge();
    this.highlightSystem.refresh();
  }

  public collapseSelectedEdge(): void {
    if (this.hoveredEdgeId === null || !this.terrainModifier?.collapseEdge) return;
    this.terrainModifier.collapseEdge(this.hoveredEdgeId);
    this.highlightSystem.refresh();
  }

  public getSelectionCentroid(): Vec3 | null {
    if (this.state.selectedVertices.size === 0) return null;
    let sumX = 0, sumY = 0, sumZ = 0;
    const vertices = this.getSelectedVertices();
    for (const v of vertices) {
      const pos = this.terrainModifier?.getVertexPosition?.(v.vx, v.vy);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        sumZ += pos.z;
      }
    }
    const count = vertices.length;
    return { x: sumX / count, y: sumY / count, z: sumZ / count };
  }

  private getBrushRadius(): number {
    return Math.max(0, this.state.brushSize - 1);
  }

  public changeBrushSize(delta: number): void {
    this.setBrushSize(this.state.brushSize + delta);
  }


  public getHoverInfo(): { x: number; y: number; elevation: number; type: TerrainType } | null {
    if (this.state.hoverVertex) {
        const vx = this.state.hoverVertex.vx;
        const vy = this.state.hoverVertex.vy;
        const pos = this.terrainModifier?.getVertexPosition?.(vx, vy);
        const typeCode = this.terrainModifier?.getLayoutGrid?.()?.[vy]?.[vx] ?? 0;
        return {
            x: vx,
            y: vy,
            elevation: pos?.y ?? 0,
            type: getTerrainType(typeCode)
        };
    }
    if (this.state.hoverTile) {
        const x = this.state.hoverTile.x;
        const y = this.state.hoverTile.y;
        const elev = this.terrainModifier?.getVertexElevation?.(x, y) ?? 0;
        const typeCode = this.terrainModifier?.getLayoutGrid?.()?.[y]?.[x] ?? 0;
        return {
            x,
            y,
            elevation: elev,
            type: getTerrainType(typeCode)
        };
    }
    return null;
  }

  public isHoveredElementSelected(): boolean {
    if (this.hoveredFaceId !== null) return this.selectedFaces.has(this.hoveredFaceId);
    if (this.state.hoverVertex) return isVertexSelected(this.state, this.state.hoverVertex.vx, this.state.hoverVertex.vy);
    return false;
  }

  public isSculptBrushActive(): boolean {
    return this.state.mode === 'sculpt' && isSculptTool(this.state.activeTool);
  }

  public handleVertexMoveStart(worldX: number, worldZ: number, screenY: number): void {
    this.isMovingVertices = true;
    this.moveStartWorldPos = { x: worldX, z: worldZ };
    this.moveStartScreenY = screenY;
    this.moveDragStartPositions.clear();
    const vertices = this.getSelectedVertices();
    for (const v of vertices) {
      const pos = this.terrainModifier?.getVertexPosition?.(v.vx, v.vy);
      if (pos) {
        this.moveDragStartPositions.set(`${v.vx},${v.vy}`, { ...pos });
      }
    }
  }

  public handleVertexMoveDrag(worldX: number, worldZ: number, screenY: number): void {
    if (!this.isMovingVertices || !this.moveStartWorldPos || this.moveStartScreenY === null) return;
    const dx = worldX - this.moveStartWorldPos.x;
    const dz = worldZ - this.moveStartWorldPos.z;
    const dy = (this.moveStartScreenY - screenY) * 0.1;

    const changes: Array<{ vx: number; vy: number; pos: Vec3 }> = [];
    const vertices = this.getSelectedVertices();
    for (const v of vertices) {
      const startPos = this.moveDragStartPositions.get(`${v.vx},${v.vy}`);
      if (startPos) {
        const newPos = { ...startPos };
        if (this.axisConstraint.includes('x')) newPos.x += dx;
        if (this.axisConstraint.includes('y')) newPos.y += dy;
        if (this.axisConstraint.includes('z')) newPos.z += dz;
        changes.push({ vx: v.vx, vy: v.vy, pos: newPos });
      }
    }
    this.terrainModifier?.setVertexPositions?.(changes);
    this.terrainModifier?.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public handleVertexMoveEnd(): void {
    if (!this.isMovingVertices) return;
    this.isMovingVertices = false;
  }

  public handleDragStart(gridX: number, gridY: number): void {
    this.handleMouseDown(gridX, gridY);
  }

  public handleDragEnd(): void {
    this.handleMouseUp();
  }

  public handleMouseDown(_gridX: number, _gridY: number): void {
    if (!this.state.enabled) return;
    if (this.state.interactionMode === 'select') return;

    this.state.isDragging = true;

    if (this.state.mode === 'sculpt') {
      this.handleSculptClick();
    } else if (this.state.mode === 'paint') {
      if (this.lastWorldPos) {
        this.handleFacePaint(this.lastWorldPos.x, this.lastWorldPos.z);
      }
    }
  }

  public handleMouseUp(): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    this.state.isDragging = false;
    this.isMovingVertices = false;
  }

  public handleClick(_gridX: number, _gridY: number): void {
  }

  private getSculptContext(): { anchorVx: number; anchorVy: number; worldX: number; worldZ: number; vertices: Array<{ vx: number; vy: number }> } | null {
    if (!this.terrainModifier) return null;

    let worldX: number;
    let worldZ: number;

    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
      const wp = this.terrainModifier.vertexToWorld?.(this.state.hoverVertex.vx, this.state.hoverVertex.vy);
      worldX = wp?.x ?? this.state.hoverVertex.vx / this.meshResolution;
      worldZ = wp?.z ?? this.state.hoverVertex.vy / this.meshResolution;
    } else if (this.lastWorldPos) {
      worldX = this.lastWorldPos.x;
      worldZ = this.lastWorldPos.z;
    } else {
      return null;
    }

    const nearest = this.terrainModifier.findNearestVertex?.(worldX, worldZ);
    if (!nearest) return null;
    const anchorVx = nearest.vx;
    const anchorVy = nearest.vy;

    const radius = this.getBrushRadius();
    let vertices: Array<{ vx: number; vy: number }>;
    switch (this.topologyMode) {
      case 'vertex':
        vertices = this.terrainModifier.getVerticesInWorldRadius?.(worldX, worldZ, radius) ?? [];
        break;
      case 'edge':
        vertices = this.terrainModifier.getVerticesFromEdgesInBrush?.(worldX, worldZ, radius) ?? [];
        break;
      case 'face':
        vertices = this.terrainModifier.getVerticesFromFacesInBrush?.(worldX, worldZ, radius) ?? [];
        break;
      default:
        vertices = this.terrainModifier.getVerticesInWorldRadius?.(worldX, worldZ, radius) ?? [];
        break;
    }

    if (vertices.length === 0) return null;

    return { anchorVx, anchorVy, worldX, worldZ, vertices };
  }

  private handleSculptClick(): void {
    this.applySculpt();
  }

  public handleDrag(_gridX: number, _gridY: number): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    if (this.state.mode === 'sculpt') {
      this.applySculpt();
      return;
    }

    if (this.state.mode === 'paint' && isTerrainBrush(this.state.activeTool) && this.lastWorldPos) {
      this.handleFacePaint(this.lastWorldPos.x, this.lastWorldPos.z);
      return;
    }
  }

  private applySculpt(): void {
    if (!this.terrainModifier) return;

    const sculpt = this.getSculptContext();
    if (!sculpt) return;

    const tool = this.state.activeTool as SculptTool;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();
    const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];
    const modifications = applySculptTool(
      tool,
      sculpt.anchorVx,
      sculpt.anchorVy,
      elevGrid,
      this.getBrushRadius() * this.meshResolution,
      this.state.brushStrength,
      vertexWidth,
      vertexHeight,
      this.state.selectedVertices,
      sculpt.vertices
    );

    if (modifications.length > 0) {
      commitVertexModifications(modifications, elevGrid);

      this.terrainModifier.setVertexElevations?.(modifications.map(m => ({ vx: m.vx, vy: m.vy, z: m.newZ })));
      this.terrainModifier.rebuildMesh?.();
      this.callbacks.onModification?.(modifications.map(m => ({ x: m.vx, y: m.vy })));
      this.highlightSystem.refresh();
    }
  }

  public handleMouseMove(gridX: number, gridY: number, worldPos?: Vector3): void {
    if (!this.state.enabled) return;

    if (worldPos) {
      this.lastWorldPos = { x: worldPos.x, z: worldPos.z };
    }

    const { width: mapWidth, height: mapHeight } = this.getWorldDims();
    const res = this.meshResolution;
    if (gridX < 0 || gridX >= mapWidth * res || gridY < 0 || gridY >= mapHeight * res) {
      this.state.hoverTile = null;
      this.highlightSystem.clearHighlight();
      return;
    }

    this.state.hoverTile = { x: gridX, y: gridY };

    if (this.topologyMode === 'vertex') {
        const worldX = gridX / res;
        const worldZ = gridY / res;
        const nearest = this.terrainModifier?.findNearestVertex?.(worldX, worldZ);
        if (nearest) {
            this.state.hoverVertex = { vx: nearest.vx, vy: nearest.vy };
            this.highlightSystem.setVertexHighlightPosition(nearest.vx, nearest.vy, worldX, worldZ);
        } else {
            this.state.hoverVertex = null;
            this.highlightSystem.setVertexHighlightPosition(-1, -1);
        }
    } else if (this.topologyMode === 'face' || this.topologyMode === 'edge') {
        this.state.hoverVertex = null;
        if (this.topologyMode === 'face' && worldPos) {
            const faceId = this.terrainModifier?.findFaceAtPosition?.(worldPos.x, worldPos.z) ?? null;
            this.hoveredFaceId = faceId;
            this.terrainModifier?.setHoveredFace?.(faceId);

            if (this.state.interactionMode === 'brush') {
                const facesInBrush = this.terrainModifier?.getFacesInBrush?.(worldPos.x, worldPos.z, this.getBrushRadius()) ?? [];
                this.terrainModifier?.setBrushHoveredFaces?.(facesInBrush);
            } else {
                this.terrainModifier?.setBrushHoveredFaces?.([]);
            }
        }

        if (this.topologyMode === 'edge' && worldPos) {
            const edgePick = this.terrainModifier?.findNearestEdgeAt?.(worldPos.x, worldPos.z);
            this.hoveredEdgeId = edgePick ? edgePick.edgeId : null;
            this.terrainModifier?.setHoveredEdge?.(this.hoveredEdgeId);

            if (this.state.interactionMode === 'brush') {
                const edgesInBrush = this.terrainModifier?.getEdgesInBrush?.(worldPos.x, worldPos.z, this.getBrushRadius()) ?? [];
                this.terrainModifier?.setBrushHoveredEdges?.(edgesInBrush);
            } else {
                this.terrainModifier?.setBrushHoveredEdges?.([]);
            }
        }

        if (worldPos) {
            this.highlightSystem.setWorldPosition(worldPos.x, worldPos.z);
        }
    }
  }

  public onSelectionChange(callback: (count: number) => void): void {
    this.callbacks.onSelectionChange = callback;
  }

  public setTopologyMode(mode: TopologyMode): void {
    if (this.topologyMode === mode) return;
    this.topologyMode = mode;
    this.terrainModifier?.setTopologyMode?.(mode);
    
    if (mode === 'vertex') {
        this.highlightSystem.setHighlightMode('vertex');
    } else if (mode === 'face') {
        this.highlightSystem.setHighlightMode('face');
    } else if (mode === 'edge') {
        this.highlightSystem.setHighlightMode('edge');
    } else {
        this.highlightSystem.setHighlightMode('none');
    }
    
    this.callbacks.onTopologyModeChange?.(mode);
    this.highlightSystem.refresh();
  }

  private syncHighlightMode(): void {
    const mode = this.topologyMode === 'none' ? 'none'
      : this.topologyMode === 'vertex' ? 'vertex'
      : this.topologyMode === 'face' ? 'face'
      : this.topologyMode === 'edge' ? 'edge'
      : 'none' as const;
    this.highlightSystem.setHighlightMode(mode);
  }

  public getTopologyMode(): TopologyMode {
    return this.topologyMode;
  }

  public deleteVertex(): void {
    if (this.hoveredTopologyVertexId === null || !this.terrainModifier?.deleteTopologyVertex) return;
    this.terrainModifier.deleteTopologyVertex(this.hoveredTopologyVertexId);
    this.highlightSystem.refresh();
  }

  public selectFace(faceId: number, additive: boolean = false): void {
    if (!additive) this.selectedFaces.clear();
    this.selectedFaces.add(faceId);
    this.terrainModifier?.selectFace?.(faceId, additive);
    this.notifySelectionChange();
  }

  public toggleFaceSelection(faceId: number): void {
    if (this.selectedFaces.has(faceId)) {
      this.selectedFaces.delete(faceId);
      this.terrainModifier?.deselectFace?.(faceId);
    } else {
      this.selectedFaces.add(faceId);
      this.terrainModifier?.selectFace?.(faceId, true);
    }
    this.notifySelectionChange();
  }

  public clearFaceSelection(): void {
    this.selectedFaces.clear();
    this.terrainModifier?.clearSelectedFaces?.();
    this.notifySelectionChange();
  }

  public moveSelectedFaces(dx: number, dy: number, dz: number): void {
    if (this.selectedFaces.size === 0) return;
    this.terrainModifier?.moveSelectedFaces?.(dx, dy, dz);
    this.terrainModifier?.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  private handleFacePaint(worldX: number, worldZ: number): void {
    if (!this.terrainModifier || !isTerrainBrush(this.state.activeTool)) return;
    const facesInBrush = this.terrainModifier.getFacesInBrush?.(worldX, worldZ, this.getBrushRadius());
    if (!facesInBrush || facesInBrush.length === 0) return;

    const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
    for (const faceId of facesInBrush) {
      this.terrainModifier.setFaceTerrain?.(faceId, terrainType);
    }
    this.terrainModifier.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public dispose(): void {
    this.highlightSystem.clearHighlight();
  }
}
