import { describe, it, expect, beforeEach, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PLAYER_BASE_SPEED } from "../core/movable-entity";
import { HEIGHT_UNIT } from "./engine/BabylonEngine";

vi.mock("../core/movable-entity", async () => {
  const actual = await vi.importActual<typeof import("../core/movable-entity")>(
    "../core/movable-entity"
  );
  return {
    ...actual,
    createPlayerEntity: actual.createPlayerEntity,
    teleportEntity: actual.teleportEntity,
  };
});

vi.mock("./systems/EntityVisualSystem", () => ({
  PLAYER_APPEARANCE: { assetId: "character.greenkeeper", scale: 1.0 },
  createEntityMesh: vi.fn((_scene, _id, _appearance, startX, startY) => ({
    container: {
      position: { x: 0, y: 0, z: 0, set: vi.fn(), copyFrom: vi.fn() },
    },
    meshInstance: null,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 0,
    facingAngle: 0,
    isAnimating: false,
    isDisposed: false,
    rotatesWithMovement: true,
  })),
  disposeEntityMesh: vi.fn(),
}));

import {
  PlayerController,
  TerrainProvider,
  EquipmentProvider,
  EngineProvider,
  InputProvider,
  EditorProvider,
} from "./PlayerController";
import { disposeEntityMesh, createEntityMesh } from "./systems/EntityVisualSystem";

function createMockTerrain(
  width = 50,
  height = 40,
  overrides?: Partial<TerrainProvider>
): TerrainProvider {
  return {
    getElevationAt: () => 0,
    getCourseStats: () => ({ health: 1, moisture: 0.5, nutrients: 0.5, height: 0.5 }),
    getWorldDimensions: () => ({ width, height }),
    getTerrainTypeAt: () => "fairway",
    isPositionWalkable: () => true,
    getTerrainSpeedAt: () => 1.0,
    findFaceAtPosition: () => null,
    mowAt: () => true,
    waterArea: () => 0,
    fertilizeArea: () => 0,
    ...overrides,
  };
}

function createMockEquipment(overrides?: Partial<EquipmentProvider>): EquipmentProvider {
  return {
    getSelected: () => null,
    getCurrentState: () => undefined,
    isActive: () => false,
    ...overrides,
  };
}

function createMockEngine(): EngineProvider & { setCameraTarget: ReturnType<typeof vi.fn>; updateCameraPan: ReturnType<typeof vi.fn> } {
  return {
    getScene: () =>
      ({
        getEngine: () => ({
          getRenderingCanvas: () => null,
        }),
        pick: vi.fn(() => ({ hit: false, pickedMesh: null })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(0, 10, 0),
          direction: new Vector3(0, -1, 0),
        })),
      }) as any,
    getCamera: () => ({ position: new Vector3(0, 10, -10) }),
    setCameraTarget: vi.fn() as any,
    updateCameraPan: vi.fn() as any,
  };
}

function createMockInput(held: Record<string, boolean> = {}): InputProvider {
  return {
    isDirectionKeyHeld: (dir) => held[dir] ?? false,
  };
}

function createMockEditor(enabled = false): EditorProvider {
  return { isEnabled: () => enabled };
}

describe("PlayerController", () => {
  let terrain: ReturnType<typeof createMockTerrain>;
  let equipment: ReturnType<typeof createMockEquipment>;
  let engine: ReturnType<typeof createMockEngine>;
  let input: ReturnType<typeof createMockInput>;
  let editor: ReturnType<typeof createMockEditor>;
  let controller: PlayerController;

  beforeEach(() => {
    vi.clearAllMocks();
    terrain = createMockTerrain();
    equipment = createMockEquipment();
    engine = createMockEngine();
    input = createMockInput();
    editor = createMockEditor();
    controller = new PlayerController(
      {} as any,
      terrain,
      equipment,
      engine,
      input,
      { editor, startX: 5, startY: 5 }
    );
  });

  describe("constructor", () => {
    it("uses default start position when not provided", () => {
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        engine,
        input
      );
      expect(ctrl.getPlayer().gridX).toBe(25);
      expect(ctrl.getPlayer().gridY).toBe(19);
    });

    it("uses provided start position", () => {
      expect(controller.getPlayer().gridX).toBe(5);
      expect(controller.getPlayer().gridY).toBe(5);
    });

    it("defaults editor and onEquipmentEffect to null without options", () => {
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        engine,
        input
      );
      ctrl.createPlayer();
      ctrl.teleport(3, 3);
      expect(ctrl.getPlayer().gridX).toBe(3);
    });
  });

  describe("getters and setters", () => {
    it("getPlayer / setPlayer", () => {
      const player = controller.getPlayer();
      expect(player.gridX).toBe(5);
      const modified = { ...player, gridX: 10 };
      controller.setPlayer(modified);
      expect(controller.getPlayer().gridX).toBe(10);
    });

    it("getPlayerVisual / setPlayerVisual", () => {
      expect(controller.getPlayerVisual()).toBeNull();
      const visual = { container: { position: { set: vi.fn() } } } as any;
      controller.setPlayerVisual(visual);
      expect(controller.getPlayerVisual()).toBe(visual);
    });

    it("getClickToMoveWaypoints / setClickToMoveWaypoints", () => {
      expect(controller.getClickToMoveWaypoints()).toEqual([]);
      controller.setClickToMoveWaypoints([{ x: 1, z: 2 }]);
      expect(controller.getClickToMoveWaypoints()).toEqual([{ x: 1, z: 2 }]);
    });

    it("getLastEquipmentFaceId / setLastEquipmentFaceId", () => {
      expect(controller.getLastEquipmentFaceId()).toBeNull();
      controller.setLastEquipmentFaceId(42);
      expect(controller.getLastEquipmentFaceId()).toBe(42);
    });

    it("getCameraFollowPlayer / setCameraFollowPlayer", () => {
      expect(controller.getCameraFollowPlayer()).toBe(true);
      controller.setCameraFollowPlayer(false);
      expect(controller.getCameraFollowPlayer()).toBe(false);
    });
  });

  describe("isMoving", () => {
    it("returns false when no visual", () => {
      expect(controller.isMoving()).toBe(false);
    });

    it("returns false when visual exists but no pending direction or waypoints", () => {
      controller.createPlayer();
      expect(controller.isMoving()).toBe(false);
    });

    it("returns true when pendingDirection is set", () => {
      controller.createPlayer();
      controller.handleMove("up");
      expect(controller.isMoving()).toBe(true);
    });

    it("returns true when waypoints exist", () => {
      controller.createPlayer();
      controller.setClickToMoveWaypoints([{ x: 10, z: 10 }]);
      expect(controller.isMoving()).toBe(true);
    });
  });

  describe("createPlayer", () => {
    it("creates a player visual", () => {
      controller.createPlayer();
      expect(controller.getPlayerVisual()).not.toBeNull();
    });

    it("passes elevation provider that delegates to terrain", () => {
      terrain.getElevationAt = vi.fn(() => 42);
      controller.createPlayer();
      const call = vi.mocked(createEntityMesh).mock.calls[
        vi.mocked(createEntityMesh).mock.calls.length - 1
      ];
      const elevProvider = call[5] as { getElevationAt: (x: number, y: number, d?: number) => number };
      const result = elevProvider.getElevationAt(10, 20, 0);
      expect(result).toBe(42);
      expect(terrain.getElevationAt).toHaveBeenCalledWith(10, 20, 0);
    });
  });

  describe("teleport", () => {
    it("moves player to target position", () => {
      controller.createPlayer();
      controller.teleport(10, 15);
      expect(controller.getPlayer().gridX).toBe(10);
      expect(controller.getPlayer().gridY).toBe(15);
      expect(controller.getPlayer().worldX).toBe(10.5);
      expect(controller.getPlayer().worldZ).toBe(15.5);
    });

    it("clears waypoints and lastEquipmentFaceId", () => {
      controller.createPlayer();
      controller.setClickToMoveWaypoints([{ x: 1, z: 1 }]);
      controller.setLastEquipmentFaceId(5);
      controller.teleport(10, 15);
      expect(controller.getClickToMoveWaypoints()).toEqual([]);
      expect(controller.getLastEquipmentFaceId()).toBeNull();
    });

    it("updates player visual properties", () => {
      controller.createPlayer();
      controller.teleport(10, 15);
      const visual = controller.getPlayerVisual()!;
      expect(visual.lastGridX).toBe(10);
      expect(visual.lastGridY).toBe(15);
      expect(visual.targetGridX).toBe(10);
      expect(visual.targetGridY).toBe(15);
      expect(visual.visualProgress).toBe(1);
    });

    it("works without player visual", () => {
      controller.teleport(10, 15);
      expect(controller.getPlayer().gridX).toBe(10);
    });

    it("rejects out-of-bounds teleport (negative x)", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      controller.teleport(-1, 5);
      expect(controller.getPlayer().gridX).toBe(5);
      spy.mockRestore();
    });

    it("rejects out-of-bounds teleport (x >= width)", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      controller.teleport(50, 5);
      expect(controller.getPlayer().gridX).toBe(5);
      spy.mockRestore();
    });

    it("rejects out-of-bounds teleport (negative y)", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      controller.teleport(5, -1);
      expect(controller.getPlayer().gridY).toBe(5);
      spy.mockRestore();
    });

    it("rejects out-of-bounds teleport (y >= height)", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      controller.teleport(5, 40);
      expect(controller.getPlayer().gridY).toBe(5);
      spy.mockRestore();
    });

    it("calls updatePlayerPosition after teleport", () => {
      controller.createPlayer();
      controller.setCameraFollowPlayer(true);
      controller.teleport(10, 15);
      expect(engine.setCameraTarget).toHaveBeenCalled();
    });
  });

  describe("updatePlayerPosition", () => {
    it("does nothing without player visual", () => {
      controller.updatePlayerPosition();
      expect(engine.setCameraTarget).not.toHaveBeenCalled();
    });

    it("sets container position with elevation", () => {
      terrain.getElevationAt = () => 5;
      controller.createPlayer();
      const visual = controller.getPlayerVisual()!;
      controller.updatePlayerPosition();
      expect(visual.container.position.set).toHaveBeenCalledWith(
        controller.getPlayer().worldX,
        5 * HEIGHT_UNIT,
        controller.getPlayer().worldZ
      );
    });

    it("updates camera target when cameraFollowPlayer is true", () => {
      controller.createPlayer();
      controller.updatePlayerPosition();
      expect(engine.setCameraTarget).toHaveBeenCalled();
    });

    it("does not update camera target when cameraFollowPlayer is false", () => {
      controller.createPlayer();
      controller.setCameraFollowPlayer(false);
      controller.updatePlayerPosition();
      expect(engine.setCameraTarget).not.toHaveBeenCalled();
    });
  });

  describe("handleMove", () => {
    it("sets pending direction and clears waypoints", () => {
      controller.setClickToMoveWaypoints([{ x: 1, z: 1 }]);
      controller.handleMove("up");
      expect(controller.getPlayer().pendingDirection).toBe("up");
      expect(controller.getPlayer().path).toEqual([]);
      expect(controller.getClickToMoveWaypoints()).toEqual([]);
    });

    it("handles all four directions", () => {
      for (const dir of ["up", "down", "left", "right"] as const) {
        controller.handleMove(dir);
        expect(controller.getPlayer().pendingDirection).toBe(dir);
      }
    });
  });

  describe("updateMovement", () => {
    beforeEach(() => {
      controller.createPlayer();
    });

    it("delegates to updateEditorCamera when editor is enabled", () => {
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        engine,
        createMockInput({ up: true }),
        { editor: createMockEditor(true) }
      );
      ctrl.createPlayer();
      ctrl.updateMovement(16);
      expect(engine.updateCameraPan).toHaveBeenCalled();
    });

    it("returns early without player visual", () => {
      controller.setPlayerVisual(null);
      controller.updateMovement(16);
      expect(engine.setCameraTarget).not.toHaveBeenCalled();
    });

    describe("keyboard movement", () => {
      it("moves player in held direction (up)", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startX = ctrl.getPlayer().worldX;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldX).toBeLessThan(startX);
      });

      it("moves player in held direction (down)", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startX = ctrl.getPlayer().worldX;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldX).toBeGreaterThan(startX);
      });

      it("moves player in held direction (left)", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ left: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startZ = ctrl.getPlayer().worldZ;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldZ).toBeLessThan(startZ);
      });

      it("moves player in held direction (right)", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ right: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startZ = ctrl.getPlayer().worldZ;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldZ).toBeGreaterThan(startZ);
      });

      it("moves diagonally when two keys held", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true, left: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startX = ctrl.getPlayer().worldX;
        const startZ = ctrl.getPlayer().worldZ;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldX).toBeLessThan(startX);
        expect(ctrl.getPlayer().worldZ).toBeLessThan(startZ);
      });

      it("clears click-to-move waypoints on keyboard input", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.setClickToMoveWaypoints([{ x: 30, z: 30 }]);
        ctrl.updateMovement(16);
        expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
      });

      it("sets facingAngle and isAnimating", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(ctrl.getPlayerVisual()!.isAnimating).toBe(true);
      });

      it("clamps delta to 100ms max", () => {
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.getPlayer().worldX;
        ctrl.updateMovement(500);
        const movedWith500 = ctrl.getPlayer().worldX;

        const ctrl2 = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl2.createPlayer();
        ctrl2.updateMovement(100);
        const movedWith100 = ctrl2.getPlayer().worldX;

        expect(movedWith500).toBeCloseTo(movedWith100, 5);
      });

      it("applies terrain speed factor with minimum 0.3", () => {
        const slowTerrain = createMockTerrain(50, 40, {
          getTerrainSpeedAt: () => 0.1,
        });
        const ctrl = new PlayerController(
          {} as any,
          slowTerrain,
          equipment,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startX = ctrl.getPlayer().worldX;
        ctrl.updateMovement(100);
        const delta = ctrl.getPlayer().worldX - startX;
        const expectedSpeed = PLAYER_BASE_SPEED * 0.3;
        const expectedDelta = expectedSpeed * (100 / 1000);
        expect(Math.abs(delta)).toBeCloseTo(expectedDelta, 3);
      });

      it("slides along X axis when target blocked but X component walkable", () => {
        let callCount = 0;
        const blockedTerrain = createMockTerrain(50, 40, {
          isPositionWalkable: (_x, _z) => {
            callCount++;
            if (callCount === 1) return false;
            if (callCount === 2) return true;
            return true;
          },
        });
        const ctrl = new PlayerController(
          {} as any,
          blockedTerrain,
          equipment,
          engine,
          createMockInput({ up: true, left: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldX).not.toBe(25.5);
      });

      it("slides along Z axis when target and X blocked but Z walkable", () => {
        let callCount = 0;
        const blockedTerrain = createMockTerrain(50, 40, {
          isPositionWalkable: () => {
            callCount++;
            if (callCount <= 2) return false;
            return true;
          },
        });
        const ctrl = new PlayerController(
          {} as any,
          blockedTerrain,
          equipment,
          engine,
          createMockInput({ up: true, left: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldZ).not.toBe(25.5);
      });

      it("does not move when all directions are blocked", () => {
        const blockedTerrain = createMockTerrain(50, 40, {
          isPositionWalkable: () => false,
        });
        const ctrl = new PlayerController(
          {} as any,
          blockedTerrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        const startX = ctrl.getPlayer().worldX;
        const startZ = ctrl.getPlayer().worldZ;
        ctrl.updateMovement(16);
        expect(ctrl.getPlayer().worldX).toBe(startX);
        expect(ctrl.getPlayer().worldZ).toBe(startZ);
      });
    });

    describe("click-to-move waypoints", () => {
      it("follows waypoints when no key input", () => {
        controller.setClickToMoveWaypoints([{ x: 10, z: 10 }]);
        const startX = controller.getPlayer().worldX;
        controller.updateMovement(16);
        expect(controller.getPlayer().worldX).not.toBe(startX);
      });

      it("shifts waypoint when close enough (< 0.1)", () => {
        controller.setClickToMoveWaypoints([
          { x: controller.getPlayer().worldX + 0.05, z: controller.getPlayer().worldZ },
          { x: 10, z: 10 },
        ]);
        controller.updateMovement(16);
        expect(controller.getClickToMoveWaypoints().length).toBeLessThanOrEqual(1);
      });

      it("clears waypoints when path is blocked", () => {
        const blockedTerrain = createMockTerrain(50, 40, {
          isPositionWalkable: () => false,
        });
        const ctrl = new PlayerController(
          {} as any,
          blockedTerrain,
          equipment,
          engine,
          input,
          { editor, startX: 5, startY: 5 }
        );
        ctrl.createPlayer();
        ctrl.setClickToMoveWaypoints([{ x: 10, z: 10 }]);
        ctrl.updateMovement(16);
        expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
      });

      it("sets facingAngle and isAnimating during waypoint following", () => {
        controller.setClickToMoveWaypoints([{ x: 10, z: 10 }]);
        controller.updateMovement(16);
        expect(controller.getPlayerVisual()!.isAnimating).toBe(true);
      });

      it("limits movement distance to remaining distance to waypoint", () => {
        const wx = controller.getPlayer().worldX + 0.2;
        const wz = controller.getPlayer().worldZ;
        controller.setClickToMoveWaypoints([{ x: wx, z: wz }]);
        controller.updateMovement(5000);
        expect(controller.getPlayer().worldX).toBeCloseTo(wx, 1);
      });
    });

    describe("idle state", () => {
      it("stops animating when no input and no waypoints", () => {
        controller.updateMovement(16);
        expect(controller.getPlayerVisual()!.isAnimating).toBe(false);
      });

      it("clears pendingDirection when idle", () => {
        controller.handleMove("up");
        expect(controller.getPlayer().pendingDirection).toBe("up");
        controller.updateMovement(16);
        expect(controller.getPlayer().pendingDirection).toBeNull();
      });

      it("does not clear already-null pendingDirection", () => {
        const before = controller.getPlayer();
        expect(before.pendingDirection).toBeNull();
        controller.updateMovement(16);
        expect(controller.getPlayer().pendingDirection).toBeNull();
      });
    });

    describe("mesh rotation", () => {
      it("updates mesh rotation when meshInstance exists", () => {
        const mockRoot = { rotation: { y: 0 } };
        const visual = controller.getPlayerVisual()!;
        visual.meshInstance = { root: mockRoot } as any;
        const ctrl2 = new PlayerController(
          {} as any,
          terrain,
          equipment,
          engine,
          createMockInput({ up: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl2.createPlayer();
        const v2 = ctrl2.getPlayerVisual()!;
        v2.meshInstance = { root: mockRoot } as any;
        ctrl2.updateMovement(16);
        expect(mockRoot.rotation.y).toBe(v2.facingAngle);
      });

      it("skips mesh rotation when meshInstance is null", () => {
        controller.updateMovement(16);
        expect(controller.getPlayerVisual()!.meshInstance).toBeNull();
      });
    });

    describe("camera follow", () => {
      it("updates camera target when following", () => {
        controller.updateMovement(16);
        expect(engine.setCameraTarget).toHaveBeenCalled();
      });

      it("does not update camera target when not following", () => {
        controller.setCameraFollowPlayer(false);
        controller.updateMovement(16);
        expect(engine.setCameraTarget).not.toHaveBeenCalled();
      });
    });

    describe("equipment effects", () => {
      it("triggers equipment effect on new face when equipment active", () => {
        const effectCb = vi.fn();
        const faceIds = [1];
        const faceTerrain = createMockTerrain(50, 40, {
          findFaceAtPosition: () => faceIds[0],
        });
        const activeEquip = createMockEquipment({ isActive: () => true });
        const ctrl = new PlayerController(
          {} as any,
          faceTerrain,
          activeEquip,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25, onEquipmentEffect: effectCb }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(effectCb).toHaveBeenCalled();
      });

      it("does not trigger effect on same face", () => {
        const effectCb = vi.fn();
        const faceTerrain = createMockTerrain(50, 40, {
          findFaceAtPosition: () => 1,
        });
        const activeEquip = createMockEquipment({ isActive: () => true });
        const ctrl = new PlayerController(
          {} as any,
          faceTerrain,
          activeEquip,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25, onEquipmentEffect: effectCb }
        );
        ctrl.createPlayer();
        ctrl.setLastEquipmentFaceId(1);
        ctrl.updateMovement(16);
        expect(effectCb).not.toHaveBeenCalled();
      });

      it("does not trigger effect when equipment is not active", () => {
        const effectCb = vi.fn();
        const faceTerrain = createMockTerrain(50, 40, {
          findFaceAtPosition: () => 1,
        });
        const ctrl = new PlayerController(
          {} as any,
          faceTerrain,
          equipment,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25, onEquipmentEffect: effectCb }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(effectCb).not.toHaveBeenCalled();
      });

      it("does not trigger effect when face is null", () => {
        const effectCb = vi.fn();
        const activeEquip = createMockEquipment({ isActive: () => true });
        const ctrl = new PlayerController(
          {} as any,
          terrain,
          activeEquip,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25, onEquipmentEffect: effectCb }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(effectCb).not.toHaveBeenCalled();
      });

      it("updates lastEquipmentFaceId when face changes regardless of equipment", () => {
        const faceTerrain = createMockTerrain(50, 40, {
          findFaceAtPosition: () => 7,
        });
        const ctrl = new PlayerController(
          {} as any,
          faceTerrain,
          equipment,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(ctrl.getLastEquipmentFaceId()).toBe(7);
      });

      it("works without onEquipmentEffect callback when equipment active on new face", () => {
        const faceTerrain = createMockTerrain(50, 40, {
          findFaceAtPosition: () => 1,
        });
        const activeEquip = createMockEquipment({ isActive: () => true });
        const ctrl = new PlayerController(
          {} as any,
          faceTerrain,
          activeEquip,
          engine,
          createMockInput({ down: true }),
          { editor, startX: 25, startY: 25 }
        );
        ctrl.createPlayer();
        ctrl.updateMovement(16);
        expect(ctrl.getLastEquipmentFaceId()).toBe(1);
      });
    });
  });

  describe("handleClick", () => {
    it("returns early when screenToGrid returns null (no canvas)", () => {
      controller.createPlayer();
      controller.handleClick(100, 100);
      expect(controller.getClickToMoveWaypoints()).toEqual([]);
    });

    it("returns early when target is out of bounds", () => {
      controller.createPlayer();
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_100_100" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });

    it("returns early when target cell is water", () => {
      const waterTerrain = createMockTerrain(50, 40, {
        getTerrainTypeAt: () => "water",
      });
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_10_10" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        waterTerrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });

    it("returns early when target cell is null", () => {
      const nullTerrain = createMockTerrain(50, 40, {
        getTerrainTypeAt: () => undefined,
      });
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_10_10" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        nullTerrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });

    it("returns early when clicking player current position", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_5_5" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });

    it("generates waypoints for valid click target", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_7_5" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints().length).toBeGreaterThan(0);
      expect(ctrl.getPlayer().pendingDirection).toBeNull();
    });

    it("does not set waypoints when no path found", () => {
      const blockedTerrain = createMockTerrain(50, 40, {
        getTerrainTypeAt: (wx, wz) => {
          const x = Math.floor(wx);
          const y = Math.floor(wz);
          if (x === 6 && y === 5) return "water";
          if (x === 5 && y === 6) return "water";
          if (x === 5 && y === 4) return "water";
          if (x === 4 && y === 5) return "water";
          return "fairway";
        },
      });
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_10_10" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        blockedTerrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(400, 300);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });
  });

  describe("screenToGridFromScreen", () => {
    it("returns null when no canvas", () => {
      const result = controller.screenToGridFromScreen(100, 100);
      expect(result).toBeNull();
    });

    it("parses tile mesh name for grid position", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "tile_12_8" },
        })),
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toEqual({ x: 12, y: 8 });
    });

    it("falls back to raycast when no tile mesh hit", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false, pickedMesh: null })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(10, 10, 15),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toEqual({ x: 10, y: 15 });
    });

    it("applies DPI scaling to coordinates", () => {
      const pickFn = vi.fn(() => ({
        hit: true,
        pickedMesh: { name: "tile_5_5" },
      }));
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 1600,
            height: 1200,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: pickFn,
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      ctrl.screenToGridFromScreen(400, 300);
      expect(pickFn).toHaveBeenCalledWith(800, 600, expect.any(Function));
    });

    it("pick predicate filters for tile_ meshes", () => {
      const pickFn = vi.fn((_cx, _cy, predicate) => {
        const tileMesh = { name: "tile_3_4" };
        const otherMesh = { name: "ground" };
        expect(predicate(tileMesh)).toBe(true);
        expect(predicate(otherMesh)).toBe(false);
        return { hit: true, pickedMesh: tileMesh };
      });
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: pickFn,
        createPickingRay: vi.fn(),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      ctrl.screenToGridFromScreen(400, 300);
      expect(pickFn).toHaveBeenCalled();
    });

    it("falls back to raycast when hit mesh name does not match tile pattern", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({
          hit: true,
          pickedMesh: { name: "ground_mesh" },
        })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(5, 10, 8),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toEqual({ x: 5, y: 8 });
    });
  });

  describe("raycastToGround", () => {
    it("returns null when ray direction y is 0", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(5, 10, 5),
          direction: new Vector3(1, 0, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toBeNull();
    });

    it("returns null when t < 0 (ray going away from ground)", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(5, 10, 5),
          direction: new Vector3(0, 1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toBeNull();
    });

    it("returns null when raycast result is out of bounds", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(100, 10, 100),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toBeNull();
    });

    it("returns null for negative raycast grid positions", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(-5, 10, -5),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor }
      );
      const result = ctrl.screenToGridFromScreen(400, 300);
      expect(result).toBeNull();
    });
  });

  describe("findPath", () => {
    it("finds a direct path with no obstacles", () => {
      const path = controller.findPath(0, 0, 3, 0);
      expect(path).toEqual([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]);
    });

    it("finds path around obstacles", () => {
      const obstacleTerrain = createMockTerrain(10, 10, {
        getTerrainTypeAt: (wx, wz) => {
          if (Math.floor(wx) === 2 && Math.floor(wz) === 0) return "water";
          return "fairway";
        },
      });
      const ctrl = new PlayerController(
        {} as any,
        obstacleTerrain,
        equipment,
        engine,
        input,
        { editor, startX: 0, startY: 0 }
      );
      const path = ctrl.findPath(0, 0, 3, 0);
      expect(path.length).toBeGreaterThan(3);
      expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
      expect(path.find((p) => p.x === 2 && p.y === 0)).toBeUndefined();
    });

    it("returns empty array when no path exists", () => {
      const blockedTerrain = createMockTerrain(10, 10, {
        getTerrainTypeAt: (wx) => {
          if (Math.floor(wx) === 1) return "water";
          return "fairway";
        },
      });
      const ctrl = new PlayerController(
        {} as any,
        blockedTerrain,
        equipment,
        engine,
        input,
        { editor }
      );
      const path = ctrl.findPath(0, 0, 5, 0);
      expect(path).toEqual([]);
    });

    it("returns empty array for start == end", () => {
      const path = controller.findPath(5, 5, 5, 5);
      expect(path).toEqual([]);
    });

    it("does not include start node in path", () => {
      const path = controller.findPath(0, 0, 2, 0);
      expect(path[0]).toEqual({ x: 1, y: 0 });
    });

    it("respects grid boundaries", () => {
      const smallTerrain = createMockTerrain(5, 5);
      const ctrl = new PlayerController(
        {} as any,
        smallTerrain,
        equipment,
        engine,
        input,
        { editor, startX: 0, startY: 0 }
      );
      const path = ctrl.findPath(0, 0, 4, 4);
      for (const node of path) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThan(5);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThan(5);
      }
    });

    it("avoids cells rejected by isPositionWalkable", () => {
      const unwalkableTerrain = createMockTerrain(50, 40, {
        isPositionWalkable: (wx, wz) => !(Math.floor(wx) === 1 && Math.floor(wz) === 0),
      });
      const ctrl = new PlayerController(
        {} as any,
        unwalkableTerrain,
        equipment,
        engine,
        input,
        { editor, startX: 0, startY: 0 }
      );
      const path = ctrl.findPath(0, 0, 2, 0);
      expect(path.find((p) => p.x === 1 && p.y === 0)).toBeUndefined();
      if (path.length > 0) {
        expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
      }
    });

    it("updates existing node in open set when finding shorter path", () => {
      const customTerrain = createMockTerrain(10, 10, {
        getTerrainTypeAt: (wx, wz) => {
          if (Math.floor(wx) === 1 && Math.floor(wz) === 0) return "water";
          return "fairway";
        },
      });
      const ctrl = new PlayerController(
        {} as any,
        customTerrain,
        equipment,
        engine,
        input,
        { editor }
      );
      const path = ctrl.findPath(0, 0, 3, 0);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
    });

    it("handles multiple paths to same neighbor in open set", () => {
      const customTerrain = createMockTerrain(6, 4, {
        getTerrainTypeAt: (wx, wz) => {
          const x = Math.floor(wx);
          const y = Math.floor(wz);
          if (x === 1 && y === 0) return "water";
          if (x === 0 && y === 2) return "water";
          if (x === 2 && y === 2) return "water";
          return "fairway";
        },
      });
      const ctrl = new PlayerController(
        {} as any,
        customTerrain,
        equipment,
        engine,
        input,
        { editor }
      );
      const path = ctrl.findPath(0, 0, 5, 0);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual({ x: 5, y: 0 });
    });

    it("handles null cells at boundary", () => {
      const edgeTerrain = createMockTerrain(3, 3);
      const ctrl = new PlayerController(
        {} as any,
        edgeTerrain,
        equipment,
        engine,
        input,
        { editor }
      );
      const path = ctrl.findPath(0, 0, 2, 2);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe("updateEditorCamera", () => {
    it("passes held directions to engine updateCameraPan", () => {
      const inp = createMockInput({ up: true, left: true });
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        engine,
        inp,
        { editor: createMockEditor(true) }
      );
      ctrl.updateEditorCamera(16);
      expect(engine.updateCameraPan).toHaveBeenCalledWith(16, {
        up: true,
        down: false,
        left: true,
        right: false,
      });
    });
  });

  describe("dispose", () => {
    it("disposes player visual", () => {
      controller.createPlayer();
      expect(controller.getPlayerVisual()).not.toBeNull();
      controller.dispose();
      expect(controller.getPlayerVisual()).toBeNull();
      expect(disposeEntityMesh).toHaveBeenCalled();
    });

    it("does nothing when no visual exists", () => {
      controller.dispose();
      expect(disposeEntityMesh).not.toHaveBeenCalled();
    });
  });

  describe("handleClick with negative boundary", () => {
    it("rejects click with negative x coordinate", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(-2, 10, 5),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(100, 100);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });

    it("rejects click with negative y coordinate", () => {
      const mockScene = {
        getEngine: () => ({
          getRenderingCanvas: () => ({
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          }),
        }),
        pick: vi.fn(() => ({ hit: false })),
        createPickingRay: vi.fn(() => ({
          origin: new Vector3(5, 10, -2),
          direction: new Vector3(0, -1, 0),
        })),
      };
      const eng = {
        ...engine,
        getScene: () => mockScene as any,
        getCamera: () => ({ position: new Vector3(0, 10, -10) }),
      };
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        eng,
        input,
        { editor, startX: 5, startY: 5 }
      );
      ctrl.createPlayer();
      ctrl.handleClick(100, 100);
      expect(ctrl.getClickToMoveWaypoints()).toEqual([]);
    });
  });

  describe("edge: editor null", () => {
    it("updateMovement proceeds normally when editor is null", () => {
      const ctrl = new PlayerController(
        {} as any,
        terrain,
        equipment,
        engine,
        input,
        { startX: 25, startY: 25 }
      );
      ctrl.createPlayer();
      ctrl.updateMovement(16);
      expect(ctrl.getPlayerVisual()!.isAnimating).toBe(false);
    });
  });
});
