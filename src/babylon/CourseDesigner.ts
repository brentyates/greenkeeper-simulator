import { BabylonEngine, gridTo3D } from './engine/BabylonEngine';
import { InputManager } from './engine/InputManager';
import { VectorTerrainSystem } from './systems/VectorTerrainSystem';
import { TerrainEditorSystem } from './systems/TerrainEditorSystem';
import { createVectorTerrainModifier } from './systems/createTerrainModifier';
import { AssetPlacementSystem } from './systems/AssetPlacementSystem';
import { TerrainEditorUI } from './ui/TerrainEditorUI';
import { AssetBrowserUI } from './ui/AssetBrowserUI';
import { OverlayPanelUI } from './ui/OverlayPanelUI';
import { createFileInput, loadImageAsTexture } from './utils/imageOverlayLoader';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';

import { CourseData, getCourseById } from '../data/courseData';
import { EditorTool } from '../core/terrain-editor-logic';
import {
  CustomCourseData,
  PlacedAsset,
  createBlankCourse,
  saveCustomCourse,
  customCourseToCourseData,
} from '../data/customCourseData';

export interface CourseDesignerOptions {
  blank?: { width: number; height: number; name: string };
  editCourse?: CustomCourseData;
  templateCourseId?: string;
  onExit?: () => void;
}

type DesignerMode = 'terrain' | 'asset';

export class CourseDesigner {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private vectorTerrainSystem: VectorTerrainSystem;
  private terrainEditorSystem: TerrainEditorSystem;
  private terrainEditorUI: TerrainEditorUI | null = null;
  private assetPlacementSystem: AssetPlacementSystem;
  private assetBrowserUI: AssetBrowserUI | null = null;
  private uiTexture: AdvancedDynamicTexture | null = null;

  private courseData: CustomCourseData;
  private currentCourseData: CourseData;
  private mode: DesignerMode = 'terrain';
  private options: CourseDesignerOptions;

  private terrainModeBtn: Rectangle | null = null;
  private assetModeBtn: Rectangle | null = null;
  private overlayModeBtn: Rectangle | null = null;
  private courseNameText: TextBlock | null = null;
  private overlayPanelUI: OverlayPanelUI | null = null;
  private overlayFileInput: HTMLInputElement | null = null;
  private overlayLoaded = false;
  private overlayVisible = true;
  private overlayOpacity = 50;
  private overlayScale = 1.0;
  private overlayOffsetX = 0;
  private overlayOffsetZ = 0;
  private overlayFlipX = false;
  private overlayFlipY = false;
  private overlayRotation = 0;

  constructor(canvasId: string, options: CourseDesignerOptions) {
    this.options = options;

    if (options.editCourse) {
      this.courseData = { ...options.editCourse };
    } else if (options.blank) {
      this.courseData = createBlankCourse(options.blank.width, options.blank.height, options.blank.name);
      if (options.templateCourseId) {
        this.applyTemplate(options.templateCourseId);
      }
    } else {
      this.courseData = createBlankCourse(50, 50, 'Untitled Course');
    }

    this.currentCourseData = customCourseToCourseData(this.courseData);
    this.babylonEngine = new BabylonEngine(canvasId, this.courseData.width, this.courseData.height);

    const scene = this.babylonEngine.getScene();
    this.inputManager = new InputManager(scene);

    this.vectorTerrainSystem = new VectorTerrainSystem(scene, this.currentCourseData, {
      meshResolution: 2,
      enableGridLines: false,
    });

    this.vectorTerrainSystem.build(this.currentCourseData);

    this.terrainEditorSystem = this.setupTerrainEditor();
    this.assetPlacementSystem = new AssetPlacementSystem(scene, {
      onSelect: (asset) => this.handleAssetSelect(asset),
      onPlace: () => {},
      getTerrainElevation: (wx, wz) => this.getTerrainElevation(wx, wz),
    });

    this.setupUI();
    this.setupInput();

    this.terrainEditorSystem.enable();
    this.vectorTerrainSystem.setWireframeEnabled(true);
    this.vectorTerrainSystem.setAxisIndicatorEnabled(true);

    if (options.editCourse?.placedAssets?.length) {
      this.assetPlacementSystem.loadPlacedAssets(options.editCourse.placedAssets);
    }

    this.babylonEngine.setTargetOrthoSize(35);
    this.setupRenderLoop();
    this.babylonEngine.start();
  }

  private applyTemplate(courseId: string): void {
    const templateCourse = getCourseById(courseId);
    if (!templateCourse) return;

    const w = Math.min(this.courseData.width, templateCourse.width);
    const h = Math.min(this.courseData.height, templateCourse.height);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        this.courseData.layout[y][x] = templateCourse.layout[y][x];
      }
    }

    if (templateCourse.vertexElevations) {
      const meshRes = 2;
      const tvw = templateCourse.width * meshRes + 1;
      const tvh = templateCourse.height * meshRes + 1;
      const cvw = this.courseData.width * meshRes + 1;
      const cvh = this.courseData.height * meshRes + 1;
      const mw = Math.min(cvw, tvw);
      const mh = Math.min(cvh, tvh);

      for (let vy = 0; vy < mh; vy++) {
        for (let vx = 0; vx < mw; vx++) {
          this.courseData.vertexElevations[vy][vx] = templateCourse.vertexElevations[vy][vx];
        }
      }
    }

    if (templateCourse.obstacles) {
      this.courseData.obstacles = templateCourse.obstacles.filter(
        o => o.x < this.courseData.width && o.y < this.courseData.height
      );
    }
  }

  private setupTerrainEditor(): TerrainEditorSystem {
    const scene = this.babylonEngine.getScene();

    const cornerProvider = {
      getCornerHeights: (_gridX: number, _gridY: number) => ({ nw: 0, ne: 0, se: 0, sw: 0 }),
      getElevationAt: (_gridX: number, _gridY: number) => 0,
      gridTo3D: (gridX: number, gridY: number, elev: number) => gridTo3D(gridX, gridY, elev),
    };

    const editor = new TerrainEditorSystem(scene, cornerProvider);

    const vts = this.vectorTerrainSystem;
    editor.setTerrainModifier({
      setElevationAt: () => {},
      setTerrainTypeAt: () => {},
      rebuildTileAndNeighbors: () => {},
      ...createVectorTerrainModifier(vts),
    });
    editor.setMeshResolution(vts.getMeshResolution());

    return editor;
  }

  private setupUI(): void {
    const scene = this.babylonEngine.getScene();

    this.uiTexture = AdvancedDynamicTexture.CreateFullscreenUI('DesignerUI', true, scene);

    const rootGrid = new Grid('designerRootGrid');
    rootGrid.width = '100%';
    rootGrid.height = '100%';
    rootGrid.addRowDefinition(40, true);
    rootGrid.addRowDefinition(1);
    this.uiTexture.addControl(rootGrid);

    const contentContainer = new Rectangle('contentContainer');
    contentContainer.width = '100%';
    contentContainer.height = '100%';
    contentContainer.thickness = 0;
    contentContainer.background = 'transparent';
    rootGrid.addControl(contentContainer, 1, 0);

    this.terrainEditorUI = new TerrainEditorUI(contentContainer, {
      onToolSelect: (tool: EditorTool) => this.terrainEditorSystem.setTool(tool),
      onModeChange: (mode) => this.terrainEditorSystem.setMode(mode),
      onClose: () => this.setDesignerMode('asset'),
      onExport: () => this.save(),
      onUndo: () => this.terrainEditorSystem.undo(),
      onRedo: () => this.terrainEditorSystem.redo(),
      onBrushSizeChange: (delta) => {
        this.terrainEditorSystem.changeBrushSize(delta);
        this.terrainEditorUI?.setBrushSize(this.terrainEditorSystem.getBrushSize());
      },
      onBrushStrengthChange: (strength) => {
        this.terrainEditorSystem.setBrushStrength(strength);
        this.terrainEditorUI?.setBrushStrength(this.terrainEditorSystem.getBrushStrength());
      },
      onSelectAll: () => this.terrainEditorSystem.selectAllVertices(),
      onDeselectAll: () => this.terrainEditorSystem.deselectAllVertices(),
      onAxisChange: (axis) => {
        this.terrainEditorSystem.setAxisConstraint(axis);
        this.terrainEditorUI?.setActiveAxis(axis);
      },
      onMoveBy: (dx, dy, dz) => {
        this.terrainEditorSystem.moveSelectedVerticesBy({ x: dx, y: dy, z: dz });
        this.updateVertexPositionDisplay();
      },
      onTopologyModeChange: (mode) => this.terrainEditorSystem.setTopologyMode(mode),
      onDeleteVertex: () => this.terrainEditorSystem.handleDeleteSelectedTopologyVertices(),
      onSplitEdge: () => this.terrainEditorSystem.subdivideSelectedEdge(),
      onFlipEdge: () => this.terrainEditorSystem.flipSelectedEdge(),
      onCollapseEdge: () => this.terrainEditorSystem.collapseSelectedEdge(),
    });

    this.terrainEditorSystem.setCallbacks({
      onEnable: () => {
        if (this.mode === 'terrain') {
          this.terrainEditorUI?.show();
        }
        this.terrainEditorUI?.setActiveTool(this.terrainEditorSystem.getTool());
        this.terrainEditorUI?.setActiveMode(this.terrainEditorSystem.getMode());
        this.terrainEditorUI?.setActiveAxis(this.terrainEditorSystem.getAxisConstraint());
        this.vectorTerrainSystem.setWireframeEnabled(true);
        this.vectorTerrainSystem.setAxisIndicatorEnabled(true);
      },
      onDisable: () => {},
      onToolChange: (tool) => this.terrainEditorUI?.setActiveTool(tool),
      onModeChange: (mode) => {
        this.terrainEditorUI?.setActiveMode(mode);
        this.vectorTerrainSystem.setWireframeEnabled(true);
        this.vectorTerrainSystem.setGridLinesEnabled(false);
      },
      onBrushSizeChange: (size) => this.terrainEditorUI?.setBrushSize(size),
      onUndoRedoChange: (canUndo, canRedo) => {
        this.terrainEditorUI?.setUndoEnabled(canUndo);
        this.terrainEditorUI?.setRedoEnabled(canRedo);
      },
      onSelectionChange: (count) => {
        this.terrainEditorUI?.setSelectionCount(count);
        this.updateVertexPositionDisplay();
      },
      onTopologyModeChange: (mode) => this.terrainEditorUI?.setActiveTopologyMode(mode),
    });

    this.assetBrowserUI = new AssetBrowserUI(contentContainer, {
      onSelectAsset: (assetId) => {
        this.assetPlacementSystem.setPlaceMode(assetId);
        this.assetBrowserUI?.showActions(true);
      },
      onRotate: () => this.assetPlacementSystem.rotateSelected(),
      onDelete: () => {
        this.assetPlacementSystem.deleteSelected();
        this.assetBrowserUI?.showActions(false);
      },
      onExitPlaceMode: () => {
        this.assetPlacementSystem.exitPlaceMode();
        this.assetPlacementSystem.clearSelection();
        this.assetBrowserUI?.showActions(false);
      },
    }, scene);

    this.overlayPanelUI = new OverlayPanelUI(contentContainer, {
      onLoadImage: () => this.overlayFileInput?.click(),
      onOpacityChange: (opacity) => {
        this.overlayOpacity = opacity;
        if (this.overlayVisible) {
          this.vectorTerrainSystem.setImageOverlayOpacity(opacity / 100);
        }
      },
      onScaleChange: (scale) => {
        this.overlayScale = scale;
        this.applyOverlayTransform();
      },
      onOffsetXChange: (offsetX) => {
        this.overlayOffsetX = offsetX;
        this.applyOverlayTransform();
      },
      onOffsetZChange: (offsetZ) => {
        this.overlayOffsetZ = offsetZ;
        this.applyOverlayTransform();
      },
      onFlipX: () => {
        this.overlayFlipX = !this.overlayFlipX;
        this.vectorTerrainSystem.setImageOverlayFlip(this.overlayFlipX, this.overlayFlipY);
      },
      onFlipY: () => {
        this.overlayFlipY = !this.overlayFlipY;
        this.vectorTerrainSystem.setImageOverlayFlip(this.overlayFlipX, this.overlayFlipY);
      },
      onRotate: () => {
        this.overlayRotation = (this.overlayRotation + 1) % 4;
        this.vectorTerrainSystem.setImageOverlayRotation(this.overlayRotation);
      },
      onToggle: () => {
        if (!this.overlayLoaded) return;
        this.overlayVisible = !this.overlayVisible;
        this.vectorTerrainSystem.setImageOverlayOpacity(
          this.overlayVisible ? this.overlayOpacity / 100 : 0
        );
      },
      onClear: () => {
        this.vectorTerrainSystem.clearImageOverlay();
        this.vectorTerrainSystem.setImageOverlayFlip(false, false);
        this.vectorTerrainSystem.setImageOverlayRotation(0);
        this.overlayLoaded = false;
        this.overlayVisible = true;
        this.overlayOpacity = 50;
        this.overlayScale = 1.0;
        this.overlayOffsetX = 0;
        this.overlayOffsetZ = 0;
        this.overlayFlipX = false;
        this.overlayFlipY = false;
        this.overlayRotation = 0;
        this.overlayPanelUI?.resetControls();
      },
    });

    this.overlayFileInput = createFileInput('image/*,.svg', (file) => {
      const scene = this.babylonEngine.getScene();
      loadImageAsTexture(file, scene, (texture, _w, _h) => {
        this.vectorTerrainSystem.setImageOverlayTexture(texture);
        this.overlayLoaded = true;
        this.overlayVisible = true;
        this.overlayOpacity = 50;
        this.overlayScale = 1.0;
        this.overlayOffsetX = 0;
        this.overlayOffsetZ = 0;

        const worldW = this.vectorTerrainSystem.getWorldWidth();
        const worldH = this.vectorTerrainSystem.getWorldHeight();
        this.overlayScale = 1.0;
        this.vectorTerrainSystem.setImageOverlayTransform(0, 0, worldW, worldH);
        this.vectorTerrainSystem.setImageOverlayOpacity(this.overlayOpacity / 100);

        this.overlayPanelUI?.resetControls();
        this.overlayPanelUI?.show();
      });
    });

    this.setupToolbar(rootGrid);
  }

  private setupToolbar(rootGrid: Grid): void {
    const toolbar = new Rectangle('toolbar');
    toolbar.width = '100%';
    toolbar.height = '40px';
    toolbar.background = 'rgba(13, 31, 21, 0.9)';
    toolbar.color = '#3a5a4a';
    toolbar.thickness = 0;
    rootGrid.addControl(toolbar, 0, 0);

    const row = new StackPanel();
    row.isVertical = false;
    row.width = '100%';
    row.height = '100%';
    toolbar.addControl(row);

    this.courseNameText = new TextBlock('courseName');
    this.courseNameText.text = this.courseData.name;
    this.courseNameText.color = '#7FFF7F';
    this.courseNameText.fontSize = 14;
    this.courseNameText.fontFamily = 'Arial, sans-serif';
    this.courseNameText.width = '200px';
    this.courseNameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.courseNameText.paddingLeft = '15px';
    row.addControl(this.courseNameText);

    const dimText = new TextBlock('dimText');
    dimText.text = `${this.courseData.width}x${this.courseData.height}`;
    dimText.color = '#88aa88';
    dimText.fontSize = 11;
    dimText.fontFamily = 'Arial, sans-serif';
    dimText.width = '80px';
    row.addControl(dimText);

    const spacer = new Rectangle();
    spacer.width = '1';
    spacer.height = '1px';
    spacer.thickness = 0;
    spacer.background = 'transparent';
    row.addControl(spacer);

    this.terrainModeBtn = this.createToolbarButton(row, 'TERRAIN', true);
    this.terrainModeBtn.onPointerUpObservable.add(() => this.setDesignerMode('terrain'));

    this.assetModeBtn = this.createToolbarButton(row, 'ASSETS', false);
    this.assetModeBtn.onPointerUpObservable.add(() => this.setDesignerMode('asset'));

    this.overlayModeBtn = this.createToolbarButton(row, 'OVERLAY', false);
    this.overlayModeBtn.onPointerUpObservable.add(() => this.toggleOverlayPanel());

    this.createToolbarActionButton(row, 'SAVE', '#2a5a3a', () => this.save());
    this.createToolbarActionButton(row, 'EXIT', '#5a3a3a', () => this.exit());
  }

  private createToolbarButton(parent: StackPanel, label: string, active: boolean): Rectangle {
    const btn = new Rectangle(`tb_${label}`);
    btn.width = '80px';
    btn.height = '30px';
    btn.cornerRadius = 4;
    btn.background = active ? '#2a5a3a' : '#1a2a20';
    btn.color = active ? '#7FFF7F' : '#4a6a5a';
    btn.thickness = 1;
    btn.paddingLeft = '4px';
    btn.paddingRight = '4px';
    btn.isPointerBlocker = true;

    const text = new TextBlock();
    text.text = label;
    text.color = active ? '#7FFF7F' : '#aaccaa';
    text.fontSize = 11;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    btn.addControl(text);

    parent.addControl(btn);
    return btn;
  }

  private createToolbarActionButton(parent: StackPanel, label: string, bg: string, onClick: () => void): void {
    const btn = new Rectangle(`tb_${label}`);
    btn.width = '65px';
    btn.height = '30px';
    btn.cornerRadius = 4;
    btn.background = bg;
    btn.color = '#7FFF7F';
    btn.thickness = 1;
    btn.paddingLeft = '4px';
    btn.paddingRight = '4px';
    btn.isPointerBlocker = true;

    const text = new TextBlock();
    text.text = label;
    text.color = 'white';
    text.fontSize = 11;
    text.fontFamily = 'Arial, sans-serif';
    text.isPointerBlocker = false;
    btn.addControl(text);

    btn.onPointerUpObservable.add(onClick);
    btn.onPointerEnterObservable.add(() => { btn.alpha = 0.8; });
    btn.onPointerOutObservable.add(() => { btn.alpha = 1; });

    parent.addControl(btn);
  }

  private setDesignerMode(mode: DesignerMode): void {
    this.mode = mode;

    if (this.terrainModeBtn) {
      this.terrainModeBtn.background = mode === 'terrain' ? '#2a5a3a' : '#1a2a20';
      this.terrainModeBtn.color = mode === 'terrain' ? '#7FFF7F' : '#4a6a5a';
      const text = this.terrainModeBtn.children[0] as TextBlock;
      if (text) text.color = mode === 'terrain' ? '#7FFF7F' : '#aaccaa';
    }
    if (this.assetModeBtn) {
      this.assetModeBtn.background = mode === 'asset' ? '#2a5a3a' : '#1a2a20';
      this.assetModeBtn.color = mode === 'asset' ? '#7FFF7F' : '#4a6a5a';
      const text = this.assetModeBtn.children[0] as TextBlock;
      if (text) text.color = mode === 'asset' ? '#7FFF7F' : '#aaccaa';
    }

    if (mode === 'terrain') {
      this.terrainEditorUI?.show();
      this.assetBrowserUI?.hide();
      this.assetPlacementSystem.exitPlaceMode();
      this.assetPlacementSystem.clearSelection();
      this.vectorTerrainSystem.setWireframeEnabled(true);
    } else {
      this.terrainEditorUI?.hide();
      this.assetBrowserUI?.show();
      this.vectorTerrainSystem.setWireframeEnabled(false);
    }
  }

  private setupRenderLoop(): void {
    const scene = this.babylonEngine.getScene();
    let lastTime = performance.now();

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaMs = now - lastTime;
      lastTime = now;

      this.babylonEngine.updateSmoothZoom(deltaMs);
      this.babylonEngine.updateCameraPan(deltaMs, {
        up: this.inputManager.isDirectionKeyHeld('up'),
        down: this.inputManager.isDirectionKeyHeld('down'),
        left: this.inputManager.isDirectionKeyHeld('left'),
        right: this.inputManager.isDirectionKeyHeld('right'),
      });
    });
  }

  private setupInput(): void {
    this.inputManager.setCallbacks({
      onZoom: (delta) => this.babylonEngine.handleZoom(delta),
      onClick: (screenX, screenY) => this.handleClick(screenX, screenY),
      onMouseMove: (screenX, screenY) => this.handleMouseMove(screenX, screenY),
      onDragStart: (screenX, screenY) => this.handleDragStart(screenX, screenY),
      onDrag: (screenX, screenY) => this.handleDrag(screenX, screenY),
      onDragEnd: () => this.handleDragEnd(),
      onUndo: () => this.terrainEditorSystem.undo(),
      onRedo: () => this.terrainEditorSystem.redo(),
      onEditorBrushSizeChange: (delta) => {
        this.terrainEditorSystem.changeBrushSize(delta);
        this.terrainEditorUI?.setBrushSize(this.terrainEditorSystem.getBrushSize());
      },
      onSelectAll: () => this.terrainEditorSystem.selectAllVertices(),
      onDeselectAll: () => this.terrainEditorSystem.deselectAllVertices(),
      onAxisConstraint: (axis) => {
        this.terrainEditorSystem.setAxisConstraint(axis);
        this.terrainEditorUI?.setActiveAxis(axis);
      },
      onEdgeModeToggle: () => {
        const current = this.terrainEditorSystem.getTopologyMode();
        this.terrainEditorSystem.setTopologyMode(current === 'edge' ? 'vertex' : 'edge');
      },
      onFaceModeToggle: () => {
        const current = this.terrainEditorSystem.getTopologyMode();
        this.terrainEditorSystem.setTopologyMode(current === 'face' ? 'vertex' : 'face');
      },
      onDeleteVertex: () => this.terrainEditorSystem.handleDeleteSelectedTopologyVertices(),
      onSubdivideEdge: () => this.terrainEditorSystem.subdivideSelectedEdge(),
      onFlipEdge: () => this.terrainEditorSystem.flipSelectedEdge(),
      isInputBlocked: (x, _y) => {
        if (!this.assetBrowserUI?.isVisible()) return false;
        const canvas = this.babylonEngine.getScene().getEngine().getRenderingCanvas();
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        return x > rect.right - 220;
      },
      isEditorActive: () => this.mode === 'terrain',
      isEdgeModeActive: () => this.terrainEditorSystem.getTopologyMode() === 'edge',
      isFaceModeActive: () => this.terrainEditorSystem.getTopologyMode() === 'face',
    });
  }

  private handleClick(screenX: number, screenY: number): void {
    if (this.mode === 'terrain') {
      this.handleMouseMove(screenX, screenY);
      const result = this.screenToGridAndWorld(screenX, screenY);
      if (result) {
        this.terrainEditorSystem.handleClick(result.gridX, result.gridY);
      }
    } else {
      const world = this.screenToWorldPosition(screenX, screenY);
      if (world) {
        this.assetPlacementSystem.handleClick(world.x, world.z);
      }
    }
  }

  private handleMouseMove(screenX: number, screenY: number): void {
    if (this.mode === 'terrain') {
      const result = this.screenToGridAndWorld(screenX, screenY);
      if (result) {
        const worldPos = result.worldPos ? new Vector3(result.worldPos.x, 0, result.worldPos.z) : undefined;
        this.terrainEditorSystem.handleMouseMove(result.gridX, result.gridY, worldPos);
      }
    } else {
      const world = this.screenToWorldPosition(screenX, screenY);
      if (world) {
        this.assetPlacementSystem.handleMouseMove(world.x, world.z);
      }
    }
  }

  private handleDragStart(screenX: number, screenY: number): void {
    if (this.mode !== 'terrain') return;
    this.handleMouseMove(screenX, screenY);

    if (this.terrainEditorSystem.isHoveredElementSelected() && !this.terrainEditorSystem.isSculptBrushActive()) {
      const world = this.screenToWorldPosition(screenX, screenY);
      if (world) {
        this.terrainEditorSystem.handleVertexMoveStart(world.x, world.z, screenY);
      }
      return;
    }

    const result = this.screenToGridAndWorld(screenX, screenY);
    if (result) {
      this.terrainEditorSystem.handleDragStart(result.gridX, result.gridY);
    }
  }

  private handleDrag(screenX: number, screenY: number): void {
    if (this.mode !== 'terrain') return;

    if (this.terrainEditorSystem.isMovingSelectedVertices()) {
      const world = this.screenToWorldPosition(screenX, screenY);
      if (world) {
        this.terrainEditorSystem.handleVertexMoveDrag(world.x, world.z, screenY);
      }
      return;
    }

    const result = this.screenToGridAndWorld(screenX, screenY);
    if (result) {
      this.terrainEditorSystem.handleDrag(result.gridX, result.gridY);
    }
  }

  private handleDragEnd(): void {
    if (this.mode !== 'terrain') return;

    if (this.terrainEditorSystem.isMovingSelectedVertices()) {
      this.terrainEditorSystem.handleVertexMoveEnd();
      this.updateVertexPositionDisplay();
      return;
    }

    this.terrainEditorSystem.handleDragEnd();
  }

  private screenToGridAndWorld(screenX: number, screenY: number): { gridX: number; gridY: number; worldPos?: { x: number; z: number } } | null {
    const scene = this.babylonEngine.getScene();
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    const pickResult = scene.pick(canvasX, canvasY, (mesh) => {
      return mesh.name.startsWith('terrain') || mesh.name.startsWith('tile_') || mesh.name === 'vectorTerrain';
    });

    if (pickResult?.hit && pickResult.pickedPoint) {
      const worldX = pickResult.pickedPoint.x;
      const worldZ = pickResult.pickedPoint.z;
      const res = this.vectorTerrainSystem.getResolution();
      const gridX = Math.floor(worldX * res);
      const gridY = Math.floor(worldZ * res);
      return { gridX, gridY, worldPos: { x: worldX, z: worldZ } };
    }

    const camera = this.babylonEngine.getCamera();
    const ray = scene.createPickingRay(canvasX, canvasY, null, camera);

    if (ray.direction.y === 0) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const groundX = ray.origin.x + ray.direction.x * t;
    const groundZ = ray.origin.z + ray.direction.z * t;
    const gridX = Math.floor(groundX);
    const gridY = Math.floor(groundZ);

    return { gridX, gridY, worldPos: { x: groundX, z: groundZ } };
  }

  private screenToWorldPosition(screenX: number, screenY: number): { x: number; z: number } | null {
    return this.babylonEngine.screenToWorldPosition(screenX, screenY);
  }

  private getTerrainElevation(worldX: number, worldZ: number): number {
    const vCoord = this.vectorTerrainSystem.worldToVertex(worldX, worldZ);
    const pos = this.vectorTerrainSystem.getVertexPosition(vCoord.vx, vCoord.vy);
    return pos ? pos.y : 0;
  }

  private updateVertexPositionDisplay(): void {
    const centroid = this.terrainEditorSystem.getSelectionCentroid();
    if (centroid) {
      this.terrainEditorUI?.updateVertexPosition(centroid.x, centroid.y, centroid.z);
    } else {
      this.terrainEditorUI?.clearVertexPosition();
    }
  }

  private handleAssetSelect(asset: PlacedAsset | null): void {
    this.assetBrowserUI?.showActions(asset !== null);
  }

  private applyOverlayTransform(): void {
    const worldW = this.vectorTerrainSystem.getWorldWidth();
    const worldH = this.vectorTerrainSystem.getWorldHeight();
    this.vectorTerrainSystem.setImageOverlayTransform(
      this.overlayOffsetX,
      this.overlayOffsetZ,
      worldW * this.overlayScale,
      worldH * this.overlayScale
    );
  }

  private toggleOverlayPanel(): void {
    if (this.overlayPanelUI?.isVisible()) {
      this.overlayPanelUI.hide();
    } else {
      this.overlayPanelUI?.show();
    }
  }

  public save(): void {
    const vts = this.vectorTerrainSystem;

    this.courseData.layout = vts.getLayoutGrid();
    this.courseData.vertexElevations = vts.getVertexElevationsGrid();
    this.courseData.placedAssets = this.assetPlacementSystem.getPlacedAssets();

    saveCustomCourse(this.courseData);
  }

  private exit(): void {
    this.save();
    if (this.options.onExit) {
      this.options.onExit();
    }
  }

  public getCourseData(): CustomCourseData {
    return this.courseData;
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.assetPlacementSystem.dispose();
    this.terrainEditorUI?.hide();
    this.assetBrowserUI?.dispose();
    this.overlayPanelUI?.dispose();
    if (this.overlayFileInput) {
      this.overlayFileInput.remove();
      this.overlayFileInput = null;
    }
    this.uiTexture?.dispose();
    this.vectorTerrainSystem.dispose();
    this.babylonEngine.stop();
    this.babylonEngine.dispose();
  }
}
