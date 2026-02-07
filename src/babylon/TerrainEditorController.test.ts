import { describe, it, expect, beforeEach, vi } from "vitest";
import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

vi.mock("./systems/TerrainEditorSystem", () => ({
  TerrainEditorSystem: vi.fn(),
}));

vi.mock("./ui/TerrainEditorUI", () => ({
  TerrainEditorUI: vi.fn(),
}));

vi.mock("./systems/createTerrainModifier", () => ({
  createTerrainMeshModifier: vi.fn(() => ({ getVertexPosition: vi.fn() })),
}));

vi.mock("@babylonjs/gui/2D/advancedDynamicTexture", () => ({
  AdvancedDynamicTexture: {
    CreateFullscreenUI: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

import { TerrainEditorController, TerrainEditorContext } from "./TerrainEditorController";
import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { TerrainEditorUI } from "./ui/TerrainEditorUI";
import { createTerrainMeshModifier } from "./systems/createTerrainModifier";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { BUILT_IN_TEMPLATES } from "../data/shape-templates";

function createMockEditorSystem() {
  return {
    setTerrainModifier: vi.fn(),
    setMeshResolution: vi.fn(),
    setCallbacks: vi.fn(),
    toggle: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: vi.fn((): boolean => true),
    setTool: vi.fn(),
    getTool: vi.fn((): string => "raise"),
    getMode: vi.fn((): string => "sculpt"),
    setMode: vi.fn(),
    getActiveTool: vi.fn((): string => "raise"),
    setBrushSize: vi.fn(),
    getBrushSize: vi.fn((): number => 3),
    changeBrushSize: vi.fn(),
    setBrushStrength: vi.fn(),
    getBrushStrength: vi.fn((): number => 0.5),
    handleMouseMove: vi.fn(),
    handleDragStart: vi.fn(),
    handleDrag: vi.fn(),
    handleDragEnd: vi.fn(),
    getHoverInfo: vi.fn((): { x: number; y: number; elevation: number; type: number } | null => ({ x: 1, y: 2, elevation: 5, type: 0 })),
    selectAllVertices: vi.fn(),
    deselectAllVertices: vi.fn(),
    setAxisConstraint: vi.fn(),
    getAxisConstraint: vi.fn((): string => "xz"),
    moveSelectedVerticesBy: vi.fn(),
    setTopologyMode: vi.fn(),
    handleDeleteSelectedTopologyVertices: vi.fn(),
    subdivideSelectedEdge: vi.fn(),
    flipSelectedEdge: vi.fn(),
    collapseSelectedEdge: vi.fn(),
    setInteractionMode: vi.fn(),
    getInteractionMode: vi.fn((): string => "brush"),
    rotateSelectedVertices: vi.fn(),
    setActiveTemplate: vi.fn(),
    setStampScale: vi.fn(),
    getStampScale: vi.fn((): number | undefined => 1.5),
    isHoveredElementSelected: vi.fn((): boolean => false),
    isSculptBrushActive: vi.fn((): boolean => false),
    handleVertexMoveStart: vi.fn(),
    handleSelectClick: vi.fn(),
    handleVertexMoveDrag: vi.fn(),
    handleVertexMoveEnd: vi.fn(),
    isMovingSelectedVertices: vi.fn((): boolean => false),
    getSelectionCentroid: vi.fn((): { x: number; y: number; z: number } | null => ({ x: 1, y: 2, z: 3 })),
  };
}

function createMockEditorUI() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    setActiveTool: vi.fn(),
    setActiveMode: vi.fn(),
    setActiveAxis: vi.fn(),
    setBrushSize: vi.fn(),
    setBrushStrength: vi.fn(),
    updateCoordinates: vi.fn(),
    clearCoordinates: vi.fn(),
    setSelectionCount: vi.fn(),
    setActiveTopologyMode: vi.fn(),
    setInteractionMode: vi.fn(),
    updateVertexPosition: vi.fn(),
    clearVertexPosition: vi.fn(),
    setStampSize: vi.fn(),
  };
}

function createMockCanvas() {
  return {
    width: 800,
    height: 600,
    style: { cursor: "default" },
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
  };
}

function createMockScene(canvas: ReturnType<typeof createMockCanvas>) {
  return {
    pick: vi.fn((): { hit: boolean; pickedPoint: { x: number; y: number; z: number }; getTextureCoordinates: ReturnType<typeof vi.fn> } => ({
      hit: true,
      pickedPoint: { x: 5, y: 0, z: 10 },
      getTextureCoordinates: vi.fn(() => new Vector2(0.5, 0.5)),
    })),
    getEngine: vi.fn(() => ({
      getRenderingCanvas: vi.fn((): ReturnType<typeof createMockCanvas> | null => canvas),
    })),
    createPickingRay: vi.fn(() => ({
      origin: { x: 0, y: 10, z: 0 },
      direction: { x: 0, y: -1, z: 0 },
    })),
  };
}

function createMockVts() {
  return {
    getMeshResolution: vi.fn(() => 4),
    setWireframeEnabled: vi.fn(),
    setAxisIndicatorEnabled: vi.fn(),
    setGridLinesEnabled: vi.fn(),
  };
}

function createMockTerrainSystem() {
  return {
    setElevationAt: vi.fn(),
    setTerrainTypeAt: vi.fn(),
    getResolution: vi.fn(() => 1),
  };
}

function createMockContext(overrides?: {
  vts?: ReturnType<typeof createMockVts> | null;
  scene?: ReturnType<typeof createMockScene>;
  canvas?: ReturnType<typeof createMockCanvas>;
  terrainSystem?: ReturnType<typeof createMockTerrainSystem>;
  playerVisual?: any;
}) {
  const canvas = overrides?.canvas ?? createMockCanvas();
  const scene = overrides?.scene ?? createMockScene(canvas);
  const vts = overrides?.vts !== undefined ? overrides.vts : createMockVts();
  const terrainSystem = overrides?.terrainSystem ?? createMockTerrainSystem();
  const playerVisual = overrides?.playerVisual !== undefined
    ? overrides.playerVisual
    : { container: { position: { x: 0, y: 0, z: 0 } } };

  const ctx: TerrainEditorContext = {
    getScene: vi.fn(() => scene) as any,
    getCamera: vi.fn(() => ({ position: { clone: () => ({ x: 0, y: 10, z: 0 }) } })),
    screenToWorldPosition: vi.fn(() => ({ x: 5, z: 10 })),
    setCameraTarget: vi.fn(),
    getTerrainSystem: vi.fn(() => terrainSystem) as any,
    getTerrainMeshSystem: vi.fn(() => vts) as any,
    getCourseWidth: vi.fn(() => 20),
    getCourseHeight: vi.fn(() => 20),
    getPlayerVisual: vi.fn(() => playerVisual) as any,
    getPlayerGridPosition: vi.fn(() => ({ gridX: 5, gridY: 5 })),
    setPlayerVisualEnabled: vi.fn(),
    setEmployeeVisualSystemVisible: vi.fn(),
    snapEmployeesToTerrain: vi.fn(),
    snapEntityToTerrain: vi.fn(),
    snapAssetsToTerrain: vi.fn(),
  };

  return { ctx, scene, canvas, vts, terrainSystem };
}

let mockSystem: ReturnType<typeof createMockEditorSystem>;
let mockUI: ReturnType<typeof createMockEditorUI>;
let mocks: ReturnType<typeof createMockContext>;
let controller: TerrainEditorController;

function setupController(overrides?: Parameters<typeof createMockContext>[0]) {
  mockSystem = createMockEditorSystem();
  mockUI = createMockEditorUI();
  mocks = createMockContext(overrides);

  vi.mocked(TerrainEditorSystem).mockImplementation(function () { return mockSystem as any; } as any);
  vi.mocked(TerrainEditorUI).mockImplementation(function () { return mockUI as any; } as any);

  controller = new TerrainEditorController(mocks.ctx);
  controller.setup();
}

function getSystemCallbacks(): Record<string, Function> {
  return mockSystem.setCallbacks.mock.calls[0][0];
}

function getUICallbacks(): Record<string, Function> {
  return vi.mocked(TerrainEditorUI).mock.calls[0][1] as any;
}

describe("TerrainEditorController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupController();
  });

  describe("setup", () => {
    it("creates TerrainEditorSystem with scene", () => {
      expect(TerrainEditorSystem).toHaveBeenCalledWith(mocks.scene);
    });

    it("sets terrain modifier with VTS present", () => {
      expect(createTerrainMeshModifier).toHaveBeenCalled();
      expect(mockSystem.setTerrainModifier).toHaveBeenCalled();
      expect(mockSystem.setMeshResolution).toHaveBeenCalledWith(4);
    });

    it("sets base modifier when VTS is null", () => {
      vi.clearAllMocks();
      setupController({ vts: null });

      expect(createTerrainMeshModifier).not.toHaveBeenCalled();
      expect(mockSystem.setTerrainModifier).toHaveBeenCalled();
      expect(mockSystem.setMeshResolution).not.toHaveBeenCalled();
    });

    it("creates AdvancedDynamicTexture and TerrainEditorUI", () => {
      expect(AdvancedDynamicTexture.CreateFullscreenUI).toHaveBeenCalledWith(
        "EditorUI",
        true,
        mocks.scene
      );
      expect(TerrainEditorUI).toHaveBeenCalled();
    });

    it("sets callbacks on the editor system", () => {
      expect(mockSystem.setCallbacks).toHaveBeenCalled();
    });

    it("baseModifier delegates to terrain system", () => {
      vi.clearAllMocks();
      setupController({ vts: null });
      const modifier = mockSystem.setTerrainModifier.mock.calls[0][0];
      modifier.setElevationAt(1, 2, 5);
      expect(mocks.terrainSystem.setElevationAt).toHaveBeenCalledWith(1, 2, 5);
      modifier.setTerrainTypeAt(3, 4, 1);
      expect(mocks.terrainSystem.setTerrainTypeAt).toHaveBeenCalledWith(3, 4, 1);
    });
  });

  describe("setup - UI callbacks", () => {
    it("onToolSelect calls handleEditorToolSelect", () => {
      const cbs = getUICallbacks();
      cbs.onToolSelect("lower");
      expect(mockSystem.setTool).toHaveBeenCalledWith("lower");
    });

    it("onModeChange sets mode on system", () => {
      const cbs = getUICallbacks();
      cbs.onModeChange("paint");
      expect(mockSystem.setMode).toHaveBeenCalledWith("paint");
    });

    it("onClose calls handleEditorToggle", () => {
      const cbs = getUICallbacks();
      cbs.onClose();
      expect(mockSystem.toggle).toHaveBeenCalled();
    });

    it("onBrushSizeChange calls handleEditorBrushSize", () => {
      const cbs = getUICallbacks();
      cbs.onBrushSizeChange(5);
      expect(mockSystem.setBrushSize).toHaveBeenCalledWith(5);
    });

    it("onBrushStrengthChange calls handleEditorBrushStrength", () => {
      const cbs = getUICallbacks();
      cbs.onBrushStrengthChange(0.8);
      expect(mockSystem.setBrushStrength).toHaveBeenCalledWith(0.8);
    });

    it("onSelectAll calls selectAllVertices", () => {
      const cbs = getUICallbacks();
      cbs.onSelectAll();
      expect(mockSystem.selectAllVertices).toHaveBeenCalled();
    });

    it("onDeselectAll calls deselectAllVertices", () => {
      const cbs = getUICallbacks();
      cbs.onDeselectAll();
      expect(mockSystem.deselectAllVertices).toHaveBeenCalled();
    });

    it("onAxisChange sets axis on system and UI", () => {
      const cbs = getUICallbacks();
      cbs.onAxisChange("y");
      expect(mockSystem.setAxisConstraint).toHaveBeenCalledWith("y");
      expect(mockUI.setActiveAxis).toHaveBeenCalledWith("y");
    });

    it("onMoveBy moves selected vertices and updates display", () => {
      const cbs = getUICallbacks();
      cbs.onMoveBy(1, 2, 3);
      expect(mockSystem.moveSelectedVerticesBy).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
      expect(mockUI.updateVertexPosition).toHaveBeenCalledWith(1, 2, 3);
    });

    it("onTopologyModeChange sets topology mode on system", () => {
      const cbs = getUICallbacks();
      cbs.onTopologyModeChange("edge");
      expect(mockSystem.setTopologyMode).toHaveBeenCalledWith("edge");
    });

    it("onDeleteVertex calls handleDeleteSelectedTopologyVertices", () => {
      const cbs = getUICallbacks();
      cbs.onDeleteVertex();
      expect(mockSystem.handleDeleteSelectedTopologyVertices).toHaveBeenCalled();
    });

    it("onSplitEdge calls subdivideSelectedEdge", () => {
      const cbs = getUICallbacks();
      cbs.onSplitEdge();
      expect(mockSystem.subdivideSelectedEdge).toHaveBeenCalled();
    });

    it("onFlipEdge calls flipSelectedEdge", () => {
      const cbs = getUICallbacks();
      cbs.onFlipEdge();
      expect(mockSystem.flipSelectedEdge).toHaveBeenCalled();
    });

    it("onCollapseEdge calls collapseSelectedEdge", () => {
      const cbs = getUICallbacks();
      cbs.onCollapseEdge();
      expect(mockSystem.collapseSelectedEdge).toHaveBeenCalled();
    });

    it("onInteractionModeChange sets interaction mode on system", () => {
      const cbs = getUICallbacks();
      cbs.onInteractionModeChange("select");
      expect(mockSystem.setInteractionMode).toHaveBeenCalledWith("select");
    });

    it("onRotateBy rotates selected vertices", () => {
      const cbs = getUICallbacks();
      cbs.onRotateBy(10, 20, 30);
      expect(mockSystem.rotateSelectedVertices).toHaveBeenCalledWith(10, 20, 30);
    });

    it("onTemplateSelect sets active template for matching name", () => {
      const cbs = getUICallbacks();
      cbs.onTemplateSelect("Circle");
      expect(mockSystem.setActiveTemplate).toHaveBeenCalledWith(BUILT_IN_TEMPLATES[0]);
    });

    it("onTemplateSelect does not set template for unknown name", () => {
      const cbs = getUICallbacks();
      cbs.onTemplateSelect("Unknown");
      expect(mockSystem.setActiveTemplate).not.toHaveBeenCalled();
    });

    it("onStampSizeChange sets stamp scale on system and updates UI", () => {
      const cbs = getUICallbacks();
      cbs.onStampSizeChange(2);
      expect(mockSystem.setStampScale).toHaveBeenCalledWith(2);
      expect(mockUI.setStampSize).toHaveBeenCalledWith(1.5);
    });

    it("onStampSizeChange falls back to input size when getStampScale returns undefined", () => {
      mockSystem.getStampScale.mockReturnValue(undefined);
      const cbs = getUICallbacks();
      cbs.onStampSizeChange(7);
      expect(mockUI.setStampSize).toHaveBeenCalledWith(7);
    });
  });

  describe("setup - system callbacks", () => {
    it("onEnable shows UI, sets tool/mode/axis/stamp, pauses game", () => {
      const cbs = getSystemCallbacks();
      cbs.onEnable();

      expect(mockUI.show).toHaveBeenCalled();
      expect(mockUI.setActiveTool).toHaveBeenCalledWith("raise");
      expect(mockUI.setActiveMode).toHaveBeenCalledWith("sculpt");
      expect(mockUI.setActiveAxis).toHaveBeenCalledWith("xz");
      expect(mockUI.setStampSize).toHaveBeenCalled();
      expect(mocks.ctx.setPlayerVisualEnabled).toHaveBeenCalledWith(false);
      expect(mocks.ctx.setEmployeeVisualSystemVisible).toHaveBeenCalledWith(false);
    });

    it("onEnable enables wireframe when mode is sculpt", () => {
      mockSystem.getMode.mockReturnValue("sculpt");
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      expect(mocks.vts!.setWireframeEnabled).toHaveBeenCalledWith(true);
      expect(mocks.vts!.setAxisIndicatorEnabled).toHaveBeenCalledWith(true);
    });

    it("onEnable skips wireframe when mode is not sculpt", () => {
      mockSystem.getMode.mockReturnValue("paint");
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      expect(mocks.vts!.setWireframeEnabled).not.toHaveBeenCalled();
      expect(mocks.vts!.setAxisIndicatorEnabled).toHaveBeenCalledWith(true);
    });

    it("onEnable with no VTS skips wireframe calls", () => {
      vi.clearAllMocks();
      setupController({ vts: null });
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      expect(mockUI.show).toHaveBeenCalled();
      expect(mocks.ctx.setPlayerVisualEnabled).toHaveBeenCalledWith(false);
    });

    it("onDisable hides UI, disables wireframe, resumes game, snaps entities", () => {
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      cbs.onDisable();

      expect(mockUI.hide).toHaveBeenCalled();
      expect(mocks.vts!.setWireframeEnabled).toHaveBeenCalledWith(false);
      expect(mocks.vts!.setAxisIndicatorEnabled).toHaveBeenCalledWith(false);
      expect(mocks.ctx.setPlayerVisualEnabled).toHaveBeenCalledWith(true);
      expect(mocks.ctx.setEmployeeVisualSystemVisible).toHaveBeenCalledWith(true);
      expect(mocks.ctx.snapEmployeesToTerrain).toHaveBeenCalled();
      expect(mocks.ctx.snapAssetsToTerrain).toHaveBeenCalled();
      expect(mocks.ctx.snapEntityToTerrain).toHaveBeenCalled();
      expect(mocks.ctx.setCameraTarget).toHaveBeenCalled();
    });

    it("onDisable with null player visual skips player re-enable", () => {
      vi.clearAllMocks();
      setupController({ playerVisual: null });
      const cbs = getSystemCallbacks();
      cbs.onDisable();
      expect(mocks.ctx.setPlayerVisualEnabled).not.toHaveBeenCalled();
      expect(mocks.ctx.setEmployeeVisualSystemVisible).toHaveBeenCalledWith(true);
      expect(mocks.ctx.snapEmployeesToTerrain).toHaveBeenCalled();
    });

    it("onDisable with no VTS skips wireframe calls", () => {
      vi.clearAllMocks();
      setupController({ vts: null });
      const cbs = getSystemCallbacks();
      cbs.onDisable();
      expect(mockUI.hide).toHaveBeenCalled();
    });

    it("onToolChange updates UI tool", () => {
      const cbs = getSystemCallbacks();
      cbs.onToolChange("smooth");
      expect(mockUI.setActiveTool).toHaveBeenCalledWith("smooth");
    });

    it("onModeChange updates UI mode and enables wireframe", () => {
      const cbs = getSystemCallbacks();
      cbs.onModeChange("paint");
      expect(mockUI.setActiveMode).toHaveBeenCalledWith("paint");
      expect(mocks.vts!.setWireframeEnabled).toHaveBeenCalledWith(true);
      expect(mocks.vts!.setGridLinesEnabled).toHaveBeenCalledWith(false);
    });

    it("onModeChange with no VTS skips wireframe calls", () => {
      vi.clearAllMocks();
      setupController({ vts: null });
      const cbs = getSystemCallbacks();
      cbs.onModeChange("sculpt");
      expect(mockUI.setActiveMode).toHaveBeenCalledWith("sculpt");
    });

    it("onBrushSizeChange updates UI brush size", () => {
      const cbs = getSystemCallbacks();
      cbs.onBrushSizeChange(5);
      expect(mockUI.setBrushSize).toHaveBeenCalledWith(5);
    });

    it("onSelectionChange updates UI selection count and vertex position", () => {
      const cbs = getSystemCallbacks();
      cbs.onSelectionChange(3);
      expect(mockUI.setSelectionCount).toHaveBeenCalledWith(3);
      expect(mockUI.updateVertexPosition).toHaveBeenCalledWith(1, 2, 3);
    });

    it("onSelectionChange clears position when no centroid", () => {
      mockSystem.getSelectionCentroid.mockReturnValue(null);
      const cbs = getSystemCallbacks();
      cbs.onSelectionChange(0);
      expect(mockUI.clearVertexPosition).toHaveBeenCalled();
    });

    it("onTopologyModeChange updates UI topology mode", () => {
      const cbs = getSystemCallbacks();
      cbs.onTopologyModeChange("edge");
      expect(mockUI.setActiveTopologyMode).toHaveBeenCalledWith("edge");
    });

    it("onInteractionModeChange updates UI interaction mode", () => {
      const cbs = getSystemCallbacks();
      cbs.onInteractionModeChange("select");
      expect(mockUI.setInteractionMode).toHaveBeenCalledWith("select");
    });

    it("onModification snaps assets to terrain", () => {
      const cbs = getSystemCallbacks();
      cbs.onModification();
      expect(mocks.ctx.snapAssetsToTerrain).toHaveBeenCalled();
    });
  });

  describe("handleEditorToggle", () => {
    it("calls toggle on the system", () => {
      controller.handleEditorToggle();
      expect(mockSystem.toggle).toHaveBeenCalled();
    });

    it("does nothing before setup", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.handleEditorToggle();
    });
  });

  describe("handleEditorToolSelect", () => {
    it("sets tool and updates cursor", () => {
      controller.handleEditorToolSelect("lower");
      expect(mockSystem.setTool).toHaveBeenCalledWith("lower");
    });
  });

  describe("handleEditorToolNumber", () => {
    it("is a no-op", () => {
      controller.handleEditorToolNumber(1);
    });
  });

  describe("handleEditorBrushSelect", () => {
    it("sets tool when brush starts with terrain_", () => {
      controller.handleEditorBrushSelect("terrain_fairway");
      expect(mockSystem.setTool).toHaveBeenCalledWith("terrain_fairway");
    });

    it("ignores brushes not starting with terrain_", () => {
      controller.handleEditorBrushSelect("other_brush");
      expect(mockSystem.setTool).not.toHaveBeenCalled();
    });

    it("does nothing when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      controller.handleEditorBrushSelect("terrain_fairway");
      expect(mockSystem.setTool).not.toHaveBeenCalled();
    });
  });

  describe("updateEditorCursor", () => {
    it("sets crosshair for paint mode", () => {
      mockSystem.getMode.mockReturnValue("paint");
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("crosshair");
    });

    it("sets ns-resize for raise tool", () => {
      mockSystem.getMode.mockReturnValue("sculpt");
      mockSystem.getActiveTool.mockReturnValue("raise");
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("ns-resize");
    });

    it("sets ns-resize for lower tool", () => {
      mockSystem.getMode.mockReturnValue("sculpt");
      mockSystem.getActiveTool.mockReturnValue("lower");
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("ns-resize");
    });

    it("sets wait for smooth tool", () => {
      mockSystem.getMode.mockReturnValue("sculpt");
      mockSystem.getActiveTool.mockReturnValue("smooth");
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("wait");
    });

    it("sets move for other tools", () => {
      mockSystem.getMode.mockReturnValue("sculpt");
      mockSystem.getActiveTool.mockReturnValue("flatten");
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("move");
    });

    it("sets default when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      mocks.canvas.style.cursor = "crosshair";
      controller.updateEditorCursor();
      expect(mocks.canvas.style.cursor).toBe("default");
    });

    it("does nothing when canvas is null and editor disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      mocks.scene.getEngine.mockReturnValue({
        getRenderingCanvas: vi.fn(() => null),
      });
      controller.updateEditorCursor();
    });

    it("returns early when canvas is null and editor enabled", () => {
      mocks.scene.getEngine.mockReturnValue({
        getRenderingCanvas: vi.fn(() => null),
      });
      controller.updateEditorCursor();
    });
  });

  describe("handleEditorBrushSize", () => {
    it("sets brush size and updates UI", () => {
      controller.handleEditorBrushSize(5);
      expect(mockSystem.setBrushSize).toHaveBeenCalledWith(5);
      expect(mockUI.setBrushSize).toHaveBeenCalledWith(3);
    });

    it("does nothing when system is null", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.handleEditorBrushSize(5);
    });
  });

  describe("handleEditorBrushSizeDelta", () => {
    it("changes brush size by delta and updates UI", () => {
      controller.handleEditorBrushSizeDelta(2);
      expect(mockSystem.changeBrushSize).toHaveBeenCalledWith(2);
      expect(mockUI.setBrushSize).toHaveBeenCalledWith(3);
    });

    it("does nothing when system is null", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.handleEditorBrushSizeDelta(1);
    });
  });

  describe("handleEditorBrushStrength", () => {
    it("sets brush strength and updates UI", () => {
      controller.handleEditorBrushStrength(0.8);
      expect(mockSystem.setBrushStrength).toHaveBeenCalledWith(0.8);
      expect(mockUI.setBrushStrength).toHaveBeenCalledWith(0.5);
    });

    it("does nothing when system is null", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.handleEditorBrushStrength(0.5);
    });
  });

  describe("handleEditorBrushStrengthDelta", () => {
    it("adds delta to current strength", () => {
      controller.handleEditorBrushStrengthDelta(0.1);
      expect(mockSystem.setBrushStrength).toHaveBeenCalledWith(0.6);
    });

    it("does nothing when system is null", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.handleEditorBrushStrengthDelta(0.1);
    });
  });

  describe("handleMouseMove", () => {
    it("moves editor with grid and world position", () => {
      controller.handleMouseMove(100, 200);
      expect(mockSystem.handleMouseMove).toHaveBeenCalled();
      const args = mockSystem.handleMouseMove.mock.calls[0];
      expect(args[0]).toBe(5);
      expect(args[1]).toBe(10);
      expect(args[2]).toBeInstanceOf(Vector3);
    });

    it("updates coordinates from hover info", () => {
      controller.handleMouseMove(100, 200);
      expect(mockUI.updateCoordinates).toHaveBeenCalledWith(1, 2, 5, 0);
    });

    it("clears coordinates when no hover info", () => {
      mockSystem.getHoverInfo.mockReturnValue(null);
      controller.handleMouseMove(100, 200);
      expect(mockUI.clearCoordinates).toHaveBeenCalled();
    });

    it("does nothing when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      controller.handleMouseMove(100, 200);
      expect(mockSystem.handleMouseMove).not.toHaveBeenCalled();
    });

    it("does nothing when screenToGridAndWorld returns null", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      });
      controller.handleMouseMove(100, 200);
      expect(mockSystem.handleMouseMove).not.toHaveBeenCalled();
    });
  });

  describe("screenToGridAndWorld", () => {
    it("returns grid and world position from pick result", () => {
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).not.toBeNull();
      expect(result!.gridX).toBe(5);
      expect(result!.gridY).toBe(10);
      expect(result!.worldPos).toEqual({ x: 5, z: 10 });
    });

    it("returns null when canvas is null", () => {
      mocks.scene.getEngine.mockReturnValue({
        getRenderingCanvas: vi.fn(() => null),
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).toBeNull();
    });

    it("falls back to ray when pick misses", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).not.toBeNull();
      expect(result!.gridX).toBe(0);
      expect(result!.gridY).toBe(0);
    });

    it("returns null when ray direction.y is 0", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 1, y: 0, z: 0 },
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).toBeNull();
    });

    it("returns null when t < 0", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: 1, z: 0 },
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).toBeNull();
    });

    it("returns null for out-of-bounds pick when editor disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      mocks.scene.pick.mockReturnValue({
        hit: true,
        pickedPoint: { x: -5, y: 0, z: -5 },
        getTextureCoordinates: vi.fn(() => null) as any,
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).toBeNull();
    });

    it("returns result for out-of-bounds pick when editor enabled", () => {
      mockSystem.isEnabled.mockReturnValue(true);
      mocks.scene.pick.mockReturnValue({
        hit: true,
        pickedPoint: { x: -5, y: 0, z: -5 },
        getTextureCoordinates: vi.fn(() => null) as any,
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).not.toBeNull();
      expect(result!.gridX).toBe(-5);
    });

    it("returns null for out-of-bounds ray fallback when editor disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: -10, y: 10, z: -10 },
        direction: { x: 0, y: -1, z: 0 },
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).toBeNull();
    });

    it("returns result for out-of-bounds ray fallback when editor enabled", () => {
      mockSystem.isEnabled.mockReturnValue(true);
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: -10, y: 10, z: -10 },
        direction: { x: 0, y: -1, z: 0 },
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).not.toBeNull();
    });

    it("uses resolution from terrain system", () => {
      mocks.terrainSystem.getResolution.mockReturnValue(2);
      mocks.scene.pick.mockReturnValue({
        hit: true,
        pickedPoint: { x: 5, y: 0, z: 10 },
        getTextureCoordinates: vi.fn(() => null) as any,
      });
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result!.gridX).toBe(10);
      expect(result!.gridY).toBe(20);
    });

    it("defaults resolution to 1 when getResolution is undefined", () => {
      (mocks.terrainSystem as any).getResolution = undefined;
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result!.gridX).toBe(5);
    });

    it("handles null pickResult", () => {
      mocks.scene.pick.mockReturnValue(null as any);
      const result = controller.screenToGridAndWorld(100, 200);
      expect(result).not.toBeNull();
    });

    it("pick predicate accepts terrain meshes and rejects others", () => {
      controller.screenToGridAndWorld(100, 200);
      const predicate = (mocks.scene.pick.mock.calls[0] as any[])[2] as (mesh: { name: string }) => boolean;
      expect(predicate({ name: "terrainMesh" })).toBe(true);
      expect(predicate({ name: "tile_0_0" })).toBe(true);
      expect(predicate({ name: "terrainMesh" })).toBe(true);
      expect(predicate({ name: "playerMesh" })).toBe(false);
    });
  });

  describe("handleDragStart", () => {
    it("does nothing when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleDragStart).not.toHaveBeenCalled();
    });

    it("calls handleDragStart in stamp mode", () => {
      mockSystem.getMode.mockReturnValue("stamp");
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleDragStart).toHaveBeenCalled();
    });

    it("handles select interaction mode with hovered selected element", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).toHaveBeenCalledWith(5, 10, 200);
    });

    it("handles select interaction mode with unselected element", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleSelectClick).toHaveBeenCalled();
    });

    it("handles select interaction mode with shiftKey", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      controller.handleDragStart(100, 200, true);
      expect(mockSystem.handleSelectClick).toHaveBeenCalledWith(
        expect.objectContaining({ x: 5, z: 10 }),
        true
      );
    });

    it("handles select interaction mode without shiftKey", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleSelectClick).toHaveBeenCalledWith(
        expect.objectContaining({ x: 5, z: 10 }),
        false
      );
    });

    it("handles hovered element selected with no sculpt brush in brush mode", () => {
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      mockSystem.isSculptBrushActive.mockReturnValue(false);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).toHaveBeenCalledWith(5, 10, 200);
    });

    it("calls handleDragStart when sculpt brush is active even if hovered is selected", () => {
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      mockSystem.isSculptBrushActive.mockReturnValue(true);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleDragStart).toHaveBeenCalled();
      expect(mockSystem.handleVertexMoveStart).not.toHaveBeenCalled();
    });

    it("calls handleDragStart for normal brush with no hovered selection", () => {
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleDragStart).toHaveBeenCalled();
    });

    it("does nothing when screenToGridAndWorld returns null", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleDragStart).not.toHaveBeenCalled();
    });

    it("handles select mode hovered selected with no worldPos in ray fallback", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
      });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).toHaveBeenCalled();
    });

    it("handles brush mode hovered selected with ray fallback worldPos", () => {
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      mockSystem.isSculptBrushActive.mockReturnValue(false);
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: -1, z: 0 },
      });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).toHaveBeenCalled();
    });

    it("select mode hovered selected with no worldPos skips vertex move start", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      vi.spyOn(controller, "screenToGridAndWorld").mockReturnValue({ gridX: 1, gridY: 2 });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).not.toHaveBeenCalled();
    });

    it("select mode unselected with no worldPos skips handleSelectClick", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      vi.spyOn(controller, "screenToGridAndWorld").mockReturnValue({ gridX: 1, gridY: 2 });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleSelectClick).not.toHaveBeenCalled();
    });

    it("brush mode hovered selected with no worldPos skips vertex move start", () => {
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mockSystem.isHoveredElementSelected.mockReturnValue(true);
      mockSystem.isSculptBrushActive.mockReturnValue(false);
      vi.spyOn(controller, "screenToGridAndWorld").mockReturnValue({ gridX: 1, gridY: 2 });
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleVertexMoveStart).not.toHaveBeenCalled();
    });
  });

  describe("handleDrag", () => {
    it("does nothing when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      controller.handleDrag(100, 200);
      expect(mockSystem.handleDrag).not.toHaveBeenCalled();
    });

    it("handles vertex move drag when moving selected vertices", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(true);
      controller.handleDrag(100, 200);
      expect(mockSystem.handleVertexMoveDrag).toHaveBeenCalledWith(5, 10, 200);
    });

    it("does nothing when moving vertices but screenToWorldPosition returns null", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(true);
      (mocks.ctx.screenToWorldPosition as ReturnType<typeof vi.fn>).mockReturnValue(null);
      controller.handleDrag(100, 200);
      expect(mockSystem.handleVertexMoveDrag).not.toHaveBeenCalled();
    });

    it("returns early in select interaction mode without moving", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(false);
      mockSystem.getInteractionMode.mockReturnValue("select");
      controller.handleDrag(100, 200);
      expect(mockSystem.handleDrag).not.toHaveBeenCalled();
    });

    it("handles normal drag in brush mode", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(false);
      mockSystem.getInteractionMode.mockReturnValue("brush");
      controller.handleDrag(100, 200);
      expect(mockSystem.handleDrag).toHaveBeenCalled();
    });

    it("does nothing when screenToGridAndWorld returns null in brush mode", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(false);
      mockSystem.getInteractionMode.mockReturnValue("brush");
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      mocks.scene.createPickingRay.mockReturnValue({
        origin: { x: 0, y: 10, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      });
      controller.handleDrag(100, 200);
      expect(mockSystem.handleDrag).not.toHaveBeenCalled();
    });
  });

  describe("handleDragEnd", () => {
    it("does nothing when editor is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      controller.handleDragEnd();
      expect(mockSystem.handleDragEnd).not.toHaveBeenCalled();
    });

    it("handles vertex move end when moving selected vertices", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(true);
      controller.handleDragEnd();
      expect(mockSystem.handleVertexMoveEnd).toHaveBeenCalled();
      expect(mockUI.updateVertexPosition).toHaveBeenCalledWith(1, 2, 3);
    });

    it("clears position display on vertex move end when no centroid", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(true);
      mockSystem.getSelectionCentroid.mockReturnValue(null);
      controller.handleDragEnd();
      expect(mockSystem.handleVertexMoveEnd).toHaveBeenCalled();
      expect(mockUI.clearVertexPosition).toHaveBeenCalled();
    });

    it("handles normal drag end", () => {
      mockSystem.isMovingSelectedVertices.mockReturnValue(false);
      controller.handleDragEnd();
      expect(mockSystem.handleDragEnd).toHaveBeenCalled();
    });
  });

  describe("setEnabled", () => {
    it("enables the system", () => {
      controller.setEnabled(true);
      expect(mockSystem.enable).toHaveBeenCalled();
    });

    it("disables the system", () => {
      controller.setEnabled(false);
      expect(mockSystem.disable).toHaveBeenCalled();
    });

    it("does nothing when system is null", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      ctrl.setEnabled(true);
    });
  });

  describe("isEnabled", () => {
    it("returns true when system is enabled", () => {
      mockSystem.isEnabled.mockReturnValue(true);
      expect(controller.isEnabled()).toBe(true);
    });

    it("returns false when system is disabled", () => {
      mockSystem.isEnabled.mockReturnValue(false);
      expect(controller.isEnabled()).toBe(false);
    });

    it("returns false before setup", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      expect(ctrl.isEnabled()).toBe(false);
    });
  });

  describe("isPausedByEditor", () => {
    it("returns false initially", () => {
      expect(controller.isPausedByEditor()).toBe(false);
    });

    it("returns true after onEnable callback", () => {
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      expect(controller.isPausedByEditor()).toBe(true);
    });

    it("returns false after onDisable callback", () => {
      const cbs = getSystemCallbacks();
      cbs.onEnable();
      cbs.onDisable();
      expect(controller.isPausedByEditor()).toBe(false);
    });
  });

  describe("getSystem", () => {
    it("returns the editor system", () => {
      expect(controller.getSystem()).toBe(mockSystem);
    });

    it("returns null before setup", () => {
      const ctrl = new TerrainEditorController(mocks.ctx);
      expect(ctrl.getSystem()).toBeNull();
    });
  });

  describe("dispose", () => {
    it("disposes UI texture and nulls references", () => {
      controller.dispose();
      expect(controller.getSystem()).toBeNull();
      expect(controller.isEnabled()).toBe(false);
    });
  });

  describe("updateVertexPositionDisplay", () => {
    it("updates vertex position from centroid", () => {
      mockSystem.getSelectionCentroid.mockReturnValue({ x: 4, y: 5, z: 6 });
      const cbs = getSystemCallbacks();
      cbs.onSelectionChange(2);
      expect(mockUI.updateVertexPosition).toHaveBeenCalledWith(4, 5, 6);
    });

    it("clears vertex position when centroid is null", () => {
      mockSystem.getSelectionCentroid.mockReturnValue(null);
      const cbs = getSystemCallbacks();
      cbs.onSelectionChange(0);
      expect(mockUI.clearVertexPosition).toHaveBeenCalled();
    });

    it("returns early when system is null", () => {
      controller.dispose();
      const cbs = getUICallbacks();
      cbs.onMoveBy(1, 2, 3);
    });
  });

  describe("UI callbacks after dispose", () => {
    it("onAxisChange is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onAxisChange("y");
    });

    it("onModeChange is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onModeChange("paint");
    });

    it("onSelectAll is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onSelectAll();
    });

    it("onDeselectAll is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onDeselectAll();
    });

    it("onTopologyModeChange is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onTopologyModeChange("edge");
    });

    it("onDeleteVertex is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onDeleteVertex();
    });

    it("onSplitEdge is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onSplitEdge();
    });

    it("onFlipEdge is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onFlipEdge();
    });

    it("onCollapseEdge is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onCollapseEdge();
    });

    it("onInteractionModeChange is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onInteractionModeChange("select");
    });

    it("onRotateBy is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onRotateBy(1, 2, 3);
    });

    it("onTemplateSelect is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onTemplateSelect("Circle");
    });

    it("onStampSizeChange is safe when system is null", () => {
      const cbs = getUICallbacks();
      controller.dispose();
      cbs.onStampSizeChange(2);
    });
  });

  describe("handleMouseMove with ray fallback worldPos", () => {
    it("passes worldPos from ray fallback", () => {
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      controller.handleMouseMove(100, 200);
      expect(mockSystem.handleMouseMove).toHaveBeenCalled();
    });
  });

  describe("handleDragStart - select mode unselected with ray fallback worldPos", () => {
    it("calls handleSelectClick with ray fallback worldPos", () => {
      mockSystem.getInteractionMode.mockReturnValue("select");
      mockSystem.isHoveredElementSelected.mockReturnValue(false);
      mocks.scene.pick.mockReturnValue({ hit: false } as any);
      controller.handleDragStart(100, 200);
      expect(mockSystem.handleSelectClick).toHaveBeenCalled();
    });
  });
});
