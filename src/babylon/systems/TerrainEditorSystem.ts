import { Scene, Vector3 } from "@babylonjs/core";

import {
  EditorTool,
  EditorMode,
  TopologyMode,
  SculptTool,
  EditorState,
  Vec3,
  InteractionMode,
  createInitialEditorState,
  isSculptTool,
  isTerrainBrush,
  getTerrainTypeFromBrush,
  applySculptTool,
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
  setTerrainTypeAt(worldX: number, worldZ: number, type: TerrainType): void;
  setVertexElevationsById?(changes: Array<{ vertexId: number; y: number }>): void;
  setVertexPositionsById?(changes: Array<{ vertexId: number; pos: Vec3 }>): void;
  moveVerticesById?(vertexIds: number[], delta: Vec3): void;
  findNearestVertexId?(worldX: number, worldZ: number): number | null;
  getVertexPositionById?(vertexId: number): Vec3 | null;
  getVertexElevationById?(vertexId: number): number | null;
  getVertexIdsInWorldRadius?(worldX: number, worldZ: number, radius: number): number[];
  getWorldDimensions?(): { width: number; height: number };
  rebuildMesh?(): void;
  paintTerrainType?(faceIds: number[], type: TerrainType): void;
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
  rotateSelectedVertices?(angleX: number, angleY: number, angleZ: number): void;
  stampTemplate?(template: any, centerX: number, centerZ: number, scale?: number): { faceIds: number[]; vertexIds: number[] };
  getSelectedFaceVertexIds?(): Set<number>;
  getSelectedEdgeVertexIds?(): Set<number>;
  collapseEdge?(edgeId: number): void;
  getFacesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  setBrushHoveredFaces?(faceIds: number[]): void;
  getEdgesInBrush?(worldX: number, worldZ: number, radius: number): number[];
  setBrushHoveredEdges?(edgeIds: number[]): void;
  subdivideEdgeAt?(edgeId: number, t?: number): void;
  canDeleteTopologyVertex?(vertexId: number): boolean;
  deleteTopologyVertex?(vertexId: number): void;
  findNearestTopologyVertexAt?(worldX: number, worldZ: number): { vertexId: number; dist: number } | null;
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
  private axisConstraint: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' = 'xz';
  private isMovingVertices: boolean = false;
  private moveStartWorldPos: { x: number; z: number } | null = null;
  private moveStartScreenY: number | null = null;
  private moveDragStartPositions: Map<number, Vec3> = new Map();

  private topologyMode: TopologyMode = 'vertex';
  private hoveredEdgeId: number | null = null;
  private hoveredTopologyVertexId: number | null = null;
  private selectedTopologyVertices: Set<number> = new Set();
  private hoveredFaceId: number | null = null;
  private selectedFaces: Set<number> = new Set();
  private meshResolution: number = 2.0;
  private lastWorldPos: { x: number; z: number } | null = null;
  private activeTemplate: any | null = null;
  private stampScale: number = 1;

  constructor(scene: Scene) {
    this.state = createInitialEditorState();
    this.highlightSystem = new TileHighlightSystem(scene);
  }

  private getWorldDims(): { width: number; height: number } {
    return this.terrainModifier?.getWorldDimensions?.() ?? { width: 0, height: 0 };
  }

  public setTerrainModifier(modifier: TerrainModifier): void {
    this.terrainModifier = modifier;

    const vertexProvider: VertexPositionProvider = {
      getVertexPosition: (vertexId) => modifier.getVertexPositionById?.(vertexId) ?? null,
      getVertexElevation: (vertexId) => modifier.getVertexElevationById?.(vertexId) ?? 0,
      getVertexIdsInWorldRadius: modifier.getVertexIdsInWorldRadius
        ? (worldX, worldZ, radius) => modifier.getVertexIdsInWorldRadius!(worldX, worldZ, radius)
        : undefined,
    };
    this.highlightSystem.setVertexProvider(vertexProvider);

    const selectionProvider: SelectionProvider = {
      getSelectedVertices: () => this.state.selectedVertices,
    };
    this.highlightSystem.setSelectionProvider(selectionProvider);
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
    } else if (mode === 'stamp') {
      this.setTopologyMode('face');
      this.refreshStampPreview();
    }

    if (mode !== 'stamp') {
      this.highlightSystem.clearStampPreview();
    }

    this.callbacks.onModeChange?.(mode);
  }

  public getMode(): EditorMode {
    return this.state.mode;
  }

  public setActiveTemplate(template: any): void {
    this.activeTemplate = template;
    this.refreshStampPreview();
  }

  public setStampScale(scale: number): void {
    this.stampScale = Math.max(0.25, Math.min(6, scale));
    this.refreshStampPreview();
  }

  public getStampScale(): number {
    return this.stampScale;
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
      const vertexId = this.terrainModifier.findNearestVertexId?.(worldPos.x, worldPos.z);
      if (vertexId != null) {
        if (shiftKey) {
          if (this.state.selectedVertices.has(vertexId)) {
            this.state.selectedVertices.delete(vertexId);
          } else {
            this.state.selectedVertices.add(vertexId);
          }
        } else {
          this.state.selectedVertices.clear();
          this.state.selectedVertices.add(vertexId);
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

  public selectVerticesById(vertexIds: number[], additive: boolean = false): void {
    if (!additive) {
      this.state.selectedVertices.clear();
    }
    for (const id of vertexIds) {
      this.state.selectedVertices.add(id);
    }
    this.notifySelectionChange();
    this.highlightSystem.refresh();
  }

  public deselectVertices(): void {
    this.state.selectedVertices.clear();
    this.notifySelectionChange();
    this.highlightSystem.refresh();
  }

  public getSelectedVertexIds(): number[] {
    return Array.from(this.state.selectedVertices);
  }

  private notifySelectionChange(): void {
    const count = this.state.selectedVertices.size + this.selectedTopologyVertices.size + this.selectedFaces.size;
    this.callbacks.onSelectionChange?.(count);
  }

  public selectAllVertices(): void {
    const topology = this.terrainModifier?.getTopology?.();
    if (topology) {
      const ids = Array.from(topology.vertices.keys());
      this.selectVerticesById(ids, false);
    }
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
    this.terrainModifier.moveVerticesById?.(this.getSelectedVertexIds(), delta);
    this.terrainModifier.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public rotateSelectedVertices(ax: number, ay: number, az: number): void {
    this.terrainModifier?.rotateSelectedVertices?.(ax, ay, az);
    this.terrainModifier?.rebuildMesh?.();
    this.highlightSystem.refresh();
  }

  public handleDeleteSelectedTopologyVertices(): void {
    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
        const vertexId = this.state.hoverVertex.vertexId;
        const pos = this.terrainModifier?.getVertexPositionById?.(vertexId);
        const nearest = this.terrainModifier?.findNearestTopologyVertexAt?.(
          pos?.x ?? 0,
          pos?.z ?? 0
        );
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
    let count = 0;
    for (const vertexId of this.state.selectedVertices) {
      const pos = this.terrainModifier?.getVertexPositionById?.(vertexId);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        sumZ += pos.z;
        count++;
      }
    }
    if (count === 0) return null;
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
        const vertexId = this.state.hoverVertex.vertexId;
        const pos = this.terrainModifier?.getVertexPositionById?.(vertexId);
        return {
            x: Math.round(pos?.x ?? 0),
            y: Math.round(pos?.z ?? 0),
            elevation: pos?.y ?? 0,
            type: 'rough'
        };
    }
    if (this.state.hoverTile) {
        const x = this.state.hoverTile.x;
        const y = this.state.hoverTile.y;
        const nearestId = this.terrainModifier?.findNearestVertexId?.(x / this.meshResolution, y / this.meshResolution);
        const elev = nearestId != null ? (this.terrainModifier?.getVertexElevationById?.(nearestId) ?? 0) : 0;
        const res = this.meshResolution || 1;
        const faceId = this.terrainModifier?.findFaceAtPosition?.(x / res, y / res);
        const tri = faceId != null ? this.terrainModifier?.getTopology?.()?.triangles.get(faceId) : null;
        const typeCode = tri?.terrainCode ?? 0;
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
    if (this.state.hoverVertex) return isVertexSelected(this.state, this.state.hoverVertex.vertexId);
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
    for (const vertexId of this.state.selectedVertices) {
      const pos = this.terrainModifier?.getVertexPositionById?.(vertexId);
      if (pos) {
        this.moveDragStartPositions.set(vertexId, { ...pos });
      }
    }
  }

  public handleVertexMoveDrag(worldX: number, worldZ: number, screenY: number): void {
    if (!this.isMovingVertices || !this.moveStartWorldPos || this.moveStartScreenY === null) return;
    const dx = worldX - this.moveStartWorldPos.x;
    const dz = worldZ - this.moveStartWorldPos.z;
    const dy = (this.moveStartScreenY - screenY) * 0.1;

    const changes: Array<{ vertexId: number; pos: Vec3 }> = [];
    for (const vertexId of this.state.selectedVertices) {
      const startPos = this.moveDragStartPositions.get(vertexId);
      if (startPos) {
        const newPos = { ...startPos };
        if (this.axisConstraint.includes('x')) newPos.x += dx;
        if (this.axisConstraint.includes('y')) newPos.y += dy;
        if (this.axisConstraint.includes('z')) newPos.z += dz;
        changes.push({ vertexId, pos: newPos });
      }
    }
    this.terrainModifier?.setVertexPositionsById?.(changes);
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

    if (this.state.mode === 'stamp') {
      if (!this.lastWorldPos) {
        const res = this.meshResolution || 1;
        this.lastWorldPos = { x: _gridX / res, z: _gridY / res };
      }
      this.handleStampClick();
      return;
    }

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

  private handleStampClick(): void {
    if (!this.lastWorldPos || !this.activeTemplate || !this.terrainModifier) return;

    const result = this.terrainModifier.stampTemplate?.(
      this.activeTemplate,
      this.lastWorldPos.x,
      this.lastWorldPos.z,
      this.stampScale
    );

    if (result) {
      this.terrainModifier.rebuildMesh?.();
      this.highlightSystem.refresh();
    }
  }

  private refreshStampPreview(): void {
    if (this.state.mode === 'stamp' && this.activeTemplate) {
      this.highlightSystem.setStampPreview(this.activeTemplate, this.stampScale);
    } else {
      this.highlightSystem.clearStampPreview();
    }
  }

  public handleMouseUp(): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    this.state.isDragging = false;
    this.isMovingVertices = false;
  }

  public handleClick(_gridX: number, _gridY: number): void {
    if (!this.state.enabled) return;
    this.handleMouseDown(_gridX, _gridY);
    this.handleMouseUp();
  }

  private getSculptContext(): { vertexIds: number[]; worldX: number; worldZ: number } | null {
    if (!this.terrainModifier) return null;

    let worldX: number;
    let worldZ: number;

    if (this.topologyMode === 'vertex' && this.state.hoverVertex) {
      const wp = this.terrainModifier.getVertexPositionById?.(this.state.hoverVertex.vertexId);
      worldX = wp?.x ?? 0;
      worldZ = wp?.z ?? 0;
    } else if (this.lastWorldPos) {
      worldX = this.lastWorldPos.x;
      worldZ = this.lastWorldPos.z;
    } else {
      return null;
    }

    const radius = this.getBrushRadius();
    const vertexIds = this.terrainModifier.getVertexIdsInWorldRadius?.(worldX, worldZ, radius) ?? [];

    if (vertexIds.length === 0) return null;

    return { vertexIds, worldX, worldZ };
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
    const topology = this.terrainModifier.getTopology?.();
    if (!topology) return;

    const modifications = applySculptTool(
      tool,
      sculpt.vertexIds,
      topology,
      this.state.brushStrength,
      this.state.selectedVertices
    );

    if (modifications.length > 0) {
      this.terrainModifier.setVertexElevationsById?.(
        modifications.map(m => ({ vertexId: m.vertexId, y: m.newY }))
      );
      this.terrainModifier.rebuildMesh?.();
      this.callbacks.onModification?.(modifications.map(m => ({ x: m.vertexId, y: 0 })));
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
        const worldX = worldPos?.x ?? gridX / res;
        const worldZ = worldPos?.z ?? gridY / res;
        const vertexId = this.terrainModifier?.findNearestVertexId?.(worldX, worldZ);
        if (vertexId != null) {
            this.state.hoverVertex = { vertexId };
            this.highlightSystem.setVertexHighlightPosition(vertexId, worldX, worldZ);
        } else {
            this.state.hoverVertex = null;
            this.highlightSystem.setVertexHighlightPosition(-1);
        }
    } else if (this.topologyMode === 'face' || this.topologyMode === 'edge') {
        this.state.hoverVertex = null;
        if (this.topologyMode === 'face' && worldPos) {
            const faceId = this.terrainModifier?.findFaceAtPosition?.(worldPos.x, worldPos.z) ?? null;
            this.hoveredFaceId = faceId;
            this.terrainModifier?.setHoveredFace?.(faceId);

            if (this.state.mode === 'stamp') {
                this.terrainModifier?.setBrushHoveredFaces?.([]);
            } else if (this.state.interactionMode === 'brush') {
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
