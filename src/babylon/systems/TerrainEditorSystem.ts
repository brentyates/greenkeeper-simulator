import { Scene, Vector3, Ray } from "@babylonjs/core";

import {
  EditorTool,
  EditorMode,
  TopologyMode,
  SculptTool,
  EditorState,
  EditorAction,
  VertexModification,
  TerrainTypeModification,
  Vec3,
  SelectionMode,
  vertexKey,
  parseVertexKey,
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  applySculptTool,
  applyPaintBrush,
  commitVertexModifications,
  commitTerrainTypeModifications,
  createElevationAction,
  createPaintAction,
  createPositionAction,
  createTopologyAction,
  isVertexSelected,
} from "../../core/terrain-editor-logic";

import {
  TerrainType,
  getTerrainType,
} from "../../core/terrain";
import {
  TileHighlightSystem,
  CornerHeightsProvider,
  VertexPositionProvider,
  SelectionProvider,
} from "./TileHighlightSystem";

import { TopologyModification, TerrainMeshTopology } from "../../core/mesh-topology";

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
  isTopologyMode?(): boolean;
  enableTopologyMode?(): void;
  disableTopologyMode?(): void;
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
  subdivideSelectedEdge?(): { newVertexId: number; beforeState: TopologyModification['beforeState'] } | null;
  flipSelectedEdge?(): { beforeState: TopologyModification['beforeState'] } | null;
  setFaceTerrain?(faceId: number, type: TerrainType): { beforeState: TopologyModification['beforeState'] } | null;
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
  collapseEdge?(edgeId: number): { beforeState: TopologyModification['beforeState'] } | null;
  getFacesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  getEdgesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  pick?(ray: Ray): { gridX: number; gridY: number; worldPos: { x: number; z: number }; faceId: number | null } | null;
  
  // Backward compatibility / legacy
  subdivideEdgeAt?(edgeId: number, t?: number): { newVertexId: number; beforeState: TopologyModification['beforeState'] } | null;
  canDeleteTopologyVertex?(vertexId: number): boolean;
  deleteTopologyVertex?(vertexId: number): { beforeState: TopologyModification['beforeState'] } | null;
  findNearestTopologyVertexAt?(worldX: number, worldZ: number): { vertexId: number; dist: number } | null;
  getTopologyVertexPosition?(vertexId: number): Vec3 | null;
  setTopologyVertexPosition?(vertexId: number, pos: Vec3): void;
  restoreTopologyFromState?(state: TopologyModification['beforeState']): void;
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
  onUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange?: (count: number) => void;
  onTopologyModeChange?: (mode: TopologyMode) => void;
  getPickRay?: () => Ray | null;
}

export class TerrainEditorSystem {
  private terrainModifier: TerrainModifier | null = null;
  private highlightSystem: TileHighlightSystem;
  private callbacks: TerrainEditorCallbacks = {};

  private state: EditorState;
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];

  private dragModifications: VertexModification[] = [];
  private dragPaintModifications: TerrainTypeModification[] = [];
  private boxSelectStart: { vx: number; vy: number } | null = null;
  private axisConstraint: 'x' | 'y' | 'z' | 'xz' | 'all' = 'xz';
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

  constructor(scene: Scene, cornerProvider: CornerHeightsProvider) {
    this.state = createInitialEditorState();
    this.highlightSystem = new TileHighlightSystem(scene, cornerProvider);
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
    this.undoStack = [];
    this.redoStack = [];
    this.notifyUndoRedoChange();

    this.highlightSystem.setHighlightMode(this.state.mode === 'sculpt' ? 'vertex' : 'cell');

    this.callbacks.onEnable?.();
  }

  public disable(): void {
    if (!this.state.enabled) return;

    this.state.enabled = false;
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

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public setMode(mode: EditorMode): void {
    if (this.state.mode === mode) return;
    this.state.mode = mode;

    if (mode === 'sculpt' && !isSculptTool(this.state.activeTool)) {
      this.state.activeTool = 'raise';
      this.callbacks.onToolChange?.('raise');
    } else if (mode === 'paint') {
      if (!isTerrainBrush(this.state.activeTool)) {
        this.state.activeTool = 'terrain_fairway';
        this.callbacks.onToolChange?.('terrain_fairway');
      }
      this.setTopologyMode('face');
    }

    if (this.topologyMode === 'face' || this.topologyMode === 'edge') {
        this.highlightSystem.setHighlightMode('none');
    } else if (this.topologyMode === 'vertex') {
        this.highlightSystem.setHighlightMode('vertex');
    } else {
        this.highlightSystem.setHighlightMode(mode === 'sculpt' ? 'vertex' : 'cell');
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
      this.state.mode = 'sculpt';
      this.highlightSystem.setHighlightMode('vertex');
      this.callbacks.onModeChange?.('sculpt');
    } else if (isTerrainBrush(tool) && this.state.mode !== 'paint') {
      this.state.mode = 'paint';
      this.highlightSystem.setHighlightMode('cell');
      this.callbacks.onModeChange?.('paint');
      this.setTopologyMode('face');
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

  public getBrushSize(): number {
    return this.state.brushSize;
  }

  public setBrushSize(size: number): void {
    if (this.state.brushSize === size) return;
    this.state.brushSize = Math.max(0.1, Math.min(10.0, size));
    this.callbacks.onBrushSizeChange?.(this.state.brushSize);
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

  public selectVertices(vertices: Array<{ vx: number; vy: number }>, mode: SelectionMode = 'single'): void {
    if (mode === 'single') {
      this.state.selectedVertices.clear();
      for (const v of vertices) {
        this.state.selectedVertices.add(vertexKey(v.vx, v.vy));
      }
    } else { 
        for (const v of vertices) {
            this.state.selectedVertices.add(vertexKey(v.vx, v.vy));
        }
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
    this.selectVertices(vertices, 'single');
  }

  public deselectAllVertices(): void {
    this.deselectVertices();
  }

  public setAxisConstraint(constraint: 'x' | 'y' | 'z' | 'xz' | 'all'): void {
    this.axisConstraint = constraint;
  }

  public getAxisConstraint(): 'x' | 'y' | 'z' | 'xz' | 'all' {
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
    const result = this.terrainModifier.subdivideSelectedEdge();
    if (result) {
        const action = createTopologyAction({
          type: 'subdivide',
          edgeId: this.hoveredEdgeId!,
          beforeState: result.beforeState
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.highlightSystem.refresh();
    }
  }

  public flipSelectedEdge(): void {
    if (this.hoveredEdgeId === null || !this.terrainModifier?.flipSelectedEdge) return;
    const result = this.terrainModifier.flipSelectedEdge();
    if (result) {
        const action = createTopologyAction({
          type: 'flip',
          edgeId: this.hoveredEdgeId!,
          beforeState: result.beforeState
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.highlightSystem.refresh();
    }
  }

  public collapseSelectedEdge(): void {
    if (this.hoveredEdgeId === null || !this.terrainModifier?.collapseEdge) return;
    const result = this.terrainModifier.collapseEdge(this.hoveredEdgeId);
    if (result) {
        const action = createTopologyAction({
          type: 'collapse',
          edgeId: this.hoveredEdgeId!,
          beforeState: result.beforeState
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.highlightSystem.refresh();
    }
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

  public changeBrushSize(delta: number): void {
    this.setBrushSize(this.state.brushSize + delta);
  }

  public exportToJSON(): string {
    return JSON.stringify({
      mode: this.state.mode,
      activeTool: this.state.activeTool,
      brushSize: this.state.brushSize,
      brushStrength: this.state.brushStrength,
    });
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
        if (this.axisConstraint === 'x' || this.axisConstraint === 'all' || this.axisConstraint === 'xz') newPos.x += dx;
        if (this.axisConstraint === 'y' || this.axisConstraint === 'all') newPos.y += dy;
        if (this.axisConstraint === 'z' || this.axisConstraint === 'all' || this.axisConstraint === 'xz') newPos.z += dz;
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
    const changes: Array<{ vx: number; vy: number; oldPos: Vec3; newPos: Vec3 }> = [];
    const vertices = this.getSelectedVertices();
    for (const v of vertices) {
        const startPos = this.moveDragStartPositions.get(`${v.vx},${v.vy}`);
        const currentPos = this.terrainModifier?.getVertexPosition?.(v.vx, v.vy);
        if (startPos && currentPos) {
            changes.push({ vx: v.vx, vy: v.vy, oldPos: startPos, newPos: currentPos });
        }
    }
    if (changes.length > 0) {
        const action = createPositionAction(changes);
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
    }
  }

  public handleDragStart(gridX: number, gridY: number): void {
    this.handleMouseDown(gridX, gridY);
  }

  public handleDragEnd(): void {
    this.handleMouseUp();
  }

  public handleMouseDown(gridX: number, gridY: number): void {
    if (!this.state.enabled) return;

    this.state.isDragging = true;
    this.dragModifications = [];
    this.dragPaintModifications = [];
    // this.lastDragTile = { x: gridX, y: gridY };
    // this.lastDragVertex = this.state.hoverVertex ? { ...this.state.hoverVertex } : null;

    if (this.state.mode === 'sculpt') {
      this.handleSculptClick();
    } else if (this.state.mode === 'paint') {
      this.handleClick(gridX, gridY);
    }
  }

  public handleMouseUp(): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    this.state.isDragging = false;

    if (this.dragModifications.length > 0) {
      const action = createElevationAction(this.dragModifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    } else if (this.dragPaintModifications.length > 0) {
      const action = createPaintAction(this.dragPaintModifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    }

    this.dragModifications = [];
    this.dragPaintModifications = [];
    // this.lastDragTile = null;
    // this.lastDragVertex = null;
    this.isMovingVertices = false;
  }

  public handleClick(gridX: number, gridY: number): void {
    if (!this.state.enabled) return;

    if (this.state.mode === 'sculpt' && this.state.hoverVertex) {
      this.handleSculptClick();
    } else if (this.state.mode === 'paint' && this.topologyMode === 'face') {
        const ray = this.getPickRay();
        if (ray) {
            const pick = this.terrainModifier?.pick?.(ray);
            if (pick) {
                this.handlePaintDrag(pick.gridX, pick.gridY);
            }
        }
    } else if (this.state.mode === 'paint' && this.state.hoverTile) {
      this.handlePaintClick(gridX, gridY);
    }
  }

  private handleSculptClick(): void {
    if (!this.terrainModifier) return;

    let anchorX: number | undefined;
    let anchorY: number | undefined;

    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
        anchorX = this.state.hoverVertex.vx;
        anchorY = this.state.hoverVertex.vy;
    } else if (this.state.hoverTile) {
        anchorX = this.state.hoverTile.x * (1.0 / this.meshResolution); 
        anchorY = this.state.hoverTile.y * (1.0 / this.meshResolution);
    }

    if (anchorX === undefined || anchorY === undefined) return;

    const tool = this.state.activeTool as SculptTool;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();
    const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];
    const gridRadius = this.state.brushSize;

    const modifications = applySculptTool(
      tool,
      anchorX,
      anchorY,
      elevGrid,
      gridRadius,
      this.state.brushStrength,
      vertexWidth,
      vertexHeight,
      this.state.selectedVertices
    );

    if (modifications.length > 0) {
      commitVertexModifications(modifications, elevGrid);

      const action = createElevationAction(modifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();

      this.applyVertexModifications(modifications);
      this.highlightSystem.refresh();
    }
  }

  private handlePaintClick(gridX: number, gridY: number): void {
    if (!this.terrainModifier || !isTerrainBrush(this.state.activeTool)) return;

    const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
    const layoutGrid = this.terrainModifier.getLayoutGrid?.() ?? [];
    const { width, height } = this.getWorldDims();

    const modifications = applyPaintBrush(
      gridX,
      gridY,
      layoutGrid,
      terrainType,
      this.state.brushSize,
      width,
      height
    );

    if (modifications.length > 0) {
      commitTerrainTypeModifications(modifications, layoutGrid);
      
      const action = createPaintAction(modifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();

      this.terrainModifier.paintTerrainType?.(modifications.map(m => ({ x: m.x, y: m.y })), terrainType);
      this.highlightSystem.refresh();
    }
  }

  public handleDrag(gridX: number, gridY: number): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    if (this.state.mode === 'sculpt') {
      this.handleSculptDrag(gridX, gridY);
      return;
    }

    if (this.state.mode === 'paint' && isTerrainBrush(this.state.activeTool)) {
      this.handlePaintDrag(gridX, gridY);
      return;
    }
  }

  private handleSculptDrag(gridX: number, gridY: number): void {
    if (!this.terrainModifier) return;

    let anchorX: number | undefined;
    let anchorY: number | undefined;

    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
        anchorX = this.state.hoverVertex.vx;
        anchorY = this.state.hoverVertex.vy;
    } else {
        anchorX = gridX * (1.0 / this.meshResolution);
        anchorY = gridY * (1.0 / this.meshResolution);
    }

    if (anchorX === undefined || anchorY === undefined) return;

    const tool = this.state.activeTool as SculptTool;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();
    const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];
    const gridRadius = this.state.brushSize;

    const modifications = applySculptTool(
      tool,
      anchorX,
      anchorY,
      elevGrid,
      gridRadius,
      this.state.brushStrength,
      vertexWidth,
      vertexHeight,
      this.state.selectedVertices
    );

    if (modifications.length > 0) {
      commitVertexModifications(modifications, elevGrid);
      
      for (const mod of modifications) {
        const existing = this.dragModifications.find(m => m.vx === mod.vx && m.vy === mod.vy);
        if (existing) {
          existing.newZ = mod.newZ;
        } else {
          this.dragModifications.push({ ...mod });
        }
      }

      this.applyVertexModifications(modifications);
      this.highlightSystem.refresh();
    }
  }

  private handlePaintDrag(gridX: number, gridY: number): void {
    if (!this.terrainModifier || !isTerrainBrush(this.state.activeTool)) return;

    if (this.topologyMode === 'face') {
        const ray = this.getPickRay();
        if (ray) {
            const pick = this.terrainModifier.pick?.(ray);
            if (!pick || pick.faceId === null) return;

            const brushRadius = this.state.brushSize * 0.5;
            const facesInBrush = this.terrainModifier.getFacesInBrush?.(pick.worldPos.x, pick.worldPos.z, brushRadius);
            
            if (facesInBrush && facesInBrush.length > 0) {
                const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
                for (const faceId of facesInBrush) {
                    this.terrainModifier.setFaceTerrain?.(faceId, terrainType);
                }
                this.terrainModifier.rebuildMesh?.();
                this.highlightSystem.refresh();
            }
        }
        return;
    }

    const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
    const layoutGrid = this.terrainModifier.getLayoutGrid?.() ?? [];
    const { width, height } = this.getWorldDims();

    const modifications = applyPaintBrush(
      gridX,
      gridY,
      layoutGrid,
      terrainType,
      this.state.brushSize,
      width,
      height
    );

    if (modifications.length > 0) {
      commitTerrainTypeModifications(modifications, layoutGrid);
      
      for (const mod of modifications) {
        const existing = this.dragPaintModifications.find(m => m.x === mod.x && m.y === mod.y);
        if (existing) {
          existing.newType = mod.newType;
        } else {
          this.dragPaintModifications.push({ ...mod });
        }
      }

      this.terrainModifier.paintTerrainType?.(modifications.map(m => ({ x: m.x, y: m.y })), terrainType);
      this.highlightSystem.refresh();
    }
  }

  private applyVertexModifications(modifications: VertexModification[]): void {
    if (!this.terrainModifier) return;
    this.terrainModifier.setVertexElevations?.(modifications.map(m => ({ vx: m.vx, vy: m.vy, z: m.newZ })));
    this.terrainModifier.rebuildMesh?.();
  }

  public handleMouseMove(gridX: number, gridY: number, worldPos?: Vector3): void {
    if (!this.state.enabled) return;
    
    // Brush handle
    if (this.state.mode === 'paint' && isTerrainBrush(this.state.activeTool) && worldPos) {
        const ray = this.callbacks.getPickRay?.();
        if (ray) {
            const pick = this.terrainModifier?.pick?.(ray);
            if (pick) {
                this.hoveredFaceId = pick.faceId;
            }
        }
    }

    const { width: mapWidth, height: mapHeight } = this.getWorldDims();
    if (gridX < 0 || gridX >= mapWidth || gridY < 0 || gridY >= mapHeight) {
      this.state.hoverTile = null;
      this.highlightSystem.setHighlightPosition(-1, -1);
      return;
    }

    this.state.hoverTile = { x: gridX, y: gridY };

    if (this.topologyMode === 'vertex') {
        const nearest = this.terrainModifier?.findNearestVertex?.(gridX, gridY);
        if (nearest && nearest.dist < 0.5) {
            this.state.hoverVertex = { vx: nearest.vx, vy: nearest.vy };
            this.highlightSystem.setVertexHighlightPosition(nearest.vx, nearest.vy);
        } else {
            this.state.hoverVertex = null;
            this.highlightSystem.setVertexHighlightPosition(-1, -1);
        }
        this.highlightSystem.setHighlightPosition(this.state.hoverTile.x, this.state.hoverTile.y);
    } else if (this.topologyMode === 'face' || this.topologyMode === 'edge') {
        const ray = this.getPickRay();
        if (ray) {
            const pick = this.terrainModifier?.pick?.(ray);
            if (pick) {
                if (this.topologyMode === 'face') {
                    this.hoveredFaceId = pick.faceId;
                    this.terrainModifier?.setHoveredFace?.(pick.faceId);
                } else {
                    const edgePick = this.terrainModifier?.findNearestEdgeAt?.(pick.worldPos.x, pick.worldPos.z);
                    this.hoveredEdgeId = edgePick ? edgePick.edgeId : null;
                    this.terrainModifier?.setHoveredEdge?.(this.hoveredEdgeId);
                }
            }
        }
        this.highlightSystem.setHighlightPosition(-1, -1);
    } else {
        this.highlightSystem.setHighlightPosition(this.state.hoverTile.x, this.state.hoverTile.y);
    }
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    this.applyAction(action, true);
    this.notifyUndoRedoChange();
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    this.applyAction(action, false);
    this.notifyUndoRedoChange();
  }

  private applyAction(action: EditorAction, isUndo: boolean): void {
    if (!this.terrainModifier) return;

    if (action.type === 'elevation') {
      const mods = action.modifications.map(m => ({
        vx: m.vx,
        vy: m.vy,
        z: isUndo ? m.oldZ : m.newZ
      }));
      this.terrainModifier.setVertexElevations?.(mods);
    } else if (action.type === 'paint') {
      const mods = action.modifications.map(m => ({
        x: m.x,
        y: m.y,
        type: isUndo ? m.oldType : m.newType
      }));
      for (const mod of mods) {
        this.terrainModifier.setTerrainTypeAt(mod.x, mod.y, getTerrainType(mod.type));
      }
    }

    this.terrainModifier.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  private notifyUndoRedoChange(): void {
    this.callbacks.onUndoRedoChange?.(this.undoStack.length > 0, this.redoStack.length > 0);
  }

  public onUndoRedoChange(callback: (canUndo: boolean, canRedo: boolean) => void): void {
    this.callbacks.onUndoRedoChange = callback;
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
    } else if (mode === 'face' && this.state.mode === 'paint') {
        this.highlightSystem.setHighlightMode('cell');
    } else {
        this.highlightSystem.setHighlightMode('none');
    }
    
    this.callbacks.onTopologyModeChange?.(mode);
    this.highlightSystem.refresh();
  }

  public getTopologyMode(): TopologyMode {
    return this.topologyMode;
  }

  public deleteVertex(): void {
    if (this.hoveredTopologyVertexId === null || !this.terrainModifier?.deleteTopologyVertex) return;
    const result = this.terrainModifier.deleteTopologyVertex(this.hoveredTopologyVertexId);
    if (result) {
        const action = createTopologyAction({
          type: 'delete',
          vertexId: this.hoveredTopologyVertexId!,
          beforeState: result.beforeState
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.highlightSystem.refresh();
    }
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

  public dispose(): void {
    this.highlightSystem.clearHighlight(); 
  }

  private getPickRay(): Ray | null {
    if (!this.terrainModifier || !this.callbacks.getPickRay) return null;
    return this.callbacks.getPickRay();
  }
}
