import { Scene } from "@babylonjs/core";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { createTerrainMeshModifier } from "./systems/createTerrainModifier";
import { TerrainMeshSystem } from "./systems/TerrainMeshSystem";
import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { TerrainEditorUI } from "./ui/TerrainEditorUI";
import { TerrainType } from "../core/terrain";
import { EditorTool, TopologyMode, InteractionMode } from "../core/terrain-editor-logic";
import { BUILT_IN_TEMPLATES } from "../data/shape-templates";
import { EntityVisualState } from "./systems/EntityVisualSystem";

export interface TerrainEditorContext {
  getScene(): Scene;
  getCamera(): { position: { clone(): any } };
  screenToWorldPosition(screenX: number, screenY: number): { x: number; z: number } | null;
  setCameraTarget(target: any): void;
  getTerrainSystem(): TerrainSystem;
  getTerrainMeshSystem(): TerrainMeshSystem | null;
  getCourseWidth(): number;
  getCourseHeight(): number;
  getPlayerVisual(): EntityVisualState | null;
  getPlayerGridPosition(): { gridX: number; gridY: number };
  setPlayerVisualEnabled(enabled: boolean): void;
  setEmployeeVisualSystemVisible(visible: boolean): void;
  snapEmployeesToTerrain(): void;
  snapEntityToTerrain(visual: EntityVisualState, gridX: number, gridY: number): void;
  snapAssetsToTerrain(): void;
}

export class TerrainEditorController {
  private terrainEditorSystem: TerrainEditorSystem | null = null;
  private terrainEditorUI: TerrainEditorUI | null = null;
  private editorUITexture: AdvancedDynamicTexture | null = null;
  private terrainEditorPausedGame: boolean = false;
  private ctx: TerrainEditorContext;

  constructor(ctx: TerrainEditorContext) {
    this.ctx = ctx;
  }

  setup(): void {
    const scene = this.ctx.getScene();

    this.terrainEditorSystem = new TerrainEditorSystem(scene);

    const terrainSystem = this.ctx.getTerrainSystem();
    const baseModifier = {
      setElevationAt: (x: number, y: number, elev: number) =>
        terrainSystem.setElevationAt(x, y, elev),
      setTerrainTypeAt: (worldX: number, worldZ: number, type: TerrainType) =>
        terrainSystem.setTerrainTypeAt(worldX, worldZ, type),
    };

    const vts = this.ctx.getTerrainMeshSystem();
    if (vts) {
      this.terrainEditorSystem.setTerrainModifier({
        ...baseModifier,
        ...createTerrainMeshModifier(vts),
      });
      this.terrainEditorSystem.setMeshResolution(vts.getMeshResolution());
    } else {
      this.terrainEditorSystem.setTerrainModifier(baseModifier);
    }

    this.editorUITexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EditorUI",
      true,
      scene
    );
    this.terrainEditorUI = new TerrainEditorUI(this.editorUITexture, {
      onToolSelect: (tool: EditorTool) => this.handleEditorToolSelect(tool),
      onModeChange: (mode) => this.terrainEditorSystem?.setMode(mode),
      onClose: () => this.handleEditorToggle(),
      onBrushSizeChange: (size: number) => this.handleEditorBrushSize(size),
      onBrushStrengthChange: (strength: number) => this.handleEditorBrushStrength(strength),
      onSelectAll: () => this.terrainEditorSystem?.selectAllVertices(),
      onDeselectAll: () => this.terrainEditorSystem?.deselectAllVertices(),
      onAxisChange: (axis) => {
        this.terrainEditorSystem?.setAxisConstraint(axis);
        this.terrainEditorUI?.setActiveAxis(axis);
      },
      onMoveBy: (dx, dy, dz) => {
        this.terrainEditorSystem?.moveSelectedVerticesBy({ x: dx, y: dy, z: dz });
        this.updateVertexPositionDisplay();
      },
      onTopologyModeChange: (mode) => {
        this.terrainEditorSystem?.setTopologyMode(mode);
      },
      onDeleteVertex: () => {
        this.terrainEditorSystem?.handleDeleteSelectedTopologyVertices();
      },
      onSplitEdge: () => {
        this.terrainEditorSystem?.subdivideSelectedEdge();
      },
      onFlipEdge: () => {
        this.terrainEditorSystem?.flipSelectedEdge();
      },
      onCollapseEdge: () => {
        this.terrainEditorSystem?.collapseSelectedEdge();
      },
      onInteractionModeChange: (mode: InteractionMode) => {
        this.terrainEditorSystem?.setInteractionMode(mode);
      },
      onRotateBy: (ax, ay, az) => {
        this.terrainEditorSystem?.rotateSelectedVertices(ax, ay, az);
      },
      onTemplateSelect: (templateName) => {
        const template = BUILT_IN_TEMPLATES.find(t => t.name === templateName);
        if (template) {
          this.terrainEditorSystem?.setActiveTemplate(template);
        }
      },
      onStampSizeChange: (size) => {
        this.terrainEditorSystem?.setStampScale(size);
        this.terrainEditorUI?.setStampSize(this.terrainEditorSystem?.getStampScale() ?? size);
      },
    });

    this.terrainEditorSystem.setCallbacks({
      onEnable: () => {
        this.terrainEditorUI?.show();
        this.terrainEditorUI?.setActiveTool(
          this.terrainEditorSystem!.getTool()
        );
        this.terrainEditorUI?.setActiveMode(
          this.terrainEditorSystem!.getMode()
        );
        this.terrainEditorUI?.setActiveAxis(
          this.terrainEditorSystem!.getAxisConstraint()
        );
        this.terrainEditorUI?.setStampSize(this.terrainEditorSystem!.getStampScale());
        const vts = this.ctx.getTerrainMeshSystem();
        if (vts) {
          if (this.terrainEditorSystem!.getMode() === 'sculpt') {
            vts.setWireframeEnabled(true);
          }
          vts.setAxisIndicatorEnabled(true);
        }

        this.terrainEditorPausedGame = true;
        this.ctx.setPlayerVisualEnabled(false);
        this.ctx.setEmployeeVisualSystemVisible(false);
      },
      onDisable: () => {
        this.terrainEditorUI?.hide();
        const vts = this.ctx.getTerrainMeshSystem();
        if (vts) {
          vts.setWireframeEnabled(false);
          vts.setAxisIndicatorEnabled(false);
        }

        this.terrainEditorPausedGame = false;
        const playerVisual = this.ctx.getPlayerVisual();
        if (playerVisual) {
          this.ctx.setPlayerVisualEnabled(true);
          const pos = this.ctx.getPlayerGridPosition();
          this.ctx.snapEntityToTerrain(playerVisual, pos.gridX, pos.gridY);
          this.ctx.setCameraTarget(playerVisual.container.position);
        }
        this.ctx.setEmployeeVisualSystemVisible(true);
        this.ctx.snapEmployeesToTerrain();
        this.ctx.snapAssetsToTerrain();
      },
      onToolChange: (tool: EditorTool) => {
        this.terrainEditorUI?.setActiveTool(tool);
      },
      onModeChange: (mode) => {
        this.terrainEditorUI?.setActiveMode(mode);
        const vts = this.ctx.getTerrainMeshSystem();
        if (vts) {
          vts.setWireframeEnabled(true);
          vts.setGridLinesEnabled(false);
        }
      },
      onBrushSizeChange: (size: number) => {
        this.terrainEditorUI?.setBrushSize(size);
      },
      onSelectionChange: (count: number) => {
        this.terrainEditorUI?.setSelectionCount(count);
        this.updateVertexPositionDisplay();
      },
      onTopologyModeChange: (mode: TopologyMode) => {
        this.terrainEditorUI?.setActiveTopologyMode(mode);
      },
      onInteractionModeChange: (mode: InteractionMode) => {
        this.terrainEditorUI?.setInteractionMode(mode);
      },
      onModification: () => {
        this.ctx.snapAssetsToTerrain();
      },
    });
  }

  private updateVertexPositionDisplay(): void {
    if (!this.terrainEditorSystem) return;

    const centroid = this.terrainEditorSystem.getSelectionCentroid();
    if (centroid) {
      this.terrainEditorUI?.updateVertexPosition(centroid.x, centroid.y, centroid.z);
    } else {
      this.terrainEditorUI?.clearVertexPosition();
    }
  }

  handleEditorToggle(): void {
    this.terrainEditorSystem?.toggle();
  }

  handleEditorToolSelect(tool: EditorTool): void {
    this.terrainEditorSystem?.setTool(tool);
    this.updateEditorCursor();
  }

  handleEditorToolNumber(_toolNumber: number): void {
  }

  handleEditorBrushSelect(brush: string): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    if (brush.startsWith("terrain_")) {
      this.terrainEditorSystem.setTool(brush as EditorTool);
      this.updateEditorCursor();
    }
  }

  updateEditorCursor(): void {
    if (!this.terrainEditorSystem?.isEnabled()) {
      const canvas = this.ctx.getScene().getEngine().getRenderingCanvas();
      if (canvas) canvas.style.cursor = "default";
      return;
    }

    const mode = this.terrainEditorSystem.getMode();
    const tool = this.terrainEditorSystem.getActiveTool();
    const canvas = this.ctx.getScene().getEngine().getRenderingCanvas();
    if (!canvas) return;

    if (mode === 'paint') {
      canvas.style.cursor = "crosshair";
    } else if (tool === 'raise' || tool === 'lower') {
      canvas.style.cursor = "ns-resize";
    } else if (tool === 'smooth') {
        canvas.style.cursor = "wait";
    } else {
      canvas.style.cursor = "move";
    }
  }

  handleEditorBrushSize(size: number): void {
    if (!this.terrainEditorSystem) return;
    this.terrainEditorSystem.setBrushSize(size);
    this.terrainEditorUI?.setBrushSize(this.terrainEditorSystem.getBrushSize());
  }

  handleEditorBrushSizeDelta(delta: number): void {
    if (!this.terrainEditorSystem) return;
    this.terrainEditorSystem.changeBrushSize(delta);
    this.terrainEditorUI?.setBrushSize(this.terrainEditorSystem.getBrushSize());
  }

  handleEditorBrushStrength(strength: number): void {
    if (!this.terrainEditorSystem) return;
    this.terrainEditorSystem.setBrushStrength(strength);
    this.terrainEditorUI?.setBrushStrength(this.terrainEditorSystem.getBrushStrength());
  }

  handleEditorBrushStrengthDelta(delta: number): void {
    if (!this.terrainEditorSystem) return;
    const current = this.terrainEditorSystem.getBrushStrength();
    this.handleEditorBrushStrength(current + delta);
  }

  handleMouseMove(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const result = this.screenToGridAndWorld(screenX, screenY);
    if (result) {
      const worldPos = result.worldPos ? new Vector3(result.worldPos.x, 0, result.worldPos.z) : undefined;
      this.terrainEditorSystem.handleMouseMove(result.gridX, result.gridY, worldPos);

      const hoverInfo = this.terrainEditorSystem.getHoverInfo();
      if (hoverInfo) {
        this.terrainEditorUI?.updateCoordinates(
          hoverInfo.x,
          hoverInfo.y,
          hoverInfo.elevation,
          hoverInfo.type
        );
      } else {
        this.terrainEditorUI?.clearCoordinates();
      }
    }
  }

  screenToGridAndWorld(
    screenX: number,
    screenY: number
  ): { gridX: number; gridY: number; worldPos?: { x: number; z: number }; uv?: Vector2 | null } | null {
    const scene = this.ctx.getScene();
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    const pickResult = scene.pick(canvasX, canvasY, (mesh) => {
      return mesh.name.startsWith("terrain") || mesh.name.startsWith("tile_") || mesh.name === "terrainMesh";
    });

    if (pickResult?.hit && pickResult.pickedPoint) {
      const worldX = pickResult.pickedPoint.x;
      const worldZ = pickResult.pickedPoint.z;
      const terrainSystem = this.ctx.getTerrainSystem();
      const res = terrainSystem.getResolution?.() ?? 1;
      const gridX = Math.floor(worldX * res);
      const gridY = Math.floor(worldZ * res);

      const courseWidth = this.ctx.getCourseWidth();
      const courseHeight = this.ctx.getCourseHeight();
      const isInBounds = gridX >= 0 && gridX < courseWidth * res && gridY >= 0 && gridY < courseHeight * res;

      if (!isInBounds && !this.terrainEditorSystem?.isEnabled()) {
        return null;
      }

      return { gridX, gridY, worldPos: { x: worldX, z: worldZ }, uv: pickResult.getTextureCoordinates() };
    }

    const camera = this.ctx.getCamera();
    const ray = scene.createPickingRay(canvasX, canvasY, null, camera as any);

    if (ray.direction.y === 0) return null;

    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const groundX = ray.origin.x + ray.direction.x * t;
    const groundZ = ray.origin.z + ray.direction.z * t;

    const gridX = Math.floor(groundX);
    const gridY = Math.floor(groundZ);

    const courseWidth = this.ctx.getCourseWidth();
    const courseHeight = this.ctx.getCourseHeight();
    const isInBounds = gridX >= 0 && gridX < courseWidth && gridY >= 0 && gridY < courseHeight;

    if (!isInBounds && !this.terrainEditorSystem?.isEnabled()) {
      return null;
    }

    return { gridX, gridY, worldPos: { x: groundX, z: groundZ }, uv: null };
  }

  handleDragStart(screenX: number, screenY: number, shiftKey?: boolean): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    this.handleMouseMove(screenX, screenY);

    const result = this.screenToGridAndWorld(screenX, screenY);
    if (!result) return;

    if (this.terrainEditorSystem.getMode() === 'stamp') {
      this.terrainEditorSystem.handleDragStart(result.gridX, result.gridY);
      return;
    }

    if (this.terrainEditorSystem.getInteractionMode() === 'select') {
      if (this.terrainEditorSystem.isHoveredElementSelected()) {
        if (result.worldPos) {
          this.terrainEditorSystem.handleVertexMoveStart(result.worldPos.x, result.worldPos.z, screenY);
        }
      } else if (result.worldPos) {
        this.terrainEditorSystem.handleSelectClick(result.worldPos, shiftKey ?? false);
      }
      return;
    }

    if (this.terrainEditorSystem.isHoveredElementSelected() && !this.terrainEditorSystem.isSculptBrushActive()) {
      if (result.worldPos) {
        this.terrainEditorSystem.handleVertexMoveStart(result.worldPos.x, result.worldPos.z, screenY);
      }
      return;
    }

    this.terrainEditorSystem.handleDragStart(result.gridX, result.gridY);
  }

  handleDrag(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    if (this.terrainEditorSystem.isMovingSelectedVertices()) {
      const worldPos = this.ctx.screenToWorldPosition(screenX, screenY);
      if (worldPos) {
        this.terrainEditorSystem.handleVertexMoveDrag(worldPos.x, worldPos.z, screenY);
      }
      return;
    }

    if (this.terrainEditorSystem.getInteractionMode() === 'select') return;

    const result = this.screenToGridAndWorld(screenX, screenY);
    if (!result) return;

    this.terrainEditorSystem.handleDrag(result.gridX, result.gridY);
  }

  handleDragEnd(): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    if (this.terrainEditorSystem.isMovingSelectedVertices()) {
      this.terrainEditorSystem.handleVertexMoveEnd();
      this.updateVertexPositionDisplay();
      return;
    }

    this.terrainEditorSystem.handleDragEnd();
  }

  setEnabled(enabled: boolean): void {
    if (!this.terrainEditorSystem) return;
    if (enabled) {
      this.terrainEditorSystem.enable();
    } else {
      this.terrainEditorSystem.disable();
    }
  }

  isEnabled(): boolean {
    return this.terrainEditorSystem?.isEnabled() ?? false;
  }

  isPausedByEditor(): boolean {
    return this.terrainEditorPausedGame;
  }

  getSystem(): TerrainEditorSystem | null {
    return this.terrainEditorSystem;
  }

  dispose(): void {
    this.editorUITexture?.dispose();
    this.editorUITexture = null;
    this.terrainEditorUI = null;
    this.terrainEditorSystem = null;
  }
}
