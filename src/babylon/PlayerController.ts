import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HEIGHT_UNIT } from "./engine/BabylonEngine";
import { MovableCell, canMoveFromTo } from "../core/terrain";
import {
  PlayerEntity,
  createPlayerEntity,
  teleportEntity,
  PLAYER_BASE_SPEED,
} from "../core/movable-entity";
import {
  EntityVisualState,
  PLAYER_APPEARANCE,
  createEntityMesh,
  disposeEntityMesh,
} from "./systems/EntityVisualSystem";
import { EquipmentType, EquipmentState } from "../core/equipment-logic";

export interface TerrainProvider {
  getCell(x: number, y: number): MovableCell | null;
  getElevationAt(x: number, y: number, defaultForOutOfBounds?: number): number;
  getCourseStats(): { health: number; moisture: number; nutrients: number; height: number };
  getGridDimensions(): { width: number; height: number };
  isPositionWalkable(worldX: number, worldZ: number): boolean;
  getTerrainSpeedAt(worldX: number, worldZ: number): number;
  findFaceAtPosition(worldX: number, worldZ: number): number | null;
  mowAt(gridX: number, gridY: number): boolean;
  waterArea(centerX: number, centerY: number, radius: number, amount: number): number;
  fertilizeArea(centerX: number, centerY: number, radius: number, amount: number, effectiveness?: number): number;
  getResolution?(): number;
}

export interface EquipmentProvider {
  getSelected(): EquipmentType | null;
  getCurrentState(): EquipmentState | undefined;
  isActive(): boolean;
}

export interface EngineProvider {
  getScene(): Scene;
  getCamera(): { position: Vector3 };
  setCameraTarget(target: Vector3): void;
  updateCameraPan(deltaMs: number, directions: { up: boolean; down: boolean; left: boolean; right: boolean }): void;
}

export interface InputProvider {
  isDirectionKeyHeld(direction: 'up' | 'down' | 'left' | 'right'): boolean;
}

export interface EditorProvider {
  isEnabled(): boolean;
}

export interface EquipmentEffectCallback {
  (x: number, y: number): void;
}

export class PlayerController {
  private player: PlayerEntity;
  private playerVisual: EntityVisualState | null = null;
  private cameraFollowPlayer: boolean = true;
  private lastEquipmentFaceId: number | null = null;
  private clickToMoveWaypoints: Array<{ x: number; z: number }> = [];

  private scene: Scene;
  private terrain: TerrainProvider;
  private equipment: EquipmentProvider;
  private engine: EngineProvider;
  private input: InputProvider;
  private editor: EditorProvider | null;
  private onEquipmentEffect: EquipmentEffectCallback | null;

  constructor(
    scene: Scene,
    terrain: TerrainProvider,
    equipment: EquipmentProvider,
    engine: EngineProvider,
    input: InputProvider,
    options?: {
      editor?: EditorProvider;
      onEquipmentEffect?: EquipmentEffectCallback;
      startX?: number;
      startY?: number;
    }
  ) {
    this.scene = scene;
    this.terrain = terrain;
    this.equipment = equipment;
    this.engine = engine;
    this.input = input;
    this.editor = options?.editor ?? null;
    this.onEquipmentEffect = options?.onEquipmentEffect ?? null;

    const startX = options?.startX ?? 25;
    const startY = options?.startY ?? 19;
    this.player = createPlayerEntity("player", startX, startY);
  }

  getPlayer(): PlayerEntity {
    return this.player;
  }

  setPlayer(v: PlayerEntity): void {
    this.player = v;
  }

  getPlayerVisual(): EntityVisualState | null {
    return this.playerVisual;
  }

  setPlayerVisual(v: EntityVisualState | null): void {
    this.playerVisual = v;
  }

  getClickToMoveWaypoints(): Array<{ x: number; z: number }> {
    return this.clickToMoveWaypoints;
  }

  setClickToMoveWaypoints(v: Array<{ x: number; z: number }>): void {
    this.clickToMoveWaypoints = v;
  }

  getLastEquipmentFaceId(): number | null {
    return this.lastEquipmentFaceId;
  }

  setLastEquipmentFaceId(v: number | null): void {
    this.lastEquipmentFaceId = v;
  }

  getCameraFollowPlayer(): boolean {
    return this.cameraFollowPlayer;
  }

  setCameraFollowPlayer(follow: boolean): void {
    this.cameraFollowPlayer = follow;
  }

  isMoving(): boolean {
    return this.playerVisual !== null && (
      this.player.pendingDirection !== null ||
      this.clickToMoveWaypoints.length > 0
    );
  }

  createPlayer(): void {
    this.playerVisual = createEntityMesh(
      this.scene,
      "player",
      PLAYER_APPEARANCE,
      this.player.gridX,
      this.player.gridY,
      { getElevationAt: (x, y, d) => this.terrain.getElevationAt(x, y, d) }
    );
  }

  teleport(x: number, y: number): void {
    const dims = this.terrain.getGridDimensions();
    if (x < 0 || x >= dims.width || y < 0 || y >= dims.height) {
      console.warn(`Teleport target (${x}, ${y}) is out of bounds.`);
      return;
    }

    this.player = {
      ...teleportEntity(this.player, x, y),
      worldX: x + 0.5,
      worldZ: y + 0.5,
    };
    this.clickToMoveWaypoints = [];
    this.lastEquipmentFaceId = null;

    if (this.playerVisual) {
      this.playerVisual.lastGridX = x;
      this.playerVisual.lastGridY = y;
      this.playerVisual.targetGridX = x;
      this.playerVisual.targetGridY = y;
      this.playerVisual.visualProgress = 1;
    }

    this.updatePlayerPosition();
  }

  updatePlayerPosition(): void {
    if (!this.playerVisual) return;

    const elev = this.terrain.getElevationAt(
      this.player.worldX,
      this.player.worldZ,
      0
    ) * HEIGHT_UNIT;
    this.playerVisual.container.position.set(this.player.worldX, elev, this.player.worldZ);

    if (this.cameraFollowPlayer) {
      this.engine.setCameraTarget(this.playerVisual.container.position);
    }
  }

  updateMovement(deltaMs: number): void {
    if (this.editor?.isEnabled()) {
      this.updateEditorCamera(deltaMs);
      return;
    }

    if (!this.playerVisual) return;

    const clampedDelta = Math.min(deltaMs, 100);

    const dir = this.getHeldDirectionVector();
    const hasKeyInput = dir.dx !== 0 || dir.dz !== 0;

    if (hasKeyInput) {
      this.clickToMoveWaypoints = [];

      const len = Math.sqrt(dir.dx * dir.dx + dir.dz * dir.dz);
      const ndx = dir.dx / len;
      const ndz = dir.dz / len;

      const terrainSpeed = this.terrain.getTerrainSpeedAt(this.player.worldX, this.player.worldZ);
      const speed = PLAYER_BASE_SPEED * Math.max(terrainSpeed, 0.3);
      const delta = speed * (clampedDelta / 1000);
      const targetX = this.player.worldX + ndx * delta;
      const targetZ = this.player.worldZ + ndz * delta;

      if (this.terrain.isPositionWalkable(targetX, targetZ)) {
        this.movePlayerTo(targetX, targetZ);
      } else if (this.terrain.isPositionWalkable(targetX, this.player.worldZ)) {
        this.movePlayerTo(targetX, this.player.worldZ);
      } else if (this.terrain.isPositionWalkable(this.player.worldX, targetZ)) {
        this.movePlayerTo(this.player.worldX, targetZ);
      }

      this.playerVisual.facingAngle = Math.atan2(ndx, ndz);
      this.playerVisual.isAnimating = true;
    } else if (this.clickToMoveWaypoints.length > 0) {
      const wp = this.clickToMoveWaypoints[0];
      const dx = wp.x - this.player.worldX;
      const dz = wp.z - this.player.worldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.1) {
        this.clickToMoveWaypoints.shift();
      } else {
        const ndx = dx / dist;
        const ndz = dz / dist;
        const terrainSpeed = this.terrain.getTerrainSpeedAt(this.player.worldX, this.player.worldZ);
        const speed = PLAYER_BASE_SPEED * Math.max(terrainSpeed, 0.3);
        const delta = Math.min(speed * (clampedDelta / 1000), dist);
        const targetX = this.player.worldX + ndx * delta;
        const targetZ = this.player.worldZ + ndz * delta;

        if (this.terrain.isPositionWalkable(targetX, targetZ)) {
          this.movePlayerTo(targetX, targetZ);
        } else {
          this.clickToMoveWaypoints = [];
        }

        this.playerVisual.facingAngle = Math.atan2(ndx, ndz);
        this.playerVisual.isAnimating = true;
      }
    } else {
      this.playerVisual.isAnimating = false;
      if (this.player.pendingDirection !== null) {
        this.player = { ...this.player, pendingDirection: null };
      }
    }

    if (this.playerVisual.meshInstance) {
      this.playerVisual.meshInstance.root.rotation.y = this.playerVisual.facingAngle;
    }

    const elev = this.terrain.getElevationAt(
      this.player.worldX,
      this.player.worldZ,
      0
    ) * HEIGHT_UNIT;
    this.playerVisual.container.position.set(this.player.worldX, elev, this.player.worldZ);

    if (this.cameraFollowPlayer) {
      this.engine.setCameraTarget(this.playerVisual.container.position);
    }
  }

  handleMove(direction: 'up' | 'down' | 'left' | 'right'): void {
    this.player = { ...this.player, pendingDirection: direction, path: [] };
    this.clickToMoveWaypoints = [];
  }

  handleClick(screenX: number, screenY: number): void {
    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (!gridPos) return;

    const dims = this.terrain.getGridDimensions();
    if (
      gridPos.x < 0 ||
      gridPos.x >= dims.width ||
      gridPos.y < 0 ||
      gridPos.y >= dims.height
    ) {
      return;
    }

    const targetCell = this.terrain.getCell(gridPos.x, gridPos.y);
    if (!targetCell || targetCell.type === "water") return;

    if (gridPos.x === this.player.gridX && gridPos.y === this.player.gridY) {
      return;
    }

    const slopeChecker = (x: number, y: number) =>
      this.terrain.isPositionWalkable(x + 0.5, y + 0.5);

    const path = this.findPath(
      this.player.gridX,
      this.player.gridY,
      gridPos.x,
      gridPos.y,
      slopeChecker
    );
    if (path.length > 0) {
      this.clickToMoveWaypoints = path.map(p => ({ x: p.x + 0.5, z: p.y + 0.5 }));
      this.player = { ...this.player, pendingDirection: null, path: [] };
    }
  }

  screenToGridFromScreen(
    screenX: number,
    screenY: number
  ): { x: number; y: number } | null {
    const scene = this.engine.getScene();
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    const pickResult = scene.pick(canvasX, canvasY, (mesh) => {
      return mesh.name.startsWith("tile_");
    });

    if (pickResult?.hit && pickResult.pickedMesh) {
      const match = pickResult.pickedMesh.name.match(/^tile_(\d+)_(\d+)/);
      if (match) {
        return { x: parseInt(match[1]), y: parseInt(match[2]) };
      }
    }

    return this.raycastToGround(canvasX, canvasY);
  }

  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    slopeChecker?: (x: number, y: number) => boolean
  ): { x: number; y: number }[] {
    interface PathNode {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent: PathNode | null;
    }

    const dims = this.terrain.getGridDimensions();
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const heuristic = (x: number, y: number) =>
      Math.abs(x - endX) + Math.abs(y - endY);

    openSet.push({
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY),
      f: heuristic(startX, startY),
      parent: null,
    });

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      if (current.x === endX && current.y === endY) {
        const path: { x: number; y: number }[] = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      closedSet.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x < 0 ||
          neighbor.x >= dims.width ||
          neighbor.y < 0 ||
          neighbor.y >= dims.height
        )
          continue;
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

        const fromCell = this.terrain.getCell(current.x, current.y);
        const toCell = this.terrain.getCell(neighbor.x, neighbor.y);
        if (!canMoveFromTo(fromCell, toCell, slopeChecker)) continue;

        const g = current.g + 1;
        const h = heuristic(neighbor.x, neighbor.y);
        const f = g + h;

        const alreadyOpen = openSet.some(
          (n) => n.x === neighbor.x && n.y === neighbor.y
        );
        if (!alreadyOpen) {
          openSet.push({
            x: neighbor.x,
            y: neighbor.y,
            g,
            h,
            f,
            parent: current,
          });
        }
      }
    }

    return [];
  }

  updateEditorCamera(deltaMs: number): void {
    this.engine.updateCameraPan(deltaMs, {
      up: this.input.isDirectionKeyHeld('up'),
      down: this.input.isDirectionKeyHeld('down'),
      left: this.input.isDirectionKeyHeld('left'),
      right: this.input.isDirectionKeyHeld('right'),
    });
  }

  dispose(): void {
    if (this.playerVisual) {
      disposeEntityMesh(this.playerVisual);
      this.playerVisual = null;
    }
  }

  private getHeldDirectionVector(): { dx: number; dz: number } {
    let dx = 0;
    let dz = 0;
    if (this.input.isDirectionKeyHeld('up')) dx -= 1;
    if (this.input.isDirectionKeyHeld('down')) dx += 1;
    if (this.input.isDirectionKeyHeld('left')) dz -= 1;
    if (this.input.isDirectionKeyHeld('right')) dz += 1;
    return { dx, dz };
  }

  private movePlayerTo(targetX: number, targetZ: number): void {
    this.player = {
      ...this.player,
      worldX: targetX,
      worldZ: targetZ,
      gridX: Math.floor(targetX),
      gridY: Math.floor(targetZ),
    };

    const currentFace = this.terrain.findFaceAtPosition(targetX, targetZ);
    if (currentFace !== null && currentFace !== this.lastEquipmentFaceId) {
      if (this.equipment.isActive()) {
        if (this.onEquipmentEffect) {
          this.onEquipmentEffect(Math.floor(targetX), Math.floor(targetZ));
        }
      }
      this.lastEquipmentFaceId = currentFace;
    }
  }

  private raycastToGround(
    canvasX: number,
    canvasY: number
  ): { x: number; y: number } | null {
    const scene = this.engine.getScene();
    const camera = this.engine.getCamera();
    const ray = scene.createPickingRay(canvasX, canvasY, null, camera as any);

    if (ray.direction.y === 0) return null;

    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const groundX = ray.origin.x + ray.direction.x * t;
    const groundZ = ray.origin.z + ray.direction.z * t;

    const gridX = Math.floor(groundX);
    const gridY = Math.floor(groundZ);

    const dims = this.terrain.getGridDimensions();
    if (
      gridX < 0 ||
      gridX >= dims.width ||
      gridY < 0 ||
      gridY >= dims.height
    ) {
      return null;
    }

    return { x: gridX, y: gridY };
  }
}
