import { BabylonEngine } from './engine/BabylonEngine';
import { InputManager, Direction, EquipmentSlot } from './engine/InputManager';
import { GrassSystem, OverlayMode } from './systems/GrassSystem';
import { EquipmentManager } from './systems/EquipmentManager';
import { UIManager } from './ui/UIManager';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { COURSE_HOLE_1, REFILL_STATIONS } from '../data/courseData';
import { canMoveFromTo } from '../core/terrain';

export class BabylonMain {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private grassSystem: GrassSystem;
  private equipmentManager: EquipmentManager;
  private uiManager: UIManager;
  private zoomLevel: number = 1.5;
  private lastTime: number = 0;
  private gameTime: number = 6 * 60;
  private gameDay: number = 1;
  private timeScale: number = 1;
  private isPaused: boolean = false;
  private isMuted: boolean = false;

  private playerX: number = 25;
  private playerY: number = 19;
  private playerMesh: any = null;
  private cameraFollowPlayer: boolean = true;

  private score: number = 0;
  private obstacleMeshes: any[] = [];

  constructor(canvasId: string) {
    const course = COURSE_HOLE_1;
    this.babylonEngine = new BabylonEngine(canvasId, course.width, course.height);
    this.inputManager = new InputManager(this.babylonEngine.getScene());
    this.grassSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    this.equipmentManager = new EquipmentManager(this.babylonEngine.getScene());
    this.uiManager = new UIManager(this.babylonEngine.getScene());

    this.setupInputCallbacks();
    this.buildScene();
    this.setupUpdateLoop();
  }

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      onMove: (direction: Direction) => this.handleMove(direction),
      onEquipmentSelect: (slot: EquipmentSlot) => this.handleEquipmentSelect(slot),
      onEquipmentToggle: () => this.handleEquipmentToggle(),
      onRefill: () => this.handleRefill(),
      onOverlayCycle: () => this.handleOverlayCycle(),
      onPause: () => this.handlePause(),
      onMute: () => this.handleMute(),
      onTimeSpeedUp: () => this.handleTimeSpeed(1),
      onTimeSlowDown: () => this.handleTimeSpeed(-1),
      onZoomIn: () => this.handleZoom(1),
      onZoomOut: () => this.handleZoom(-1),
      onDebugReload: () => this.handleDebugReload(),
      onDebugExport: () => this.handleDebugExport(),
    });
  }

  private buildScene(): void {
    this.grassSystem.build();
    this.buildObstacles();
    this.buildRefillStations();
    this.createPlayer();
    this.babylonEngine.setZoom(this.zoomLevel);
    this.updatePlayerPosition();
  }

  private buildObstacles(): void {
    const { obstacles } = COURSE_HOLE_1;
    if (!obstacles) return;

    for (const obs of obstacles) {
      const pos = this.grassSystem.gridToWorld(obs.x, obs.y);

      if (obs.type === 1 || obs.type === 2) {
        this.createTree(pos.x, pos.y, pos.z, obs.type === 2);
      }
    }
  }

  private createTree(x: number, y: number, z: number, isPine: boolean): void {
    const scene = this.babylonEngine.getScene();
    const trunkHeight = isPine ? 35 : 25;
    const foliageSize = isPine ? 18 : 28;

    const trunk = MeshBuilder.CreateCylinder('trunk', { height: trunkHeight, diameter: 4 }, scene);
    trunk.position = new Vector3(x, y + trunkHeight / 2, z - 0.2);
    const trunkMat = new StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);
    trunkMat.emissiveColor = new Color3(0.18, 0.11, 0.05);
    trunk.material = trunkMat;
    this.obstacleMeshes.push(trunk);

    if (isPine) {
      for (let layer = 0; layer < 3; layer++) {
        const cone = MeshBuilder.CreateCylinder('foliage', {
          height: foliageSize - layer * 5,
          diameterTop: 0,
          diameterBottom: foliageSize - layer * 5
        }, scene);
        cone.position = new Vector3(x, y + trunkHeight + layer * 12, z - 0.3);
        const foliageMat = new StandardMaterial('foliageMat', scene);
        foliageMat.diffuseColor = new Color3(0.15, 0.45, 0.15);
        foliageMat.emissiveColor = new Color3(0.08, 0.23, 0.08);
        cone.material = foliageMat;
        this.obstacleMeshes.push(cone);
      }
    } else {
      const sphere = MeshBuilder.CreateSphere('foliage', { diameter: foliageSize }, scene);
      sphere.position = new Vector3(x, y + trunkHeight + 5, z - 0.3);
      const foliageMat = new StandardMaterial('foliageMat', scene);
      foliageMat.diffuseColor = new Color3(0.2, 0.5, 0.2);
      foliageMat.emissiveColor = new Color3(0.1, 0.25, 0.1);
      sphere.material = foliageMat;
      this.obstacleMeshes.push(sphere);
    }
  }

  private buildRefillStations(): void {
    const scene = this.babylonEngine.getScene();

    for (const station of REFILL_STATIONS) {
      const pos = this.grassSystem.gridToWorld(station.x, station.y);

      const base = MeshBuilder.CreateBox('refillBase', { width: 40, height: 20, depth: 0.1 }, scene);
      base.position = new Vector3(pos.x, pos.y - 10, pos.z - 0.3);
      const baseMat = new StandardMaterial('baseMat', scene);
      baseMat.diffuseColor = new Color3(0.55, 0.27, 0.07);
      baseMat.emissiveColor = new Color3(0.28, 0.14, 0.04);
      base.material = baseMat;
      this.obstacleMeshes.push(base);

      const roof = MeshBuilder.CreateBox('refillRoof', { width: 50, height: 12, depth: 0.1 }, scene);
      roof.position = new Vector3(pos.x, pos.y - 26, pos.z - 0.35);
      const roofMat = new StandardMaterial('roofMat', scene);
      roofMat.diffuseColor = new Color3(0.61, 0.33, 0.12);
      roofMat.emissiveColor = new Color3(0.31, 0.17, 0.06);
      roof.material = roofMat;
      this.obstacleMeshes.push(roof);

      const pump = MeshBuilder.CreateBox('pump', { width: 12, height: 25, depth: 0.1 }, scene);
      pump.position = new Vector3(pos.x, pos.y - 32, pos.z - 0.4);
      const pumpMat = new StandardMaterial('pumpMat', scene);
      pumpMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
      pumpMat.emissiveColor = new Color3(0.2, 0.2, 0.23);
      pump.material = pumpMat;
      this.obstacleMeshes.push(pump);

      const blueDot = MeshBuilder.CreateSphere('blueDot', { diameter: 6 }, scene);
      blueDot.position = new Vector3(pos.x - 4, pos.y - 34, pos.z - 0.45);
      const blueMat = new StandardMaterial('blueMat', scene);
      blueMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
      blueMat.emissiveColor = new Color3(0.1, 0.2, 0.4);
      blueDot.material = blueMat;
      this.obstacleMeshes.push(blueDot);

      const redDot = MeshBuilder.CreateSphere('redDot', { diameter: 6 }, scene);
      redDot.position = new Vector3(pos.x + 4, pos.y - 34, pos.z - 0.45);
      const redMat = new StandardMaterial('redMat', scene);
      redMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
      redMat.emissiveColor = new Color3(0.4, 0.1, 0.1);
      redDot.material = redMat;
      this.obstacleMeshes.push(redDot);
    }
  }

  private createPlayer(): void {
    const scene = this.babylonEngine.getScene();

    this.playerMesh = MeshBuilder.CreateBox('playerContainer', { size: 1 }, scene);
    this.playerMesh.isVisible = false;

    const shadow = MeshBuilder.CreateDisc('shadow', { radius: 10, tessellation: 16 }, scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = -18;
    shadow.position.z = 0.5;
    const shadowMat = new StandardMaterial('shadowMat', scene);
    shadowMat.diffuseColor = new Color3(0, 0, 0);
    shadowMat.alpha = 0.3;
    shadowMat.disableLighting = true;
    shadow.material = shadowMat;
    shadow.parent = this.playerMesh;

    const body = MeshBuilder.CreateCylinder('body', { height: 20, diameterTop: 8, diameterBottom: 10 }, scene);
    body.position.y = -8;
    const bodyMat = new StandardMaterial('bodyMat', scene);
    bodyMat.diffuseColor = new Color3(0.11, 0.48, 0.24);
    bodyMat.emissiveColor = new Color3(0.06, 0.24, 0.12);
    body.material = bodyMat;
    body.parent = this.playerMesh;

    const head = MeshBuilder.CreateSphere('head', { diameter: 10 }, scene);
    head.position.y = 6;
    const headMat = new StandardMaterial('headMat', scene);
    headMat.diffuseColor = new Color3(0.94, 0.82, 0.69);
    headMat.emissiveColor = new Color3(0.47, 0.41, 0.35);
    head.material = headMat;
    head.parent = this.playerMesh;

    const hat = MeshBuilder.CreateCylinder('hat', { height: 5, diameterTop: 8, diameterBottom: 12 }, scene);
    hat.position.y = 12;
    const hatMat = new StandardMaterial('hatMat', scene);
    hatMat.diffuseColor = new Color3(0.9, 0.9, 0.85);
    hatMat.emissiveColor = new Color3(0.45, 0.45, 0.42);
    hat.material = hatMat;
    hat.parent = this.playerMesh;

    const hatBrim = MeshBuilder.CreateDisc('hatBrim', { radius: 8, tessellation: 16 }, scene);
    hatBrim.rotation.x = Math.PI / 2;
    hatBrim.position.y = 10;
    hatBrim.material = hatMat;
    hatBrim.parent = this.playerMesh;
  }

  private updatePlayerPosition(): void {
    if (!this.playerMesh) return;

    const worldPos = this.grassSystem.gridToWorld(this.playerX, this.playerY);
    this.playerMesh.position = new Vector3(worldPos.x, worldPos.y + 8, worldPos.z - 1);

    if (this.cameraFollowPlayer) {
      const camera = this.babylonEngine.getCamera();
      camera.position.x = worldPos.x;
      camera.position.y = worldPos.y;
      camera.setTarget(new Vector3(worldPos.x, worldPos.y, 0));
    }
  }

  private handleMove(direction: Direction): void {
    if (this.isPaused) return;

    const course = COURSE_HOLE_1;
    let newX = this.playerX;
    let newY = this.playerY;

    switch (direction) {
      case 'up': newX--; newY--; break;
      case 'down': newX++; newY++; break;
      case 'left': newX--; newY++; break;
      case 'right': newX++; newY--; break;
    }

    if (newX < 0 || newX >= course.width || newY < 0 || newY >= course.height) {
      return;
    }

    const fromCell = this.grassSystem.getCell(this.playerX, this.playerY);
    const toCell = this.grassSystem.getCell(newX, newY);

    if (!canMoveFromTo(fromCell, toCell)) {
      return;
    }

    this.playerX = newX;
    this.playerY = newY;
    this.updatePlayerPosition();

    if (this.equipmentManager.isActive()) {
      this.applyEquipmentEffect(newX, newY);
    }
  }

  private applyEquipmentEffect(x: number, y: number): void {
    const type = this.equipmentManager.getCurrentType();
    const state = this.equipmentManager.getCurrentState();
    if (!state) return;

    switch (type) {
      case 'mower':
        this.grassSystem.mowAt(x, y);
        break;
      case 'sprinkler':
        this.grassSystem.waterArea(x, y, state.effectRadius, 15);
        break;
      case 'spreader':
        this.grassSystem.fertilizeArea(x, y, state.effectRadius, 10);
        break;
    }
  }

  private handleEquipmentSelect(slot: EquipmentSlot): void {
    this.equipmentManager.selectBySlot(slot);
    const names = ['Mower', 'Sprinkler', 'Spreader'];
    this.uiManager.showNotification(`${names[slot - 1]} selected`);
  }

  private handleEquipmentToggle(): void {
    this.equipmentManager.toggle();
    const isActive = this.equipmentManager.isActive();
    const type = this.equipmentManager.getCurrentType();
    const names = { mower: 'Mower', sprinkler: 'Sprinkler', spreader: 'Spreader' };
    this.uiManager.showNotification(`${names[type]} ${isActive ? 'ON' : 'OFF'}`);
  }

  private handleRefill(): void {
    const nearStation = REFILL_STATIONS.some(station => {
      const dx = Math.abs(station.x - this.playerX);
      const dy = Math.abs(station.y - this.playerY);
      return dx <= 2 && dy <= 2;
    });

    if (nearStation) {
      this.equipmentManager.refill();
      this.uiManager.showNotification('Equipment refilled!');
    } else {
      this.uiManager.showNotification('Move closer to refill station');
    }
  }

  private handleOverlayCycle(): void {
    const mode = this.grassSystem.cycleOverlayMode();
    const modeNames: Record<OverlayMode, string> = {
      'normal': 'Normal View',
      'moisture': 'Moisture View',
      'nutrients': 'Nutrients View',
      'height': 'Height View',
    };
    this.uiManager.showNotification(modeNames[mode]);
  }

  private handlePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.uiManager.showPauseMenu(
      () => this.resumeGame(),
      () => this.restartGame()
    );
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.uiManager.hidePauseMenu();
  }

  private restartGame(): void {
    this.playerX = 25;
    this.playerY = 19;
    this.gameTime = 6 * 60;
    this.gameDay = 1;
    this.score = 0;
    this.timeScale = 1;
    this.equipmentManager.refill();
    this.grassSystem.dispose();
    this.grassSystem = new GrassSystem(this.babylonEngine.getScene(), COURSE_HOLE_1);
    this.grassSystem.build();
    this.updatePlayerPosition();
    this.resumeGame();
    this.uiManager.showNotification('Game Restarted');
  }

  private handleMute(): void {
    this.isMuted = !this.isMuted;
    this.uiManager.showNotification(this.isMuted ? 'Sound OFF' : 'Sound ON');
  }

  private handleTimeSpeed(delta: number): void {
    const speeds = [0.5, 1, 2, 4];
    const currentIndex = speeds.indexOf(this.timeScale);
    const newIndex = Math.max(0, Math.min(speeds.length - 1, currentIndex + delta));
    this.timeScale = speeds[newIndex];
    this.uiManager.showNotification(`Speed: ${this.timeScale}x`);
  }

  private handleZoom(delta: number): void {
    this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel + delta * 0.25));
    this.babylonEngine.setZoom(this.zoomLevel);
  }

  private handleDebugReload(): void {
    window.location.reload();
  }

  private handleDebugExport(): void {
    const state = {
      playerX: this.playerX,
      playerY: this.playerY,
      gameTime: this.gameTime,
      gameDay: this.gameDay,
      score: this.score,
    };
    console.log('Game State:', JSON.stringify(state, null, 2));
    console.log('Base64:', btoa(JSON.stringify(state)));
  }

  private setupUpdateLoop(): void {
    this.lastTime = performance.now();
    const course = COURSE_HOLE_1;

    const stats = this.grassSystem.getCourseStats();
    this.uiManager.updateCourseStatus(stats.health, stats.moisture, stats.nutrients);
    this.uiManager.updateMinimapPlayerPosition(this.playerX, this.playerY, course.width, course.height);
    this.uiManager.showNotification('Welcome to Greenkeeper Simulator!');

    this.babylonEngine.getScene().onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;

      if (this.isPaused) return;

      if (this.playerMesh) {
        this.equipmentManager.update(deltaMs, this.playerMesh.position);
      }

      this.gameTime += (deltaMs / 1000) * 2 * this.timeScale;
      if (this.gameTime >= 24 * 60) {
        this.gameTime -= 24 * 60;
        this.gameDay++;
      }

      this.grassSystem.update(deltaMs * this.timeScale, this.gameTime);

      this.updateDayNightCycle();

      const hours = Math.floor(this.gameTime / 60);
      const minutes = Math.floor(this.gameTime % 60);
      this.uiManager.updateTime(hours, minutes, this.gameDay);
      this.uiManager.updateEquipment(
        this.equipmentManager.getCurrentType(),
        this.equipmentManager.isActive()
      );

      const mowerState = this.equipmentManager.getState('mower');
      const sprinklerState = this.equipmentManager.getState('sprinkler');
      const spreaderState = this.equipmentManager.getState('spreader');
      this.uiManager.updateResources(
        mowerState ? (mowerState.resourceCurrent / mowerState.resourceMax) * 100 : 100,
        sprinklerState ? (sprinklerState.resourceCurrent / sprinklerState.resourceMax) * 100 : 100,
        spreaderState ? (spreaderState.resourceCurrent / spreaderState.resourceMax) * 100 : 100
      );

      const courseStats = this.grassSystem.getCourseStats();
      this.uiManager.updateCourseStatus(courseStats.health, courseStats.moisture, courseStats.nutrients);
      this.uiManager.updateScore(this.score);
      this.uiManager.updateMinimapPlayerPosition(this.playerX, this.playerY, course.width, course.height);
    });
  }

  private updateDayNightCycle(): void {
    const hours = this.gameTime / 60;
    let brightness = 1.0;

    if (hours < 6) {
      brightness = 0.3 + (hours / 6) * 0.3;
    } else if (hours < 8) {
      brightness = 0.6 + ((hours - 6) / 2) * 0.4;
    } else if (hours < 18) {
      brightness = 1.0;
    } else if (hours < 20) {
      brightness = 1.0 - ((hours - 18) / 2) * 0.4;
    } else {
      brightness = 0.6 - ((hours - 20) / 4) * 0.3;
    }

    const scene = this.babylonEngine.getScene();
    scene.clearColor = new Color4(
      0.1 * brightness,
      0.15 * brightness,
      0.1 * brightness,
      1
    );
  }

  public start(): void {
    this.babylonEngine.start();
  }

  public stop(): void {
    this.babylonEngine.stop();
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.grassSystem.dispose();
    this.equipmentManager.dispose();
    this.uiManager.dispose();
    for (const mesh of this.obstacleMeshes) {
      mesh.dispose();
    }
    this.babylonEngine.dispose();
  }
}

export function startBabylonGame(canvasId: string): BabylonMain {
  const game = new BabylonMain(canvasId);
  game.start();
  return game;
}
