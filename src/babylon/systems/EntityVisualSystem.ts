import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { SpriteManager, Sprite } from "@babylonjs/core/Sprites";
import { gridTo3D } from "../engine/BabylonEngine";
import { MOVE_DURATION_MS } from "../../core/movable-entity";

export const SPRITE_FRAMES_PER_DIRECTION = 6;
export const SPRITE_DIRECTIONS_COUNT = 8;
export const SPRITE_ANIMATION_SPEED_MS = 150;

export const ANIM_TYPE_WALK = 0;
export const ANIM_TYPE_PUSHING = 1;


export interface EntityAppearance {
  readonly bodyColor: Color3;
  readonly bodyEmissive: Color3;
  readonly hatColor: Color3;
  readonly hatEmissive: Color3;
  readonly scale: number;
  readonly hasHatBrim: boolean;
}

export interface EntityVisualState {
  container: Mesh;
  sprite: Sprite;
  equipmentSprite: Sprite | null;
  lastGridX: number;
  lastGridY: number;
  targetGridX: number;
  targetGridY: number;
  visualProgress: number;
  direction: number; // 0-7: S, N, W, E, SE, SW, NE, NW
  animationType: number; // 0=walk, 1=pushing
  isAnimating: boolean;
}

export interface ElevationProvider {
  getElevationAt(gridX: number, gridY: number, defaultValue?: number): number;
}

export const PLAYER_APPEARANCE: EntityAppearance = {
  bodyColor: new Color3(0.11, 0.48, 0.24), // Ignored by sprite
  bodyEmissive: new Color3(0.06, 0.24, 0.12),
  hatColor: new Color3(0.9, 0.9, 0.85),
  hatEmissive: new Color3(0.45, 0.45, 0.42),
  scale: 0.5,
  hasHatBrim: true,
};

export const EMPLOYEE_APPEARANCE: EntityAppearance = {
  bodyColor: new Color3(0.4, 0.35, 0.3), // Ignored by sprite
  bodyEmissive: new Color3(0.2, 0.17, 0.15),
  hatColor: new Color3(0.7, 0.5, 0.2),
  hatEmissive: new Color3(0.35, 0.25, 0.1),
  scale: 0.4,
  hasHatBrim: false,
};

let sharedSpriteManager: SpriteManager | null = null;
let equipmentSpriteManager: SpriteManager | null = null;

function getEquipmentSpriteManager(scene: Scene): SpriteManager {
  if (!equipmentSpriteManager || equipmentSpriteManager.scene !== scene) {
    equipmentSpriteManager = new SpriteManager(
      "equipmentManager",
      "/assets/textures/push_mower.png",
      50,
      { width: 48, height: 48 },
      scene
    );
    (equipmentSpriteManager as unknown as { billboardMode: number }).billboardMode = 2;
  }
  return equipmentSpriteManager;
}

export function createEntityMesh(
  scene: Scene,
  id: string,
  appearance: EntityAppearance,
  startX: number,
  startY: number
): EntityVisualState {
  const scale = appearance.scale;

  if (!sharedSpriteManager || sharedSpriteManager.scene !== scene) {
    sharedSpriteManager = new SpriteManager(
      "greenskeeperManager",
      "/assets/textures/greenkeeper_pixellab.png",
      200,
      { width: 48, height: 48 },
      scene
    );
    (sharedSpriteManager as unknown as { billboardMode: number }).billboardMode = 2;
    sharedSpriteManager.isPickable = true;
  }

  const container = MeshBuilder.CreateBox(`entity_${id}`, { size: 0.01 }, scene);
  container.isVisible = false;

  const sprite = new Sprite(`sprite_${id}`, sharedSpriteManager);
  sprite.height = 1.8 * scale;
  sprite.width = 1.8 * scale;
  sprite.cellIndex = 0;

  return {
    container,
    sprite,
    equipmentSprite: null,
    lastGridX: startX,
    lastGridY: startY,
    targetGridX: startX,
    targetGridY: startY,
    visualProgress: 1,
    direction: 0,
    animationType: ANIM_TYPE_WALK,
    isAnimating: false,
  };
}

export function getIsometricDirectionIndex(dx: number, dy: number, currentDir: number): number {
  if (dx === 0 && dy === 0) return currentDir;

  // Sprite sheet rows: S=0, N=1, W=2, E=3, SE=4, SW=5, NE=6, NW=7
  // Screen directions: NE=top-right, NW=top-left, SE=bottom-right, SW=bottom-left
  // Grid movement: dx- = screen top-right, dx+ = screen bottom-left
  //                dy- = screen top-left, dy+ = screen bottom-right
  const DIR_S = 0, DIR_N = 1, DIR_W = 2, DIR_E = 3;
  const DIR_SE = 4, DIR_SW = 5, DIR_NE = 6, DIR_NW = 7;

  // Cardinal directions (one axis only)
  if (dx < 0 && dy === 0) return DIR_NE;  // up key → top-right
  if (dx > 0 && dy === 0) return DIR_SW;  // down key → bottom-left
  if (dy < 0 && dx === 0) return DIR_NW;  // left key → top-left
  if (dy > 0 && dx === 0) return DIR_SE;  // right key → bottom-right

  // Diagonal directions (both axes)
  if (dx < 0 && dy < 0) return DIR_N;   // up+left → top
  if (dx > 0 && dy > 0) return DIR_S;   // down+right → bottom
  if (dx < 0 && dy > 0) return DIR_E;   // up+right → right
  if (dx > 0 && dy < 0) return DIR_W;   // down+left → left

  return currentDir;
}

export function updateEntityVisualPosition(
  state: EntityVisualState,
  gridX: number,
  gridY: number,
  nextX: number | null,
  nextY: number | null,
  deltaMs: number,
  elevationProvider: ElevationProvider
): void {
  const isMoving = nextX !== null && nextY !== null;
  const targetX = isMoving ? nextX : gridX;
  const targetY = isMoving ? nextY : gridY;

  if (targetX !== state.targetGridX || targetY !== state.targetGridY) {
    const dx = targetX - gridX;
    const dy = targetY - gridY;
    const newDir = getIsometricDirectionIndex(dx, dy, state.direction);

    if (newDir !== state.direction || !state.isAnimating) {
      state.direction = newDir;
      const spriteRow = state.animationType * SPRITE_DIRECTIONS_COUNT + state.direction;
      const startFrame = spriteRow * SPRITE_FRAMES_PER_DIRECTION;
      const endFrame = startFrame + SPRITE_FRAMES_PER_DIRECTION - 1;
      state.sprite.playAnimation(startFrame, endFrame, true, SPRITE_ANIMATION_SPEED_MS);
      state.isAnimating = true;
    }

    state.lastGridX = state.targetGridX;
    state.lastGridY = state.targetGridY;
    state.targetGridX = targetX;
    state.targetGridY = targetY;
    state.visualProgress = 0;
  }

  if (state.visualProgress < 1) {
    state.visualProgress = Math.min(
      1,
      state.visualProgress + deltaMs / MOVE_DURATION_MS
    );
  } else if (state.isAnimating) {
    state.sprite.stopAnimation();
    const spriteRow = state.animationType * SPRITE_DIRECTIONS_COUNT + state.direction;
    state.sprite.cellIndex = spriteRow * SPRITE_FRAMES_PER_DIRECTION;
    state.isAnimating = false;
  }

  const startElevation = elevationProvider.getElevationAt(
    state.lastGridX,
    state.lastGridY,
    0
  );
  const startPos = gridTo3D(
    state.lastGridX + 0.5,
    state.lastGridY + 0.5,
    startElevation
  );

  const endElevation = elevationProvider.getElevationAt(
    state.targetGridX,
    state.targetGridY,
    0
  );
  const endPos = gridTo3D(
    state.targetGridX + 0.5,
    state.targetGridY + 0.5,
    endElevation
  );

  const t = state.visualProgress;
  const x = startPos.x + (endPos.x - startPos.x) * t;
  const y = startPos.y + (endPos.y - startPos.y) * t;
  const z = startPos.z + (endPos.z - startPos.z) * t;

  state.container.position.set(x, y, z);
  state.sprite.position.copyFrom(state.container.position);
  state.sprite.position.y += state.sprite.height / 2 + 0.15;
  updateEquipmentSpritePosition(state);
}

export function disposeEntityMesh(state: EntityVisualState): void {
  if (state.equipmentSprite) {
    state.equipmentSprite.dispose();
  }
  state.sprite.dispose();
  state.container.dispose();
}

export function getEntityWorldPosition(state: EntityVisualState): Vector3 {
  return state.container.position.clone();
}

export function setEntityAnimationType(state: EntityVisualState, animationType: number): void {
  if (state.animationType === animationType) return;

  state.animationType = animationType;
  const spriteRow = state.animationType * SPRITE_DIRECTIONS_COUNT + state.direction;

  if (state.isAnimating) {
    const startFrame = spriteRow * SPRITE_FRAMES_PER_DIRECTION;
    const endFrame = startFrame + SPRITE_FRAMES_PER_DIRECTION - 1;
    state.sprite.playAnimation(startFrame, endFrame, true, SPRITE_ANIMATION_SPEED_MS);
  } else {
    state.sprite.cellIndex = spriteRow * SPRITE_FRAMES_PER_DIRECTION;
  }
}

const EQUIPMENT_OFFSET_BY_DIRECTION: Record<number, { x: number; z: number }> = {
  0: { x: 0, z: 0.4 },      // S - in front
  1: { x: 0, z: -0.4 },     // N - in front
  2: { x: -0.4, z: 0 },     // W - in front
  3: { x: 0.4, z: 0 },      // E - in front
  4: { x: 0.3, z: 0.3 },    // SE - diagonal front
  5: { x: -0.3, z: 0.3 },   // SW - diagonal front
  6: { x: 0.3, z: -0.3 },   // NE - diagonal front
  7: { x: -0.3, z: -0.3 },  // NW - diagonal front
};

export function showEquipmentSprite(state: EntityVisualState, scene: Scene): void {
  if (state.equipmentSprite) return;

  const manager = getEquipmentSpriteManager(scene);
  const equipSprite = new Sprite(`equipment_${state.container.name}`, manager);
  equipSprite.width = 0.7;
  equipSprite.height = 0.7;
  equipSprite.cellIndex = 0;
  state.equipmentSprite = equipSprite;
  updateEquipmentSpritePosition(state);
}

export function hideEquipmentSprite(state: EntityVisualState): void {
  if (!state.equipmentSprite) return;
  state.equipmentSprite.dispose();
  state.equipmentSprite = null;
}

export function updateEquipmentSpritePosition(state: EntityVisualState): void {
  if (!state.equipmentSprite) return;

  const offset = EQUIPMENT_OFFSET_BY_DIRECTION[state.direction] || { x: 0, z: 0.4 };
  state.equipmentSprite.position.set(
    state.container.position.x + offset.x,
    state.container.position.y + 0.35,
    state.container.position.z + offset.z
  );
}
