import { Scene } from "@babylonjs/core/scene";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

import {
  EditorTool,
  EditorMode,
  TopologyMode,
  SculptTool,
  EditorState,
  EditorAction,
  VertexModification,
  TerrainTypeModification,
  PositionModification,
  SelectionMode,
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
  canUndo,
  canRedo,
  selectVertex,
  toggleVertex,
  isVertexSelected,
  selectAll,
  deselectAll,
  selectVerticesInBox,
  selectVerticesInBrush,
  getSelectedVerticesList,
} from "../../core/terrain-editor-logic";

import {
  TerrainType,
  getTerrainType,
  TERRAIN_CODES,
} from "../../core/terrain";
import {
  TileHighlightSystem,
  CornerHeightsProvider,
  VertexPositionProvider,
  SelectionProvider,
} from "./TileHighlightSystem";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TerrainEditorCallbacks {
  onEnable?: () => void;
  onDisable?: () => void;
  onToolChange?: (tool: EditorTool) => void;
  onModeChange?: (mode: EditorMode) => void;
  onBrushSizeChange?: (size: number) => void;
  onModification?: (tiles: Array<{ x: number; y: number }>) => void;
  onUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange?: (count: number) => void;
  onTopologyModeChange?: (mode: TopologyMode) => void;
}

import { TopologyModification, TerrainMeshTopology } from "../../core/mesh-topology";

export interface TerrainModifier {
  setElevationAt(x: number, y: number, elevation: number): void;
  setTerrainTypeAt(x: number, y: number, type: TerrainType): void;
  rebuildTileAndNeighbors(x: number, y: number): void;
  getVertexPosition?(vx: number, vy: number): Vec3;
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
  
  // Cleaned up deprecated methods from interface to keep lint happy if needed
  subdivideEdgeAt?(edgeId: number, t?: number): { newVertexId: number; beforeState: TopologyModification['beforeState'] } | null;
  canDeleteTopologyVertex?(vertexId: number): boolean;
  deleteTopologyVertex?(vertexId: number): { beforeState: TopologyModification['beforeState'] } | null;
  findNearestTopologyVertexAt?(worldX: number, worldZ: number): { vertexId: number; dist: number } | null;
  getTopologyVertexPosition?(vertexId: number): Vec3 | null;
  setTopologyVertexPosition?(vertexId: number, pos: Vec3): void;
  restoreTopologyFromState?(state: TopologyModification['beforeState']): void;
  setHoveredTopologyVertex?(vertexId: number | null): void;
  getHoveredTopologyVertex?(): number | null;
  collapseEdge?(edgeId: number): { beforeState: TopologyModification['beforeState'] } | null;
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
  private lastDragTile: { x: number; y: number } | null = null;
  private lastDragVertex: { vx: number; vy: number } | null = null;

  private selectionMode: SelectionMode = 'single';
  private isSelectMode: boolean = false;
  private boxSelectStart: { vx: number; vy: number } | null = null;
  private isBoxSelecting: boolean = false;

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
        getBoxSelectBounds: () => this.getBoxSelectBounds(),
      };
      this.highlightSystem.setSelectionProvider(selectionProvider);
    }
  }

  public setCallbacks(callbacks: TerrainEditorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
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
      // Force face mode when entering paint, regardless of tool state
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

  public setBrushSize(size: number): void {
    const newSize = Math.max(1, Math.min(5, size));
    if (this.state.brushSize === newSize) return;
    this.state.brushSize = newSize;
    this.highlightSystem.setBrushSize(newSize);
    this.callbacks.onBrushSizeChange?.(newSize);
  }

  public getBrushSize(): number {
    return this.state.brushSize;
  }

  public changeBrushSize(delta: number): void {
    this.setBrushSize(this.state.brushSize + delta);
  }

  public setBrushStrength(strength: number): void {
    this.state.brushStrength = Math.max(0.1, Math.min(5.0, strength));
  }

  public getBrushStrength(): number {
    return this.state.brushStrength;
  }

  public handleMouseMove(
    gridX: number,
    gridY: number,
    worldPos?: Vector3,
    uv?: Vector2 | null
  ): void {
    if (this.state.mode === 'paint' && uv) {
      const { width, height } = this.getWorldDims();
      gridX = Math.floor(uv.x * width);
      gridY = Math.floor(uv.y * height);
    }
    if (!this.state.enabled) return;

    // Handle Edge Mode Hover
    if (this.topologyMode === 'edge' && worldPos && this.terrainModifier?.findNearestEdgeAt) {
      const nearest = this.terrainModifier.findNearestEdgeAt(worldPos.x, worldPos.z);
      if (nearest && nearest.dist < 0.5) {
        this.hoveredEdgeId = nearest.edgeId;
        this.terrainModifier.setHoveredEdge?.(nearest.edgeId);
        // Clear other highlights
        this.state.hoverVertex = null;
        this.highlightSystem.setVertexHighlightPosition(-1, -1);
      } else {
        this.hoveredEdgeId = null;
        this.terrainModifier.setHoveredEdge?.(null);
      }
    }

    // Handle Face Mode Hover
    if (this.topologyMode === 'face' && worldPos && this.terrainModifier?.findFaceAtPosition) {
      const faceId = this.terrainModifier.findFaceAtPosition(worldPos.x, worldPos.z);
      if (faceId !== null) {
        this.hoveredFaceId = faceId;
        this.terrainModifier.setHoveredFace?.(faceId);
        // Clear other highlights
        this.state.hoverVertex = null;
        this.highlightSystem.setVertexHighlightPosition(-1, -1);
      } else {
        this.hoveredFaceId = null;
        this.terrainModifier.setHoveredFace?.(null);
      }
    }

    // Handle Vertex Mode Hover
    if (this.topologyMode === 'vertex') {
      if (worldPos && this.terrainModifier?.findNearestVertex) {
        const nearest = this.terrainModifier.findNearestVertex(worldPos.x, worldPos.z);
        if (nearest.dist < 1.5) {
          this.state.hoverVertex = { vx: nearest.vx, vy: nearest.vy };
          this.highlightSystem.setVertexHighlightPosition(nearest.vx, nearest.vy);
        } else {
          this.state.hoverVertex = null;
          this.highlightSystem.setVertexHighlightPosition(-1, -1); // Clear highlight
        }
      } else if (worldPos && this.terrainModifier?.worldToVertex) {
        const vertex = this.terrainModifier.worldToVertex(worldPos.x, worldPos.z);
        this.state.hoverVertex = vertex;
        this.highlightSystem.setVertexHighlightPosition(vertex.vx, vertex.vy);
      }
    }

    const { width: mapWidth, height: mapHeight } = this.getWorldDims();

    if (gridX < 0 || gridX >= mapWidth || gridY < 0 || gridY >= mapHeight) {
      this.state.hoverTile = null;
    } else {
      this.state.hoverTile = { x: gridX, y: gridY };
    }

    if (this.state.hoverTile && this.state.mode === 'paint' && this.topologyMode !== 'face') {
      this.highlightSystem.setHighlightPosition(gridX, gridY);
    } else {
       // When in face mode, we use the specific face highlight, so clear the cell highlight
       this.highlightSystem.setHighlightPosition(-1, -1);
    }
  }

  public handleClick(shiftKey: boolean = false): void {
    if (!this.state.enabled) return;

    // Handle Edge Mode Click (Selection)
    if (this.topologyMode === 'edge') {
        this.handleSelectionClick(shiftKey);
        return;
    }

    // Handle Vertex Mode Click
    if (this.topologyMode === 'vertex') {
        if (this.state.mode === 'sculpt' && this.state.hoverVertex) {
            // Sculpting takes precedence in sculpt mode
            this.handleVertexSculptClick();
        } else {
             // Otherwise (e.g. Paint mode but Vertex topology), treat as selection
            this.handleSelectionClick(shiftKey);
        }
        return;
    }

    if (this.topologyMode === 'face' && this.hoveredFaceId !== null && this.state.mode === 'paint' && isTerrainBrush(this.state.activeTool)) {
      const type = getTerrainTypeFromBrush(this.state.activeTool);
      const result = this.terrainModifier?.setFaceTerrain?.(this.hoveredFaceId, type);
      
      if (result) {
        const action = createTopologyAction({
             type: 'flip', // TODO: Add proper type for terrain change
             edgeId: -1, // Dummy
             beforeState: result.beforeState
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.highlightSystem.refresh();
        this.terrainModifier?.rebuildMesh?.();
      }
      return;
    }

    if (this.state.mode === 'sculpt' && this.state.hoverVertex) {
      this.handleVertexSculptClick();
    } else if (this.state.mode === 'paint' && this.state.hoverTile && this.topologyMode !== 'face') {
      this.handlePaintClick(this.state.hoverTile.x, this.state.hoverTile.y);
    }
  }

  private handleVertexSculptClick(): void {
    if (!this.state.hoverVertex || !this.terrainModifier) return;

    const { vx, vy } = this.state.hoverVertex;
    const tool = this.state.activeTool as SculptTool;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();

    const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];

    const modifications = applySculptTool(
      tool,
      vx,
      vy,
      elevGrid,
      this.state.brushSize,
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

  private handlePaintClick(x: number, y: number): void {
    if (!this.terrainModifier || !isTerrainBrush(this.state.activeTool)) return;

    const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
    const { width: mapWidth, height: mapHeight } = this.getWorldDims();
    const layoutGrid = this.terrainModifier.getLayoutGrid?.() ?? [];

    const modifications = applyPaintBrush(
      x,
      y,
      layoutGrid,
      terrainType,
      this.state.brushSize,
      mapWidth,
      mapHeight
    );

    if (modifications.length > 0) {
      commitTerrainTypeModifications(modifications, layoutGrid);

      const action = createPaintAction(modifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();

      this.applyPaintModifications(modifications);
      this.highlightSystem.refresh();
    }
  }

  public handleDragStart(gridX: number, gridY: number, screenY?: number): void {
    if (!this.state.enabled) return;

    this.state.isDragging = true;
    this.state.dragStartScreenY = screenY ?? null;
    this.state.dragLastScreenY = screenY ?? null;
    this.dragModifications = [];
    this.dragPaintModifications = [];
    this.lastDragTile = null;
    this.lastDragVertex = null;

    if (this.state.mode === 'sculpt' && isSculptTool(this.state.activeTool)) {
      if (this.state.hoverVertex) {
        this.lastDragVertex = { ...this.state.hoverVertex };
      }
    } else if (this.state.mode === 'paint') {
      this.handleDrag(gridX, gridY, screenY);
    }
  }

  public handleDrag(gridX: number, gridY: number, screenY?: number): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    if (this.state.mode === 'sculpt' && this.lastDragVertex) {
      this.handleVertexDrag(screenY);
      return;
    }

    if (this.state.mode === 'paint' && isTerrainBrush(this.state.activeTool) && this.topologyMode !== 'face') {
      this.handlePaintDrag(gridX, gridY);
      return;
    }
  }

  private handleVertexDrag(screenY?: number): void {
    if (!this.lastDragVertex || screenY === undefined || !this.terrainModifier) return;

    if (this.state.dragLastScreenY === null) {
      this.state.dragLastScreenY = screenY;
      return;
    }

    const DRAG_THRESHOLD = 20;
    const delta = this.state.dragLastScreenY - screenY;

    if (Math.abs(delta) >= DRAG_THRESHOLD) {
      const steps = Math.floor(Math.abs(delta) / DRAG_THRESHOLD);
      const direction = delta > 0 ? 1 : -1;
      const tool: SculptTool = direction > 0 ? 'raise' : 'lower';
      const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();
      const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];

      for (let i = 0; i < steps; i++) {
        const mods = applySculptTool(
          tool,
          this.lastDragVertex.vx,
          this.lastDragVertex.vy,
          elevGrid,
          this.state.brushSize,
          this.state.brushStrength,
          vertexWidth,
          vertexHeight
        );

        commitVertexModifications(mods, elevGrid);
        this.dragModifications.push(...mods);
        this.applyVertexModifications(mods);
      }

      this.state.dragLastScreenY = screenY;
      this.highlightSystem.refresh();
    }
  }

  private handlePaintDrag(gridX: number, gridY: number): void {
    if (!this.terrainModifier || !isTerrainBrush(this.state.activeTool)) return;

    const { width: mapWidth, height: mapHeight } = this.getWorldDims();

    if (gridX < 0 || gridX >= mapWidth || gridY < 0 || gridY >= mapHeight) return;

    if (this.lastDragTile && this.lastDragTile.x === gridX && this.lastDragTile.y === gridY) return;

    this.lastDragTile = { x: gridX, y: gridY };

    const terrainType = getTerrainTypeFromBrush(this.state.activeTool);
    const layoutGrid = this.terrainModifier.getLayoutGrid?.() ?? [];

    const modifications = applyPaintBrush(
      gridX,
      gridY,
      layoutGrid,
      terrainType,
      this.state.brushSize,
      mapWidth,
      mapHeight
    );

    if (modifications.length > 0) {
      commitTerrainTypeModifications(modifications, layoutGrid);
      this.dragPaintModifications.push(...modifications);
      this.applyPaintModifications(modifications);
      this.highlightSystem.refresh();
    }
  }

  public handleDragEnd(): void {
    if (!this.state.enabled) return;

    this.state.isDragging = false;

    if (this.dragModifications.length > 0) {
      const action = createElevationAction(this.dragModifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    }

    if (this.dragPaintModifications.length > 0) {
      const action = createPaintAction(this.dragPaintModifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    }

    this.dragModifications = [];
    this.dragPaintModifications = [];
    this.lastDragTile = null;
    this.lastDragVertex = null;
  }

  private applyVertexModifications(modifications: VertexModification[]): void {
    if (!this.terrainModifier?.setVertexElevations) return;

    const changes = modifications.map(m => ({ vx: m.vx, vy: m.vy, z: m.newZ }));
    this.terrainModifier.setVertexElevations(changes);

    if (this.terrainModifier.rebuildMesh) {
      this.terrainModifier.rebuildMesh();
    }
  }

  private applyPaintModifications(modifications: TerrainTypeModification[]): void {
    if (!this.terrainModifier) return;

    if (this.terrainModifier.paintTerrainType) {
      const cells = modifications.map(m => ({ x: m.x, y: m.y }));
      const type = getTerrainType(modifications[0].newType);
      this.terrainModifier.paintTerrainType(cells, type);
    } else {
      for (const mod of modifications) {
        const type = getTerrainType(mod.newType);
        this.terrainModifier.setTerrainTypeAt(mod.x, mod.y, type);
      }
    }
  }

  public undo(): void {
    if (!this.state.enabled || this.undoStack.length === 0) return;

    const action = this.undoStack.pop();
    if (!action) return;

    if (action.type === 'elevation') {
      const revertChanges = action.modifications.map(m => ({ vx: m.vx, vy: m.vy, z: m.oldZ }));
      if (this.terrainModifier?.setVertexElevations) {
        this.terrainModifier.setVertexElevations(revertChanges);
        this.terrainModifier.rebuildMesh?.();
      }
    } else if (action.type === 'paint') {
      for (const mod of action.modifications) {
        this.terrainModifier?.setTerrainTypeAt(mod.x, mod.y, getTerrainType(mod.oldType));
      }
    } else if (action.type === 'position') {
      const changes = action.modifications.map(m => ({
        vx: m.vx,
        vy: m.vy,
        pos: { ...m.oldPos },
      }));
      if (this.terrainModifier?.setVertexPositions) {
        this.terrainModifier.setVertexPositions(changes);
        this.terrainModifier.rebuildMesh?.();
      }
    } else if (action.type === 'topology') {
      this.terrainModifier?.restoreTopologyFromState?.(action.modification.beforeState);
      this.terrainModifier?.rebuildMesh?.();
    }

    this.redoStack.push(action);
    this.notifyUndoRedoChange();
    this.highlightSystem.refresh();
  }

  public redo(): void {
    if (!this.state.enabled || this.redoStack.length === 0) return;

    const action = this.redoStack.pop();
    if (!action) return;

    if (action.type === 'elevation') {
      const changes = action.modifications.map(m => ({ vx: m.vx, vy: m.vy, z: m.newZ }));
      if (this.terrainModifier?.setVertexElevations) {
        this.terrainModifier.setVertexElevations(changes);
        this.terrainModifier.rebuildMesh?.();
      }
    } else if (action.type === 'paint') {
      for (const mod of action.modifications) {
        this.terrainModifier?.setTerrainTypeAt(mod.x, mod.y, getTerrainType(mod.newType));
      }
    } else if (action.type === 'position') {
      const changes = action.modifications.map(m => ({
        vx: m.vx,
        vy: m.vy,
        pos: { ...m.newPos },
      }));
      if (this.terrainModifier?.setVertexPositions) {
        this.terrainModifier.setVertexPositions(changes);
        this.terrainModifier.rebuildMesh?.();
      }
    } else if (action.type === 'topology') {
      const mod = action.modification;
      if (mod.type === 'subdivide' && mod.edgeId !== undefined) {
        this.terrainModifier?.subdivideEdgeAt?.(mod.edgeId, mod.subdivideT ?? 0.5);
      } else if (mod.type === 'delete' && mod.vertexId !== undefined) {
        this.terrainModifier?.deleteTopologyVertex?.(mod.vertexId);
      } else if (mod.type === 'collapse' && mod.edgeId !== undefined) {
        this.terrainModifier?.collapseEdge?.(mod.edgeId);
      }
      this.terrainModifier?.rebuildMesh?.();
    }

    this.undoStack.push(action);
    this.notifyUndoRedoChange();
    this.highlightSystem.refresh();
  }

  private notifyUndoRedoChange(): void {
    this.callbacks.onUndoRedoChange?.(canUndo(this.undoStack), canRedo(this.redoStack));
  }

  public canUndo(): boolean {
    return canUndo(this.undoStack);
  }

  public canRedo(): boolean {
    return canRedo(this.redoStack);
  }

  public exportTerrain(): { layout: number[][]; elevation: number[][] } {
    return {
      layout: this.terrainModifier?.getLayoutGrid?.() ?? [],
      elevation: this.terrainModifier?.getVertexElevationsGrid?.() ?? [],
    };
  }

  public exportToJSON(): string {
    const data = this.exportTerrain();
    return JSON.stringify(data, null, 2);
  }

  public getHoverTile(): { x: number; y: number } | null {
    return this.state.hoverTile;
  }

  public getHoverVertex(): { vx: number; vy: number } | null {
    return this.state.hoverVertex;
  }

  public getHoverInfo(): {
    x: number;
    y: number;
    elevation: number;
    type: TerrainType;
  } | null {
    if (!this.state.hoverTile || !this.terrainModifier) return null;

    const { x, y } = this.state.hoverTile;
    const layoutGrid = this.terrainModifier.getLayoutGrid?.() ?? [];
    const elevGrid = this.terrainModifier.getVertexElevationsGrid?.() ?? [];

    const elevation = elevGrid[y]?.[x] ?? 0;
    const typeCode = layoutGrid[y]?.[x] ?? TERRAIN_CODES.ROUGH;
    const type = getTerrainType(typeCode);

    return { x, y, elevation, type };
  }

  public setSelectMode(enabled: boolean): void {
    this.isSelectMode = enabled;
  }

  public isInSelectMode(): boolean {
    return this.isSelectMode;
  }

  public setSelectionMode(mode: SelectionMode): void {
    this.selectionMode = mode;
  }

  public getSelectionMode(): SelectionMode {
    return this.selectionMode;
  }

  public handleSelectionClick(shiftKey: boolean = false): void {
    if (!this.state.enabled) return;

    if (this.topologyMode === 'face') {
        if (this.hoveredFaceId !== null && this.terrainModifier?.toggleFaceSelection) {
            this.terrainModifier.toggleFaceSelection(this.hoveredFaceId);
            this.callbacks.onSelectionChange?.(this.terrainModifier.getSelectedFaceIds?.()?.size ?? 0);
            this.highlightSystem.refresh();
        }
        return;
    }

    if (this.topologyMode === 'edge') {
        if (this.hoveredEdgeId !== null) {
            if (shiftKey) {
                this.terrainModifier?.toggleEdgeSelection?.(this.hoveredEdgeId);
            } else {
                this.terrainModifier?.selectEdge?.(this.hoveredEdgeId, false);
            }
            this.highlightSystem.refresh();
        } else if (!shiftKey) {
             // Click on nothing with no shift -> clear selection
            this.terrainModifier?.deselectAllEdges?.();
            this.highlightSystem.refresh();
        }
        return;
    }

    if (!this.state.hoverVertex) return;

    const { vx, vy } = this.state.hoverVertex;

    if (shiftKey) {
      toggleVertex(this.state, vx, vy);
    } else {
      selectVertex(this.state, vx, vy, false);
    }

    this.callbacks.onSelectionChange?.(this.state.selectedVertices.size);
    this.highlightSystem.refresh();
  }

  public handleBoxSelectStart(): void {
    if (!this.state.enabled || !this.state.hoverVertex) return;

    this.boxSelectStart = { ...this.state.hoverVertex };
    this.isBoxSelecting = true;
  }

  public handleBoxSelectDrag(): void {
    if (!this.isBoxSelecting || !this.boxSelectStart || !this.state.hoverVertex) return;
    this.highlightSystem.refresh();
  }

  public handleBoxSelectEnd(shiftKey: boolean = false): void {
    if (!this.isBoxSelecting || !this.boxSelectStart || !this.state.hoverVertex) return;

    if (this.topologyMode !== 'vertex') {
        // Box select only supported in vertex mode for now?
        // Or we could implement box select for edges/faces later.
        this.isBoxSelecting = false;
        this.boxSelectStart = null;
        this.highlightSystem.refresh();
        return;
    }

    const { vx: vx1, vy: vy1 } = this.boxSelectStart;
    const { vx: vx2, vy: vy2 } = this.state.hoverVertex;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();

    selectVerticesInBox(
      this.state,
      vx1,
      vy1,
      vx2,
      vy2,
      vertexWidth,
      vertexHeight,
      shiftKey
    );

    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.callbacks.onSelectionChange?.(this.state.selectedVertices.size);
    this.highlightSystem.refresh();
  }

  public handleBrushSelect(shiftKey: boolean = false): void {
    if (!this.state.enabled || !this.state.hoverVertex) return;

    const { vx, vy } = this.state.hoverVertex;
    const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();

    selectVerticesInBrush(
      this.state,
      vx,
      vy,
      this.state.brushSize,
      vertexWidth,
      vertexHeight,
      shiftKey
    );

    this.callbacks.onSelectionChange?.(this.state.selectedVertices.size);
    this.highlightSystem.refresh();
  }

  public selectAllVertices(): void {
    if (this.topologyMode === 'edge') {
      this.terrainModifier?.selectAllEdges?.();
    } else if (this.topologyMode === 'vertex') {
      const { width: vertexWidth, height: vertexHeight } = this.getVertexDims();
      selectAll(this.state, vertexWidth, vertexHeight);
      this.callbacks.onSelectionChange?.(this.state.selectedVertices.size);
    }
    this.highlightSystem.refresh();
  }

  public deselectAllVertices(): void {
    if (this.topologyMode === 'edge') {
      this.terrainModifier?.deselectAllEdges?.();
    } else if (this.topologyMode === 'face') {
      this.clearFaceSelection();
    } else {
      deselectAll(this.state);
      this.callbacks.onSelectionChange?.(this.state.selectedVertices.size);
    }
    this.highlightSystem.refresh();
  }

  public isVertexSelected(vx: number, vy: number): boolean {
    return isVertexSelected(this.state, vx, vy);
  }

  public getSelectedVertices(): Array<{ vx: number; vy: number }> {
    return getSelectedVerticesList(this.state);
  }

  public getSelectedVerticesSet(): Set<string> {
    return this.state.selectedVertices;
  }

  public getSelectionCount(): number {
    return this.state.selectedVertices.size;
  }

  public getBoxSelectBounds(): { vx1: number; vy1: number; vx2: number; vy2: number } | null {
    if (!this.isBoxSelecting || !this.boxSelectStart || !this.state.hoverVertex) return null;

    return {
      vx1: this.boxSelectStart.vx,
      vy1: this.boxSelectStart.vy,
      vx2: this.state.hoverVertex.vx,
      vy2: this.state.hoverVertex.vy,
    };
  }

  public setAxisConstraint(axis: 'x' | 'y' | 'z' | 'xz' | 'all'): void {
    this.axisConstraint = axis;
  }

  public getAxisConstraint(): 'x' | 'y' | 'z' | 'xz' | 'all' {
    return this.axisConstraint;
  }

  public isHoveredElementSelected(): boolean {
    if (this.topologyMode === 'face') {
      return this.hoveredFaceId !== null && this.selectedFaces.has(this.hoveredFaceId);
    }
    if (this.topologyMode === 'edge') {
      if (this.hoveredTopologyVertexId !== null && this.selectedTopologyVertices.has(this.hoveredTopologyVertexId)) {
          return true;
      }
      return this.hoveredEdgeId !== null && (this.terrainModifier?.getSelectedEdgeIds?.()?.has(this.hoveredEdgeId) ?? false);
    }
    // Vertex mode
    if (this.state.hoverVertex) {
        return this.isVertexSelected(this.state.hoverVertex.vx, this.state.hoverVertex.vy);
    }
    return false;
  }

  public handleVertexMoveStart(worldX: number, worldZ: number, screenY: number): void {
    if (!this.state.enabled) return;
    if (!this.terrainModifier?.getVertexPosition) return;

    this.isMovingVertices = true;
    this.moveStartWorldPos = { x: worldX, z: worldZ };
    this.moveStartScreenY = screenY;

    this.moveDragStartPositions.clear();

    let vertices: Array<{vx: number, vy: number}> = [];
    
    // Try to get vertices from active selection (Edge/Face/Vertex)
    if (this.terrainModifier.getSelectedVerticesFromSelection) {
        vertices = this.terrainModifier.getSelectedVerticesFromSelection();
    }
    
    // Fallback for legacy or if method returned empty (and we might have vertex selection?)
    if (vertices.length === 0 && this.state.selectedVertices.size > 0) {
        for (const key of this.state.selectedVertices) {
            const [vx, vy] = key.split(',').map(Number);
            vertices.push({vx, vy});
        }
    }

    if (vertices.length === 0) {
        this.isMovingVertices = false;
        return;
    }

    for (const v of vertices) {
      const pos = this.terrainModifier.getVertexPosition(v.vx, v.vy);
      const key = `${v.vx},${v.vy}`;
      this.moveDragStartPositions.set(key, { ...pos });
    }
  }

  public handleVertexMoveDrag(worldX: number, worldZ: number, screenY: number): void {
    if (!this.isMovingVertices || !this.moveStartWorldPos || this.moveStartScreenY === null) return;
    if (!this.terrainModifier?.setVertexPositions) return;

    const worldDeltaX = worldX - this.moveStartWorldPos.x;
    const worldDeltaZ = worldZ - this.moveStartWorldPos.z;
    const screenDeltaY = this.moveStartScreenY - screenY;
    const yDelta = screenDeltaY * 0.02;

    const changes: Array<{ vx: number; vy: number; pos: Vec3 }> = [];

    for (const [key, startPos] of this.moveDragStartPositions) {
      const [vxStr, vyStr] = key.split(',');
      const vx = parseInt(vxStr);
      const vy = parseInt(vyStr);

      const newPos: Vec3 = { ...startPos };

      switch (this.axisConstraint) {
        case 'x':
          newPos.x = startPos.x + worldDeltaX;
          break;
        case 'y':
          newPos.y = startPos.y + yDelta;
          break;
        case 'z':
          newPos.z = startPos.z + worldDeltaZ;
          break;
        case 'xz':
          newPos.x = startPos.x + worldDeltaX;
          newPos.z = startPos.z + worldDeltaZ;
          break;
        case 'all':
          newPos.x = startPos.x + worldDeltaX;
          newPos.y = startPos.y + yDelta;
          newPos.z = startPos.z + worldDeltaZ;
          break;
      }

      changes.push({ vx, vy, pos: newPos });
    }

    if (changes.length > 0) {
      this.terrainModifier.setVertexPositions(changes);
      this.terrainModifier.rebuildMesh?.();
      this.highlightSystem.refresh();
    }
  }

  public handleVertexMoveEnd(): void {
    if (!this.isMovingVertices) return;
    if (!this.terrainModifier?.getVertexPosition) return;

    const modifications: PositionModification[] = [];

    for (const [key, oldPos] of this.moveDragStartPositions) {
      const [vxStr, vyStr] = key.split(',');
      const vx = parseInt(vxStr);
      const vy = parseInt(vyStr);
      const newPos = this.terrainModifier.getVertexPosition(vx, vy);

      if (oldPos.x !== newPos.x || oldPos.y !== newPos.y || oldPos.z !== newPos.z) {
        modifications.push({
          vx,
          vy,
          oldPos: { ...oldPos },
          newPos: { ...newPos },
        });
      }
    }

    if (modifications.length > 0) {
      const action = createPositionAction(modifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    }

    this.isMovingVertices = false;
    this.moveStartWorldPos = null;
    this.moveStartScreenY = null;
    this.moveDragStartPositions.clear();
  }

  public isMovingSelectedVertices(): boolean {
    return this.isMovingVertices;
  }

  public getSelectedVertexPositions(): Map<string, Vec3> | null {
    if (!this.terrainModifier?.getVertexPosition) return null;

    const positions = new Map<string, Vec3>();
    for (const key of this.state.selectedVertices) {
      const [vxStr, vyStr] = key.split(',');
      const vx = parseInt(vxStr);
      const vy = parseInt(vyStr);
      const pos = this.terrainModifier.getVertexPosition(vx, vy);
      positions.set(key, { ...pos });
    }
    return positions;
  }

  public getSelectionCentroid(): Vec3 | null {
    const positions = this.getSelectedVertexPositions();
    if (!positions || positions.size === 0) return null;

    let sumX = 0, sumY = 0, sumZ = 0;
    for (const pos of positions.values()) {
      sumX += pos.x;
      sumY += pos.y;
      sumZ += pos.z;
    }

    const count = positions.size;
    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
    };
  }

  public setSelectedVerticesPosition(x: number | null, y: number | null, z: number | null): void {
    if (!this.terrainModifier?.setVertexPositions || this.state.selectedVertices.size === 0) return;

    const changes: Array<{ vx: number; vy: number; pos: Vec3 }> = [];

    for (const key of this.state.selectedVertices) {
      const [vxStr, vyStr] = key.split(',');
      const vx = parseInt(vxStr);
      const vy = parseInt(vyStr);
      const currentPos = this.terrainModifier.getVertexPosition!(vx, vy);

      changes.push({
        vx,
        vy,
        pos: {
          x: x ?? currentPos.x,
          y: y ?? currentPos.y,
          z: z ?? currentPos.z,
        },
      });
    }

    if (changes.length > 0) {
      this.terrainModifier.setVertexPositions(changes);
      this.terrainModifier.rebuildMesh?.();
      this.highlightSystem.refresh();
    }
  }

  public moveSelectedVerticesBy(deltaX: number, deltaY: number, deltaZ: number): void {
    if (!this.terrainModifier) return;

    if (this.topologyMode === 'face' && this.selectedFaces.size > 0) {
      this.terrainModifier.moveSelectedFaces?.(deltaX, deltaY, deltaZ);
      this.terrainModifier.rebuildMesh?.();
      this.highlightSystem.refresh();
      return;
    }

    if (!this.terrainModifier.moveVertices || this.state.selectedVertices.size === 0) return;

    const vertices = getSelectedVerticesList(this.state);
    this.terrainModifier.moveVertices(vertices, { x: deltaX, y: deltaY, z: deltaZ });
    this.terrainModifier.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  // ============================================
  // Topology Mode
  // ============================================

  public getTopologyMode(): TopologyMode {
    return this.topologyMode;
  }

  public setTopologyMode(mode: TopologyMode): void {
    if (this.topologyMode === mode) return;
    this.topologyMode = mode;

    this.terrainModifier?.setTopologyMode?.(mode);

    // Clear unrelated highlights
    if (mode !== 'edge') {
        this.hoveredEdgeId = null;
        this.terrainModifier?.setHoveredEdge?.(null);
    }
    if (mode !== 'face') {
        this.hoveredFaceId = null;
        this.terrainModifier?.setHoveredFace?.(null);
    }
    if (mode !== 'vertex') {
        this.state.hoverVertex = null;
        this.highlightSystem.setVertexHighlightPosition(-1, -1);
    }

    if (mode === 'face' || mode === 'edge') {
        this.highlightSystem.setHighlightMode('none');
    } else if (mode === 'vertex') {
        this.highlightSystem.setHighlightMode('vertex');
    } else {
        this.highlightSystem.setHighlightMode(this.state.mode === 'sculpt' ? 'vertex' : 'cell');
    }

    this.callbacks.onTopologyModeChange?.(mode);
    this.highlightSystem.refresh();
  }

  public isTopologyMode(): boolean {
    return this.terrainModifier?.isTopologyMode?.() ?? false;
  }

  private notifySelectionChange(): void {
    let count = 0;
    if (this.topologyMode === 'face') {
      count = this.selectedFaces.size;
    } else if (this.topologyMode === 'edge') {
      const edges = this.terrainModifier?.getSelectedEdgeIds?.();
      count = edges ? edges.size : 0;
    } else {
      count = this.state.selectedVertices.size;
    }
    this.callbacks.onSelectionChange?.(count);
  }
  
  public handleEdgeModeClick(shiftKey: boolean = false): void {
    if (this.topologyMode !== 'edge') return;

    if (this.hoveredTopologyVertexId !== null) {
      if (shiftKey) {
        this.toggleTopologyVertexSelection(this.hoveredTopologyVertexId);
      } else {
        this.selectTopologyVertex(this.hoveredTopologyVertexId, false);
      }
      this.terrainModifier?.selectEdge?.(null);
      this.notifySelectionChange();
      return;
    }

    if (this.hoveredEdgeId !== null) {
      this.clearTopologySelection();
      
      // We need to know if we are toggling or selecting single
      // Current interface selectEdge(id, additive)
      // Line 101: selectEdge?(edgeId: number | null, additive?: boolean): void;
      
      if (shiftKey) {
          this.terrainModifier?.toggleEdgeSelection?.(this.hoveredEdgeId);
      } else {
          this.terrainModifier?.selectEdge?.(this.hoveredEdgeId);
    }
    } else if (!shiftKey) {
      this.terrainModifier?.selectEdge?.(null);
      this.notifySelectionChange();
    }
  }

  public getSelectedEdgeId(): number | null {
    return this.terrainModifier?.getSelectedEdge?.() ?? null;
  }

  public subdivideSelectedEdge(): { newVertexId: number } | null {
    if (this.topologyMode !== 'edge') return null;
    if (!this.terrainModifier?.subdivideSelectedEdge) return null;

    const selectedEdgeId = this.terrainModifier.getSelectedEdge?.();
    if (selectedEdgeId === null || selectedEdgeId === undefined) return null;

    const result = this.terrainModifier.subdivideSelectedEdge();
    if (!result) return null;

    const action = createTopologyAction({
      type: 'subdivide',
      edgeId: selectedEdgeId,
      subdivideT: 0.5,
      beforeState: result.beforeState,
    });
    this.undoStack.push(action);
    this.redoStack = [];
    this.notifyUndoRedoChange();

    this.highlightSystem.refresh();

    return { newVertexId: result.newVertexId };
  }

  public flipSelectedEdge(): void {
    if (this.topologyMode !== 'edge') return;
    if (!this.terrainModifier?.flipSelectedEdge) return;

    const selectedEdgeId = this.terrainModifier.getSelectedEdge?.();
    if (selectedEdgeId === null || selectedEdgeId === undefined) return;

    const result = this.terrainModifier.flipSelectedEdge();
    if (!result) return;

    const action = createTopologyAction({
      type: 'flip',
      edgeId: selectedEdgeId,
      beforeState: result.beforeState,
    });
    this.undoStack.push(action);
    this.redoStack = [];
    this.notifyUndoRedoChange();

    this.highlightSystem.refresh();
  }

  public collapseSelectedEdge(): void {
    if (this.topologyMode !== 'edge') return;
    if (!this.terrainModifier?.collapseEdge) return;

    const selectedEdgeId = this.terrainModifier.getSelectedEdge?.();
    if (selectedEdgeId === null || selectedEdgeId === undefined) return;

    const result = this.terrainModifier.collapseEdge(selectedEdgeId);
    if (!result) return;

    // TODO: Add proper action type for collapse
    // For now we reuse 'delete' or similar if available, or just generic topology change
    const action = createTopologyAction({
       type: 'delete', 
       edgeId: selectedEdgeId,
       beforeState: result.beforeState
    });
    this.undoStack.push(action);
    this.redoStack = [];
    this.notifyUndoRedoChange();

    this.highlightSystem.refresh();
  }

  public handleDeleteSelectedTopologyVertices(): number {
    const selectedEdgeId = this.terrainModifier?.getSelectedEdge?.();
    if (selectedEdgeId !== null && selectedEdgeId !== undefined) {
      const result = this.terrainModifier?.collapseEdge?.(selectedEdgeId);
      if (result) {
        const action = createTopologyAction({
          type: 'collapse',
          edgeId: selectedEdgeId,
          beforeState: result.beforeState,
        });
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.terrainModifier?.rebuildMesh?.();
        this.highlightSystem.refresh();
        return 1;
      }
    }

    if (!this.terrainModifier?.deleteTopologyVertex) return 0;
    if (this.selectedTopologyVertices.size === 0) return 0;

    let deletedCount = 0;

    for (const vertexId of this.selectedTopologyVertices) {
      if (!this.terrainModifier.canDeleteTopologyVertex?.(vertexId)) continue;

      const result = this.terrainModifier.deleteTopologyVertex(vertexId);
      if (!result) continue;

      const action = createTopologyAction({
        type: 'delete',
        vertexId,
        beforeState: result.beforeState,
      });
      this.undoStack.push(action);
      deletedCount++;
    }

    if (deletedCount > 0) {
      this.redoStack = [];
      this.notifyUndoRedoChange();
      this.selectedTopologyVertices.clear();
      this.terrainModifier.rebuildMesh?.();
      this.highlightSystem.refresh();
    }

    return deletedCount;
  }

  public selectTopologyVertex(vertexId: number, additive: boolean = false): void {
    if (!additive) {
      this.selectedTopologyVertices.clear();
    }
    this.selectedTopologyVertices.add(vertexId);
    this.notifySelectionChange();
  }

  public deselectTopologyVertex(vertexId: number): void {
    this.selectedTopologyVertices.delete(vertexId);
    this.notifySelectionChange();
  }

  public toggleTopologyVertexSelection(vertexId: number): void {
    if (this.selectedTopologyVertices.has(vertexId)) {
      this.selectedTopologyVertices.delete(vertexId);
    } else {
      this.selectedTopologyVertices.add(vertexId);
    }
    this.notifySelectionChange();
  }

  public clearTopologySelection(): void {
    this.selectedTopologyVertices.clear();
    this.notifySelectionChange();
  }

  public getSelectedTopologyVertices(): Set<number> {
    return this.selectedTopologyVertices;
  }

  public getHoveredEdgeId(): number | null {
    return this.hoveredEdgeId;
  }

  // ============================================
  // Face Mode (Triangle Selection)
  // ============================================



  public handleFaceModeClick(shiftKey: boolean = false): void {
    if (this.topologyMode !== 'face') return;
    
    if (this.hoveredFaceId !== null) {
        if (shiftKey) {
          this.toggleFaceSelection(this.hoveredFaceId);
        } else {
          this.selectFace(this.hoveredFaceId, false);
        }
    } else if (!shiftKey) {
        this.clearFaceSelection();
    }
    this.notifySelectionChange();
  }

  public selectFace(faceId: number, additive: boolean = false): void {
    if (!additive) {
      this.selectedFaces.clear();
    }
    this.selectedFaces.add(faceId);
    this.terrainModifier?.selectFace?.(faceId, additive);
    this.notifySelectionChange();
  }

  public deselectFace(faceId: number): void {
    this.selectedFaces.delete(faceId);
    this.terrainModifier?.deselectFace?.(faceId);
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

  public getSelectedFaces(): Set<number> {
    return this.selectedFaces;
  }

  public moveSelectedFaces(dx: number, dy: number, dz: number): void {
    if (this.selectedFaces.size === 0) return;
    this.terrainModifier?.moveSelectedFaces?.(dx, dy, dz);
    this.terrainModifier?.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public getHoveredFaceId(): number | null {
    return this.hoveredFaceId;
  }

  public dispose(): void {
    this.highlightSystem.dispose();
  }
}
