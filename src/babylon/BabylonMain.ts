import { BabylonEngine } from "./engine/BabylonEngine";
import { InputManager, Direction, EquipmentSlot } from "./engine/InputManager";
import { GrassSystem, OverlayMode } from "./systems/GrassSystem";
import { EquipmentManager } from "./systems/EquipmentManager";
import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { UIManager } from "./ui/UIManager";
import { TerrainEditorUI } from "./ui/TerrainEditorUI";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import "@babylonjs/core/Culling/ray";

import { COURSE_HOLE_1, REFILL_STATIONS } from "../data/courseData";
import { canMoveFromTo } from "../core/terrain";
import { EditorTool } from "../core/terrain-editor-logic";

export class BabylonMain {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private grassSystem: GrassSystem;
  private equipmentManager: EquipmentManager;
  private uiManager: UIManager;
  private zoomLevel: "close" | "far" = "close";
  private lastTime: number = 0;
  private gameTime: number = 6 * 60;
  private gameDay: number = 1;
  private timeScale: number = 1;
  private isPaused: boolean = false;
  private isMuted: boolean = false;

  private playerX: number = 25;
  private playerY: number = 19;
  private playerMesh: Mesh | null = null;
  private cameraFollowPlayer: boolean = true;
  private isMoving: boolean = false;
  private moveStartPos: { x: number; y: number; z: number } | null = null;
  private moveEndPos: { x: number; y: number; z: number } | null = null;
  private moveProgress: number = 0;
  private readonly MOVE_DURATION: number = 150;
  private movePath: { x: number; y: number }[] = [];
  private pendingDirection: Direction | null = null;

  private score: number = 0;
  private obstacleMeshes: Mesh[] = [];

  private terrainEditorSystem: TerrainEditorSystem | null = null;
  private terrainEditorUI: TerrainEditorUI | null = null;
  private editorUITexture: AdvancedDynamicTexture | null = null;

  constructor(canvasId: string) {
    const course = COURSE_HOLE_1;
    this.babylonEngine = new BabylonEngine(
      canvasId,
      course.width,
      course.height
    );
    this.inputManager = new InputManager(this.babylonEngine.getScene());
    this.grassSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    this.equipmentManager = new EquipmentManager(this.babylonEngine.getScene());
    this.uiManager = new UIManager(this.babylonEngine.getScene());

    this.setupInputCallbacks();
    this.buildScene();
    this.setupTerrainEditor();
    this.setupUpdateLoop();
  }

  private setupTerrainEditor(): void {
    const scene = this.babylonEngine.getScene();

    const cornerProvider = {
      getCornerHeights: (gridX: number, gridY: number) =>
        this.grassSystem.getCornerHeightsPublic(gridX, gridY),
      getElevationAt: (gridX: number, gridY: number, defaultValue?: number) =>
        this.grassSystem.getElevationAt(gridX, gridY, defaultValue),
    };

    this.terrainEditorSystem = new TerrainEditorSystem(scene, cornerProvider);
    this.terrainEditorSystem.setTerrainModifier({
      setElevationAt: (x, y, elev) =>
        this.grassSystem.setElevationAt(x, y, elev),
      setTerrainTypeAt: (x, y, type) =>
        this.grassSystem.setTerrainTypeAt(x, y, type),
      rebuildTileAndNeighbors: (x, y) =>
        this.grassSystem.rebuildTileAndNeighbors(x, y),
    });

    this.terrainEditorSystem.initialize(
      this.grassSystem.getLayoutGrid(),
      this.grassSystem.getElevationGrid()
    );

    this.editorUITexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EditorUI",
      true,
      scene
    );
    this.terrainEditorUI = new TerrainEditorUI(this.editorUITexture, {
      onToolSelect: (tool: EditorTool) => this.handleEditorToolSelect(tool),
      onClose: () => this.handleEditorToggle(),
      onExport: () => this.handleEditorExport(),
      onUndo: () => this.handleEditorUndo(),
      onRedo: () => this.handleEditorRedo(),
      onBrushSizeChange: (delta: number) => this.handleEditorBrushSize(delta),
    });

    this.terrainEditorSystem.setCallbacks({
      onEnable: () => {
        this.terrainEditorUI?.show();
        this.terrainEditorUI?.setActiveTool(
          this.terrainEditorSystem!.getTool()
        );
        this.uiManager.showNotification("Terrain Editor ON");
      },
      onDisable: () => {
        this.terrainEditorUI?.hide();
        this.uiManager.showNotification("Terrain Editor OFF");
      },
      onToolChange: (tool: EditorTool) => {
        this.terrainEditorUI?.setActiveTool(tool);
      },
      onBrushSizeChange: (size: number) => {
        this.terrainEditorUI?.setBrushSize(size);
      },
      onUndoRedoChange: (canUndo: boolean, canRedo: boolean) => {
        this.terrainEditorUI?.setUndoEnabled(canUndo);
        this.terrainEditorUI?.setRedoEnabled(canRedo);
      },
    });
  }

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      onMove: (direction: Direction) => this.handleMove(direction),
      onEquipmentSelect: (slot: EquipmentSlot) =>
        this.handleEquipmentSelect(slot),
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
      onClick: (screenX: number, screenY: number) =>
        this.handleClick(screenX, screenY),
      onEditorToggle: () => this.handleEditorToggle(),
      onEditorToolSelect: (tool: number) => this.handleEditorToolNumber(tool),
      onEditorBrushSelect: (brush: string) =>
        this.handleEditorBrushSelect(brush),
      onEditorBrushSizeChange: (delta: number) =>
        this.handleEditorBrushSize(delta),
      onUndo: () => this.handleEditorUndo(),
      onRedo: () => this.handleEditorRedo(),
      onMouseMove: (screenX: number, screenY: number) =>
        this.handleMouseMove(screenX, screenY),
      onDragStart: (screenX: number, screenY: number) =>
        this.handleDragStart(screenX, screenY),
      onDrag: (screenX: number, screenY: number) =>
        this.handleDrag(screenX, screenY),
      onDragEnd: () => this.handleDragEnd(),
    });
  }

  private buildScene(): void {
    this.grassSystem.build();
    this.buildObstacles();
    this.buildRefillStations();
    this.createPlayer();
    this.babylonEngine.setZoomLevel(this.zoomLevel);
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
    const trunkHeight = isPine ? 1.5 : 1.0;
    const trunkDiameter = 0.15;
    const foliageSize = isPine ? 0.6 : 1.0;

    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { height: trunkHeight, diameter: trunkDiameter },
      scene
    );
    trunk.position = new Vector3(x, y + trunkHeight / 2, z);
    const trunkMat = new StandardMaterial("trunkMat", scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);
    trunkMat.emissiveColor = new Color3(0.18, 0.11, 0.05);
    trunk.material = trunkMat;
    this.obstacleMeshes.push(trunk);

    if (isPine) {
      for (let layer = 0; layer < 3; layer++) {
        const layerSize = foliageSize - layer * 0.15;
        const cone = MeshBuilder.CreateCylinder(
          "foliage",
          {
            height: layerSize,
            diameterTop: 0,
            diameterBottom: layerSize,
          },
          scene
        );
        cone.position = new Vector3(
          x,
          y + trunkHeight + layer * 0.4 + layerSize / 2,
          z
        );
        const foliageMat = new StandardMaterial("foliageMat", scene);
        foliageMat.diffuseColor = new Color3(0.15, 0.45, 0.15);
        foliageMat.emissiveColor = new Color3(0.08, 0.23, 0.08);
        cone.material = foliageMat;
        this.obstacleMeshes.push(cone);
      }
    } else {
      const sphere = MeshBuilder.CreateSphere(
        "foliage",
        { diameter: foliageSize },
        scene
      );
      sphere.position = new Vector3(x, y + trunkHeight + foliageSize / 2, z);
      const foliageMat = new StandardMaterial("foliageMat", scene);
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

      const base = MeshBuilder.CreateBox(
        "refillBase",
        { width: 0.8, height: 0.4, depth: 0.6 },
        scene
      );
      base.position = new Vector3(pos.x, pos.y + 0.2, pos.z);
      const baseMat = new StandardMaterial("baseMat", scene);
      baseMat.diffuseColor = new Color3(0.55, 0.27, 0.07);
      baseMat.emissiveColor = new Color3(0.28, 0.14, 0.04);
      base.material = baseMat;
      this.obstacleMeshes.push(base);

      const roof = MeshBuilder.CreateBox(
        "refillRoof",
        { width: 1.0, height: 0.1, depth: 0.8 },
        scene
      );
      roof.position = new Vector3(pos.x, pos.y + 0.7, pos.z);
      const roofMat = new StandardMaterial("roofMat", scene);
      roofMat.diffuseColor = new Color3(0.61, 0.33, 0.12);
      roofMat.emissiveColor = new Color3(0.31, 0.17, 0.06);
      roof.material = roofMat;
      this.obstacleMeshes.push(roof);

      const pump = MeshBuilder.CreateBox(
        "pump",
        { width: 0.25, height: 0.5, depth: 0.2 },
        scene
      );
      pump.position = new Vector3(pos.x, pos.y + 0.25, pos.z + 0.15);
      const pumpMat = new StandardMaterial("pumpMat", scene);
      pumpMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
      pumpMat.emissiveColor = new Color3(0.2, 0.2, 0.23);
      pump.material = pumpMat;
      this.obstacleMeshes.push(pump);

      const blueDot = MeshBuilder.CreateSphere(
        "blueDot",
        { diameter: 0.12 },
        scene
      );
      blueDot.position = new Vector3(pos.x - 0.08, pos.y + 0.35, pos.z + 0.26);
      const blueMat = new StandardMaterial("blueMat", scene);
      blueMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
      blueMat.emissiveColor = new Color3(0.1, 0.2, 0.4);
      blueDot.material = blueMat;
      this.obstacleMeshes.push(blueDot);

      const redDot = MeshBuilder.CreateSphere(
        "redDot",
        { diameter: 0.12 },
        scene
      );
      redDot.position = new Vector3(pos.x + 0.08, pos.y + 0.35, pos.z + 0.26);
      const redMat = new StandardMaterial("redMat", scene);
      redMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
      redMat.emissiveColor = new Color3(0.4, 0.1, 0.1);
      redDot.material = redMat;
      this.obstacleMeshes.push(redDot);
    }
  }

  private createPlayer(): void {
    const scene = this.babylonEngine.getScene();

    this.playerMesh = MeshBuilder.CreateBox(
      "playerContainer",
      { size: 0.01 },
      scene
    );
    this.playerMesh.isVisible = false;

    const shadow = MeshBuilder.CreateDisc(
      "shadow",
      { radius: 0.2, tessellation: 16 },
      scene
    );
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.01;
    const shadowMat = new StandardMaterial("shadowMat", scene);
    shadowMat.diffuseColor = new Color3(0, 0, 0);
    shadowMat.alpha = 0.3;
    shadowMat.disableLighting = true;
    shadow.material = shadowMat;
    shadow.parent = this.playerMesh;

    const body = MeshBuilder.CreateCylinder(
      "body",
      { height: 0.4, diameterTop: 0.16, diameterBottom: 0.2 },
      scene
    );
    body.position.y = 0.2;
    const bodyMat = new StandardMaterial("bodyMat", scene);
    bodyMat.diffuseColor = new Color3(0.11, 0.48, 0.24);
    bodyMat.emissiveColor = new Color3(0.06, 0.24, 0.12);
    body.material = bodyMat;
    body.parent = this.playerMesh;

    const head = MeshBuilder.CreateSphere("head", { diameter: 0.2 }, scene);
    head.position.y = 0.5;
    const headMat = new StandardMaterial("headMat", scene);
    headMat.diffuseColor = new Color3(0.94, 0.82, 0.69);
    headMat.emissiveColor = new Color3(0.47, 0.41, 0.35);
    head.material = headMat;
    head.parent = this.playerMesh;

    const hat = MeshBuilder.CreateCylinder(
      "hat",
      { height: 0.1, diameterTop: 0.16, diameterBottom: 0.24 },
      scene
    );
    hat.position.y = 0.65;
    const hatMat = new StandardMaterial("hatMat", scene);
    hatMat.diffuseColor = new Color3(0.9, 0.9, 0.85);
    hatMat.emissiveColor = new Color3(0.45, 0.45, 0.42);
    hat.material = hatMat;
    hat.parent = this.playerMesh;

    const hatBrim = MeshBuilder.CreateDisc(
      "hatBrim",
      { radius: 0.16, tessellation: 16 },
      scene
    );
    hatBrim.rotation.x = Math.PI / 2;
    hatBrim.position.y = 0.6;
    hatBrim.material = hatMat;
    hatBrim.parent = this.playerMesh;
  }

  public teleport(x: number, y: number): void {
    const course = COURSE_HOLE_1;
    if (x < 0 || x >= course.width || y < 0 || y >= course.height) {
      console.warn(`Teleport target (${x}, ${y}) is out of bounds.`);
      return;
    }

    this.playerX = x;
    this.playerY = y;
    this.isMoving = false;
    this.moveStartPos = null;
    this.moveEndPos = null;
    this.movePath = [];
    this.pendingDirection = null;

    this.updatePlayerPosition();
    this.uiManager.showNotification(`Teleported to (${x}, ${y})`);
  }

  private updatePlayerPosition(): void {
    if (!this.playerMesh) return;

    const worldPos = this.grassSystem.gridToWorld(this.playerX, this.playerY);
    this.playerMesh.position = worldPos.clone();

    if (this.cameraFollowPlayer) {
      this.babylonEngine.setCameraTarget(worldPos);
    }
  }

  private updateMovement(deltaMs: number): void {
    if (
      !this.isMoving ||
      !this.moveStartPos ||
      !this.moveEndPos ||
      !this.playerMesh
    ) {
      if (!this.isMoving) {
        this.checkContinuousMovement();
      }
      return;
    }

    this.moveProgress += deltaMs;
    const t = Math.min(1, this.moveProgress / this.MOVE_DURATION);
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x =
      this.moveStartPos.x + (this.moveEndPos.x - this.moveStartPos.x) * easeT;
    const y =
      this.moveStartPos.y + (this.moveEndPos.y - this.moveStartPos.y) * easeT;
    const z =
      this.moveStartPos.z + (this.moveEndPos.z - this.moveStartPos.z) * easeT;

    this.playerMesh.position = new Vector3(x, y, z);

    if (this.cameraFollowPlayer) {
      this.babylonEngine.setCameraTarget(new Vector3(x, y, z));
    }

    if (t >= 1) {
      this.isMoving = false;
      this.moveStartPos = null;
      this.moveEndPos = null;
      this.checkContinuousMovement();
    }
  }

  private checkContinuousMovement(): void {
    if (this.movePath.length > 0) {
      const next = this.movePath.shift()!;
      this.startMoveTo(next.x, next.y);
      return;
    }

    if (
      this.pendingDirection &&
      this.isDirectionKeyHeld(this.pendingDirection)
    ) {
      this.tryMove(this.pendingDirection);
    } else {
      this.pendingDirection = null;
    }
  }

  private isDirectionKeyHeld(direction: Direction): boolean {
    switch (direction) {
      case "up":
        return (
          this.inputManager.isKeyDown("arrowup") ||
          this.inputManager.isKeyDown("w")
        );
      case "down":
        return (
          this.inputManager.isKeyDown("arrowdown") ||
          this.inputManager.isKeyDown("s")
        );
      case "left":
        return (
          this.inputManager.isKeyDown("arrowleft") ||
          this.inputManager.isKeyDown("a")
        );
      case "right":
        return (
          this.inputManager.isKeyDown("arrowright") ||
          this.inputManager.isKeyDown("d")
        );
    }
  }

  private handleMove(direction: Direction): void {
    if (this.isPaused) return;

    this.pendingDirection = direction;
    this.movePath = [];

    if (!this.isMoving) {
      this.tryMove(direction);
    }
  }

  private tryMove(direction: Direction): boolean {
    const course = COURSE_HOLE_1;
    let newX = this.playerX;
    let newY = this.playerY;

    switch (direction) {
      case "up":
        newY--;
        break;
      case "down":
        newY++;
        break;
      case "left":
        newX--;
        break;
      case "right":
        newX++;
        break;
    }

    if (newX < 0 || newX >= course.width || newY < 0 || newY >= course.height) {
      return false;
    }

    const fromCell = this.grassSystem.getCell(this.playerX, this.playerY);
    const toCell = this.grassSystem.getCell(newX, newY);

    if (!canMoveFromTo(fromCell, toCell)) {
      return false;
    }

    this.startMoveTo(newX, newY);
    return true;
  }

  private startMoveTo(newX: number, newY: number): void {
    this.moveStartPos = this.grassSystem.gridToWorld(
      this.playerX,
      this.playerY
    );
    this.moveEndPos = this.grassSystem.gridToWorld(newX, newY);
    this.moveProgress = 0;
    this.isMoving = true;

    this.playerX = newX;
    this.playerY = newY;

    if (this.equipmentManager.isActive()) {
      this.applyEquipmentEffect(newX, newY);
    }
  }

  private handleClick(screenX: number, screenY: number): void {
    if (this.isPaused) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (!gridPos) return;

    if (this.terrainEditorSystem?.isEnabled()) {
      this.terrainEditorSystem.handleClick();
      return;
    }

    const course = COURSE_HOLE_1;
    if (
      gridPos.x < 0 ||
      gridPos.x >= course.width ||
      gridPos.y < 0 ||
      gridPos.y >= course.height
    ) {
      return;
    }

    const targetCell = this.grassSystem.getCell(gridPos.x, gridPos.y);
    if (!targetCell || targetCell.type === "water") return;

    if (gridPos.x === this.playerX && gridPos.y === this.playerY) {
      return;
    }

    const path = this.findPath(
      this.playerX,
      this.playerY,
      gridPos.x,
      gridPos.y
    );
    if (path.length > 0) {
      this.movePath = path;
      this.pendingDirection = null;
      if (!this.isMoving) {
        this.checkContinuousMovement();
      }
    }
  }

  private screenToGridFromScreen(
    screenX: number,
    screenY: number
  ): { x: number; y: number } | null {
    const scene = this.babylonEngine.getScene();
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

  private raycastToGround(
    canvasX: number,
    canvasY: number
  ): { x: number; y: number } | null {
    const scene = this.babylonEngine.getScene();
    const camera = this.babylonEngine.getCamera();
    const ray = scene.createPickingRay(canvasX, canvasY, null, camera);

    if (ray.direction.y === 0) return null;

    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const groundX = ray.origin.x + ray.direction.x * t;
    const groundZ = ray.origin.z + ray.direction.z * t;

    const gridX = Math.floor(groundX);
    const gridY = Math.floor(groundZ);

    const course = COURSE_HOLE_1;
    if (
      gridX < 0 ||
      gridX >= course.width ||
      gridY < 0 ||
      gridY >= course.height
    ) {
      return null;
    }

    return { x: gridX, y: gridY };
  }

  private findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): { x: number; y: number }[] {
    interface PathNode {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent: PathNode | null;
    }

    const course = COURSE_HOLE_1;
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
          neighbor.x >= course.width ||
          neighbor.y < 0 ||
          neighbor.y >= course.height
        )
          continue;
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

        const fromCell = this.grassSystem.getCell(current.x, current.y);
        const toCell = this.grassSystem.getCell(neighbor.x, neighbor.y);
        if (!canMoveFromTo(fromCell, toCell)) continue;

        const g = current.g + 1;
        const h = heuristic(neighbor.x, neighbor.y);
        const f = g + h;

        const existing = openSet.find(
          (n) => n.x === neighbor.x && n.y === neighbor.y
        );
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        } else {
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

  private applyEquipmentEffect(x: number, y: number): void {
    const type = this.equipmentManager.getCurrentType();
    const state = this.equipmentManager.getCurrentState();
    if (!state) return;

    switch (type) {
      case "mower":
        this.grassSystem.mowAt(x, y);
        break;
      case "sprinkler":
        this.grassSystem.waterArea(x, y, state.effectRadius, 15);
        break;
      case "spreader":
        this.grassSystem.fertilizeArea(x, y, state.effectRadius, 10);
        break;
    }
  }

  private handleEquipmentSelect(slot: EquipmentSlot): void {
    this.equipmentManager.selectBySlot(slot);
    const names = ["Mower", "Sprinkler", "Spreader"];
    this.uiManager.showNotification(`${names[slot - 1]} selected`);
  }

  private handleEquipmentToggle(): void {
    this.equipmentManager.toggle();
    const isActive = this.equipmentManager.isActive();
    const type = this.equipmentManager.getCurrentType();
    const names = {
      mower: "Mower",
      sprinkler: "Sprinkler",
      spreader: "Spreader",
    };
    this.uiManager.showNotification(
      `${names[type]} ${isActive ? "ON" : "OFF"}`
    );
  }

  private handleRefill(): void {
    const nearStation = REFILL_STATIONS.some((station) => {
      const dx = Math.abs(station.x - this.playerX);
      const dy = Math.abs(station.y - this.playerY);
      return dx <= 2 && dy <= 2;
    });

    if (nearStation) {
      this.equipmentManager.refill();
      this.uiManager.showNotification("Equipment refilled!");
    } else {
      this.uiManager.showNotification("Move closer to refill station");
    }
  }

  private handleOverlayCycle(): void {
    const mode = this.grassSystem.cycleOverlayMode();
    const modeNames: Record<OverlayMode, string> = {
      normal: "Normal View",
      moisture: "Moisture View",
      nutrients: "Nutrients View",
      height: "Height View",
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
    this.grassSystem = new GrassSystem(
      this.babylonEngine.getScene(),
      COURSE_HOLE_1
    );
    this.grassSystem.build();
    this.updatePlayerPosition();
    this.resumeGame();
    this.uiManager.showNotification("Game Restarted");
  }

  private handleMute(): void {
    this.isMuted = !this.isMuted;
    this.uiManager.showNotification(this.isMuted ? "Sound OFF" : "Sound ON");
  }

  private handleTimeSpeed(delta: number): void {
    const speeds = [0.5, 1, 2, 4];
    const currentIndex = speeds.indexOf(this.timeScale);
    const newIndex = Math.max(
      0,
      Math.min(speeds.length - 1, currentIndex + delta)
    );
    this.timeScale = speeds[newIndex];
    this.uiManager.showNotification(`Speed: ${this.timeScale}x`);
  }

  private handleZoom(_delta: number): void {
    this.zoomLevel = this.zoomLevel === "close" ? "far" : "close";
    this.babylonEngine.setZoomLevel(this.zoomLevel);
  }

  private handleEditorToggle(): void {
    this.terrainEditorSystem?.toggle();
  }

  private handleEditorToolSelect(tool: EditorTool): void {
    this.terrainEditorSystem?.setTool(tool);
  }

  private handleEditorToolNumber(toolNumber: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const tools: EditorTool[] = ["raise", "lower", "flatten", "smooth"];
    if (toolNumber >= 1 && toolNumber <= tools.length) {
      this.terrainEditorSystem.setTool(tools[toolNumber - 1]);
    }
  }

  private handleEditorBrushSelect(brush: string): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    if (brush.startsWith("terrain_")) {
      this.terrainEditorSystem.setTool(brush as EditorTool);
    }
  }

  private handleEditorBrushSize(delta: number): void {
    this.terrainEditorSystem?.changeBrushSize(delta);
  }

  private handleEditorUndo(): void {
    this.terrainEditorSystem?.undo();
  }

  private handleEditorRedo(): void {
    this.terrainEditorSystem?.redo();
  }

  private handleEditorExport(): void {
    if (!this.terrainEditorSystem) return;

    const json = this.terrainEditorSystem.exportToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "terrain_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.uiManager.showNotification("Terrain exported!");
  }

  private handleMouseMove(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleMouseMove(gridPos.x, gridPos.y);

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

  private handleDragStart(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleDragStart(gridPos.x, gridPos.y);
    }
  }

  private handleDrag(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleDrag(gridPos.x, gridPos.y);
    }
  }

  private handleDragEnd(): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;
    this.terrainEditorSystem.handleDragEnd();
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
    console.log("Game State:", JSON.stringify(state, null, 2));
    console.log("Base64:", btoa(JSON.stringify(state)));
  }

  private setupUpdateLoop(): void {
    this.lastTime = performance.now();
    const course = COURSE_HOLE_1;

    const stats = this.grassSystem.getCourseStats();
    this.uiManager.updateCourseStatus(
      stats.health,
      stats.moisture,
      stats.nutrients
    );
    this.uiManager.updateMinimapPlayerPosition(
      this.playerX,
      this.playerY,
      course.width,
      course.height
    );
    this.uiManager.showNotification("Welcome to Greenkeeper Simulator!");

    this.babylonEngine.getScene().onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;

      if (this.isPaused) return;

      this.updateMovement(deltaMs);

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

      const mowerState = this.equipmentManager.getState("mower");
      const sprinklerState = this.equipmentManager.getState("sprinkler");
      const spreaderState = this.equipmentManager.getState("spreader");
      this.uiManager.updateResources(
        mowerState
          ? (mowerState.resourceCurrent / mowerState.resourceMax) * 100
          : 100,
        sprinklerState
          ? (sprinklerState.resourceCurrent / sprinklerState.resourceMax) * 100
          : 100,
        spreaderState
          ? (spreaderState.resourceCurrent / spreaderState.resourceMax) * 100
          : 100
      );

      const courseStats = this.grassSystem.getCourseStats();
      this.uiManager.updateCourseStatus(
        courseStats.health,
        courseStats.moisture,
        courseStats.nutrients
      );
      this.uiManager.updateScore(this.score);
      this.uiManager.updateMinimapPlayerPosition(
        this.playerX,
        this.playerY,
        course.width,
        course.height
      );
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
    this.terrainEditorSystem?.dispose();
    this.terrainEditorUI?.dispose();
    this.editorUITexture?.dispose();
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
