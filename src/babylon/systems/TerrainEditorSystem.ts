import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import {
  EditorTool,
  EditorState,
  EditorAction,
  TileModification,
  createInitialEditorState,
  applyTool,
  commitModifications,
  createEditorAction,
  canUndo,
  canRedo,
  undo as undoAction,
  redo as redoAction,
  getAffectedTiles,
  cloneGrid,
} from "../../core/terrain-editor-logic";

import {
  TerrainType,
  getTerrainType,
  TERRAIN_CODES,
} from "../../core/terrain";
import { TILE_SIZE } from "../engine/BabylonEngine";
import {
  TileHighlightSystem,
  CornerHeightsProvider,
} from "./TileHighlightSystem";

export interface TerrainEditorCallbacks {
  onEnable?: () => void;
  onDisable?: () => void;
  onToolChange?: (tool: EditorTool) => void;
  onBrushSizeChange?: (size: number) => void;
  onModification?: (tiles: Array<{ x: number; y: number }>) => void;
  onUndoRedoChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export interface TerrainModifier {
  setElevationAt(x: number, y: number, elevation: number): void;
  setTerrainTypeAt(x: number, y: number, type: TerrainType): void;
  rebuildTileAndNeighbors(x: number, y: number): void;
}

export class TerrainEditorSystem {
  private terrainModifier: TerrainModifier | null = null;
  private highlightSystem: TileHighlightSystem;
  private callbacks: TerrainEditorCallbacks = {};

  private state: EditorState;
  private undoStack: EditorAction[] = [];
  private redoStack: EditorAction[] = [];

  private workingLayout: number[][] = [];
  private workingElevation: number[][] = [];

  private mapWidth: number = 0;
  private mapHeight: number = 0;

  private dragModifications: TileModification[] = [];
  private lastDragTile: { x: number; y: number } | null = null;

  constructor(scene: Scene, cornerProvider: CornerHeightsProvider) {
    this.state = createInitialEditorState();
    this.highlightSystem = new TileHighlightSystem(scene, cornerProvider);
  }

  public setTerrainModifier(modifier: TerrainModifier): void {
    this.terrainModifier = modifier;
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

  public setTool(tool: EditorTool): void {
    if (this.state.activeTool === tool) return;
    this.state.activeTool = tool;
    this.callbacks.onToolChange?.(tool);
  }

  public getTool(): EditorTool {
    return this.state.activeTool;
  }

  public setBrushSize(size: number): void {
    const newSize = Math.max(1, Math.min(3, size));
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

  public initialize(layout: number[][], elevation: number[][]): void {
    this.mapHeight = layout.length;
    this.mapWidth = layout[0]?.length ?? 0;
    this.workingLayout = cloneGrid(layout);
    this.workingElevation = cloneGrid(elevation);
  }

  public handleMouseMove(
    gridX: number,
    gridY: number,
    worldPos?: Vector3
  ): void {
    if (!this.state.enabled) return;

    if (
      gridX < 0 ||
      gridX >= this.mapWidth ||
      gridY < 0 ||
      gridY >= this.mapHeight
    ) {
      this.highlightSystem.clearHighlight();
      this.state.hoverTile = null;
      this.state.hoverCorner = null;
      return;
    }

    this.state.hoverTile = { x: gridX, y: gridY };

    let closestCorner: "nw" | "ne" | "se" | "sw" | null = null;
    if (worldPos) {
      const localX = worldPos.x - gridX * TILE_SIZE;
      const localZ = worldPos.z - gridY * TILE_SIZE;

      const CORNER_THRESHOLD = 0.25 * TILE_SIZE;

      if (localX < CORNER_THRESHOLD && localZ < CORNER_THRESHOLD) {
        closestCorner = "nw";
      } else if (localX > TILE_SIZE - CORNER_THRESHOLD && localZ < CORNER_THRESHOLD) {
        closestCorner = "ne";
      } else if (localX > TILE_SIZE - CORNER_THRESHOLD && localZ > TILE_SIZE - CORNER_THRESHOLD) {
        closestCorner = "se";
      } else if (localX < CORNER_THRESHOLD && localZ > TILE_SIZE - CORNER_THRESHOLD) {
        closestCorner = "sw";
      }
    }

    this.state.hoverCorner = closestCorner;
    if (closestCorner) {
      this.highlightSystem.setHighlightCorner(gridX, gridY, closestCorner);
    } else {
      this.highlightSystem.setHighlightPosition(gridX, gridY);
    }
  }

  public handleClick(): void {
    if (!this.state.enabled) return;

    // Single click support for corners
    if (this.state.hoverCorner && this.state.hoverTile) {
      const { x, y } = this.state.hoverTile;
      const tiles = this.getTilesForCorner(x, y, this.state.hoverCorner);
      const direction = this.state.activeTool === "lower" ? -1 : 1;
      const tool = direction > 0 ? "raise" : "lower";

      const modifications: TileModification[] = [];
      for (const tile of tiles) {
        const mods = applyTool(
          tool,
          tile.x,
          tile.y,
          this.workingElevation,
          this.workingLayout,
          1
        );
        modifications.push(...mods);
        commitModifications(mods, this.workingElevation, this.workingLayout);
      }

      if (modifications.length > 0) {
        const action = createEditorAction(modifications);
        this.undoStack.push(action);
        this.redoStack = [];
        this.notifyUndoRedoChange();
        this.applyModificationsToTerrain(modifications);
        this.highlightSystem.refresh();
      }
    }
  }

  public handleDragStart(gridX: number, gridY: number, screenY?: number): void {
    if (!this.state.enabled) return;

    this.state.isDragging = true;
    this.state.dragCorner = this.state.hoverCorner;
    this.state.dragStartScreenY = screenY ?? null;
    this.state.dragLastScreenY = screenY ?? null;
    this.dragModifications = [];
    this.lastDragTile = null;

    // For elevation tools, we want to lock the tile we started on
    if (
      this.state.activeTool === "raise" ||
      this.state.activeTool === "lower"
    ) {
      this.lastDragTile = { x: gridX, y: gridY };
    } else {
      this.handleDrag(gridX, gridY, screenY);
    }
  }

  public handleDrag(gridX: number, gridY: number, screenY?: number): void {
    if (!this.state.enabled || !this.state.isDragging) return;

    // Vertical Drag Logic for Elevation Tools
    if (
      (this.state.activeTool === "raise" ||
        this.state.activeTool === "lower") &&
      screenY !== undefined &&
      this.lastDragTile
    ) {
      if (this.state.dragLastScreenY === null) {
        this.state.dragLastScreenY = screenY;
        return;
      }

      const DRAG_THRESHOLD = 20; // Pixels per elevation step
      const delta = this.state.dragLastScreenY - screenY; // Positive = Dragging Up

      if (Math.abs(delta) >= DRAG_THRESHOLD) {
        const steps = Math.floor(Math.abs(delta) / DRAG_THRESHOLD);
        const direction = delta > 0 ? 1 : -1;

        const targetX = this.lastDragTile.x;
        const targetY = this.lastDragTile.y;

        const modifications: TileModification[] = [];
        const effectiveTool = direction > 0 ? "raise" : "lower";

        for (let i = 0; i < steps; i++) {
          let mods: TileModification[] = [];
          if (this.state.dragCorner) {
            // Apply to the 4 tiles sharing this vertex
            const tiles = this.getTilesForCorner(
              targetX,
              targetY,
              this.state.dragCorner
            );
            for (const tile of tiles) {
              const m = applyTool(
                effectiveTool,
                tile.x,
                tile.y,
                this.workingElevation,
                this.workingLayout,
                1 // Brush size 1 for corner vertex
              );
              mods.push(...m);
            }
          } else {
            mods = applyTool(
              effectiveTool,
              targetX,
              targetY,
              this.workingElevation,
              this.workingLayout,
              this.state.brushSize
            );
          }
          modifications.push(...mods);
          commitModifications(mods, this.workingElevation, this.workingLayout);
        }

        this.state.dragLastScreenY = screenY;

        if (modifications.length > 0) {
          this.dragModifications.push(...modifications);
          this.applyModificationsToTerrain(modifications);
          const affectedTiles = getAffectedTiles(modifications);
          this.callbacks.onModification?.(affectedTiles);
          this.highlightSystem.refresh();
        }
      }
      return;
    }

    // Standard Drag Logic (Paint, Smooth, Flatten)
    if (
      gridX < 0 ||
      gridX >= this.mapWidth ||
      gridY < 0 ||
      gridY >= this.mapHeight
    )
      return;

    if (
      this.lastDragTile &&
      this.lastDragTile.x === gridX &&
      this.lastDragTile.y === gridY
    ) {
      return;
    }
    this.lastDragTile = { x: gridX, y: gridY };

    const modifications = applyTool(
      this.state.activeTool,
      gridX,
      gridY,
      this.workingElevation,
      this.workingLayout,
      this.state.brushSize
    );

    if (modifications.length > 0) {
      commitModifications(
        modifications,
        this.workingElevation,
        this.workingLayout
      );
      this.dragModifications.push(...modifications);

      const affectedTiles = getAffectedTiles(modifications);
      this.applyModificationsToTerrain(modifications);
      this.callbacks.onModification?.(affectedTiles);
      this.highlightSystem.refresh();
    }
  }

  private getTilesForCorner(
    x: number,
    y: number,
    corner: "nw" | "ne" | "se" | "sw"
  ): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [{ x, y }];
    switch (corner) {
      case "nw":
        tiles.push(
          { x: x, y: y - 1 },
          { x: x - 1, y: y },
          { x: x - 1, y: y - 1 }
        );
        break;
      case "ne":
        tiles.push(
          { x: x, y: y - 1 },
          { x: x + 1, y: y },
          { x: x + 1, y: y - 1 }
        );
        break;
      case "se":
        tiles.push(
          { x: x, y: y + 1 },
          { x: x + 1, y: y },
          { x: x + 1, y: y + 1 }
        );
        break;
      case "sw":
        tiles.push(
          { x: x, y: y + 1 },
          { x: x - 1, y: y },
          { x: x - 1, y: y + 1 }
        );
        break;
    }
    return tiles.filter(
      (t) => t.x >= 0 && t.x < this.mapWidth && t.y >= 0 && t.y < this.mapHeight
    );
  }

  public handleDragEnd(): void {
    if (!this.state.enabled) return;

    this.state.isDragging = false;

    if (this.dragModifications.length > 0) {
      const action = createEditorAction(this.dragModifications);
      this.undoStack.push(action);
      this.redoStack = [];
      this.notifyUndoRedoChange();
    }

    this.dragModifications = [];
    this.lastDragTile = null;
  }

  private applyModificationsToTerrain(
    modifications: TileModification[],
    revert: boolean = false
  ): void {
    if (!this.terrainModifier) return;

    for (const mod of modifications) {
      const elev = revert ? mod.oldElevation : mod.newElevation;
      const type = revert ? mod.oldType : mod.newType;
      const prevElev = revert ? mod.newElevation : mod.oldElevation;
      const prevType = revert ? mod.newType : mod.oldType;

      if (elev !== prevElev) {
        this.terrainModifier.setElevationAt(mod.x, mod.y, elev);
      }
      if (type !== prevType) {
        this.terrainModifier.setTerrainTypeAt(mod.x, mod.y, getTerrainType(type));
      }
    }

    const affectedTiles = getAffectedTiles(modifications);
    for (const tile of affectedTiles) {
      this.terrainModifier.rebuildTileAndNeighbors(tile.x, tile.y);
    }
  }

  public undo(): void {
    if (!this.state.enabled || !canUndo(this.undoStack)) return;

    const action = undoAction(
      this.undoStack,
      this.redoStack,
      this.workingElevation,
      this.workingLayout
    );
    if (action) {
      const affectedTiles = getAffectedTiles(action.modifications);
      this.applyModificationsToTerrain(action.modifications, true);
      this.notifyUndoRedoChange();
      this.callbacks.onModification?.(affectedTiles);
    }
  }

  public redo(): void {
    if (!this.state.enabled || !canRedo(this.redoStack)) return;

    const action = redoAction(
      this.undoStack,
      this.redoStack,
      this.workingElevation,
      this.workingLayout
    );
    if (action) {
      const affectedTiles = getAffectedTiles(action.modifications);
      this.applyModificationsToTerrain(action.modifications);
      this.notifyUndoRedoChange();
      this.callbacks.onModification?.(affectedTiles);
    }
  }

  private notifyUndoRedoChange(): void {
    this.callbacks.onUndoRedoChange?.(
      canUndo(this.undoStack),
      canRedo(this.redoStack)
    );
  }

  public canUndo(): boolean {
    return canUndo(this.undoStack);
  }

  public canRedo(): boolean {
    return canRedo(this.redoStack);
  }

  public exportTerrain(): { layout: number[][]; elevation: number[][] } {
    return {
      layout: cloneGrid(this.workingLayout),
      elevation: cloneGrid(this.workingElevation),
    };
  }

  public exportToJSON(): string {
    const data = this.exportTerrain();
    return JSON.stringify(data, null, 2);
  }

  public getHoverTile(): { x: number; y: number } | null {
    return this.state.hoverTile;
  }

  public getHoverInfo(): {
    x: number;
    y: number;
    elevation: number;
    type: TerrainType;
  } | null {
    if (!this.state.hoverTile) return null;

    const { x, y } = this.state.hoverTile;
    const elevation = this.workingElevation[y]?.[x] ?? 0;
    const typeCode = this.workingLayout[y]?.[x] ?? TERRAIN_CODES.ROUGH;
    const type = getTerrainType(typeCode);

    return { x, y, elevation, type };
  }

  public dispose(): void {
    this.highlightSystem.dispose();
  }
}
