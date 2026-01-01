import { BabylonEngine } from './engine/BabylonEngine';
import { InputManager, Direction, EquipmentSlot } from './engine/InputManager';
import { TerrainBuilder } from './terrain/TerrainBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { COURSE_HOLE_1 } from '../data/courseData';

export class BabylonMain {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private terrainBuilder: TerrainBuilder;
  private zoomLevel: number = 1;

  private playerX: number = 25;
  private playerY: number = 19;
  private playerMesh: any = null;

  constructor(canvasId: string) {
    const course = COURSE_HOLE_1;
    this.babylonEngine = new BabylonEngine(canvasId, course.width, course.height);
    this.inputManager = new InputManager(this.babylonEngine.getScene());
    this.terrainBuilder = new TerrainBuilder(this.babylonEngine.getScene(), course);

    this.setupInputCallbacks();
    this.buildScene();
  }

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      onMove: (direction: Direction) => this.handleMove(direction),
      onEquipmentSelect: (slot: EquipmentSlot) => this.handleEquipmentSelect(slot),
      onEquipmentToggle: () => this.handleEquipmentToggle(),
      onZoomIn: () => this.handleZoom(1),
      onZoomOut: () => this.handleZoom(-1),
      onDebugExport: () => this.handleDebugExport(),
    });
  }

  private buildScene(): void {
    this.terrainBuilder.build();
    this.createPlayer();
  }

  private createPlayer(): void {
    const scene = this.babylonEngine.getScene();

    this.playerMesh = MeshBuilder.CreateSphere('player', { diameter: 16 }, scene);
    this.updatePlayerPosition();

    const playerMat = new StandardMaterial('playerMat', scene);
    playerMat.diffuseColor = new Color3(0.9, 0.3, 0.3);
    playerMat.emissiveColor = new Color3(0.4, 0.15, 0.15);
    this.playerMesh.material = playerMat;
  }

  private updatePlayerPosition(): void {
    if (!this.playerMesh) return;

    const elevation = this.terrainBuilder.getElevationAt(this.playerX, this.playerY);
    const worldPos = this.terrainBuilder.gridToWorld(this.playerX, this.playerY, elevation);
    this.playerMesh.position = new Vector3(worldPos.x, worldPos.y + 12, worldPos.z);
  }

  private handleMove(direction: Direction): void {
    const course = COURSE_HOLE_1;
    let newX = this.playerX;
    let newY = this.playerY;

    switch (direction) {
      case 'up':
        newX--;
        newY--;
        break;
      case 'down':
        newX++;
        newY++;
        break;
      case 'left':
        newX--;
        newY++;
        break;
      case 'right':
        newX++;
        newY--;
        break;
    }

    if (newX >= 0 && newX < course.width && newY >= 0 && newY < course.height) {
      this.playerX = newX;
      this.playerY = newY;
      this.updatePlayerPosition();
    }
  }

  private handleEquipmentSelect(slot: EquipmentSlot): void {
    console.log(`Equipment slot: ${slot}`);
  }

  private handleEquipmentToggle(): void {
    console.log('Equipment toggle');
  }

  private handleZoom(delta: number): void {
    this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + delta * 0.25));
    this.babylonEngine.setZoom(this.zoomLevel);
  }

  private handleDebugExport(): void {
    console.log('Debug export - game state would be logged here');
  }

  public start(): void {
    this.babylonEngine.start();
  }

  public stop(): void {
    this.babylonEngine.stop();
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.terrainBuilder.dispose();
    this.babylonEngine.dispose();
  }
}

export function startBabylonGame(canvasId: string): BabylonMain {
  const game = new BabylonMain(canvasId);
  game.start();
  return game;
}
